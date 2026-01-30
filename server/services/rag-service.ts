/**
 * =============================================================================
 * MEOWSTIK - RAG SERVICE
 * =============================================================================
 * 
 * Retrieval Augmented Generation service that:
 * 1. Ingests documents (chunk + embed + store)
 * 2. Retrieves relevant chunks for queries
 * 3. Augments prompts with retrieved context
 * 
 * PIPELINE:
 * ---------
 * Upload → Chunk → Embed → Store
 * Query → Embed → Search → Retrieve → Augment Prompt
 * =============================================================================
 */

import { storage } from "../storage";
import { chunkingService, type ChunkingOptions } from "./chunking-service";
import { embeddingService } from "./embedding-service";
import { getVectorStore, type VectorStoreAdapter, type VectorDocument } from "./vector-store";
import { ragDebugBuffer } from "./rag-debug-buffer";
import { hybridSearchService } from "./hybrid-search";
import { rerankerService } from "./reranker";
import { contextSynthesisService } from "./context-synthesis";
import type { DocumentChunk, Attachment } from "@shared/schema";
import { GUEST_USER_ID } from "@shared/schema";

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

export interface RetrievalResult {
  chunks: DocumentChunk[];
  scores: number[];
}

export interface RAGContext {
  relevantChunks: string[];
  sources: { documentId: string; filename: string; chunkIndex: number }[];
}

export class RAGService {
  private vectorStore: VectorStoreAdapter | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the vector store adapter (lazy initialization)
   * This is called automatically on first use.
   */
  private async ensureInitialized(): Promise<VectorStoreAdapter> {
    if (this.vectorStore) {
      return this.vectorStore;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.vectorStore = await getVectorStore();
          console.log(`[RAG] Vector store initialized: ${this.vectorStore.name}`);
        } catch (error) {
          console.error("[RAG] Failed to initialize vector store:", error);
          throw error;
        }
      })();
    }

    await this.initPromise;
    return this.vectorStore!;
  }

  /**
   * Ingest a document: chunk, embed, and store
   * 
   * @param userId - User ID for data isolation (null for guest users)
   */
  async ingestDocument(
    content: string,
    attachmentId: string | null,
    filename: string,
    mimeType?: string,
    options?: ChunkingOptions,
    userId?: string | null // Add userId parameter for data isolation
  ): Promise<IngestResult> {
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const traceId = ragDebugBuffer.generateTraceId();
    const startTime = Date.now();

    // Log ingestion start
    ragDebugBuffer.logIngestStart(traceId, documentId, filename, content.length, "document");

    try {
      const extractedText = chunkingService.extractText(content, mimeType);

      const chunkStartTime = Date.now();
      const chunks = await chunkingService.chunkDocument(
        extractedText,
        documentId,
        filename,
        mimeType,
        options
      );
      const chunkDuration = Date.now() - chunkStartTime;

      // Log chunking result
      ragDebugBuffer.logChunk(
        traceId, 
        documentId, 
        chunks.length, 
        0, // chunksFiltered - we can't know this easily here
        options?.strategy || "paragraph",
        chunkDuration
      );

      if (chunks.length === 0) {
        ragDebugBuffer.logIngestFiltered(traceId, documentId, "No chunks generated from document");
        return {
          documentId,
          chunksCreated: 0,
          success: false,
          error: "No chunks generated from document",
        };
      }

      const embedStartTime = Date.now();
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);
      const embedDuration = Date.now() - embedStartTime;

      // Log embedding
      ragDebugBuffer.logEmbed(traceId, documentId, chunks.length, embedDuration);

      // Initialize vector store for semantic search
      const vectorStore = await this.ensureInitialized();

      // Prepare vector documents for batch upsert
      const vectorDocs: VectorDocument[] = [];

      const storeStartTime = Date.now();
      for (let i = 0; i < chunks.length; i++) {
        // Enhance metadata with userId for data isolation
        const enhancedMetadata = {
          ...chunks[i].metadata,
          userId: userId || GUEST_USER_ID,
          isVerified: !!userId,
          source: "document",
        };

        // Store in PostgreSQL for persistence
        const savedChunk = await storage.createDocumentChunk({
          documentId,
          attachmentId,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: enhancedMetadata,
        });

        // Prepare for vector store (semantic search)
        vectorDocs.push({
          id: savedChunk.id.toString(),
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: {
            ...enhancedMetadata,
            documentId,
            attachmentId,
            chunkIndex: chunks[i].metadata.chunkIndex,
          },
        });
      }

      // Batch upsert to vector store for efficient semantic search
      if (vectorDocs.length > 0) {
        await vectorStore.upsertBatch(vectorDocs);
        console.log(`[RAG] Upserted ${vectorDocs.length} chunks to vector store`);
      }
      const storeDuration = Date.now() - storeStartTime;

      // Log store complete
      ragDebugBuffer.logStore(traceId, documentId, chunks.length, storeDuration);

      const totalDuration = Date.now() - startTime;
      ragDebugBuffer.logIngestComplete(traceId, documentId, chunks.length, totalDuration);

      console.log(`Ingested document ${filename}: ${chunks.length} chunks created`);

      return {
        documentId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      console.error("Document ingestion error:", error);
      ragDebugBuffer.logError(traceId, "ingest_start", error instanceof Error ? error.message : "Unknown error");
      return {
        documentId,
        chunksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Retrieve relevant chunks for a query using the vector store
   * 
   * TEACHING NOTES:
   * ---------------
   * This method now uses the modular vector store for efficient semantic search.
   * The vector store uses optimized algorithms (IVFFlat, HNSW, etc.) instead
   * of brute-force comparison of all chunks.
   * 
   * DATA ISOLATION:
   * ---------------
   * If userId is provided, only chunks belonging to that user will be retrieved.
   * Guest users (userId = null) only retrieve from the guest bucket.
   * This ensures proper data segregation and privacy.
   */
  async retrieve(
    query: string,
    topK: number = 20,      // Increased from 5 for better recall
    threshold: number = 0.25,  // Lowered from 0.5 for better recall
    userId?: string | null  // New parameter for data isolation
  ): Promise<RetrievalResult> {
    const traceId = ragDebugBuffer.generateTraceId();
    const startTime = Date.now();

    // Log query start
    ragDebugBuffer.logQueryStart(traceId, query);

    try {
      // Get embedding for the query
      const embedStartTime = Date.now();
      const queryEmbedding = await embeddingService.embed(query);
      const embedDuration = Date.now() - embedStartTime;
      ragDebugBuffer.logQueryEmbed(traceId, query, embedDuration);

      // Use vector store for efficient similarity search
      const vectorStore = await this.ensureInitialized();
      
      // Build metadata filter for data isolation
      const filter: Record<string, unknown> = {};
      if (userId !== undefined) {
        // Filter by exact userId (authenticated user or guest)
        filter.userId = userId || GUEST_USER_ID;
      }
      
      const searchStartTime = Date.now();
      const searchResults = await vectorStore.search(queryEmbedding.embedding, {
        topK,
        threshold,
        filter, // Apply userId filter for data isolation
      });
      const searchDuration = Date.now() - searchStartTime;

      // Log search results
      const searchScores = searchResults.map(r => r.score);
      ragDebugBuffer.logSearch(traceId, query, searchResults.length, threshold, topK, searchScores, searchDuration);

      // If vector store returns no results, try legacy fallback with same filter
      if (searchResults.length === 0) {
        console.log("[RAG] Vector store returned no results, trying legacy fallback");
        return this.retrieveLegacy(query, topK, threshold, userId);
      }

      // Fetch full chunk data from PostgreSQL using the IDs from vector store
      const chunks: DocumentChunk[] = [];
      const scores: number[] = [];

      // Cache the chunk list to avoid fetching multiple times
      const chunkList = await storage.getAllDocumentChunks();
      
      const retrieveStartTime = Date.now();
      for (const result of searchResults) {
        // Try to fetch full chunk from storage using document.id
        const chunkIdStr = result.document.id;
        const chunk = chunkList.find(c => String(c.id) === chunkIdStr);
        if (chunk) {
          chunks.push(chunk);
          scores.push(result.score);
        }
      }
      const retrieveDuration = Date.now() - retrieveStartTime;

      // Log retrieve
      const chunkIds = chunks.map(c => String(c.id));
      const chunkPreviews = chunks.map(c => c.content.slice(0, 100));
      ragDebugBuffer.logRetrieve(traceId, query, chunkIds, chunkPreviews, retrieveDuration);

      // Log query complete
      const totalDuration = Date.now() - startTime;
      ragDebugBuffer.logQueryComplete(traceId, query, chunks.length, 0, totalDuration);

      return { chunks, scores };
    } catch (error) {
      console.error("Retrieval error:", error);
      ragDebugBuffer.logError(traceId, "query_start", error instanceof Error ? error.message : "Unknown error");
      // Fallback to legacy method if vector store fails (with userId filter)
      return this.retrieveLegacy(query, topK, threshold, userId);
    }
  }

  /**
   * Legacy retrieval method (loads all chunks - less efficient)
   * Used as fallback if vector store is unavailable
   * 
   * DATA ISOLATION:
   * ---------------
   * Filters chunks by userId if provided for data segregation.
   */
  private async retrieveLegacy(
    query: string,
    topK: number = 5,
    threshold: number = 0.5,
    userId?: string | null
  ): Promise<RetrievalResult> {
    try {
      const queryEmbedding = await embeddingService.embed(query);

      let allChunks = await storage.getAllDocumentChunks();
      
      // Apply userId filter for data isolation
      if (userId !== undefined) {
        const targetUserId = userId || GUEST_USER_ID;
        allChunks = allChunks.filter((chunk) => {
          const metadata = chunk.metadata as { userId?: string } | null;
          return metadata?.userId === targetUserId;
        });
      }

      if (allChunks.length === 0) {
        return { chunks: [], scores: [] };
      }

      const candidates = allChunks
        .filter((c) => {
          if (!c.embedding) return false;
          if (Array.isArray(c.embedding)) return true;
          if (typeof c.embedding === 'object' && 'values' in c.embedding && Array.isArray((c.embedding as any).values)) return true;
          return false;
        })
        .map((c) => {
          let embedding: number[];
          if (Array.isArray(c.embedding)) {
            embedding = c.embedding as number[];
          } else {
            embedding = (c.embedding as any).values;
          }
          return { id: c.id, embedding };
        });

      const similar = embeddingService.findSimilar(
        queryEmbedding.embedding,
        candidates,
        topK,
        threshold
      );

      const chunks: DocumentChunk[] = [];
      const scores: number[] = [];

      for (const match of similar) {
        const chunk = allChunks.find((c) => c.id === match.id);
        if (chunk) {
          chunks.push(chunk);
          scores.push(match.score);
        }
      }

      return { chunks, scores };
    } catch (error) {
      console.error("Legacy retrieval error:", error);
      return { chunks: [], scores: [] };
    }
  }

  /**
   * Advanced retrieval using Cognitive Architecture 2.0
   * Combines hybrid search, re-ranking, and context synthesis
   * 
   * @param query - User query
   * @param userId - User ID for data isolation
   * @param options - Advanced retrieval options
   */
  async retrieveAdvanced(
    query: string,
    userId?: string | null,
    options: {
      topK?: number;
      useHybridSearch?: boolean;
      useReranking?: boolean;
      useContextSynthesis?: boolean;
      maxTokens?: number;
    } = {}
  ): Promise<{
    chunks: DocumentChunk[];
    scores: number[];
    synthesizedContext?: string;
    tokenCount?: number;
  }> {
    const {
      topK = 20,
      useHybridSearch = true,
      useReranking = true,
      useContextSynthesis = true,
      maxTokens = 4000,
    } = options;

    const traceId = ragDebugBuffer.generateTraceId();
    ragDebugBuffer.logQueryStart(traceId, query);

    try {
      // Step 1: Initial semantic retrieval
      const { chunks: semanticChunks, scores: semanticScores } = await this.retrieve(
        query,
        topK * 2, // Get more candidates for hybrid search
        0.2, // Lower threshold for better recall
        userId
      );

      let finalChunks = semanticChunks;
      let finalScores = semanticScores;

      // Step 2: Hybrid search (semantic + keyword)
      if (useHybridSearch && semanticChunks.length > 0) {
        // For hybrid search, we need a corpus for BM25 scoring.
        // Note: For very large datasets (>10k chunks), consider implementing
        // a database-level keyword search instead of loading all chunks.
        const allChunks = await storage.getAllDocumentChunks();
        
        // Filter by userId if provided
        let userFilteredChunks = allChunks;
        if (userId !== undefined) {
          const targetUserId = userId || GUEST_USER_ID;
          userFilteredChunks = allChunks.filter(c => {
            const meta = c.metadata as { userId?: string } | null;
            return (meta?.userId || GUEST_USER_ID) === targetUserId;
          });
        }

        const hybridResults = hybridSearchService.search(
          query,
          semanticChunks.map((chunk, i) => ({ chunk, score: semanticScores[i] })),
          userFilteredChunks,
          { topK, semanticWeight: 0.7, keywordWeight: 0.3 }
        );

        finalChunks = hybridResults.map(r => r.chunk);
        finalScores = hybridResults.map(r => r.fusedScore);

        console.log(`[RAG Advanced] Hybrid search: ${hybridResults.length} results`);
      }

      // Step 3: Re-ranking
      if (useReranking && finalChunks.length > 0) {
        const reranked = await rerankerService.rerank(
          query,
          finalChunks.map((chunk, i) => ({ chunk, score: finalScores[i] })),
          { strategy: "hybrid", topK: Math.min(topK, finalChunks.length) }
        );

        finalChunks = reranked.map(r => r.chunk);
        finalScores = reranked.map(r => r.rerankedScore);

        console.log(`[RAG Advanced] Re-ranking: ${reranked.length} results`);
      }

      // Step 4: Context synthesis
      let synthesizedContext: string | undefined;
      let tokenCount: number | undefined;

      if (useContextSynthesis && finalChunks.length > 0) {
        const synthesis = await contextSynthesisService.synthesize(
          query,
          finalChunks.map((chunk, i) => ({ chunk, relevance: finalScores[i] })),
          { maxTokens, strategy: "hybrid", deduplicate: true }
        );

        synthesizedContext = synthesis.content;
        tokenCount = synthesis.tokenCount;

        console.log(
          `[RAG Advanced] Context synthesis: ${synthesis.sourceChunkCount} → ${synthesis.synthesizedChunkCount} chunks, ` +
          `${tokenCount} tokens (${(synthesis.compressionRatio * 100).toFixed(1)}% compression)`
        );
      }

      const totalDuration = Date.now();
      ragDebugBuffer.logQueryComplete(traceId, query, finalChunks.length, 0, totalDuration);

      return {
        chunks: finalChunks,
        scores: finalScores,
        synthesizedContext,
        tokenCount,
      };
    } catch (error) {
      console.error("[RAG Advanced] Retrieval error:", error);
      ragDebugBuffer.logError(traceId, "query_start", error instanceof Error ? error.message : "Unknown error");
      // Fallback to basic retrieval
      return this.retrieve(query, topK, 0.25, userId);
    }
  }

  /**
   * Build RAG context from retrieved chunks
   */
  async buildContext(query: string, topK: number = 5, userId?: string | null): Promise<RAGContext> {
    const { chunks, scores } = await this.retrieve(query, topK, 0.25, userId);

    const relevantChunks = chunks.map((c, i) => {
      const meta = c.metadata as { filename?: string } | null;
      const filename = meta?.filename || "unknown";
      return `[Source: ${filename}, Score: ${scores[i].toFixed(2)}]\n${c.content}`;
    });

    const sources = chunks.map((c) => {
      const meta = c.metadata as { filename?: string } | null;
      return {
        documentId: c.documentId,
        filename: meta?.filename || "unknown",
        chunkIndex: c.chunkIndex,
      };
    });

    return { relevantChunks, sources };
  }

  /**
   * Build advanced RAG context using Cognitive Architecture 2.0
   */
  async buildContextAdvanced(
    query: string,
    topK: number = 10,
    userId?: string | null,
    maxTokens: number = 4000
  ): Promise<RAGContext & { synthesizedContext?: string; tokenCount?: number }> {
    const result = await this.retrieveAdvanced(query, userId, {
      topK,
      useHybridSearch: true,
      useReranking: true,
      useContextSynthesis: true,
      maxTokens,
    });

    const relevantChunks = result.chunks.map((c, i) => {
      const meta = c.metadata as { filename?: string } | null;
      const filename = meta?.filename || "unknown";
      return `[Source: ${filename}, Score: ${result.scores[i].toFixed(2)}]\n${c.content}`;
    });

    const sources = result.chunks.map((c) => {
      const meta = c.metadata as { filename?: string } | null;
      return {
        documentId: c.documentId,
        filename: meta?.filename || "unknown",
        chunkIndex: c.chunkIndex,
      };
    });

    return {
      relevantChunks,
      sources,
      synthesizedContext: result.synthesizedContext,
      tokenCount: result.tokenCount,
    };
  }

  /**
   * Format RAG context as a string for prompt augmentation
   */
  formatContextForPrompt(context: RAGContext): string {
    if (context.relevantChunks.length === 0) {
      return "";
    }

    return `
## Retrieved Document Context

The following excerpts from uploaded documents may be relevant to this query:

${context.relevantChunks.join("\n\n---\n\n")}

Use this context to provide accurate, grounded responses. Cite sources when appropriate.
`;
  }

  /**
   * Process attachment for RAG ingestion
   */
  async processAttachment(attachment: Attachment): Promise<IngestResult | null> {
    if (!attachment.content) {
      return null;
    }

    if (attachment.type !== "file") {
      return null;
    }

    const mimeType = attachment.mimeType || "";

    // Handle PDF files - extract text from base64 content
    if (mimeType === "application/pdf") {
      try {
        console.log(`Processing PDF file: ${attachment.filename}`);
        const extractedText = await chunkingService.extractPdfText(attachment.content);
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.log(`No text extracted from PDF: ${attachment.filename}`);
          return null;
        }

        return this.ingestDocument(
          extractedText,
          attachment.id,
          attachment.filename,
          mimeType
        );
      } catch (error) {
        console.error(`Failed to process PDF ${attachment.filename}:`, error);
        return {
          documentId: `doc-${Date.now()}`,
          chunksCreated: 0,
          success: false,
          error: error instanceof Error ? error.message : "PDF extraction failed",
        };
      }
    }

    // Check if mime type supports text extraction
    if (!chunkingService.supportsTextExtraction(mimeType)) {
      console.log(`Skipping unsupported file type: ${attachment.filename} (${mimeType})`);
      return null;
    }

    return this.ingestDocument(
      attachment.content,
      attachment.id,
      attachment.filename,
      mimeType || undefined
    );
  }

  /**
   * Ingest a conversation message for RAG recall
   * This allows the AI to remember important facts from earlier in conversations
   * 
   * @param userId - Optional user ID for authenticated users. Guest messages use GUEST_USER_ID bucket.
   */
  async ingestMessage(
    content: string,
    chatId: string,
    messageId: string,
    role: "user" | "ai",
    timestamp?: Date,
    userId?: string | null
  ): Promise<IngestResult | null> {
    // Skip very short messages (less than 20 chars) - not worth indexing
    if (!content || content.trim().length < 20) {
      return null;
    }

    // Skip messages that are just greetings or acknowledgments
    const trivialPatterns = /^(hi|hello|hey|thanks|ok|okay|yes|no|sure|got it|understood)[\s.!?]*$/i;
    if (trivialPatterns.test(content.trim())) {
      return null;
    }

    const documentId = `msg-${chatId}-${messageId}`;
    const filename = `conversation-${role}-${messageId}`;

    try {
      // Use sentence-based chunking for conversation messages
      const chunks = await chunkingService.chunkDocument(
        content,
        documentId,
        filename,
        "text/plain",
        { strategy: "sentence", maxChunkSize: 500, overlap: 50 }
      );

      if (chunks.length === 0) {
        return null;
      }

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      // Initialize vector store for semantic search
      const vectorStore = await this.ensureInitialized();

      // Prepare vector documents for batch upsert
      const vectorDocs: VectorDocument[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkMetadata = {
          ...chunks[i].metadata,
          chatId,
          messageId,
          role,
          timestamp: timestamp?.toISOString() || new Date().toISOString(),
          type: "conversation",
          userId: userId || GUEST_USER_ID,
          isVerified: !!userId,
          source: "conversation",
        };

        // Store in PostgreSQL for persistence
        // Note: attachmentId is null for message-based chunks (not from file attachments)
        const savedChunk = await storage.createDocumentChunk({
          documentId,
          attachmentId: null,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunkMetadata,
        });

        // Prepare for vector store (semantic search)
        vectorDocs.push({
          id: savedChunk.id.toString(),
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunkMetadata,
        });
      }

      // Batch upsert to vector store for efficient semantic search
      if (vectorDocs.length > 0) {
        await vectorStore.upsertBatch(vectorDocs);
      }

      console.log(`[RAG] Ingested ${role} message ${messageId}: ${chunks.length} chunks (vector store: ${vectorStore.name})`);

      return {
        documentId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      console.error(`[RAG] Message ingestion error for ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Build conversation context by retrieving relevant past messages
   * 
   * @param userId - Optional user ID. If provided, only retrieves verified user data.
   *                 If null/undefined, retrieves only guest bucket data.
   */
  async buildConversationContext(query: string, chatId?: string, topK: number = 5, userId?: string | null): Promise<RAGContext> {
    const { chunks, scores } = await this.retrieve(query, topK * 2, 0.4, userId);

    // Pair chunks with their scores and filter to conversation chunks from the same chat
    const pairedChunks = chunks.map((chunk, index) => ({
      chunk,
      score: scores[index],
    }));

    // Filter to conversation chunks - CRITICAL: scope by userId to prevent cross-user data leakage
    const conversationPairs = pairedChunks.filter(({ chunk }) => {
      const meta = chunk.metadata as { type?: string; chatId?: string; userId?: string } | null;
      const isConversation = meta?.type === "conversation";
      const isSameChat = !chatId || meta?.chatId === chatId;
      
      // Data isolation: only return chunks belonging to the same user
      // Authenticated users only see their own verified data
      // Guests only see guest bucket data (and only from same chat)
      const chunkUserId = meta?.userId || GUEST_USER_ID;
      const requestUserId = userId || GUEST_USER_ID;
      const isSameUser = chunkUserId === requestUserId;
      
      return isConversation && isSameChat && isSameUser;
    }).slice(0, topK);

    const relevantChunks = conversationPairs.map(({ chunk, score }) => {
      const meta = chunk.metadata as { role?: string; chatId?: string; timestamp?: string } | null;
      const role = meta?.role || "unknown";
      const time = meta?.timestamp ? new Date(meta.timestamp).toLocaleDateString() : "";
      return `[Previous ${role} message${time ? ` from ${time}` : ""}, relevance: ${score.toFixed(2)}]\n${chunk.content}`;
    });

    const sources = conversationPairs.map(({ chunk }) => {
      const meta = chunk.metadata as { chatId?: string; messageId?: string } | null;
      return {
        documentId: chunk.documentId,
        filename: `message-${meta?.messageId || "unknown"}`,
        chunkIndex: chunk.chunkIndex,
      };
    });

    return { relevantChunks, sources };
  }

  /**
   * Format conversation context for prompt augmentation
   */
  formatConversationContextForPrompt(context: RAGContext): string {
    if (context.relevantChunks.length === 0) {
      return "";
    }

    return `
## Recalled Conversation History

The following excerpts from earlier in our conversations may be relevant:

${context.relevantChunks.join("\n\n---\n\n")}

Use this recalled context to maintain continuity and remember important facts the user has shared.
`;
  }
}

export const ragService = new RAGService();
