/**
 * =============================================================================
 * PREPARE CODE FILES FOR NOTEBOOKLM INGESTION
 * =============================================================================
 * 
 * This script prepares the codebase for ingestion into Google's NotebookLM.
 * It traverses the project directory, finds all text-based source code files,
 * and copies them to a separate output directory with NotebookLM-friendly
 * filenames.
 * 
 * Features:
 * - Traverses project directory recursively
 * - Filters by configurable file extensions
 * - Renames files to NotebookLM-friendly format (e.g., server/services/ssh-service.ts → server-services-ssh-service-ts.txt)
 * - Excludes common build/dependency directories (node_modules, dist, etc.)
 * 
 * Usage:
 *   npm run prepare:notebooklm
 *   or
 *   tsx scripts/prepare-notebooklm.ts [options]
 * 
 * Options:
 *   --source, -s     Source directory (default: .)
 *   --output, -o     Output directory (default: ./notebooklm-output)
 *   --extensions, -e Comma-separated list of file extensions (default: ts,js,tsx,jsx,py,html,css,md,json,yaml,yml)
 * =============================================================================
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, relative, extname, basename } from 'path';

// Default configuration
const DEFAULT_EXTENSIONS = [
  'ts', 'js', 'tsx', 'jsx',
  'py',
  'html', 'css', 'scss', 'sass',
  'md', 'mdx',
  'json', 'yaml', 'yml',
  'sql',
  'sh', 'bash',
  'xml',
];

const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
  'tmp',
  'temp',
  '__pycache__',
  'venv',
  'repos', // Project-specific: Exclude nested repository clones
  'attached_assets',
];

// Progress reporting configuration
const INITIAL_FILES_TO_SHOW = 10; // Show first N files individually
const PROGRESS_INTERVAL = 100; // Show progress every N files after initial batch

interface Options {
  sourceDir: string;
  outputDir: string;
  extensions: string[];
}

/**
 * Parse command-line arguments
 */
function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    sourceDir: '.',
    outputDir: './notebooklm-output',
    extensions: DEFAULT_EXTENSIONS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--source':
      case '-s':
        if (i + 1 >= args.length) {
          console.error('Error: --source requires a directory argument');
          process.exit(1);
        }
        options.sourceDir = args[++i];
        break;
      case '--output':
      case '-o':
        if (i + 1 >= args.length) {
          console.error('Error: --output requires a directory argument');
          process.exit(1);
        }
        options.outputDir = args[++i];
        break;
      case '--extensions':
      case '-e':
        if (i + 1 >= args.length) {
          console.error('Error: --extensions requires a comma-separated list');
          process.exit(1);
        }
        options.extensions = args[++i].split(',').map(ext => ext.trim());
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: tsx scripts/prepare-notebooklm.ts [options]

Options:
  --source, -s <dir>       Source directory (default: .)
  --output, -o <dir>       Output directory (default: ./notebooklm-output)
  --extensions, -e <list>  Comma-separated list of file extensions
                           (default: ${DEFAULT_EXTENSIONS.join(',')})
  --help, -h               Show this help message
        `);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Convert a file path to a NotebookLM-friendly filename
 * Example: server/services/ssh-service.ts → server-services-ssh-service-ts.txt
 * Note: All special characters (/, \, .) are replaced with hyphens for maximum compatibility
 */
function convertToNotebookLMFilename(relativePath: string): string {
  // Replace directory separators with hyphens
  const pathWithoutExt = relativePath.replace(extname(relativePath), '');
  // Replace all special characters with hyphens for clean, flat filenames
  const normalized = pathWithoutExt.replace(/[/\\]/g, '-').replace(/\./g, '-');
  
  // Get original extension without the dot
  const ext = extname(relativePath).slice(1);
  
  // Create the new filename with the extension as part of the name and .txt suffix
  return `${normalized}-${ext}.txt`;
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDirectory(dirName: string): boolean {
  return EXCLUDED_DIRECTORIES.includes(dirName) || dirName.startsWith('.');
}

/**
 * Check if a file has one of the target extensions
 */
function hasTargetExtension(filename: string, extensions: string[]): boolean {
  const ext = extname(filename).slice(1); // Remove the leading dot
  return extensions.includes(ext);
}

/**
 * Recursively traverse directory and collect files
 */
function traverseDirectory(
  dirPath: string,
  rootPath: string,
  extensions: string[],
  files: string[] = []
): string[] {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    
    try {
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        if (!shouldExcludeDirectory(entry)) {
          traverseDirectory(fullPath, rootPath, extensions, files);
        }
      } else if (stats.isFile()) {
        if (hasTargetExtension(entry, extensions)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip broken symlinks and files with permission issues
      console.log(`  ⚠️  Skipping ${fullPath}: ${(error as Error).message}`);
    }
  }

  return files;
}

/**
 * Main function to prepare files for NotebookLM
 */
function prepareForNotebookLM() {
  console.log('📚 Preparing files for NotebookLM ingestion...\n');

  const options = parseArgs();
  const sourceDir = join(process.cwd(), options.sourceDir);
  const outputDir = join(process.cwd(), options.outputDir);

  console.log(`Source directory: ${sourceDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`File extensions: ${options.extensions.join(', ')}\n`);

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created output directory: ${outputDir}\n`);
  }

  // Traverse and collect files
  console.log('🔍 Scanning for files...');
  const files = traverseDirectory(sourceDir, sourceDir, options.extensions);
  console.log(`Found ${files.length} files\n`);

  // Process and copy files
  let copied = 0;
  let errors = 0;

  console.log('📝 Processing files...');
  for (const filePath of files) {
    try {
      const relativePath = relative(sourceDir, filePath);
      const newFilename = convertToNotebookLMFilename(relativePath);
      const destPath = join(outputDir, newFilename);

      copyFileSync(filePath, destPath);
      copied++;

      if (copied <= INITIAL_FILES_TO_SHOW || copied % PROGRESS_INTERVAL === 0) {
        console.log(`  ✓ ${relativePath} → ${newFilename}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${filePath}:`, error);
      errors++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Copied: ${copied}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📁 Output: ${outputDir}`);
  console.log('='.repeat(60) + '\n');

  console.log('✨ NotebookLM preparation complete!\n');
  console.log('Next steps:');
  console.log(`  1. Navigate to ${outputDir}`);
  console.log('  2. Upload the .txt files to Google NotebookLM');
  console.log('  3. Start querying your codebase!\n');

  process.exit(0);
}

// Run the script
prepareForNotebookLM();
