import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CodeEntity {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "variable" | "export" | "import" | "struct" | "typedef" | "macro" | "enum";
  file: string;
  line: number;
  signature?: string;
  description?: string;
}

export interface FileAnalysis {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  entities: CodeEntity[];
  imports: string[];
  exports: string[];
  lineCount: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Analyse a single file for code entities, imports and exports.
 */
export async function analyzeFile(filePath: string, rootPath: string): Promise<FileAnalysis> {
  const content = await fs.promises.readFile(filePath, "utf-8");
  const relativePath = path.relative(rootPath, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split("\n");

  const entities: CodeEntity[] = [];
  const imports: string[] = [];
  const exports: string[] = [];

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    extractTsJsEntities(content, lines, relativePath, entities, imports, exports);
  } else if (ext === ".py") {
    extractPythonEntities(content, lines, relativePath, entities, imports, exports);
  } else if ([".c", ".h", ".cpp", ".hpp", ".cc", ".hh"].includes(ext)) {
    extractCEntities(content, lines, relativePath, entities, imports);
  } else if ([".sh", ".bash", ".zsh"].includes(ext)) {
    extractBashEntities(content, lines, relativePath, entities);
  } else if ([".php", ".phtml"].includes(ext)) {
    extractPhpEntities(content, lines, relativePath, entities);
  } else if ([".java", ".kt", ".scala"].includes(ext)) {
    extractJavaEntities(content, lines, relativePath, entities);
  } else if (ext === ".go") {
    extractGoEntities(content, lines, relativePath, entities);
  } else if (ext === ".rb") {
    extractRubyEntities(content, lines, relativePath, entities);
  } else if (ext === ".rs") {
    extractRustEntities(content, lines, relativePath, entities);
  } else if (ext === ".cs") {
    extractCSharpEntities(content, lines, relativePath, entities);
  } else if (ext === ".swift") {
    extractSwiftEntities(content, lines, relativePath, entities);
  } else if ([".vb", ".vbs", ".bas"].includes(ext)) {
    extractVBEntities(content, lines, relativePath, entities);
  } else if (ext === ".lua") {
    extractLuaEntities(content, lines, relativePath, entities);
  } else if ([".r", ".R"].includes(ext)) {
    extractREntities(content, lines, relativePath, entities);
  } else if ([".pl", ".pm"].includes(ext)) {
    extractPerlEntities(content, lines, relativePath, entities);
  } else if (ext === ".dart") {
    extractDartEntities(content, lines, relativePath, entities);
  } else if ([".groovy", ".gradle"].includes(ext)) {
    extractGroovyEntities(content, lines, relativePath, entities);
  } else if ([".m", ".mat"].includes(ext)) {
    extractMatlabEntities(content, lines, relativePath, entities);
  } else {
    extractGenericEntities(content, lines, relativePath, ext, entities);
  }

  return {
    path: filePath,
    relativePath,
    extension: ext,
    size: content.length,
    entities,
    imports,
    exports,
    lineCount: lines.length,
  };
}

// ---------------------------------------------------------------------------
// Language extractors
// ---------------------------------------------------------------------------

function extractTsJsEntities(
  content: string,
  lines: string[],
  file: string,
  entities: CodeEntity[],
  imports: string[],
  exports: string[]
): void {
  const functionPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/gm,
    /(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
  ];

  const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?/gm;
  const typePattern = /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=/gm;
  const importPattern = /import\s+(?:{[^}]+}|[\w*]+(?:\s+as\s+\w+)?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/gm;
  const exportPattern = /export\s+(?:default\s+)?(?:{([^}]+)}|(\w+))/gm;

  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (name && !isCommonKeyword(name)) {
        const line = getLineNumber(content, match.index);
        entities.push({
          name,
          type: "function",
          file,
          line,
          signature: extractSignature(lines[line - 1] || ""),
        });
      }
    }
  }

  let match;

  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = typePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "type", file, line: getLineNumber(content, match.index) });
  }
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = exportPattern.exec(content)) !== null) {
    const exportedItems = match[1] || match[2];
    if (exportedItems) {
      exports.push(...exportedItems.split(",").map(s => s.trim()));
    }
  }
}

function extractPythonEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[],
  imports: string[],
  _exports: string[]
): void {
  const funcPattern = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;
  const classPattern = /^class\s+(\w+)(?:\([^)]*\))?:/gm;
  const importPattern = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;

  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1] || match[2]);
  }
}

function extractPhpEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const functionPattern = /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(/gm;
  const classPattern = /(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;
  const interfacePattern = /interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?/gm;
  const traitPattern = /trait\s+(\w+)/gm;

  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = traitPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
}

function extractJavaEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /(?:public|private|protected)?\s*(?:abstract|final|static)?\s*class\s+(\w+)/gm;
  const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)/gm;
  const methodPattern = /(?:public|private|protected)?\s*(?:static|final|abstract|synchronized)?\s*(?:<[\w<>,\s]+>\s+)?(?:\w+(?:<[\w<>,\s?]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm;
  const enumPattern = /(?:public|private|protected)?\s*enum\s+(\w+)/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = methodPattern.exec(content)) !== null) {
    if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = enumPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
  }
}

function extractGoEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const funcPattern = /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/gm;
  const typePattern = /type\s+(\w+)\s+(?:struct|interface)/gm;

  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = typePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "struct", file, line: getLineNumber(content, match.index) });
  }
}

function extractRubyEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /class\s+(\w+)(?:\s*<\s*\w+)?/gm;
  const modulePattern = /module\s+(\w+)/gm;
  const methodPattern = /def\s+(?:self\.)?(\w+[?!=]?)/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = modulePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = methodPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
}

function extractRustEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const fnPattern = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm;
  const structPattern = /(?:pub\s+)?struct\s+(\w+)/gm;
  const enumPattern = /(?:pub\s+)?enum\s+(\w+)/gm;
  const traitPattern = /(?:pub\s+)?trait\s+(\w+)/gm;

  let match;
  while ((match = fnPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = structPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "struct", file, line: getLineNumber(content, match.index) });
  }
  while ((match = enumPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
  }
  while ((match = traitPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
}

function extractCSharpEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /(?:public|private|protected|internal)?\s*(?:abstract|sealed|static|partial)?\s*class\s+(\w+)/gm;
  const interfacePattern = /(?:public|private|protected|internal)?\s*interface\s+(\w+)/gm;
  const structPattern = /(?:public|private|protected|internal)?\s*(?:readonly)?\s*struct\s+(\w+)/gm;
  const methodPattern = /(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async)?\s*(?:\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:where\s+[\w:\s,]+)?\s*\{/gm;
  const enumPattern = /(?:public|private|protected|internal)?\s*enum\s+(\w+)/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = structPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "struct", file, line: getLineNumber(content, match.index) });
  }
  while ((match = methodPattern.exec(content)) !== null) {
    if (!["if", "while", "for", "switch", "catch", "using", "lock"].includes(match[1])) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = enumPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
  }
}

function extractSwiftEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /(?:public|private|internal|open|fileprivate)?\s*(?:final)?\s*class\s+(\w+)/gm;
  const structPattern = /(?:public|private|internal|fileprivate)?\s*struct\s+(\w+)/gm;
  const protocolPattern = /(?:public|private|internal|fileprivate)?\s*protocol\s+(\w+)/gm;
  const enumPattern = /(?:public|private|internal|fileprivate)?\s*enum\s+(\w+)/gm;
  const funcPattern = /(?:public|private|internal|open|fileprivate)?\s*(?:static|class|override)?\s*func\s+(\w+)/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = structPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "struct", file, line: getLineNumber(content, match.index) });
  }
  while ((match = protocolPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = enumPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
  }
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
}

function extractVBEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const vbKeywords = new Set(["public", "private", "friend", "protected", "end", "new", "get", "set", "let"]);

  const classPattern = /\bClass\s+(\w+)/gim;
  const modulePattern = /\bModule\s+(\w+)/gim;
  const interfacePattern = /\bInterface\s+(\w+)/gim;
  const subPattern = /\bSub\s+(\w+)/gim;
  const funcPattern = /\bFunction\s+(\w+)/gim;
  const propPattern = /\bProperty\s+(\w+)/gim;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = modulePattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = subPattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = funcPattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = propPattern.exec(content)) !== null) {
    if (!vbKeywords.has(match[1].toLowerCase())) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
}

function extractLuaEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const funcPattern = /(?:local\s+)?function\s+(\w+(?:\.\w+)*)\s*\(/gm;
  const assignFuncPattern = /(\w+(?:\.\w+)*)\s*=\s*function\s*\(/gm;

  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = assignFuncPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
}

function extractREntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const funcPattern = /(\w+)\s*(?:<-|=)\s*function\s*\(/gm;
  const classPattern = /setClass\s*\(\s*["'](\w+)["']/gm;

  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
}

function extractPerlEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const subPattern = /\bsub\s+(\w+)/gm;
  const packagePattern = /\bpackage\s+([\w:]+)/gm;

  let match;
  while ((match = subPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = packagePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
}

function extractDartEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?(?:\s+with\s+[\w,\s]+)?/gm;
  const mixinPattern = /mixin\s+(\w+)(?:\s+on\s+[\w,\s]+)?/gm;
  const extensionPattern = /extension\s+(\w+)\s+on/gm;
  const enumPattern = /enum\s+(\w+)/gm;
  const funcPattern = /(?:static\s+)?(?:Future|Stream|void|int|double|String|bool|dynamic|var|\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?[{=]/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = mixinPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = extensionPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = enumPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
  }
  while ((match = funcPattern.exec(content)) !== null) {
    if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
}

function extractGroovyEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const classPattern = /(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)/gm;
  const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)/gm;
  const traitPattern = /trait\s+(\w+)/gm;
  const methodPattern = /(?:def|void|int|String|boolean|Object|\w+)\s+(\w+)\s*\([^)]*\)\s*\{/gm;
  const closurePattern = /(?:def|final)\s+(\w+)\s*=\s*\{/gm;

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = interfacePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "interface", file, line: getLineNumber(content, match.index) });
  }
  while ((match = traitPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
  while ((match = methodPattern.exec(content)) !== null) {
    if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
      entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = closurePattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
}

function extractMatlabEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const funcPattern = /\bfunction\s+(?:\[[^\]]*\]\s*=\s*)?(\w+)\s*\(/gm;
  const classPattern = /\bclassdef\s+(?:\([^)]*\)\s+)?(\w+)/gm;

  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "function", file, line: getLineNumber(content, match.index) });
  }
  while ((match = classPattern.exec(content)) !== null) {
    entities.push({ name: match[1], type: "class", file, line: getLineNumber(content, match.index) });
  }
}

function extractBashEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[]
): void {
  const functionPatterns = [
    /^\s*function\s+(\w+)\s*\(\s*\)/gm,
    /^\s*function\s+(\w+)\s*\{/gm,
    /^\s*(\w+)\s*\(\s*\)\s*\{/gm,
  ];

  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!["if", "while", "for", "until", "case", "select"].includes(name)) {
        entities.push({ name, type: "function", file, line: getLineNumber(content, match.index) });
      }
    }
  }

  // Deduplicate by name (same function may match multiple patterns)
  const seen = new Set<string>();
  const unique: CodeEntity[] = [];
  for (const entity of entities) {
    if (!seen.has(entity.name)) {
      seen.add(entity.name);
      unique.push(entity);
    }
  }
  entities.length = 0;
  entities.push(...unique);
}

function extractCEntities(
  content: string,
  _lines: string[],
  file: string,
  entities: CodeEntity[],
  imports: string[]
): void {
  const typedefStructBodyPattern = /\btypedef\s+struct\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
  const typedefForwardStructPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?struct\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;
  const typedefPattern = /\btypedef\s+(?!struct|enum|union)[\w\s\*]+\s+(\w+)\s*;/gm;
  const enumPattern = /\benum\s+(?:class\s+|struct\s+)?(\w+)\s*(?::\s*\w+)?\s*\{/gm;
  const typedefEnumBodyPattern = /\btypedef\s+enum\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
  const typedefForwardEnumPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?enum\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;
  const typedefUnionBodyPattern = /\btypedef\s+union\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
  const typedefForwardUnionPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?union\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;
  const macroPattern = /^\s*#define\s+(\w+)(?:\([^)]*\))?(?:\s+|$)/gm;
  const includePattern = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;

  let match;
  const seenFunctions = new Set<string>();

  extractCFunctions(content, file, entities, seenFunctions);
  extractCStructs(content, file, entities);

  while ((match = typedefStructBodyPattern.exec(content)) !== null) {
    parseTypedefAliases(match[1], file, getLineNumber(content, match.index), entities);
  }
  while ((match = typedefForwardStructPattern.exec(content)) !== null) {
    if (match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: "typedef", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = typedefPattern.exec(content)) !== null) {
    if (match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: "typedef", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = enumPattern.exec(content)) !== null) {
    if (match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: "enum", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = typedefEnumBodyPattern.exec(content)) !== null) {
    parseTypedefAliases(match[1], file, getLineNumber(content, match.index), entities, "enum");
  }
  while ((match = typedefForwardEnumPattern.exec(content)) !== null) {
    if (match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: "typedef", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = typedefUnionBodyPattern.exec(content)) !== null) {
    parseTypedefAliases(match[1], file, getLineNumber(content, match.index), entities);
  }
  while ((match = typedefForwardUnionPattern.exec(content)) !== null) {
    if (match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: "typedef", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = macroPattern.exec(content)) !== null) {
    if (match[1] && !isIncludeGuard(match[1], file)) {
      entities.push({ name: match[1], type: "macro", file, line: getLineNumber(content, match.index) });
    }
  }
  while ((match = includePattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
}

function extractGenericEntities(
  content: string,
  _lines: string[],
  file: string,
  ext: string,
  entities: CodeEntity[]
): void {
  if (ext === ".md" || ext === ".mdx") {
    const headerPattern = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headerPattern.exec(content)) !== null) {
      entities.push({ name: match[2].trim(), type: "export", file, line: getLineNumber(content, match.index) });
    }
  }

  if (ext === ".json") {
    try {
      const obj = JSON.parse(content);
      Object.keys(obj).forEach(key => {
        entities.push({ name: key, type: "const", file, line: 1 });
      });
    } catch {
      // Ignore invalid JSON
    }
  }
}

// ---------------------------------------------------------------------------
// C/C++ helpers
// ---------------------------------------------------------------------------

function isInsideComment(content: string, pos: number): boolean {
  let lineStart = pos;
  while (lineStart > 0 && content[lineStart - 1] !== "\n") lineStart--;
  if (content.slice(lineStart, pos).includes("//")) return true;

  const beforePos = content.slice(0, pos);
  const lastBlockStart = beforePos.lastIndexOf("/*");
  if (lastBlockStart !== -1) {
    const lastBlockEnd = beforePos.lastIndexOf("*/");
    if (lastBlockEnd < lastBlockStart) return true;
  }
  return false;
}

function extractCStructs(content: string, file: string, entities: CodeEntity[]): void {
  const structKeyword = /(?<!enum\s)\bstruct\b/g;
  let structMatch;

  while ((structMatch = structKeyword.exec(content)) !== null) {
    if (isInsideComment(content, structMatch.index)) continue;

    const startIdx = structMatch.index + 6;
    let idx = startIdx;

    // Skip whitespace and compiler attributes before the struct name
    while (idx < content.length) {
      while (idx < content.length && /\s/.test(content[idx])) idx++;

      if (content.slice(idx, idx + 2) === "[[") {
        let bracketDepth = 0;
        while (idx < content.length) {
          if (content[idx] === "[") bracketDepth++;
          if (content[idx] === "]") bracketDepth--;
          idx++;
          if (bracketDepth === 0) break;
        }
        continue;
      }

      if (content.slice(idx).startsWith("__attribute__")) {
        idx += 13;
        while (idx < content.length && /\s/.test(content[idx])) idx++;
        if (content.slice(idx, idx + 2) === "((") {
          let parenDepth = 0;
          while (idx < content.length) {
            if (content[idx] === "(") parenDepth++;
            if (content[idx] === ")") parenDepth--;
            idx++;
            if (parenDepth === 0) break;
          }
        }
        continue;
      }

      const skipPatterns = [
        /^alignas\s*\([^)]*\)/,
        /^__declspec\s*\([^)]*(?:\([^)]*\)[^)]*)*\)/,
        /^__packed/,
        /^__aligned\s*\([^)]*\)/,
      ];
      let skipped = false;
      for (const pat of skipPatterns) {
        const m = content.slice(idx).match(pat);
        if (m) {
          idx += m[0].length;
          skipped = true;
          break;
        }
      }
      if (skipped) continue;

      break;
    }

    const nameMatch = content.slice(idx).match(/^(\w+)/);
    if (!nameMatch) continue;
    const structName = nameMatch[1];
    if (isCKeyword(structName)) continue;
    idx += structName.length;

    let braceDepth = 0;
    let foundBody = false;
    while (idx < content.length && !foundBody) {
      while (idx < content.length && /\s/.test(content[idx])) idx++;
      if (idx >= content.length) break;

      const ch = content[idx];

      if (content.slice(idx).match(/^requires\b/)) {
        idx += 8;
        while (idx < content.length && /\s/.test(content[idx])) idx++;

        if (content[idx] === "{") {
          let reqBraceDepth = 0;
          while (idx < content.length) {
            if (content[idx] === "{") reqBraceDepth++;
            if (content[idx] === "}") reqBraceDepth--;
            idx++;
            if (reqBraceDepth === 0) break;
          }
        } else if (content.slice(idx).match(/^requires\b/)) {
          idx += 8;
          while (idx < content.length && /\s/.test(content[idx])) idx++;
          if (content[idx] === "{") {
            let reqBraceDepth = 0;
            while (idx < content.length) {
              if (content[idx] === "{") reqBraceDepth++;
              if (content[idx] === "}") reqBraceDepth--;
              idx++;
              if (reqBraceDepth === 0) break;
            }
          }
        }
        continue;
      }

      if (ch === "{") {
        if (braceDepth === 0) { foundBody = true; break; }
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
      } else if (ch === ";" && braceDepth === 0) {
        break;
      }
      idx++;
    }

    if (foundBody) {
      entities.push({ name: structName, type: "struct", file, line: getLineNumber(content, structMatch.index) });
    }
  }
}

function extractCFunctions(
  content: string,
  file: string,
  entities: CodeEntity[],
  seenFunctions: Set<string>
): void {
  const lines = content.split("\n");

  let braceDepth = 0;
  const structBraceStack: number[] = [];
  let pendingStructStart = false;
  let pendingDeclaration = "";
  let pendingStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const attrPattern = "(?:__attribute__\\s*\\(\\([^)]*\\)\\)\\s*|alignas\\s*\\([^)]*\\)\\s*|__packed\\s*|__aligned\\s*\\([^)]*\\)\\s*|__declspec\\s*\\([^)]*\\)\\s*)*";
    const structDeclRegex = new RegExp(`\\b(struct|union|enum)\\s+${attrPattern}(?:class\\s+|struct\\s+)?(?:\\w+)?\\s*${attrPattern}(?:\\s*:\\s*\\w+)?\\s*${attrPattern}$`);
    const structDeclWithBraceRegex = new RegExp(`\\b(struct|union|enum)\\s+${attrPattern}(?:class\\s+|struct\\s+)?(?:\\w+)?\\s*${attrPattern}(?:\\s*:\\s*\\w+)?\\s*${attrPattern}\\{`);

    if (structDeclWithBraceRegex.test(trimmed) || structDeclRegex.test(trimmed)) {
      pendingStructStart = true;
    }

    for (const char of line) {
      if (char === "{") {
        braceDepth++;
        if (pendingStructStart) {
          structBraceStack.push(braceDepth);
          pendingStructStart = false;
        }
      }
      if (char === "}") {
        if (structBraceStack.length > 0 && braceDepth === structBraceStack[structBraceStack.length - 1]) {
          structBraceStack.pop();
        }
        braceDepth--;
      }
    }

    if (
      trimmed.startsWith("#") || trimmed.startsWith("//") ||
      trimmed.startsWith("/*") || trimmed.startsWith("*") ||
      trimmed === "" || trimmed === "{" || trimmed === "}"
    ) continue;

    const insideStruct = structBraceStack.some(startDepth => braceDepth >= startDepth);
    if (insideStruct) continue;

    if (pendingDeclaration) {
      pendingDeclaration += " " + trimmed;
    } else {
      pendingDeclaration = trimmed;
      pendingStartLine = i;
    }

    const hasOpenParen = pendingDeclaration.includes("(");
    if (!hasOpenParen) {
      if (!trimmed.match(/[\w*]$/) || trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}")) {
        pendingDeclaration = "";
      }
      continue;
    }

    let parenCount = 0;
    for (const char of pendingDeclaration) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
    }
    if (parenCount !== 0) continue;

    const declaration = pendingDeclaration;
    const rest = declaration.substring(declaration.lastIndexOf(")") + 1).trim();
    const isFunctionEnd = rest.match(/^(const|override|final|noexcept|throw)?\s*[\{;]/);

    if (isFunctionEnd) {
      const beforeParen = declaration.substring(0, declaration.indexOf("("));
      const funcMatch = beforeParen.match(/(\w+)\s*$/);

      if (funcMatch) {
        const funcName = funcMatch[1];
        if (funcName && !isCKeyword(funcName) && !seenFunctions.has(funcName + file)) {
          seenFunctions.add(funcName + file);
          entities.push({
            name: funcName,
            type: "function",
            file,
            line: pendingStartLine + 1,
            signature: extractSignature(declaration.replace(/\{.*$/, "").replace(/;$/, "").trim()),
          });
        }
      }
    }

    pendingDeclaration = "";
  }
}

function parseTypedefAliases(
  aliasesPart: string,
  file: string,
  line: number,
  entities: CodeEntity[],
  entityType: "typedef" | "enum" = "typedef"
): void {
  for (const alias of aliasesPart.split(",")) {
    const match = alias.trim().match(/\*?\s*(\w+)\s*$/);
    if (match && match[1] && !isCKeyword(match[1])) {
      entities.push({ name: match[1], type: entityType, file, line });
    }
  }
}

// ---------------------------------------------------------------------------
// Shared utility helpers
// ---------------------------------------------------------------------------

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

function extractSignature(line: string): string {
  const sig = line.trim().replace(/\{.*$/, "").trim();
  return sig.length > 100 ? sig.substring(0, 100) + "..." : sig;
}

function isCommonKeyword(name: string): boolean {
  const keywords = new Set([
    "if", "else", "for", "while", "do", "switch", "case", "break",
    "continue", "return", "throw", "try", "catch", "finally",
    "new", "delete", "typeof", "void", "this", "super",
    "true", "false", "null", "undefined", "NaN", "Infinity",
  ]);
  return keywords.has(name);
}

function isCKeyword(name: string): boolean {
  const keywords = new Set([
    "if", "else", "for", "while", "do", "switch", "case", "break",
    "continue", "return", "goto", "default",
    "sizeof", "typeof", "alignof", "offsetof",
    "void", "int", "char", "short", "long", "float", "double",
    "signed", "unsigned", "const", "static", "extern", "inline",
    "volatile", "register", "auto", "restrict", "_Atomic",
    "struct", "union", "enum", "typedef",
    "bool", "_Bool", "true", "false",
    "NULL", "nullptr",
    "int8_t", "int16_t", "int32_t", "int64_t",
    "uint8_t", "uint16_t", "uint32_t", "uint64_t",
    "size_t", "ssize_t", "ptrdiff_t", "intptr_t", "uintptr_t",
    "u8", "u16", "u32", "u64", "s8", "s16", "s32", "s64",
    "UINT8", "UINT16", "UINT32", "UINT64", "INT8", "INT16", "INT32", "INT64",
  ]);
  return keywords.has(name);
}

function isIncludeGuard(name: string, file: string): boolean {
  if (name.startsWith("__")) return true;
  if (name.endsWith("_H") || name.endsWith("_H_") || name.endsWith("_H__")) return true;
  if (name.endsWith("_HPP") || name.endsWith("_HPP_") || name.endsWith("_HPP__")) return true;
  if (name.endsWith("_INCLUDED") || name.endsWith("_INCLUDED_")) return true;
  if (name.endsWith("_HH") || name.endsWith("_HH_")) return true;

  const fileName = file.split(/[\/\\]/).pop() || "";
  const baseNameOnly = fileName.replace(/\.[ch](?:pp|h)?$/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const exactGuard = baseNameOnly + "_H";
  const exactGuardUnderscore = "__" + baseNameOnly + "_H__";
  if (name.toUpperCase() === exactGuard || name.toUpperCase() === exactGuardUnderscore) return true;

  return false;
}
