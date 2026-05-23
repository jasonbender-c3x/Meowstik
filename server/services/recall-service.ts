import { nanoid } from "nanoid";
import type { Attachment, ConversationSummaryRecord } from "@shared/schema";
import { GUEST_USER_ID } from "@shared/schema";
import { rawDb } from "../db";

const MAX_DOCUMENT_CHARS = 24_000;
const DEFAULT_CHUNK_SIZE = 700;
const DEFAULT_CHUNK_OVERLAP = 120;
const MAX_QUERY_TERMS = 12;
const MAX_RESULTS = 6;
const MAX_SECTION_CHARS = 1_800;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "being",
  "could",
  "from",
  "have",
  "into",
  "just",
  "like",
  "make",
  "more",
  "need",
  "only",
  "that",
  "the",
  "them",
  "then",
  "they",
  "this",
  "those",
  "want",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

const TEXT_ATTACHMENT_MIME_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/x-sh",
  "application/x-httpd-php",
  "application/sql",
]);

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

type RecallSourceType = "message" | "attachment" | "summary";

interface RecallDocumentInput {
  userId?: string | null;
  chatId?: string | null;
  sourceType: RecallSourceType;
  sourceId: string;
  title?: string | null;
  role?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface RecallResult {
  sourceType: RecallSourceType;
  sourceId: string;
  chatId: string | null;
  title: string | null;
  excerpt: string;
  score: number;
}

interface RecallSearchRow {
  chunk_id: string;
  user_id: string;
  chat_id: string | null;
  source_type: RecallSourceType;
  source_id: string;
  source_key: string;
  title: string | null;
  content: string;
  created_at: number;
  rank: number;
}

function normalizeUserId(userId?: string | null): string {
  return userId?.trim() || GUEST_USER_ID;
}

function normalizeRecallContent(content: string): string {
  return content
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_DOCUMENT_CHARS);
}

function splitLongSegment(segment: string, maxChars: number, overlap: number): string[] {
  const normalized = segment.trim();
  if (!normalized) {
    return [];
  }
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const pieces: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(maxChars * 0.6)) {
        end = boundary;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) {
      pieces.push(piece);
    }
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return pieces;
}

export function chunkRecallContent(
  content: string,
  options: { maxChars?: number; overlap?: number } = {},
): string[] {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const normalized = normalizeRecallContent(content);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    chunks.push(...splitLongSegment(paragraph, maxChars, overlap));
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

export function buildRecallMatchQuery(text: string, maxTerms: number = MAX_QUERY_TERMS): string {
  const terms = (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
    .filter((term) => !STOP_WORDS.has(term))
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, maxTerms)
    .map((term) => `"${term.replace(/"/g, '""')}"`);

  return terms.join(" OR ");
}

function createExcerpt(content: string, terms: string[]): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 260) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  const matchIndex = terms
    .map((term) => lower.indexOf(term))
    .find((index) => index >= 0);

  if (matchIndex == null || matchIndex < 0) {
    return `${normalized.slice(0, 257)}...`;
  }

  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(normalized.length, matchIndex + 160);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}

function formatSourceLabel(result: RecallResult): string {
  switch (result.sourceType) {
    case "attachment":
      return result.title ? `Attachment: ${result.title}` : "Attachment";
    case "summary":
      return result.title ? `Conversation summary: ${result.title}` : "Conversation summary";
    case "message":
    default:
      return result.title ?? "Earlier message";
  }
}

export function formatRelevantRecallSection(
  results: RecallResult[],
  maxChars: number = MAX_SECTION_CHARS,
): string {
  if (results.length === 0) {
    return "";
  }

  const lines = [
    "# Relevant Recall",
    "Use only the most relevant items below when they materially help answer the current turn.",
  ];

  let totalChars = lines.join("\n").length;
  for (const result of results) {
    const line = `- **${formatSourceLabel(result)}**: ${result.excerpt}`;
    if (totalChars + line.length > maxChars) {
      break;
    }
    lines.push(line);
    totalChars += line.length;
  }

  return lines.length > 2 ? lines.join("\n") : "";
}

function attachmentExtension(filename: string | null | undefined): string {
  if (!filename || !filename.includes(".")) {
    return "";
  }
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

export function isSearchableTextAttachment(attachment: Pick<Attachment, "filename" | "mimeType" | "content">): boolean {
  const content = attachment.content?.trim();
  if (!content) {
    return false;
  }

  if (attachment.mimeType?.startsWith("text/")) {
    return true;
  }

  if (attachment.mimeType && TEXT_ATTACHMENT_MIME_TYPES.has(attachment.mimeType)) {
    return true;
  }

  return TEXT_ATTACHMENT_EXTENSIONS.has(attachmentExtension(attachment.filename));
}

function buildQueryText(textContent: string, attachments: Attachment[]): string {
  const parts = [textContent.trim()];
  for (const attachment of attachments) {
    if (!isSearchableTextAttachment(attachment)) {
      continue;
    }
    parts.push(attachment.filename ?? "");
    parts.push(attachment.content?.slice(0, 400) ?? "");
  }
  return parts.filter(Boolean).join("\n");
}

class RecallService {
  private initialized = false;

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS recall_documents (
        id TEXT PRIMARY KEY NOT NULL,
        source_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT,
        role TEXT,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE INDEX IF NOT EXISTS recall_documents_source_key_idx
        ON recall_documents (source_key);
      CREATE INDEX IF NOT EXISTS recall_documents_user_chat_idx
        ON recall_documents (user_id, chat_id);
      CREATE INDEX IF NOT EXISTS recall_documents_source_idx
        ON recall_documents (source_type, source_id);

      CREATE TABLE IF NOT EXISTS recall_chunks (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES recall_documents(id) ON DELETE CASCADE,
        source_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE INDEX IF NOT EXISTS recall_chunks_document_idx
        ON recall_chunks (document_id);
      CREATE INDEX IF NOT EXISTS recall_chunks_source_key_idx
        ON recall_chunks (source_key);
      CREATE INDEX IF NOT EXISTS recall_chunks_user_chat_idx
        ON recall_chunks (user_id, chat_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS recall_chunks_fts USING fts5(
        content,
        chunk_id UNINDEXED,
        document_id UNINDEXED,
        user_id UNINDEXED,
        chat_id UNINDEXED,
        source_type UNINDEXED,
        source_id UNINDEXED,
        source_key UNINDEXED,
        title UNINDEXED,
        created_at UNINDEXED,
        tokenize = 'porter unicode61'
      );
    `);

    this.initialized = true;
  }

  private upsertDocument(input: RecallDocumentInput): void {
    this.ensureInitialized();

    const content = normalizeRecallContent(input.content);
    if (!content) {
      return;
    }

    const userId = normalizeUserId(input.userId);
    const sourceKey = `${input.sourceType}:${input.sourceId}`;
    const now = input.createdAt ?? Date.now();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    const existing = rawDb
      .prepare("SELECT id FROM recall_documents WHERE source_key = ? LIMIT 1")
      .get(sourceKey) as { id: string } | undefined;

    const documentId = existing?.id ?? nanoid();

    if (existing) {
      rawDb.prepare("DELETE FROM recall_chunks WHERE document_id = ?").run(documentId);
      rawDb.prepare("DELETE FROM recall_chunks_fts WHERE source_key = ?").run(sourceKey);
      rawDb
        .prepare(`
          UPDATE recall_documents
          SET user_id = ?, chat_id = ?, source_type = ?, source_id = ?, title = ?, role = ?, content = ?, metadata = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          userId,
          input.chatId ?? null,
          input.sourceType,
          input.sourceId,
          input.title ?? null,
          input.role ?? null,
          content,
          metadataJson,
          now,
          documentId,
        );
    } else {
      rawDb
        .prepare(`
          INSERT INTO recall_documents (
            id, source_key, user_id, chat_id, source_type, source_id, title, role, content, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          documentId,
          sourceKey,
          userId,
          input.chatId ?? null,
          input.sourceType,
          input.sourceId,
          input.title ?? null,
          input.role ?? null,
          content,
          metadataJson,
          now,
          now,
        );
    }

    const chunks = chunkRecallContent(content);
    const insertChunk = rawDb.prepare(`
      INSERT INTO recall_chunks (
        id, document_id, source_key, user_id, chat_id, source_type, source_id, chunk_index, content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFts = rawDb.prepare(`
      INSERT INTO recall_chunks_fts (
        content, chunk_id, document_id, user_id, chat_id, source_type, source_id, source_key, title, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    chunks.forEach((chunk, chunkIndex) => {
      const chunkId = nanoid();
      insertChunk.run(
        chunkId,
        documentId,
        sourceKey,
        userId,
        input.chatId ?? null,
        input.sourceType,
        input.sourceId,
        chunkIndex,
        chunk,
        now,
      );
      insertFts.run(
        chunk,
        chunkId,
        documentId,
        userId,
        input.chatId ?? null,
        input.sourceType,
        input.sourceId,
        sourceKey,
        input.title ?? null,
        now,
      );
    });
  }

  async ingestMessage(options: {
    userId?: string | null;
    chatId: string;
    messageId: string;
    role: "user" | "ai";
    content: string;
  }): Promise<void> {
    this.upsertDocument({
      userId: options.userId,
      chatId: options.chatId,
      sourceType: "message",
      sourceId: options.messageId,
      title: options.role === "user" ? "Earlier user message" : "Earlier assistant response",
      role: options.role,
      content: options.content,
    });
  }

  async ingestAttachment(options: {
    userId?: string | null;
    chatId: string;
    attachment: Attachment;
  }): Promise<void> {
    if (!isSearchableTextAttachment(options.attachment)) {
      return;
    }

    this.upsertDocument({
      userId: options.userId,
      chatId: options.chatId,
      sourceType: "attachment",
      sourceId: options.attachment.id,
      title: options.attachment.filename,
      content: options.attachment.content ?? "",
      metadata: {
        filename: options.attachment.filename,
        mimeType: options.attachment.mimeType,
      },
      createdAt: options.attachment.createdAt?.valueOf(),
    });
  }

  async ingestConversationSummary(summary: ConversationSummaryRecord): Promise<void> {
    if (!summary.chatId) {
      return;
    }

    const chat = rawDb
      .prepare("SELECT title, user_id, is_guest FROM chats WHERE id = ? LIMIT 1")
      .get(summary.chatId) as { title: string | null; user_id: string | null; is_guest: number } | undefined;

    const title = chat?.title ?? "Chat";
    const keyTopics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];
    const content = [
      summary.summary,
      keyTopics.length > 0 ? `Key topics: ${keyTopics.join(", ")}` : "",
      summary.sentiment ? `Sentiment: ${summary.sentiment}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    this.upsertDocument({
      userId: chat?.user_id ?? GUEST_USER_ID,
      chatId: summary.chatId,
      sourceType: "summary",
      sourceId: summary.id,
      title,
      content,
      metadata: {
        keyTopics,
        sentiment: summary.sentiment,
        modelUsed: summary.modelUsed,
      },
      createdAt: summary.createdAt?.valueOf(),
    });
  }

  private queryRecallRows(
    matchQuery: string,
    userId: string,
    chatId: string | null,
    limit: number,
    sameChatOnly: boolean,
  ): RecallSearchRow[] {
    if (!matchQuery || limit <= 0) {
      return [];
    }

    const statement = sameChatOnly && chatId
      ? rawDb.prepare(`
          SELECT chunk_id, user_id, chat_id, source_type, source_id, source_key, title, content, created_at, bm25(recall_chunks_fts) AS rank
          FROM recall_chunks_fts
          WHERE recall_chunks_fts MATCH ? AND user_id = ? AND chat_id = ?
          ORDER BY rank, created_at DESC
          LIMIT ?
        `)
      : chatId
        ? rawDb.prepare(`
            SELECT chunk_id, user_id, chat_id, source_type, source_id, source_key, title, content, created_at, bm25(recall_chunks_fts) AS rank
            FROM recall_chunks_fts
            WHERE recall_chunks_fts MATCH ? AND user_id = ? AND (chat_id IS NULL OR chat_id != ?)
            ORDER BY rank, created_at DESC
            LIMIT ?
          `)
        : rawDb.prepare(`
            SELECT chunk_id, user_id, chat_id, source_type, source_id, source_key, title, content, created_at, bm25(recall_chunks_fts) AS rank
            FROM recall_chunks_fts
            WHERE recall_chunks_fts MATCH ? AND user_id = ?
            ORDER BY rank, created_at DESC
            LIMIT ?
          `);

    if (sameChatOnly && chatId) {
      return statement.all(matchQuery, userId, chatId, limit) as RecallSearchRow[];
    }
    if (chatId) {
      return statement.all(matchQuery, userId, chatId, limit) as RecallSearchRow[];
    }
    return statement.all(matchQuery, userId, limit) as RecallSearchRow[];
  }

  async findRelevantRecall(options: {
    userId?: string | null;
    chatId?: string | null;
    textContent: string;
    attachments?: Attachment[];
    limit?: number;
  }): Promise<RecallResult[]> {
    this.ensureInitialized();

    const userId = normalizeUserId(options.userId);
    const queryText = buildQueryText(options.textContent, options.attachments ?? []);
    const matchQuery = buildRecallMatchQuery(queryText);
    if (!matchQuery) {
      return [];
    }

    const limit = options.limit ?? MAX_RESULTS;
    const terms = (queryText.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).slice(0, MAX_QUERY_TERMS);
    const deduped = new Map<string, RecallResult>();

    const sameChatRows = options.chatId
      ? this.queryRecallRows(matchQuery, userId, options.chatId, limit, true)
      : [];
    const broaderRows = this.queryRecallRows(
      matchQuery,
      userId,
      options.chatId ?? null,
      Math.max(limit - sameChatRows.length, 0),
      false,
    );

    for (const row of [...sameChatRows, ...broaderRows]) {
      if (deduped.has(row.source_key)) {
        continue;
      }
      deduped.set(row.source_key, {
        sourceType: row.source_type,
        sourceId: row.source_id,
        chatId: row.chat_id,
        title: row.title,
        excerpt: createExcerpt(row.content, terms),
        score: Number(row.rank ?? 0),
      });
      if (deduped.size >= limit) {
        break;
      }
    }

    return [...deduped.values()];
  }

  async buildRelevantRecallSection(options: {
    userId?: string | null;
    chatId?: string | null;
    textContent: string;
    attachments?: Attachment[];
  }): Promise<string> {
    const results = await this.findRelevantRecall(options);
    return formatRelevantRecallSection(results);
  }
}

export const recallService = new RecallService();
