# How to Initiate RAG Ingestion in Meowstik

**Quick Answer**: There are 6 ways to initiate RAG ingestion in Meowstik, depending on your use case.

---

## 🎯 Choose Your Method

| Method | Best For | Complexity | Link |
|--------|----------|------------|------|
| **1. UI - Knowledge Hub** | Gmail/Drive conversations | ⭐ Easy | [Jump to UI Method](#1-ui-knowledge-hub) |
| **2. UI - File Upload** | Documents during chat | ⭐ Easy | [Jump to Upload Method](#2-ui-file-upload) |
| **3. API - Text Ingestion** | Custom scripts, automation | ⭐⭐ Medium | [Jump to API Method](#3-api-text-ingestion) |
| **4. CLI - Directory** | Bulk document ingestion | ⭐⭐ Medium | [Jump to Directory Method](#4-cli-directory-ingestion) |
| **5. CLI - Repository** | Entire codebase ingestion | ⭐⭐⭐ Advanced | [Jump to Repo Method](#5-cli-repository-ingestion) |
| **6. Auto - Chat Messages** | Automatic (no action needed) | ⭐ Easy | [Jump to Auto Method](#6-automatic-chat-message-ingestion) |

---

## 1. UI - Knowledge Hub

**Best for**: Scanning and ingesting LLM conversations from Gmail and Google Drive

### Steps:
1. Open Meowstik in your browser: `http://localhost:5000`
2. Navigate to `/knowledge` (click "Knowledge Hub" in sidebar)
3. Click **"Scan Sources"** button
4. Wait for the scan to complete (shows Gmail & Drive conversations)
5. Click **"Ingest All"** to process all sources, or click ▶ on individual sources
6. Monitor progress in the **"Jobs"** tab

### What Gets Scanned:
- **Gmail**: Emails from Gemini, AI Studio, Google Voice
- **Google Drive**: Documents with "conversation", "chat", or "Gemini" in name/content

### Screenshots:
- Navigate to `/knowledge` to see the UI
- Sources tab shows discovered conversations
- Jobs tab shows real-time ingestion progress

---

## 2. UI - File Upload

**Best for**: Uploading documents while chatting with the AI

### Steps:
1. Open any chat conversation
2. Click the **📎 attachment icon** in the message input area
3. Select files to upload (PDF, markdown, code, text, etc.)
4. Files are automatically ingested into RAG
5. Ask the AI questions about the uploaded documents

### Supported File Types:
- **Documents**: PDF, TXT, Markdown
- **Code**: JS, TS, Python, Java, C++, Go, Rust, Ruby, PHP, etc.
- **Data**: JSON, YAML, XML, CSV
- **Web**: HTML, CSS

### Example:
```
1. Upload "project-requirements.pdf"
2. Ask: "What are the main requirements for this project?"
3. AI retrieves relevant chunks and answers based on the document
```

---

## 3. API - Text Ingestion

**Best for**: Programmatic ingestion, automation, custom scripts

### Basic Usage:
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your text content here...",
    "title": "My Document",
    "sourceType": "upload"
  }'
```

### Response:
```json
{
  "success": true,
  "evidenceId": "evidence-uuid-123"
}
```

### Node.js Example:
```javascript
const response = await fetch('http://localhost:5000/api/knowledge/pipeline/ingest/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Your text content here...',
    title: 'My Document',
    sourceType: 'upload'
  })
});

const result = await response.json();
console.log('Ingested:', result.evidenceId);
```

### Python Example:
```python
import requests

response = requests.post(
    'http://localhost:5000/api/knowledge/pipeline/ingest/text',
    json={
        'content': 'Your text content here...',
        'title': 'My Document',
        'sourceType': 'upload'
    }
)

result = response.json()
print(f"Ingested: {result['evidenceId']}")
```

---

## 4. CLI - Directory Ingestion

**Best for**: Bulk ingestion of all files in a directory (recursive)

### Usage:
```bash
# Simple usage
npm run ingest:dir /path/to/your/docs

# With npx
npx tsx scripts/ingest-directory.ts /path/to/your/docs
```

### What It Does:
1. Recursively scans the directory
2. Finds all supported file types
3. Reads file content
4. Ingests each file into RAG
5. Shows progress and summary

### Example:
```bash
# Ingest all markdown and code files in docs directory
npm run ingest:dir ./docs

# Output:
# ✓ Ingested: docs/README.md (1234 chars) -> evidence-uuid-1
# ✓ Ingested: docs/guide.md (5678 chars) -> evidence-uuid-2
# ⊘ Skipping: docs/image.png (unsupported)
# 
# Total files: 10
# ✓ Successfully ingested: 8
# ✗ Failed: 0
# ⊘ Skipped: 2
```

### Supported Extensions:
`.md`, `.txt`, `.js`, `.ts`, `.tsx`, `.py`, `.java`, `.c`, `.cpp`, `.go`, `.rs`, `.rb`, `.php`, `.sh`, `.json`, `.yaml`, `.xml`, `.csv`, `.html`, `.css`

### Skipped Directories:
`node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.vscode`, `.idea`, `__pycache__`, `vendor`, `target`

---

## 5. CLI - Repository Ingestion

**Best for**: Ingesting entire GitHub/Git repositories (codebases)

### Usage:
```bash
# With default branch (main)
npm run ingest:repo https://github.com/user/repo.git

# With specific branch
npm run ingest:repo https://github.com/user/repo.git develop

# With npx
npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git main
```

### What It Does:
1. Clones the repository (shallow clone)
2. Finds all supported source files
3. Ingests each file into RAG
4. Cleans up the temporary clone

### Example:
```bash
npm run ingest:repo https://github.com/octocat/Hello-World.git

# Output:
# Cloning repository: https://github.com/octocat/Hello-World.git (branch: main)
# ✓ Repository cloned successfully
# Found 5 source files to ingest
# ✓ Ingested: README.md (123 chars) -> evidence-uuid-1
# ✓ Ingested: src/index.js (456 chars) -> evidence-uuid-2
# ...
# ✓ Cleanup complete
```

### Use Cases:
- **Code review**: Ingest entire codebase for AI-assisted review
- **Documentation**: Ingest repo docs for Q&A
- **Learning**: Ingest open-source projects to learn from
- **Migration**: Understand legacy codebases

---

## 6. Automatic - Chat Message Ingestion

**Best for**: Long-term conversation memory (happens automatically)

### How It Works:
- **Automatic**: Every message you send is automatically ingested
- **Filtering**: Messages < 20 characters are skipped
- **Trivial Filter**: Greetings ("hi", "thanks", "ok") are skipped
- **Both Sides**: Both user and AI messages are ingested

### Data Isolation:
- **Guest users**: Messages stored in guest bucket (no cross-user access)
- **Authenticated users**: Messages stored with userId for privacy

### Example:
```
User: "I live in Seattle and work as a software engineer"
[Auto-ingested ✓]

... (30 messages later) ...

User: "Where did I say I live?"
AI: [Retrieves: "I live in Seattle"] "You mentioned you live in Seattle."
```

### Querying Past Conversations:
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What did I say about my job?",
    "maxTokens": 2000
  }'
```

---

## 📚 Next Steps

### After Ingestion
1. **Search your content**: Use `/api/knowledge/pipeline/search`
2. **Retrieve context**: Use `/api/knowledge/pipeline/retrieve`
3. **Check stats**: Visit `/api/knowledge/pipeline/stats`
4. **Debug traces**: Navigate to `/rag-debug` in the UI

### Learn More
- **Quick Reference**: [RAG_QUICK_REFERENCE.md](./RAG_QUICK_REFERENCE.md)
- **Full Guide**: [RAG_INGESTION_GUIDE.md](./RAG_INGESTION_GUIDE.md)
- **Testing**: [RAG_TESTING.md](./RAG_TESTING.md)
- **RAG Analysis**: [ragent/RAG-ANALYSIS.md](./ragent/RAG-ANALYSIS.md)

---

## 🔧 Configuration

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your-gemini-api-key
DATABASE_URL=postgresql://...

# Optional
VECTOR_STORE_TYPE=pgvector  # or 'vertex' or 'memory'
```

### Vector Store Options
- **pgvector**: PostgreSQL with pgvector extension (production, persistent)
- **vertex**: Google Vertex AI (Google Cloud)
- **memory**: In-memory (development, non-persistent)

---

## ❓ FAQ

### Q: Which method should I use?
**A**: 
- **Casual use**: Use UI methods (#1 or #2)
- **Automation**: Use API (#3)
- **Bulk ingestion**: Use CLI (#4 or #5)
- **Chat memory**: Automatic (#6)

### Q: How do I know if ingestion succeeded?
**A**: Check pipeline stats:
```bash
curl http://localhost:5000/api/knowledge/pipeline/stats
```

### Q: Can I ingest private repositories?
**A**: Yes, use SSH URLs or provide credentials. For private repos:
```bash
git clone git@github.com:user/private-repo.git /tmp/repo
npm run ingest:dir /tmp/repo
```

### Q: How do I search ingested content?
**A**: Use the search API:
```bash
curl -X POST http://localhost:5000/api/knowledge/pipeline/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your search term", "limit": 10}'
```

### Q: What if no search results are returned?
**A**:
1. Check if content was ingested: `GET /api/knowledge/pipeline/stats`
2. Lower the threshold: Try `"threshold": 0.25` instead of `0.5`
3. Increase results: Try `"limit": 20` instead of `5`

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Scripts not found | Run from project root: `cd /path/to/Meowstik` |
| Permission denied | Make scripts executable: `chmod +x scripts/*.ts` |
| Import errors | Install dependencies: `npm install` |
| No search results | Lower threshold to 0.25, increase limit to 20 |
| Ingestion fails | Check `GEMINI_API_KEY`, verify PostgreSQL is running |
| Vector store error | Set `VECTOR_STORE_TYPE=memory` for testing |

---

**Summary**: Use the UI for casual ingestion, the API for automation, and the CLI scripts for bulk operations. All methods feed into the same RAG system for unified semantic search.

*Last updated: January 14, 2026*
