/**
 * =============================================================================
 * MEOWSTIK - CODEBASE ANALYSIS AGENT
 * =============================================================================
 *
 * Autonomous agent that crawls a codebase, extracts code entities (functions,
 * classes, variables), and generates documentation.
 *
 * PIPELINE:
 * ---------
 * 1. Recursive file discovery   (file-discovery.ts)
 * 2. Code entity extraction     (entity-extractor.ts)
 * 3. Glossary generation        (glossary.ts)
 * 4. Documentation synthesis    (doc-synthesizer.ts)
 * =============================================================================
 */

import { discoverFiles } from "./file-discovery";
import { analyzeFile } from "./entity-extractor";
import { buildGlossary } from "./glossary";
import { generateDocumentation } from "./doc-synthesizer";

// Re-export public types so callers can continue to import from this module
export type { CodeEntity, FileAnalysis } from "./entity-extractor";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface AnalysisProgress {
  phase: "discovery" | "extraction" | "ingestion" | "glossary" | "documentation" | "complete";
  filesDiscovered: number;
  filesProcessed: number;
  entitiesFound: number;
  /** Always 0 – kept for API compatibility after RAG ingestion was removed. */
  chunksIngested: number;
  currentFile?: string;
  errors: string[];
}

export interface AnalysisResult {
  rootPath: string;
  totalFiles: number;
  totalEntities: number;
  /** Always 0 – kept for API compatibility after RAG ingestion was removed. */
  totalChunks: number;
  files: import("./entity-extractor").FileAnalysis[];
  glossary: Map<string, import("./entity-extractor").CodeEntity[]>;
  documentation: string;
  errors: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class CodebaseAnalyzer {
  private progress: AnalysisProgress = {
    phase: "discovery",
    filesDiscovered: 0,
    filesProcessed: 0,
    entitiesFound: 0,
    chunksIngested: 0,
    errors: [],
  };

  private progressCallback?: (progress: AnalysisProgress) => void;

  /** Set a callback to receive progress updates. */
  onProgress(callback: (progress: AnalysisProgress) => void): void {
    this.progressCallback = callback;
  }

  private updateProgress(updates: Partial<AnalysisProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.progressCallback?.(this.progress);
  }

  /**
   * Analyse an entire codebase.
   * @param rootPath     - Root directory to analyse.
   * @param _skipIngestion - Deprecated parameter kept for API compatibility.
   */
  async analyzeCodebase(rootPath: string, _skipIngestion = false): Promise<AnalysisResult> {
    // Reset progress so repeated calls on the same singleton don't accumulate stale counts
    this.progress = {
      phase: "discovery",
      filesDiscovered: 0,
      filesProcessed: 0,
      entitiesFound: 0,
      chunksIngested: 0,
      errors: [],
    };

    const startTime = Date.now();
    const files: import("./entity-extractor").FileAnalysis[] = [];
    const errors: string[] = [];

    try {
      // Phase 1: File Discovery
      this.updateProgress({ phase: "discovery" });
      const filePaths = await discoverFiles(rootPath);
      this.updateProgress({ filesDiscovered: filePaths.length });

      // Phase 2: Entity Extraction
      this.updateProgress({ phase: "extraction" });
      for (const filePath of filePaths) {
        try {
          this.updateProgress({ currentFile: filePath });
          const analysis = await analyzeFile(filePath, rootPath);
          files.push(analysis);

          this.updateProgress({
            filesProcessed: this.progress.filesProcessed + 1,
            entitiesFound: this.progress.entitiesFound + analysis.entities.length,
          });
        } catch (err) {
          const errorMsg = `Error analyzing ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errorMsg);
          this.updateProgress({ errors: [...this.progress.errors, errorMsg] });
        }
      }

      // Phase 3: Glossary Generation
      this.updateProgress({ phase: "glossary" });
      const glossary = buildGlossary(files);

      // Phase 4: Documentation Synthesis
      this.updateProgress({ phase: "documentation" });
      const documentation = generateDocumentation(rootPath, files, glossary);

      this.updateProgress({ phase: "complete" });

      return {
        rootPath,
        totalFiles: files.length,
        totalEntities: this.progress.entitiesFound,
        totalChunks: 0,
        files,
        glossary,
        documentation,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = `Fatal error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errorMsg);
      return {
        rootPath,
        totalFiles: files.length,
        totalEntities: this.progress.entitiesFound,
        totalChunks: 0,
        files,
        glossary: new Map(),
        documentation: "",
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /** Get a snapshot of the current progress. */
  getProgress(): AnalysisProgress {
    return { ...this.progress };
  }
}

export const codebaseAnalyzer = new CodebaseAnalyzer();
