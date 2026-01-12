/**
 * Example: Using Content-Aware RAG Ingestion
 * 
 * This example demonstrates how to use the new content-aware ingestion
 * feature to process and retrieve code and documentation files.
 */

import { ragService } from '../../server/services/rag-service';
import { chunkingService } from '../../server/services/chunking-service';

// Example 1: Ingesting a Python file with content-aware parsing
async function ingestPythonCode() {
  const pythonCode = `
class DataProcessor:
    """Process and transform data."""
    
    def __init__(self, config):
        self.config = config
    
    def process_batch(self, items):
        """Process a batch of items."""
        results = []
        for item in items:
            result = self.transform(item)
            results.append(result)
        return results
    
    def transform(self, item):
        """Transform a single item."""
        return item.upper()
`;

  const result = await ragService.ingestDocument(
    pythonCode,
    'attachment-123',
    'data_processor.py',
    'text/x-python'
  );
  
  console.log(`Ingested Python file: ${result.chunksCreated} semantic chunks created`);
  return result.documentId;
}

// Example 2: Using adaptive chunking strategy
async function demonstrateAdaptiveChunking() {
  const files = [
    { 
      content: 'function hello() { return "world"; }', 
      filename: 'utils.js',
      mimeType: 'text/javascript'
    },
    { 
      content: '# README\n\nThis is a test.', 
      filename: 'README.md',
      mimeType: 'text/markdown'
    },
  ];
  
  console.log('\n=== Adaptive Chunking Strategy ===');
  
  for (const file of files) {
    const chunks = await chunkingService.chunkDocument(
      file.content,
      `doc-${Date.now()}`,
      file.filename,
      file.mimeType,
      { strategy: 'adaptive' }
    );
    
    const strategy = chunks[0]?.metadata.strategy || 'unknown';
    console.log(`\n${file.filename}:`);
    console.log(`  Detected strategy: ${strategy}`);
    console.log(`  Chunks: ${chunks.length}`);
  }
}

export { ingestPythonCode, demonstrateAdaptiveChunking };
