import dns from "node:dns/promises";
import { URL } from "node:url";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenAI } from "@google/genai";

const READ_TO_ME_MODEL = "gemini-2.0-flash";
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 20000;
const MAX_SUMMARY_SOURCE_CHARS = 12000;
const MIN_EXTRACTED_TEXT_CHARS = 200;

export interface ReadablePage {
  url: string;
  title: string;
  text: string;
  excerpt: string;
  wordCount: number;
}

export interface ReadToMeSummary {
  summary: string;
  keyPoints: string[];
  narrationText: string;
  estimatedMinutes: number;
}

export function normalizeReadUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function normalizeReadableText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

export function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::" || normalized === "::1") {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpAddress(normalized.slice("::ffff:".length));
  }

  if (normalized.includes(":")) {
    return (
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("fec0") ||
      normalized === "2001:db8::"
    );
  }

  const octets = normalized.split(".").map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsedUrl = new URL(normalizeReadUrl(rawUrl));

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Credentials in URLs are not supported");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("Local and internal URLs are blocked");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Could not resolve the target URL");
  }

  for (const entry of addresses) {
    if (isPrivateIpAddress(entry.address)) {
      throw new Error("Private and local network addresses are blocked");
    }
  }

  return parsedUrl;
}

async function fetchWithSafeRedirects(rawUrl: string): Promise<{ response: Response; finalUrl: URL }> {
  let nextUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safeUrl = await assertSafePublicUrl(nextUrl);
    const response = await fetch(safeUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Meowstik ReadToMe/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Target page returned an invalid redirect");
      }
      nextUrl = new URL(location, safeUrl).toString();
      continue;
    }

    return { response, finalUrl: safeUrl };
  }

  throw new Error("Too many redirects while fetching the page");
}

export function extractReadableContentFromHtml(html: string, pageUrl: string): { title: string; text: string } {
  const dom = new JSDOM(html, { url: pageUrl });

  try {
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const fallbackText = normalizeReadableText(dom.window.document.body?.textContent || "");
    const title = article?.title?.trim() || dom.window.document.title.trim() || pageUrl;
    const text = normalizeReadableText(article?.textContent || fallbackText);

    if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
      throw new Error("The page does not contain enough readable text yet");
    }

    return {
      title,
      text: text.slice(0, MAX_EXTRACTED_TEXT_CHARS),
    };
  } finally {
    dom.window.close();
  }
}

export async function fetchReadablePage(rawUrl: string): Promise<ReadablePage> {
  const { response, finalUrl } = await fetchWithSafeRedirects(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
    throw new Error("Page is too large for the first Read to Me slice");
  }

  const contentType = response.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
  const isPlainText = contentType.includes("text/plain");

  if (!isHtml && !isPlainText) {
    throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
  }

  const body = (await response.text()).slice(0, MAX_CONTENT_LENGTH);
  const extracted = isHtml
    ? extractReadableContentFromHtml(body, finalUrl.toString())
    : {
        title: finalUrl.hostname,
        text: normalizeReadableText(body).slice(0, MAX_EXTRACTED_TEXT_CHARS),
      };

  if (extracted.text.length < MIN_EXTRACTED_TEXT_CHARS) {
    throw new Error("The page does not contain enough readable text yet");
  }

  return {
    url: finalUrl.toString(),
    title: extracted.title,
    text: extracted.text,
    excerpt: extracted.text.slice(0, 1200),
    wordCount: extracted.text.split(/\s+/).filter(Boolean).length,
  };
}

export async function summarizeReadablePage(page: ReadablePage): Promise<ReadToMeSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Read to Me summaries");
  }

  const genAI = new GoogleGenAI({ apiKey });
  const prompt = `You create concise spoken summaries for a voice-first assistant.
Return JSON with exactly this structure:
{
  "summary": "2-4 short paragraphs in plain text, no markdown",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "narrationText": "A polished spoken script to read aloud in about 45-90 seconds"
}

URL: ${page.url}
Title: ${page.title}
Content:
${page.text.slice(0, MAX_SUMMARY_SOURCE_CHARS)}`;

  const result = await genAI.models.generateContent({
    model: READ_TO_ME_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const parsed = JSON.parse(result.text || "{}") as {
    summary?: string;
    keyPoints?: string[];
    narrationText?: string;
  };

  const narrationText = normalizeReadableText(parsed.narrationText || parsed.summary || "");
  const summary = normalizeReadableText(parsed.summary || narrationText);
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.map((point) => normalizeReadableText(String(point))).filter(Boolean).slice(0, 5)
    : [];

  if (!summary || !narrationText) {
    throw new Error("The summary model returned an incomplete response");
  }

  const estimatedMinutes = Math.max(1, Math.ceil(narrationText.split(/\s+/).filter(Boolean).length / 160));

  return {
    summary,
    keyPoints,
    narrationText,
    estimatedMinutes,
  };
}
