#!/usr/bin/env tsx
/**
 * Directory Ingestion Script
 * 
 * Recursively ingests all files from a directory into the RAG system.
 * 
 * Usage:
 *   npm run build
 *   node dist/scripts/ingest-directory.js <directory-path>
 *   
 * Or with tsx:
 *   npx tsx scripts/ingest-directory.ts <directory-path>
 */

import { ingestionPipeline } from '../server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
  '.md', '.txt', '.js', '.ts', '.tsx', '.jsx',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.csv',
  '.html', '.css', '.scss', '.less'
];

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.vscode',
  '.idea',
  '__pycache__',
  'vendor',
  'target'
];

interface IngestStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

async function ingestDirectory(dirPath: string, stats: IngestStats = { total: 0, success: 0, failed: 0, skipped: 0 }): Promise<IngestStats> {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Skip directories in the skip list
        if (SKIP_DIRS.includes(item.name)) {
          console.log(`⊘ Skipping directory: ${fullPath}`);
          continue;
        }
        
        // Recursively process subdirectories
        await ingestDirectory(fullPath, stats);
      } else if (item.isFile()) {
        stats.total++;
        
        // Check if file extension is supported
        const ext = path.extname(item.name).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          stats.skipped++;
          console.log(`⊘ Skipping unsupported file: ${fullPath}`);
          continue;
        }
        
        try {
          // Read file content
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Skip empty files
          if (!content.trim()) {
            stats.skipped++;
            console.log(`⊘ Skipping empty file: ${fullPath}`);
            continue;
          }
          
          // Ingest file
          const result = await ingestionPipeline.ingestText({
            sourceType: 'upload',
            modality: 'document',
            title: path.relative(process.cwd(), fullPath),
            rawContent: content,
            extractedText: content,
          });
          
          stats.success++;
          console.log(`✓ Ingested: ${fullPath} (${content.length} chars) -> ${result.id}`);
        } catch (error) {
          stats.failed++;
          console.error(`✗ Failed: ${fullPath}`, error instanceof Error ? error.message : String(error));
        }
      }
    }
    
    return stats;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return stats;
  }
}

async function main() {
  const dirPath = process.argv[2];
  
  if (!dirPath) {
    console.error('Usage: tsx scripts/ingest-directory.ts <directory-path>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scripts/ingest-directory.ts ./docs');
    console.error('  npx tsx scripts/ingest-directory.ts ./src');
    process.exit(1);
  }
  
  // Resolve to absolute path
  const absolutePath = path.resolve(dirPath);
  
  // Check if directory exists
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: Directory does not exist: ${absolutePath}`);
    process.exit(1);
  }
  
  if (!fs.statSync(absolutePath).isDirectory()) {
    console.error(`Error: Path is not a directory: ${absolutePath}`);
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('Directory Ingestion Script');
  console.log('='.repeat(60));
  console.log(`Directory: ${absolutePath}`);
  console.log(`Supported extensions: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  console.log(`Skipping directories: ${SKIP_DIRS.join(', ')}`);
  console.log('='.repeat(60));
  console.log('');
  
  const startTime = Date.now();
  const stats = await ingestDirectory(absolutePath);
  const duration = Date.now() - startTime;
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Ingestion Complete!');
  console.log('='.repeat(60));
  console.log(`Total files: ${stats.total}`);
  console.log(`✓ Successfully ingested: ${stats.success}`);
  console.log(`✗ Failed: ${stats.failed}`);
  console.log(`⊘ Skipped: ${stats.skipped}`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));
  
  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
