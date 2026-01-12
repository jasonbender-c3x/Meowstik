# Content-Aware RAG Examples

This directory contains examples demonstrating the content-aware RAG ingestion feature.

## Available Examples

### `content-aware-rag-example.ts`

Demonstrates:
- Ingesting Python code with semantic chunking by function/class
- Ingesting Markdown documents with hierarchical section chunking
- Using adaptive strategy for automatic file-type detection
- Inspecting rich metadata from chunks

## Running the Examples

```bash
# Run the example
npx tsx docs/examples/content-aware-rag-example.ts
```

## Key Concepts

### Adaptive Strategy

The `adaptive` strategy automatically selects the best chunking approach based on file type:
- **Python (.py)**: Function and class boundaries
- **JavaScript/TypeScript (.js, .ts)**: Function, class, and component boundaries
- **Markdown (.md)**: Section headers with hierarchy
- **Other files**: Falls back to paragraph or sentence-based chunking

### Metadata Extraction

Each chunk includes rich metadata:
- `type`: Function, class, section, etc.
- `name`: Function/class/section name
- `startLine` / `endLine`: Source location
- `parent`: Parent class or section
- `language`: Programming language (for code)
- `sectionLevel`: Header level (for markdown)

### Usage in RAG Pipeline

The content-aware parsing integrates seamlessly:

```typescript
// Automatic content-aware parsing
const result = await ragService.ingestDocument(
  pythonCode,
  attachmentId,
  'calculator.py',
  'text/x-python'
);

// Retrieval includes metadata
const { chunks, scores } = await ragService.retrieve(query, 5);
chunks.forEach(chunk => {
  console.log(`Function: ${chunk.metadata.name}`);
  console.log(`In class: ${chunk.metadata.parent}`);
});
```

## Learn More

See [content-aware-rag.md](../content-aware-rag.md) for complete documentation.
