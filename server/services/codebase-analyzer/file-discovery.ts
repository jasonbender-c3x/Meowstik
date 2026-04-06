import * as fs from "fs";
import * as path from "path";
import { CODE_EXTENSIONS, SKIP_DIRS, isDependencyFile } from "./constants";

/**
 * Recursively discover all code files under dirPath,
 * skipping directories listed in SKIP_DIRS and dot-directories.
 */
export async function discoverFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        const subFiles = await discoverFiles(fullPath);
        files.push(...subFiles);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext) || isDependencyFile(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}
