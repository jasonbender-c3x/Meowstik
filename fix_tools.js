const fs = require('fs');
const path = require('path');

const filePath = 'server/services/tool-dispatcher.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix ReferenceErrors in executeFilePut
// Replace the entire executeFilePut method to be safe
const filePutStart = content.indexOf('private async executeFilePut(toolCall: ToolCall): Promise<unknown> {');
const filePutEnd = content.indexOf('  /**\n   * Log Append Tool', filePutStart);

if (filePutStart !== -1 && filePutEnd !== -1) {
  const newFilePut = `private async executeFilePut(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      path: string; 
      content: string; 
      mimeType?: string;
      permissions?: string;
      summary?: string;
    };
    
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('file_put requires a path parameter');
    }
    if (params.content === undefined || params.content === null) {
      throw new Error('file_put requires a content parameter');
    }

    const parsed = parsePathPrefix(params.path, 'server');
    const actualPath = parsed.path;

    if (parsed.target === 'editor') {
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'editor',
        content: params.content,
        mimeType: params.mimeType || this.detectMimeType(actualPath),
        summary: params.summary,
        message: \`File saved to editor canvas: \${actualPath}. View at /editor\`
      };
    }

    if (parsed.target === 'client') {
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: paths.');
      }
      await clientRouter.writeFile(actualPath, params.content, { permissions: params.permissions });
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'client',
        mimeType: params.mimeType || this.detectMimeType(actualPath),
        summary: params.summary,
        message: \`File written to client: \${actualPath}\`
      };
    }

    const sanitizedPath = actualPath.replace(/\\.\\./g, "");
    let fullPath = path.isAbsolute(sanitizedPath) ? path.normalize(sanitizedPath) : path.normalize(path.join(this.workspaceDir, sanitizedPath));
    
    if (!path.isAbsolute(sanitizedPath)) {
        const relativePath = path.relative(this.workspaceDir, fullPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error(\`Access denied: Path traversal detected.\`);
        }
    }
    
    try {
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, params.content, 'utf8');
      
      if (params.permissions) {
        try {
          await fs.promises.chmod(fullPath, parseInt(params.permissions, 8));
        } catch (error) {
          console.warn(\`[RAGDispatcher] Failed to set permissions on \${sanitizedPath}:\`, error);
        }
      }

      return {
        type: 'file_put',
        path: sanitizedPath,
        destination: 'server',
        mimeType: params.mimeType || this.detectMimeType(sanitizedPath),
        summary: params.summary,
        success: true,
        message: \`File written to: \${sanitizedPath}\`
      };
    } catch (error) {
      return {
        type: 'file_put',
        path: sanitizedPath,
        destination: 'server',
        success: false,
        error: \`Failed to write file: \${error.message || String(error)}\`
      };
    }
  }
`;
  content = content.substring(0, filePutStart) + newFilePut + content.substring(filePutEnd);
}

// 2. Fix executeDbTables for SQLite
const dbTablesStart = content.indexOf('private async executeDbTables(toolCall: ToolCall): Promise<unknown> {');
const dbTablesEnd = content.indexOf('  /**', dbTablesStart + 1);

if (dbTablesStart !== -1 && dbTablesEnd !== -1) {
  const newDbTables = `private async executeDbTables(toolCall: ToolCall): Promise<unknown> {
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      
      // Use raw SQLite query to list tables
      const tablesResult = await db.all(sql\`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\`);

      const tables: Record<string, { columns: any[] }> = {};
      
      for (const row of (tablesResult as any)) {
        const tableName = row.name;
        const columnsResult = await db.all(sql.raw(\`PRAGMA table_info("\${tableName}")\`));
        tables[tableName] = {
          columns: (columnsResult as any).map(c => ({
            name: c.name,
            type: c.type,
            nullable: c.notnull === 0,
            default: c.dflt_value
          }))
        };
      }

      return {
        type: "db_tables",
        success: true,
        tables,
        tableCount: Object.keys(tables).length,
        message: \`Found \${Object.keys(tables).length} tables in the database\`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        type: "db_tables",
        success: false,
        error: errorMessage,
        message: \`Failed to list tables: \${errorMessage}\`
      };
    }
  }
`;
  content = content.substring(0, dbTablesStart) + newDbTables + content.substring(dbTablesEnd);
}

// 3. Fix executeDbQuery
content = content.replace(
  /const result = await db\.execute\(queryToExecute\);/g,
  "const { sql } = await import('drizzle-orm');\n      const result = await db.all(sql.raw(queryToExecute));"
);
content = content.replace(/rows: result\.rows,/g, "rows: result,");
content = content.replace(/rowCount: result\.rows\.length,/g, "rowCount: (result as any).length,");
content = content.replace(/\$\{result\.rows\.length\}/g, "${(result as any).length}");

fs.writeFileSync(filePath, content);
console.log('Patched tool-dispatcher.ts successfully');
