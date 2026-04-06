import * as path from "path";
import { CodeEntity, FileAnalysis } from "./entity-extractor";

/**
 * Generate a human-readable Markdown documentation report from an analysis result.
 */
export function generateDocumentation(
  rootPath: string,
  files: FileAnalysis[],
  glossary: Map<string, CodeEntity[]>
): string {
  const totalEntities = Array.from(glossary.values()).reduce((sum, arr) => sum + arr.length, 0);

  // Group files by directory
  const byDir = new Map<string, FileAnalysis[]>();
  for (const file of files) {
    const dir = path.dirname(file.relativePath) || ".";
    const existing = byDir.get(dir) || [];
    existing.push(file);
    byDir.set(dir, existing);
  }

  let doc = `# Codebase Analysis Report

## Summary
- **Root Path:** ${rootPath}
- **Total Files:** ${files.length}
- **Total Code Entities:** ${totalEntities}
- **Unique Entity Names:** ${glossary.size}

## Directory Structure

`;

  const sortedDirs = Array.from(byDir.keys()).sort();
  for (const dir of sortedDirs) {
    const dirFiles = byDir.get(dir)!;
    const entityCount = dirFiles.reduce((sum, f) => sum + f.entities.length, 0);
    doc += `### ${dir}/\n`;
    doc += `- ${dirFiles.length} files, ${entityCount} entities\n`;
    for (const f of dirFiles) {
      doc += `  - \`${path.basename(f.relativePath)}\` (${f.entities.length} entities)\n`;
    }
    doc += "\n";
  }

  doc += `## Entity Glossary\n\n`;

  const sortedEntities = Array.from(glossary.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 100); // Top 100 entities

  for (const [name, occurrences] of sortedEntities) {
    const types = Array.from(new Set(occurrences.map(o => o.type))).join(", ");
    const locations = occurrences.map(o => `${o.file}:${o.line}`).join(", ");
    doc += `### ${name}\n`;
    doc += `- **Type(s):** ${types}\n`;
    doc += `- **Locations:** ${locations}\n\n`;
  }

  return doc;
}
