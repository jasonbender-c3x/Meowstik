/**
 * =============================================================================
 * PREPARE NOTEBOOKLM INGESTION PACKAGE
 * =============================================================================
 * 
 * This script transforms the repository into a set of 4 monolithic text files
 * optimized for ingestion into Google NotebookLM.
 * 
 * OUTPUTS (in ./notebooklm-ingest/):
 * 1. meowstik_codebase.txt   - Combined source code (server, client, agents)
 * 2. meowstik_docs.txt       - Combined documentation (docs/, *.md)
 * 3. meowstik_logs.txt       - Combined logs (logs/, memory/)
 * 4. files.txt               - Filesystem structure (recursive file listing)
 * 
 * Usage:
 *   npm run prepare:notebooklm
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Output directory
const OUTPUT_DIR = path.resolve(process.cwd(), 'notebooklm-ingest');

// Extensions to treat as code
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.scss', '.sql', 
  '.json', '.yaml', '.yml', '.xml', '.sh', '.bat', '.config', '.toml'
]);

// Extensions to treat as documentation
const DOC_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.csv'
]);

// Directories/files to completely ignore during traversal
const IGNORED_ITEMS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.cache', 
  '.vscode', 'tmp', 'temp', '__pycache__', 'venv', 'notebooklm-ingest', 
  'notebooklm-output', 'attached_assets', '.next', '.output',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
]);

// Specific directories to route to specific output files
const DOCS_DIR_NAMES = new Set(['docs']);
const LOGS_DIR_NAMES = new Set(['logs', 'memory']);

// Binary extensions to explicitly exclude
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar', 
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.mp3', '.wav', '.mp4', '.mov', '.avi', '.mkv',
  '.ttf', '.otf', '.woff', '.woff2', '.eot'
]);

// Statistics
const stats = {
  codeFiles: 0,
  docFiles: 0,
  logFiles: 0,
  skipped: 0
};

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('📦 Starting NotebookLM Preparation...');
  console.log(`   Working Directory: ${process.cwd()}`);
  
  // 1. Prepare Output Directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR);
  console.log(`📂 Created output directory: ${OUTPUT_DIR}`);

  // 2. Initialize File Streams
  const codePath = path.join(OUTPUT_DIR, 'meowstik_codebase.txt');
  const docsPath = path.join(OUTPUT_DIR, 'meowstik_docs.txt');
  const logsPath = path.join(OUTPUT_DIR, 'meowstik_logs.txt');

  const codeStream = fs.createWriteStream(codePath);
  const docsStream = fs.createWriteStream(docsPath);
  const logsStream = fs.createWriteStream(logsPath);

  writeHeader(codeStream, "MEOWSTIK SOURCE CODE COMBINED");
  writeHeader(docsStream, "MEOWSTIK DOCUMENTATION COMBINED");
  writeHeader(logsStream, "MEOWSTIK LOGS & MEMORY COMBINED");

  // 3. Recursive Traversal for Content Aggregation
  console.log('🔍 Scanning repository for content...');
  processDirectoryForContent(process.cwd(), codeStream, docsStream, logsStream);

  codeStream.end();
  docsStream.end();
  logsStream.end();

  console.log('✅ File content processing complete.');
  console.log(`   - Code Files: ${stats.codeFiles}`);
  console.log(`   - Doc Files:  ${stats.docFiles}`);
  console.log(`   - Log Files:  ${stats.logFiles}`);
  console.log(`   - TOTAL:      ${stats.codeFiles + stats.docFiles + stats.logFiles}`);

  // 4. Generate Filesystem Map
  console.log('🌳 Generating filesystem map...');
  const filesMapPath = path.join(OUTPUT_DIR, 'files.txt');
  try {
    const fileList = generateFileList(process.cwd());
    fs.writeFileSync(filesMapPath, fileList.join('\\n'));
    console.log('✅ Generated files.txt');
  } catch (err) {
    console.error('❌ Failed to generate files.txt', err);
  }

  console.log('\\n🎉 DONE! Upload these 4 files to NotebookLM:');
  console.log(`   1. ${path.relative(process.cwd(), codePath)}`);
  console.log(`   2. ${path.relative(process.cwd(), docsPath)}`);
  console.log(`   3. ${path.relative(process.cwd(), logsPath)}`);
  console.log(`   4. ${path.relative(process.cwd(), filesMapPath)}`);
}

// =============================================================================
// HELPERS
// =============================================================================

function processDirectoryForContent(
  currentPath: string, 
  codeStream: fs.WriteStream, 
  docsStream: fs.WriteStream, 
  logsStream: fs.WriteStream
) {
  const items = fs.readdirSync(currentPath);

  for (const item of items) {
    if (IGNORED_ITEMS.has(item)) continue;
    
    const fullPath = path.join(currentPath, item);
    const relPath = path.relative(process.cwd(), fullPath);

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) {
      processDirectoryForContent(fullPath, codeStream, docsStream, logsStream);
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        stats.skipped++;
        continue;
      }
      
      let destinationStream: fs.WriteStream | null = null;
      if (isInDirectory(relPath, DOCS_DIR_NAMES)) {
        destinationStream = docsStream;
        stats.docFiles++;
      } else if (isInDirectory(relPath, LOGS_DIR_NAMES)) {
        destinationStream = logsStream;
        stats.logFiles++;
      } else if (DOC_EXTENSIONS.has(ext)) {
        destinationStream = docsStream;
        stats.docFiles++;
      } else if (CODE_EXTENSIONS.has(ext)) {
        destinationStream = codeStream;
        stats.codeFiles++;
      } else {
        stats.skipped++;
      }

      if (destinationStream) {
        appendFileToStream(fullPath, relPath, destinationStream);
      }
    }
  }
}

function generateFileList(startPath: string): string[] {
  let fileList: string[] = [];
  
  function crawl(currentPath: string) {
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      if (IGNORED_ITEMS.has(item)) continue;
      const fullPath = path.join(currentPath, item);
      const relPath = path.relative(startPath, fullPath);
      
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) { continue; }

      fileList.push(relPath);
      if (stat.isDirectory()) {
        crawl(fullPath);
      }
    }
  }

  crawl(startPath);
  return fileList;
}

function isInDirectory(filePath: string, dirNames: Set<string>): boolean {
  const parts = filePath.split(path.sep);
  return parts.some(part => dirNames.has(part));
}

function writeHeader(stream: fs.WriteStream, title: string) {
  stream.write(`################################################################################\\n`);
  stream.write(`# ${title}\\n`);
  stream.write(`# Generated: ${new Date().toISOString()}\\n`);
  stream.write(`################################################################################\\n\\n`);
}

function appendFileToStream(filePath: string, relPath: string, stream: fs.WriteStream) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    stream.write(`\\n================================================================================\\n`);
    stream.write(`FILE PATH: ${relPath}\\n`);
    stream.write(`================================================================================\\n\\n`);
    stream.write(content);
    stream.write(`\\n\\n`);
  } catch (err) {
    console.warn(`Could not read file ${relPath}:`, err);
  }
}

// Run
main().catch(console.error);
