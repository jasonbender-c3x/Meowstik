# File Ingest Tool - User Guide

> **Complete guide to using the `file_ingest` tool for RAG knowledge ingestion**

---

## Overview

The `file_ingest` tool allows you to store content in Meowstik's knowledge base (RAG system) for semantic search and intelligent retrieval. Unlike `file_put` which writes files to disk, `file_ingest` stores content in a vector database where it can be semantically searched and retrieved when relevant to conversations.

---

## Quick Start

### Basic Usage

```json
{
  "type": "file_ingest",
  "id": "ingest1",
  "parameters": {
    "content": "Your content here...",
    "filename": "my_notes.txt"
  }
}
```

### What Happens

1. **Chunking**: Content is split into semantically meaningful pieces
2. **Embedding**: Each chunk is converted to a 768-dimensional vector using Gemini
3. **Storage**: Vectors are stored in the database (pgvector, Vertex AI, or in-memory)
4. **Retrieval**: Content becomes searchable and retrievable in future conversations

---

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | string | The text content to ingest |
| `filename` | string | Name of the document (for identification) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mimeType` | string | `text/plain` | MIME type of the content |

### Supported MIME Types

- `text/plain` - Plain text files
- `text/markdown` - Markdown documents
- `application/json` - JSON data (will be pretty-printed)
- `text/html` - HTML content (converted to plain text)

---

## Examples

### Example 1: Ingest Plain Text Notes

```json
{
  "type": "file_ingest",
  "id": "note1",
  "parameters": {
    "content": "Meeting with team on Jan 15, 2024.\n\nKey decisions:\n- Use PostgreSQL for database\n- Deploy on Replit\n- Launch beta by Feb 1",
    "filename": "team_meeting_notes.txt"
  }
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "doc-1706198400-xyz789",
  "chunksCreated": 2,
  "filename": "team_meeting_notes.txt",
  "message": "Successfully ingested team_meeting_notes.txt into RAG system (2 chunks created)"
}
```

### Example 2: Ingest JSON Project Data

```json
{
  "type": "file_ingest",
  "id": "project1",
  "parameters": {
    "content": "{\"name\":\"Meowstik\",\"version\":\"1.0.0\",\"description\":\"AI-powered chat assistant with RAG capabilities\",\"tech_stack\":[\"Node.js\",\"TypeScript\",\"PostgreSQL\",\"React\"]}",
    "filename": "project_metadata.json",
    "mimeType": "application/json"
  }
}
```

### Example 3: Ingest Markdown Documentation

```json
{
  "type": "file_ingest",
  "id": "docs1",
  "parameters": {
    "content": "# API Documentation\n\n## Authentication\n\nUse OAuth2 for authentication.\n\n## Endpoints\n\n### POST /api/chat\n\nSend a chat message.\n\n**Parameters:**\n- `message`: The chat message\n- `chatId`: Chat session ID",
    "filename": "api_docs.md",
    "mimeType": "text/markdown"
  }
}
```

---

## Use Cases

### 1. Personal Knowledge Base

Ingest your notes, documentation, and research materials to create a searchable knowledge base.

```json
{
  "type": "file_ingest",
  "id": "kb1",
  "parameters": {
    "content": "Python tips:\n- Use list comprehensions for concise code\n- Prefer f-strings for string formatting\n- Use context managers (with) for file operations",
    "filename": "python_tips.txt"
  }
}
```

### 2. Project Context

Store project information so the AI has context about your work.

```json
{
  "type": "file_ingest",
  "id": "proj1",
  "parameters": {
    "content": "Project: E-commerce Platform\nStatus: In Development\nTeam: 5 developers\nDeadline: March 2024\nTech: React, Node.js, PostgreSQL",
    "filename": "project_overview.txt"
  }
}
```

### 3. Code Documentation

Ingest code documentation for quick reference.

```json
{
  "type": "file_ingest",
  "id": "code1",
  "parameters": {
    "content": "Function: authenticateUser(email, password)\n\nPurpose: Validates user credentials\n\nReturns: { success: boolean, token?: string, error?: string }\n\nExample:\nconst result = await authenticateUser('user@example.com', 'password123');",
    "filename": "auth_function_docs.txt"
  }
}
```

---

## Architecture

### RAG Pipeline

```
User Input (file_ingest tool)
        │
        ▼
    Chunking
  (Break into pieces)
        │
        ▼
    Embedding
  (Convert to vectors via Gemini)
        │
        ▼
    Vector Storage
  (PostgreSQL/Vertex AI/Memory)
        │
        ▼
    Ready for Retrieval
  (Semantic search in future chats)
```

### Vector Store Backends

The RAG system supports multiple vector storage backends:

| Backend | Best For | Configuration |
|---------|----------|---------------|
| **pgvector** | Production (Replit, Supabase, Neon) | Set `DATABASE_URL` |
| **Vertex AI** | Google Cloud deployments | Set `GOOGLE_CLOUD_PROJECT` |
| **Memory** | Testing, development | No configuration needed |

The system automatically detects the best backend based on available credentials.

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Required: Gemini API for embeddings
GEMINI_API_KEY=your_gemini_api_key

# Database (for pgvector backend)
DATABASE_URL=postgresql://user:password@localhost:5432/meowstik

# Optional: Explicit backend selection
VECTOR_STORE_BACKEND=pgvector  # or: vertex, memory, pinecone
VECTOR_DIMENSION=768           # Gemini embedding dimension
VECTOR_METRIC=cosine           # Distance metric
```

### Backend Auto-Detection

If `VECTOR_STORE_BACKEND` is not set, the system auto-detects:

1. If `DATABASE_URL` exists → use **pgvector**
2. If `GOOGLE_CLOUD_PROJECT` exists → use **Vertex AI**
3. Otherwise → use **memory** (for testing)

---

## Data Privacy

### User Isolation

All ingested content is isolated by user ID:

- **Authenticated users**: Content is associated with their user ID
- **Guest users**: Content is isolated in a guest session
- **Cross-user access**: Prevented - users can only retrieve their own content

### Data Flow

```
file_ingest call
     │
     ├─ Extract messageId
     │
     ├─ Look up chatId from message
     │
     ├─ Look up userId from chat
     │
     └─ Store with userId for isolation
```

---

## Troubleshooting

### Common Errors

#### Error: "file_ingest requires a content parameter"

**Cause**: Missing or invalid `content` parameter

**Solution**: Ensure `content` is a non-empty string:
```json
{
  "content": "Your content here",  // ✓ Correct
  "filename": "file.txt"
}
```

#### Error: "file_ingest requires a filename parameter"

**Cause**: Missing or invalid `filename` parameter

**Solution**: Provide a valid filename:
```json
{
  "content": "Content...",
  "filename": "my_file.txt"  // ✓ Correct
}
```

#### Error: "Failed to ingest document"

**Possible causes:**
- Vector store not configured
- Database connection issue
- Embedding service unavailable

**Solution:**
1. Check that `GEMINI_API_KEY` is set
2. Verify database connection (if using pgvector)
3. Check server logs for detailed error

---

## Chunking Strategies

The RAG system uses intelligent chunking to break content into optimal pieces:

| Strategy | Description | Best For |
|----------|-------------|----------|
| **paragraph** | Split on double newlines | Articles, documentation |
| **sentence** | Split on sentence boundaries | Conversations, Q&A |
| **fixed** | Split at fixed character count | Large uniform documents |
| **semantic** | Split on topic changes | Mixed content |

The default strategy is **paragraph**, which works well for most content.

---

## Best Practices

### 1. Use Descriptive Filenames

```json
// ✓ Good
{"filename": "python_best_practices_2024.txt"}

// ✗ Avoid
{"filename": "file1.txt"}
```

### 2. Structure Your Content

```json
// ✓ Good - Well-structured
{
  "content": "# Python Tips\n\n## Performance\n- Use generators\n- Profile code\n\n## Style\n- Follow PEP 8",
  "filename": "python_tips.md",
  "mimeType": "text/markdown"
}

// ✗ Avoid - Unstructured
{
  "content": "generators, profile, pep 8",
  "filename": "notes.txt"
}
```

### 3. Choose Appropriate MIME Types

```json
// ✓ Good - Correct MIME type
{
  "content": "# Heading\n\nContent",
  "mimeType": "text/markdown"
}

// ✗ Avoid - Misleading MIME type
{
  "content": "# Heading\n\nContent",
  "mimeType": "application/json"
}
```

### 4. Chunk Large Documents

For very large documents (>10,000 characters), consider splitting them:

```json
// Split a large document into sections
{"content": "Chapter 1: Introduction...", "filename": "book_chapter_1.txt"}
{"content": "Chapter 2: Methods...", "filename": "book_chapter_2.txt"}
{"content": "Chapter 3: Results...", "filename": "book_chapter_3.txt"}
```

---

## Comparison: file_ingest vs file_put

| Feature | `file_ingest` | `file_put` |
|---------|--------------|-----------|
| **Purpose** | Store in knowledge base | Write to filesystem |
| **Storage** | Vector database | Filesystem |
| **Searchable** | Yes (semantic search) | No |
| **Retrievable** | Auto-retrieved when relevant | Manual read required |
| **Use Case** | Building knowledge base | Creating/updating files |

### When to Use file_ingest

- Building a searchable knowledge base
- Storing reference materials
- Enabling context-aware AI responses

### When to Use file_put

- Creating source code files
- Generating configuration files
- Writing output data to disk

---

## Advanced Usage

### Combining with Retrieval

Once ingested, content is automatically retrieved when relevant:

```
User: "What are our Python coding standards?"

AI: [Automatically retrieves from ingested "python_tips.txt"]
     "Based on your notes, here are the Python standards..."
```

### Updating Content

To update ingested content, simply ingest again with the same filename:

```json
// Original
{"content": "Version 1.0 notes", "filename": "notes.txt"}

// Update (creates new chunks, old ones remain)
{"content": "Version 2.0 notes with updates", "filename": "notes.txt"}
```

### Batch Ingestion

Ingest multiple files in sequence:

```json
[
  {"type": "file_ingest", "id": "1", "parameters": {"content": "...", "filename": "file1.txt"}},
  {"type": "file_ingest", "id": "2", "parameters": {"content": "...", "filename": "file2.txt"}},
  {"type": "file_ingest", "id": "3", "parameters": {"content": "...", "filename": "file3.txt"}}
]
```

---

## Related Documentation

- [RAG Pipeline Architecture](./exhibit/03-advanced-ai/RAG_PIPELINE.md)
- [Vector Store System](../server/services/vector-store/README.md)
- [Hybrid Search Implementation](./RAG_HYBRID_SEARCH_ENHANCEMENT.md)
- [RAG Traceability](./exhibit/03-advanced-ai/RAG_TRACEABILITY_IMPLEMENTATION.md)

---

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment variables are correctly set
3. Ensure database is accessible (for pgvector backend)
4. Check that Gemini API key is valid

---

## Summary

The `file_ingest` tool is your gateway to building a powerful, searchable knowledge base in Meowstik. By ingesting content into the RAG system, you enable intelligent, context-aware AI responses based on your personal information and documentation.

**Key Points:**
- ✅ Use `file_ingest` to store content in the knowledge base
- ✅ Content is automatically embedded and made searchable
- ✅ User data is isolated for privacy
- ✅ Multiple vector store backends supported
- ✅ No external RAG service needed - fully integrated

---

**Last Updated**: January 2024  
**Version**: 1.0
