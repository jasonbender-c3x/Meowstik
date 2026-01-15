/**
 * =============================================================================
 * XML FILE ADAPTER
 * =============================================================================
 * 
 * XML file adapter for reading and writing hierarchical data.
 * Converts XML to/from JSON-like structure for manipulation.
 * =============================================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  IDatabaseAdapter,
  ConnectionConfig,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ExportOptions,
  ImportOptions,
  DatabaseType
} from './database-adapter';

// Simple XML parser and builder
class SimpleXMLParser {
  parse(xml: string): any {
    // Remove XML declaration and comments
    xml = xml.replace(/<\?xml[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();

    const result: any = {};
    const stack: any[] = [result];
    const tagRegex = /<\/?([^\s>\/]+)([^>]*)>/g;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(xml)) !== null) {
      const [fullMatch, tagName, attributes] = match;
      const isClosing = fullMatch.startsWith('</');
      const isSelfClosing = fullMatch.endsWith('/>');

      // Get text content between tags
      if (lastIndex < match.index) {
        const text = xml.substring(lastIndex, match.index).trim();
        if (text) {
          const current = stack[stack.length - 1];
          if (typeof current === 'object' && !Array.isArray(current)) {
            current._text = text;
          }
        }
      }

      if (!isClosing) {
        // Opening or self-closing tag
        const parent = stack[stack.length - 1];
        const newNode: any = isSelfClosing ? { _text: '' } : {};

        // Parse attributes
        const attrRegex = /(\w+)="([^"]*)"/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
          newNode[`@${attrMatch[1]}`] = attrMatch[2];
        }

        if (!parent[tagName]) {
          parent[tagName] = newNode;
        } else if (Array.isArray(parent[tagName])) {
          parent[tagName].push(newNode);
        } else {
          parent[tagName] = [parent[tagName], newNode];
        }

        if (!isSelfClosing) {
          stack.push(newNode);
        }
      } else {
        // Closing tag
        stack.pop();
      }

      lastIndex = tagRegex.lastIndex;
    }

    return result;
  }

  build(obj: any, rootName = 'root', indent = 0): string {
    const spaces = '  '.repeat(indent);
    let xml = '';

    if (typeof obj !== 'object' || obj === null) {
      return obj?.toString() || '';
    }

    for (const key in obj) {
      if (key === '_text') continue;
      if (key.startsWith('@')) continue;

      const value = obj[key];

      if (Array.isArray(value)) {
        value.forEach(item => {
          xml += `${spaces}<${key}`;
          
          // Add attributes
          if (typeof item === 'object') {
            for (const attrKey in item) {
              if (attrKey.startsWith('@')) {
                xml += ` ${attrKey.substring(1)}="${item[attrKey]}"`;
              }
            }
          }

          const text = item._text || '';
          const hasChildren = Object.keys(item).some(k => !k.startsWith('@') && k !== '_text');

          if (!hasChildren && !text) {
            xml += '/>\n';
          } else {
            xml += '>';
            if (hasChildren) {
              xml += '\n' + this.build(item, key, indent + 1) + spaces;
            } else {
              xml += text;
            }
            xml += `</${key}>\n`;
          }
        });
      } else {
        xml += `${spaces}<${key}`;

        // Add attributes
        if (typeof value === 'object') {
          for (const attrKey in value) {
            if (attrKey.startsWith('@')) {
              xml += ` ${attrKey.substring(1)}="${value[attrKey]}"`;
            }
          }
        }

        const text = value?._text || '';
        const hasChildren = typeof value === 'object' && Object.keys(value).some(k => !k.startsWith('@') && k !== '_text');

        if (!hasChildren && !text) {
          xml += '/>\n';
        } else {
          xml += '>';
          if (hasChildren) {
            xml += '\n' + this.build(value, key, indent + 1) + spaces;
          } else if (typeof value === 'object') {
            xml += text;
          } else {
            xml += value;
          }
          xml += `</${key}>\n`;
        }
      }
    }

    return xml;
  }
}

export class XMLAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;
  private data: any = {};
  private parser = new SimpleXMLParser();
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path is required for XML adapter');
    }

    if (existsSync(this.config.filePath)) {
      const content = readFileSync(this.config.filePath, 'utf-8');
      this.data = this.parser.parse(content);
    } else {
      this.data = { root: {} };
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error('Raw SQL queries are not supported for XML files. Use select/insert/update/delete methods.');
  }

  async getTables(): Promise<string[]> {
    // Each top-level array in the XML structure is treated as a table
    const tables: string[] = [];
    const root = this.data.root || this.data;
    
    for (const key in root) {
      if (Array.isArray(root[key]) || (typeof root[key] === 'object' && !key.startsWith('@') && key !== '_text')) {
        tables.push(key);
      }
    }
    
    return tables;
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const root = this.data.root || this.data;
    const table = root[tableName];
    
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const items = Array.isArray(table) ? table : [table];
    if (items.length === 0) {
      return { name: tableName, columns: [] };
    }

    // Infer schema from first item
    const columns: ColumnSchema[] = [];
    const firstItem = items[0];
    
    for (const key in firstItem) {
      if (!key.startsWith('@') && key !== '_text') {
        columns.push({
          name: key,
          type: typeof firstItem[key],
          nullable: true
        });
      }
    }

    return { name: tableName, columns };
  }

  async getRowCount(tableName: string): Promise<number> {
    const root = this.data.root || this.data;
    const table = root[tableName];
    
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    return Array.isArray(table) ? table.length : 1;
  }

  async select(tableName: string, options?: {
    columns?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<QueryResult> {
    const root = this.data.root || this.data;
    const table = root[tableName];
    
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    let rows = Array.isArray(table) ? [...table] : [table];

    // Apply where filter
    if (options?.where) {
      rows = rows.filter(row => {
        return Object.entries(options.where!).every(([key, value]) => {
          return row[key] === value || row[key]?._text === value;
        });
      });
    }

    // Apply offset and limit
    const offset = options?.offset || 0;
    const limit = options?.limit || rows.length;
    rows = rows.slice(offset, offset + limit);

    return {
      rows,
      rowCount: rows.length
    };
  }

  async insert(tableName: string, rows: any[]): Promise<number> {
    const root = this.data.root || this.data;
    
    if (!root[tableName]) {
      root[tableName] = [];
    }

    if (!Array.isArray(root[tableName])) {
      root[tableName] = [root[tableName]];
    }

    root[tableName].push(...rows);
    await this.save();

    return rows.length;
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    const root = this.data.root || this.data;
    const table = root[tableName];
    
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    let items = Array.isArray(table) ? table : [table];
    let count = 0;

    items = items.map(row => {
      const matches = !where || Object.entries(where).every(([key, value]) => {
        return row[key] === value || row[key]?._text === value;
      });

      if (matches) {
        count++;
        return { ...row, ...data };
      }
      return row;
    });

    root[tableName] = Array.isArray(table) ? items : items[0];
    await this.save();
    return count;
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    const root = this.data.root || this.data;
    const table = root[tableName];
    
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const items = Array.isArray(table) ? table : [table];
    const initialLength = items.length;

    if (!where) {
      root[tableName] = [];
    } else {
      const filtered = items.filter(row => {
        return !Object.entries(where).every(([key, value]) => {
          return row[key] === value || row[key]?._text === value;
        });
      });
      root[tableName] = filtered.length > 1 ? filtered : filtered[0];
    }

    await this.save();
    return initialLength - (root[tableName] ? (Array.isArray(root[tableName]) ? root[tableName].length : 1) : 0);
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    const format = options?.format || 'xml';

    if (format === 'xml') {
      await this.save(outputPath);
    } else if (format === 'json') {
      writeFileSync(outputPath, JSON.stringify(this.data, null, options?.pretty ? 2 : 0), 'utf-8');
    } else {
      throw new Error(`Export format ${format} not supported for XML adapter`);
    }
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    const format = options?.format || 'xml';

    if (format === 'xml') {
      const content = readFileSync(inputPath, 'utf-8');
      const imported = this.parser.parse(content);

      if (options?.truncateFirst) {
        this.data = imported;
      } else {
        this.data = { ...this.data, ...imported };
      }

      await this.save();
    } else if (format === 'json') {
      const content = readFileSync(inputPath, 'utf-8');
      const imported = JSON.parse(content);

      if (options?.truncateFirst) {
        this.data = imported;
      } else {
        this.data = { ...this.data, ...imported };
      }

      await this.save();
    } else {
      throw new Error(`Import format ${format} not supported for XML adapter`);
    }
  }

  getType(): DatabaseType {
    return 'xml';
  }

  async beginTransaction(): Promise<void> {
    // XML files don't support transactions
  }

  async commit(): Promise<void> {
    await this.save();
  }

  async rollback(): Promise<void> {
    await this.connect(); // Reload from file
  }

  // Helper methods

  private async save(outputPath?: string): Promise<void> {
    const path = outputPath || this.config.filePath;
    if (!path) {
      throw new Error('No output path specified');
    }

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + this.parser.build(this.data);
    writeFileSync(path, xml, 'utf-8');
  }
}
