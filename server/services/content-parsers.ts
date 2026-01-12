/**
 * =============================================================================
 * MEOWSTIK - CONTENT-AWARE PARSERS
 * =============================================================================
 * 
 * Content-specific parsers for different file types. These parsers extract
 * structured information and semantic boundaries from various document types.
 * 
 * SUPPORTED FORMATS:
 * - Python (.py): Parse classes and functions
 * - JavaScript/TypeScript (.js, .ts, .tsx, .jsx): Parse classes, functions, components
 * - Markdown (.md): Parse by section headers
 * - PDF (.pdf): Extract text with page boundaries
 * 
 * ARCHITECTURE:
 * Each parser implements a common interface that returns:
 * - Semantic chunks (code blocks, sections, etc.)
 * - Metadata for each chunk (function name, line numbers, etc.)
 * =============================================================================
 */

export interface ParsedChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  type: 'function' | 'class' | 'section' | 'paragraph' | 'module' | 'component';
  name?: string;
  startLine?: number;
  endLine?: number;
  parent?: string;
  language?: string;
  sectionLevel?: number;
  pageNumber?: number;
}

export interface ContentParser {
  /**
   * Parse content into semantic chunks
   */
  parse(content: string, filename: string): ParsedChunk[];
  
  /**
   * Check if this parser supports the given file type
   */
  supports(filename: string, mimeType?: string): boolean;
}

/**
 * Python Parser - Extract classes and functions
 */
export class PythonParser implements ContentParser {
  supports(filename: string, mimeType?: string): boolean {
    return filename.endsWith('.py') || mimeType === 'text/x-python';
  }

  parse(content: string, filename: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: { start: number; lines: string[]; type: 'function' | 'class'; name: string; parent?: string } | null = null;
    let classStack: Array<{ name: string; indent: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);
      
      // Class definition
      const classMatch = line.match(/^(\s*)class\s+(\w+)/);
      if (classMatch) {
        // Save previous chunk if exists
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, filename));
        }
        
        // Update class stack
        const classIndent = classMatch[1].length;
        classStack = classStack.filter(c => c.indent < classIndent);
        classStack.push({ name: classMatch[2], indent: classIndent });
        
        currentChunk = {
          start: i,
          lines: [line],
          type: 'class',
          name: classMatch[2],
          parent: classStack.length > 1 ? classStack[classStack.length - 2].name : undefined,
        };
        continue;
      }
      
      // Function definition
      const funcMatch = line.match(/^(\s*)def\s+(\w+)/);
      if (funcMatch) {
        // Save previous chunk if exists
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, filename));
        }
        
        const funcIndent = funcMatch[1].length;
        // Find the most recent (innermost) class at a shallower indent level
        let currentClass = undefined;
        for (let j = classStack.length - 1; j >= 0; j--) {
          if (classStack[j].indent < funcIndent) {
            currentClass = classStack[j];
            break;
          }
        }
        
        currentChunk = {
          start: i,
          lines: [line],
          type: 'function',
          name: funcMatch[2],
          parent: currentClass?.name,
        };
        continue;
      }
      
      // Add line to current chunk
      if (currentChunk) {
        currentChunk.lines.push(line);
        
        // Check if we should close the chunk (dedent detected)
        if (indent !== -1 && line.trim() !== '') {
          // Get the indentation of the definition line (first line of chunk)
          const defLine = currentChunk.lines[0];
          const defIndent = defLine.search(/\S/);
          
          // If current line is at or before definition indent, close the chunk
          if (indent <= defIndent && i > currentChunk.start + 1) {
            // Dedent detected - close chunk
            currentChunk.lines.pop(); // Remove the dedented line
            chunks.push(this.createChunk(currentChunk, filename));
            currentChunk = null;
            
            // Update class stack
            classStack = classStack.filter(c => c.indent < indent);
            
            // Re-process this line
            i--;
          }
        }
      }
    }
    
    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createChunk(currentChunk, filename));
    }
    
    return chunks;
  }

  private createChunk(
    chunkData: { start: number; lines: string[]; type: 'function' | 'class'; name: string; parent?: string },
    filename: string
  ): ParsedChunk {
    return {
      content: chunkData.lines.join('\n'),
      metadata: {
        type: chunkData.type,
        name: chunkData.name,
        startLine: chunkData.start + 1,
        endLine: chunkData.start + chunkData.lines.length,
        parent: chunkData.parent,
        language: 'python',
      },
    };
  }
}

/**
 * JavaScript/TypeScript Parser - Extract classes, functions, and React components
 */
export class JavaScriptParser implements ContentParser {
  supports(filename: string, mimeType?: string): boolean {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    return extensions.some(ext => filename.endsWith(ext)) ||
           mimeType?.includes('javascript') ||
           mimeType?.includes('typescript');
  }

  parse(content: string, filename: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = content.split('\n');
    let braceDepth = 0;
    let currentChunk: { start: number; lines: string[]; type: 'function' | 'class' | 'component'; name: string; parent?: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip comments and empty lines when not in a chunk
      if (!currentChunk && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed === '')) {
        continue;
      }
      
      // Class definition
      const classMatch = line.match(/^\s*(?:export\s+)?class\s+(\w+)/);
      if (classMatch && !currentChunk) {
        currentChunk = {
          start: i,
          lines: [line],
          type: 'class',
          name: classMatch[1],
        };
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }
      
      // Function definition (including arrow functions with and without type annotations)
      // Matches: 
      //   - function name()
      //   - const name = () =>
      //   - const name = (param) =>
      //   - const name = (param: Type) =>
      //   - const name = (param): ReturnType =>
      //   - const name = async (param) =>
      const funcMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)(?:\s*:\s*\w+(?:<[^>]+>)?)?\s*=>|function\s*\()/);
      if (funcMatch && !currentChunk) {
        const name = funcMatch[1] || funcMatch[2] || 'anonymous';
        currentChunk = {
          start: i,
          lines: [line],
          type: 'function',
          name,
        };
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }
      
      // React component (functional component) - only if name starts with uppercase
      // This should come after function matching to avoid conflicts
      const componentMatch = line.match(/^\s*(?:export\s+)?(?:const|function)\s+([A-Z][A-Za-z0-9]*)\s*[=:]/);
      if (componentMatch && !currentChunk && !funcMatch) {
        currentChunk = {
          start: i,
          lines: [line],
          type: 'component',
          name: componentMatch[1],
        };
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }
      
      // Track brace depth and add lines to current chunk
      if (currentChunk) {
        currentChunk.lines.push(line);
        braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        
        // Close chunk when braces are balanced
        if (braceDepth <= 0 && currentChunk.lines.length > 1) {
          chunks.push({
            content: currentChunk.lines.join('\n'),
            metadata: {
              type: currentChunk.type,
              name: currentChunk.name,
              startLine: currentChunk.start + 1,
              endLine: i + 1,
              parent: currentChunk.parent,
              language: filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'typescript' : 'javascript',
            },
          });
          currentChunk = null;
          braceDepth = 0;
        }
      }
    }
    
    // Add final chunk if exists
    if (currentChunk) {
      chunks.push({
        content: currentChunk.lines.join('\n'),
        metadata: {
          type: currentChunk.type,
          name: currentChunk.name,
          startLine: currentChunk.start + 1,
          endLine: currentChunk.start + currentChunk.lines.length,
          parent: currentChunk.parent,
          language: filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'typescript' : 'javascript',
        },
      });
    }
    
    return chunks;
  }
}

/**
 * Markdown Parser - Extract sections by headers
 */
export class MarkdownParser implements ContentParser {
  supports(filename: string, mimeType?: string): boolean {
    return filename.endsWith('.md') || 
           filename.endsWith('.markdown') ||
           mimeType === 'text/markdown';
  }

  parse(content: string, filename: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = content.split('\n');
    let currentSection: { start: number; lines: string[]; level: number; title: string; parent?: string } | null = null;
    const sectionStack: Array<{ title: string; level: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section if exists
        if (currentSection) {
          chunks.push({
            content: currentSection.lines.join('\n'),
            metadata: {
              type: 'section',
              name: currentSection.title,
              startLine: currentSection.start + 1,
              endLine: i,
              sectionLevel: currentSection.level,
              parent: currentSection.parent,
            },
          });
        }
        
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        
        // Update section stack (remove sections at same or deeper level)
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }
        
        const parent = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].title : undefined;
        sectionStack.push({ title, level });
        
        currentSection = {
          start: i,
          lines: [line],
          level,
          title,
          parent,
        };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }
    
    // Add final section
    if (currentSection) {
      chunks.push({
        content: currentSection.lines.join('\n'),
        metadata: {
          type: 'section',
          name: currentSection.title,
          startLine: currentSection.start + 1,
          endLine: currentSection.start + currentSection.lines.length,
          sectionLevel: currentSection.level,
          parent: currentSection.parent,
        },
      });
    }
    
    return chunks;
  }
}

/**
 * PDF Parser - Extract text with page boundaries
 * Note: This extends the existing PDF extraction in chunking-service
 */
export class PDFParser implements ContentParser {
  supports(filename: string, mimeType?: string): boolean {
    return filename.endsWith('.pdf') || mimeType === 'application/pdf';
  }

  parse(content: string, filename: string): ParsedChunk[] {
    // PDF parsing requires binary data and is handled by pdf-parse library
    // This is a placeholder that indicates semantic chunking strategy
    // Actual PDF text extraction happens in chunking-service.extractPdfText()
    
    // Split by page markers if they exist in the extracted text
    const pagePattern = /\f|\n--- Page \d+ ---\n/;
    const pages = content.split(pagePattern);
    
    return pages.map((page, index) => ({
      content: page.trim(),
      metadata: {
        type: 'paragraph',
        pageNumber: index + 1,
        name: `Page ${index + 1}`,
        startLine: 0,
        endLine: page.split('\n').length,
      },
    }));
  }
}

/**
 * Parser Registry - Factory pattern to get appropriate parser
 */
export class ParserRegistry {
  private parsers: ContentParser[] = [
    new PythonParser(),
    new JavaScriptParser(),
    new MarkdownParser(),
    new PDFParser(),
  ];

  /**
   * Get the appropriate parser for a given file
   */
  getParser(filename: string, mimeType?: string): ContentParser | null {
    for (const parser of this.parsers) {
      if (parser.supports(filename, mimeType)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Check if content-aware parsing is available for this file
   */
  isSupported(filename: string, mimeType?: string): boolean {
    return this.getParser(filename, mimeType) !== null;
  }

  /**
   * Parse content using the appropriate parser
   */
  parse(content: string, filename: string, mimeType?: string): ParsedChunk[] | null {
    const parser = this.getParser(filename, mimeType);
    if (!parser) {
      return null;
    }
    return parser.parse(content, filename);
  }
}

// Export singleton instance
export const parserRegistry = new ParserRegistry();
