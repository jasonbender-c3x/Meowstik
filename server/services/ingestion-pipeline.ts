/**
 * INGESTION PIPELINE — REMOVED
 *
 * This file previously contained the RAG document ingestion pipeline
 * (bucket classification, chunking, embedding, storage).
 *
 * The RAG system has been replaced by the Summarization Engine:
 *   server/services/summarization-engine.ts
 *
 * The Summarization Engine uses Gemini 2.0 Flash to produce structured
 * summaries of conversations and feedback, which feed the Evolution Engine.
 * No document embeddings, vector stores, or ingestion queues are used.
 */
