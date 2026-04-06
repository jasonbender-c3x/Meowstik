/**
 * =============================================================================
 * PREPARE NOTEBOOKLM INGESTION PACKAGE
 * =============================================================================
 *
 * Transforms the repository into text files optimised for Google NotebookLM.
 *
 * OUTPUTS (in ./notebooklm-ingest/):
 *   server.txt  – Server-side source code  (server/)
 *   client.txt  – Client-side source code  (client/)
 *   other.txt   – Everything else that is not docs/logs and not in server/ or client/
 *   docs.txt    – Documentation (.md, docs/, etc.)
 *   logs.txt    – Logs and memory (logs/, memory/)
 *   files.txt   – Full filesystem map
 *
 * Usage:
 *   npm run prepare:notebooklm
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const OUTPUT_DIR = path.resolve(process.cwd(), 'notebooklm-ingest');

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.scss', '.sql',
  '.json', '.yaml', '.yml', '.xml', '.sh', '.bat', '.config', '.toml',
]);

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.csv']);

const IGNORED_ITEMS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.cache',
  '.vscode', 'tmp', 'temp', '__pycache__', 'venv', 'notebooklm-ingest',
  'notebooklm-output', 'attached_assets', '.next', '.output',
  'package-lock.json', 'yarn.lock','py','pnpm-lock.yaml',
]);

const DOCS_DIRS = new Set(['docs']);
const LOGS_DIRS = new Set(['logs', 'memory']);

/** Top-level directory names that map to specific output streams. */
const SERVER_ROOT = 'server';
const CLIENT_ROOT = 'client';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.mp3', '.wav', '.mp4', '.mov', '.avi', '.mkv',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

const stats = { server: 0, client: 0, other: 0, docs: 0, logs: 0, skipped: 0 };

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('📦 Starting NotebookLM Preparation…');
  console.log(`   Working Directory: ${process.cwd()}`);

  // Recreate output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📂 Output directory: ${OUTPUT_DIR}`);

  const serverPath = path.join(OUTPUT_DIR, 'server.txt');
  const clientPath = path.join(OUTPUT_DIR, 'client.txt');
  const otherPath  = path.join(OUTPUT_DIR, 'other.txt');
  const docsPath   = path.join(OUTPUT_DIR, 'docs.txt');
  const logsPath   = path.join(OUTPUT_DIR, 'logs.txt');

  const serverStream = fs.createWriteStream(serverPath);
  const clientStream = fs.createWriteStream(clientPath);
  const otherStream  = fs.createWriteStream(otherPath);
  const docsStream   = fs.createWriteStream(docsPath);
  const logsStream   = fs.createWriteStream(logsPath);

  writeHeader(serverStream, 'MEOWSTIK — SERVER SOURCE CODE');
  writeHeader(clientStream, 'MEOWSTIK — CLIENT SOURCE CODE');
  writeHeader(otherStream,  'MEOWSTIK — OTHER SOURCE CODE (scripts, shared, root, etc.)');
  writeHeader(docsStream,   'MEOWSTIK — DOCUMENTATION');
  writeHeader(logsStream,   'MEOWSTIK — LOGS & MEMORY');

  console.log('🔍 Scanning repository…');
  processDirectory(process.cwd(), serverStream, clientStream, otherStream, docsStream, logsStream);

  serverStream.end();
  clientStream.end();
  otherStream.end();
  docsStream.end();
  logsStream.end();

  const total = stats.server + stats.client + stats.other + stats.docs + stats.logs;
  console.log('✅ Content processing complete.');
  console.log(`   Server  : ${stats.server} files → server.txt`);
  console.log(`   Client  : ${stats.client} files → client.txt`);
  console.log(`   Other   : ${stats.other} files → other.txt`);
  console.log(`   Docs    : ${stats.docs}   files → docs.txt`);
  console.log(`   Logs    : ${stats.logs}   files → logs.txt`);
  console.log(`   Total   : ${total}`);
  console.log(`   Skipped : ${stats.skipped}`);

  // Filesystem map
  const filesMapPath = path.join(OUTPUT_DIR, 'files.txt');
  try {
    const fileList = generateFileList(process.cwd());
    fs.writeFileSync(filesMapPath, fileList.join('\n'));
    console.log('✅ Generated files.txt');
  } catch (err) {
    console.error('❌ Failed to generate files.txt', err);
  }

  console.log('\n🎉 Done! Upload these files to NotebookLM:');
  console.log('   1. server.txt');
  console.log('   2. client.txt');
  console.log('   3. other.txt');
  console.log('   4. docs.txt');
  console.log('   5. logs.txt');
  console.log('   6. files.txt');
}

// =============================================================================
// TRAVERSAL
// =============================================================================

function processDirectory(
  currentPath: string,
  serverStream: fs.WriteStream,
  clientStream: fs.WriteStream,
  otherStream: fs.WriteStream,
  docsStream: fs.WriteStream,
  logsStream: fs.WriteStream,
): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(currentPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_ITEMS.has(entry)) continue;

    const fullPath = path.join(currentPath, entry);
    const relPath  = path.relative(process.cwd(), fullPath);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      processDirectory(fullPath, serverStream, clientStream, otherStream, docsStream, logsStream);
      continue;
    }

    if (!stat.isFile()) continue;

    const ext = path.extname(entry).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) { stats.skipped++; continue; }

    // Determine which stream receives this file
    const dest = resolveDestination(relPath, ext, serverStream, clientStream, otherStream, docsStream, logsStream);
    if (dest) {
      appendFileToStream(fullPath, relPath, dest.stream);
      stats[dest.bucket]++;
    } else {
      stats.skipped++;
    }
  }
}

type Bucket = 'server' | 'client' | 'other' | 'docs' | 'logs';

function resolveDestination(
  relPath: string,
  ext: string,
  serverStream: fs.WriteStream,
  clientStream: fs.WriteStream,
  otherStream: fs.WriteStream,
  docsStream: fs.WriteStream,
  logsStream: fs.WriteStream,
): { stream: fs.WriteStream; bucket: Bucket } | null {
  const parts = relPath.split(path.sep);
  const topLevel = parts[0];

  // Logs (always wins for log dirs)
  if (parts.some(p => LOGS_DIRS.has(p))) {
    return { stream: logsStream, bucket: 'logs' };
  }

  // Docs directory or markdown/text files
  if (parts.some(p => DOCS_DIRS.has(p)) || DOC_EXTENSIONS.has(ext)) {
    return { stream: docsStream, bucket: 'docs' };
  }

  // Only code/config files below this point
  if (!CODE_EXTENSIONS.has(ext)) return null;

  if (topLevel === SERVER_ROOT) return { stream: serverStream, bucket: 'server' };
  if (topLevel === CLIENT_ROOT) return { stream: clientStream, bucket: 'client' };
  return { stream: otherStream, bucket: 'other' };
}

// =============================================================================
// HELPERS
// =============================================================================

function generateFileList(startPath: string): string[] {
  const fileList: string[] = [];

  function crawl(currentPath: string) {
    let entries: string[];
    try { entries = fs.readdirSync(currentPath); } catch { return; }

    for (const entry of entries) {
      if (IGNORED_ITEMS.has(entry)) continue;
      const fullPath = path.join(currentPath, entry);
      const relPath  = path.relative(startPath, fullPath);
      fileList.push(relPath);
      try {
        if (fs.statSync(fullPath).isDirectory()) crawl(fullPath);
      } catch { /* ignore */ }
    }
  }

  crawl(startPath);
  return fileList;
}

function writeHeader(stream: fs.WriteStream, title: string): void {
  stream.write(`################################################################################\n`);
  stream.write(`# ${title}\n`);
  stream.write(`# Generated: ${new Date().toISOString()}\n`);
  stream.write(`################################################################################\n\n`);
}

function appendFileToStream(filePath: string, relPath: string, stream: fs.WriteStream): void {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    stream.write(`\n================================================================================\n`);
    stream.write(`FILE: ${relPath}\n`);
    stream.write(`================================================================================\n\n`);
    stream.write(content);
    stream.write(`\n\n`);
  } catch (err) {
    console.warn(`⚠️  Could not read ${relPath}:`, err);
  }
}

// Run
main().catch(console.error);
