import * as path from "path";

// Supported file extensions for code analysis
export const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".scala",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".hh",  // C/C++ support
  ".cs",  // C# support
  ".php", ".phtml",  // PHP support
  ".swift",  // Swift support
  ".vb", ".vbs", ".bas",  // Visual Basic support
  ".lua",  // Lua support
  ".r", ".R",  // R support
  ".pl", ".pm",  // Perl support
  ".dart",  // Dart/Flutter support
  ".groovy", ".gradle",  // Groovy support
  ".m", ".mat",  // MATLAB/Octave support
  ".css", ".scss", ".less", ".html", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml", ".md", ".mdx",
  ".sql", ".sh", ".bash", ".zsh",
]);

// Exact-name dependency/library manifest files.
// NOTE: *.csproj / *.fsproj cannot be Set members because Set.has() uses strict
// string equality and globs are never equal to a real filename.  Those extensions
// are handled separately via DEPENDENCY_FILE_EXTENSIONS below.
export const DEPENDENCY_FILES = new Set([
  "package.json", "package-lock.json",          // npm/Node.js
  "requirements.txt", "Pipfile", "pyproject.toml", "setup.py",  // Python
  "Cargo.toml", "Cargo.lock",                   // Rust
  "go.mod", "go.sum",                            // Go
  "Gemfile", "Gemfile.lock",                     // Ruby
  "composer.json", "composer.lock",              // PHP
  "build.gradle", "build.gradle.kts", "pom.xml", // Java/Kotlin
  "Package.swift",                               // Swift
  "pubspec.yaml",                                // Dart/Flutter
  "packages.config",                             // .NET (exact-name)
]);

// File extensions for project/manifest files that require extension-based matching
// (these formerly used glob patterns like "*.csproj" inside the Set, which never matched).
export const DEPENDENCY_FILE_EXTENSIONS = new Set([
  ".csproj", ".fsproj",
]);

/** Returns true when a bare filename or its extension identifies a dependency manifest. */
export function isDependencyFile(filename: string): boolean {
  return (
    DEPENDENCY_FILES.has(filename) ||
    DEPENDENCY_FILE_EXTENSIONS.has(path.extname(filename).toLowerCase())
  );
}

// Directories to skip during crawl
export const SKIP_DIRS = new Set([
  "node_modules", ".git", ".cache", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", ".idea", ".vscode",
  "coverage", ".nyc_output", "tmp", ".tmp",
]);
