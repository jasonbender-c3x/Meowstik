#!/usr/bin/env tsx
/**
 * Repository Ingestion Script
 * 
 * Clones a Git repository and ingests all source files into the RAG system.
 * 
 * Usage:
 *   npm run build
 *   node dist/scripts/ingest-repo.js <repo-url> [branch]
 *   
 * Or with tsx:
 *   npx tsx scripts/ingest-repo.ts <repo-url> [branch]
 * 
 * Examples:
 *   npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git
 *   npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git main
 */

import { execSync } from 'child_process';
import { ingestionPipeline } from '../server/services/ingestion-pipeline';
import fs from 'fs';
import path from 'path';

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
  '.md', '.txt', '.js', '.ts', '.tsx', '.jsx',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.csv',
  '.html', '.css', '.scss', '.less',
  '.sql', '.graphql', '.proto', '.thrift'
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
  'target',
  'out',
  'bin',
  '.gradle',
  '.mvn'
];

interface IngestStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

function getAllFiles(dir: string, extensions: string[], stats: IngestStats = { total: 0, success: 0, failed: 0, skipped: 0 }): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      // Skip directories in skip list
      if (SKIP_DIRS.includes(item.name)) {
        continue;
      }
      // Recursively get files from subdirectories
      files.push(...getAllFiles(fullPath, extensions, stats));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

async function ingestRepository(repoUrl: string, branch = 'main') {
  const tempDir = `/tmp/repo-${Date.now()}`;
  
  try {
    console.log(`Cloning repository: ${repoUrl} (branch: ${branch})`);
    console.log(`Target directory: ${tempDir}`);
    
    // Clone repository with depth=1 for faster cloning
    execSync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tempDir}`, {
      stdio: 'inherit'
    });
    
    console.log('✓ Repository cloned successfully');
    console.log('');
    
    // Get all supported files
    const files = getAllFiles(tempDir, SUPPORTED_EXTENSIONS);
    
    console.log(`Found ${files.length} source files to ingest`);
    console.log('');
    
    const stats: IngestStats = {
      total: files.length,
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    // Ingest each file
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(tempDir, filePath);
        
        // Skip empty files
        if (!content.trim()) {
          stats.skipped++;
          console.log(`⊘ Skipping empty file: ${relativePath}`);
          continue;
        }
        
        // Skip very large files (> 1MB)
        if (content.length > 1024 * 1024) {
          stats.skipped++;
          console.log(`⊘ Skipping large file: ${relativePath} (${(content.length / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }
        
        const result = await ingestionPipeline.ingestText({
          sourceType: 'web', // Using 'web' as proxy for 'repository' source
          sourceUrl: `${repoUrl}/blob/${branch}/${relativePath}`,
          modality: 'document',
          title: relativePath,
          rawContent: content,
          extractedText: content,
        });
        
        stats.success++;
        console.log(`✓ Ingested: ${relativePath} (${content.length} chars) -> ${result.id}`);
      } catch (error) {
        stats.failed++;
        console.error(`✗ Failed: ${path.relative(tempDir, filePath)}`, error instanceof Error ? error.message : String(error));
      }
    }
    
    return stats;
  } finally {
    // Cleanup: Remove cloned repository
    try {
      if (fs.existsSync(tempDir)) {
        console.log('');
        console.log('Cleaning up temporary directory...');
        execSync(`rm -rf ${tempDir}`);
        console.log('✓ Cleanup complete');
      }
    } catch (error) {
      console.error('Warning: Failed to cleanup temporary directory:', error);
    }
  }
}

async function main() {
  const repoUrl = process.argv[2];
  const branch = process.argv[3] || 'main';
  
  if (!repoUrl) {
    console.error('Usage: tsx scripts/ingest-repo.ts <repo-url> [branch]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git');
    console.error('  npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git main');
    console.error('  npx tsx scripts/ingest-repo.ts https://github.com/user/repo.git develop');
    process.exit(1);
  }
  
  // Validate URL format
  if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.startsWith('git@')) {
    console.error('Error: Invalid repository URL format');
    console.error('URL must start with http://, https://, or git@');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('Repository Ingestion Script');
  console.log('='.repeat(60));
  console.log(`Repository: ${repoUrl}`);
  console.log(`Branch: ${branch}`);
  console.log(`Supported extensions: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  console.log(`Skipping directories: ${SKIP_DIRS.join(', ')}`);
  console.log('='.repeat(60));
  console.log('');
  
  const startTime = Date.now();
  const stats = await ingestRepository(repoUrl, branch);
  const duration = Date.now() - startTime;
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Repository Ingestion Complete!');
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
