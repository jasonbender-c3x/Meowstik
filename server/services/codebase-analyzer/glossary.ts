import { CodeEntity, FileAnalysis } from "./entity-extractor";

/**
 * Build a glossary (entity-name → occurrences) from an array of file analyses.
 * The glossary is constructed incrementally during extraction and simply
 * aggregated here.
 */
export function buildGlossary(files: FileAnalysis[]): Map<string, CodeEntity[]> {
  const glossary = new Map<string, CodeEntity[]>();

  for (const file of files) {
    for (const entity of file.entities) {
      const existing = glossary.get(entity.name) || [];
      existing.push(entity);
      glossary.set(entity.name, existing);
    }
  }

  return glossary;
}
