/**
 * Shared constants for ingestion scripts
 * Ensures consistency between directory and repository ingestion
 */

// Supported file extensions for ingestion
export const SUPPORTED_EXTENSIONS = [
  // Markdown and text
  '.md', '.txt',
  
  // JavaScript/TypeScript
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  
  // Python
  '.py',
  
  // Java
  '.java',
  
  // C/C++
  '.c', '.cpp', '.h', '.hpp', '.cc', '.cxx',
  
  // Go
  '.go',
  
  // Rust
  '.rs',
  
  // Ruby
  '.rb',
  
  // PHP
  '.php',
  
  // Shell scripts
  '.sh', '.bash', '.zsh',
  
  // Data formats
  '.json', '.yaml', '.yml', '.xml', '.csv', '.toml',
  
  // Web
  '.html', '.css', '.scss', '.less', '.sass',
  
  // Database
  '.sql',
  
  // API/Schema definitions
  '.graphql', '.proto', '.thrift'
];

// Directories to skip during ingestion
export const SKIP_DIRS = [
  // Node.js
  'node_modules',
  
  // Version control
  '.git',
  
  // Build outputs
  'dist',
  'build',
  'out',
  'bin',
  
  // Next.js
  '.next',
  
  // Testing
  'coverage',
  
  // IDEs
  '.vscode',
  '.idea',
  
  // Python
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  
  // Package managers
  'vendor',
  
  // Java/Gradle/Maven
  'target',
  '.gradle',
  '.mvn',
  
  // Misc
  '.DS_Store',
  'tmp',
  'temp'
];
