# Database Abstraction Layer

A generic, LLM-friendly database abstraction layer that enables interaction with multiple database types through a unified interface.

## Supported Databases

### Fully Implemented ✅
- **PostgreSQL** - Production-ready, full feature support
- **CSV Files** - Read/write tabular data with filtering, sorting
- **JSON Files** - Structured data with nested object support
- **XML Files** - Hierarchical data with simple parser

### Stub Implementations (Install Dependencies to Enable)
- **MySQL/MariaDB** - Install: `npm install mysql2`
- **SQLite** - Install: `npm install better-sqlite3`

## Quick Start

```typescript
import { createDatabaseAdapter, parseConnectionString } from './database-adapter';

// Auto-detect database type from connection string
const config = parseConnectionString('postgresql://localhost:5432/mydb');
const db = await createDatabaseAdapter(config);

// Connect
await db.connect();

// Query tables
const tables = await db.getTables();
console.log('Tables:', tables);

// Select data
const result = await db.select('users', {
  where: { active: true },
  limit: 10,
  orderBy: 'created_at DESC'
});

// Insert data
await db.insert('users', [
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' }
]);

// Update data
await db.update('users', 
  { status: 'verified' }, 
  { email: 'john@example.com' }
);

// Delete data
await db.delete('users', { status: 'inactive' });

// Export to different formats
await db.export('/path/to/backup.sql', {
  format: 'sql',
  includeSchema: true,
  includeData: true,
  compress: true
});

// Disconnect
await db.disconnect();
```

## Connection Strings

The system auto-detects database type from connection strings:

```typescript
// PostgreSQL
'postgresql://user:pass@host:5432/database'
'postgres://user:pass@host:5432/database'

// MySQL (requires mysql2 package)
'mysql://user:pass@host:3306/database'

// SQLite (requires better-sqlite3 package)
'/path/to/database.sqlite'
'/path/to/database.db'

// CSV
'/path/to/data.csv'

// JSON
'/path/to/data.json'

// XML
'/path/to/data.xml'
```

## File Format Adapters

### CSV Adapter

CSV files are treated as a single-table database named "data":

```typescript
const db = await createDatabaseAdapter({
  type: 'csv',
  filePath: '/path/to/users.csv'
});

await db.connect();

// Read data
const users = await db.select('data', { limit: 100 });

// Add rows
await db.insert('data', [
  { name: 'Alice', age: '30', city: 'NYC' }
]);

// Update rows
await db.update('data', { city: 'SF' }, { name: 'Alice' });

// Export to JSON
await db.export('/path/to/users.json', { format: 'json' });
```

### JSON Adapter

JSON files support multiple "tables" (top-level arrays):

```typescript
// data.json structure:
// {
//   "users": [{ "id": 1, "name": "John" }],
//   "posts": [{ "id": 1, "title": "Hello" }]
// }

const db = await createDatabaseAdapter({
  type: 'json',
  filePath: '/path/to/data.json'
});

await db.connect();

// List tables
const tables = await db.getTables(); // ['users', 'posts']

// Query table
const users = await db.select('users', {
  where: { name: 'John' }
});

// Add to table
await db.insert('posts', [
  { id: 2, title: 'World', author: 'John' }
]);

// Export to CSV
await db.export('/path/to/users.csv', {
  format: 'csv',
  tables: ['users']
});
```

### XML Adapter

XML files support hierarchical data structures:

```typescript
// data.xml structure:
// <root>
//   <users>
//     <user id="1" name="John"/>
//     <user id="2" name="Jane"/>
//   </users>
// </root>

const db = await createDatabaseAdapter({
  type: 'xml',
  filePath: '/path/to/data.xml'
});

await db.connect();

// List tables
const tables = await db.getTables(); // ['users']

// Query
const users = await db.select('users');

// Export to JSON
await db.export('/path/to/data.json', { format: 'json' });
```

## Interface Methods

All adapters implement the same interface:

```typescript
interface IDatabaseAdapter {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  
  // Schema
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  getRowCount(tableName: string): Promise<number>;
  
  // Queries
  query(sql: string, params?: any[]): Promise<QueryResult>;
  select(tableName: string, options?: SelectOptions): Promise<QueryResult>;
  insert(tableName: string, rows: any[]): Promise<number>;
  update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number>;
  delete(tableName: string, where?: Record<string, any>): Promise<number>;
  
  // Import/Export
  export(outputPath: string, options?: ExportOptions): Promise<void>;
  import(inputPath: string, options?: ImportOptions): Promise<void>;
  
  // Transactions
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  
  // Metadata
  getType(): DatabaseType;
}
```

## Format Conversion

Convert between different formats:

```typescript
// CSV to JSON
const csv = await createDatabaseAdapter({ type: 'csv', filePath: 'data.csv' });
await csv.connect();
await csv.export('data.json', { format: 'json', pretty: true });

// JSON to CSV (single table)
const json = await createDatabaseAdapter({ type: 'json', filePath: 'data.json' });
await json.connect();
await json.export('users.csv', { format: 'csv', tables: ['users'] });

// PostgreSQL to JSON
const pg = await createDatabaseAdapter({ type: 'postgresql', connectionString: process.env.DATABASE_URL });
await pg.connect();
await pg.export('backup.json', { format: 'json' });
```

## Transactions

SQL databases support transactions:

```typescript
const db = await createDatabaseAdapter(config);
await db.connect();

try {
  await db.beginTransaction();
  
  await db.insert('users', [{ name: 'Test' }]);
  await db.update('stats', { count: 10 });
  
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

## LLM Integration

This abstraction layer is designed to be LLM-friendly:

1. **Unified Interface**: Single set of methods works across all database types
2. **Simple API**: Clear, predictable method signatures
3. **Type Safety**: TypeScript interfaces provide structure
4. **Error Handling**: Consistent error messages across adapters
5. **Format Flexibility**: Easy conversion between formats

Example LLM prompt:

```
I have a PostgreSQL database at postgresql://localhost/mydb.
Export the "users" table to CSV format.

// LLM can generate:
const db = await createDatabaseAdapter(
  parseConnectionString('postgresql://localhost/mydb')
);
await db.connect();
await db.export('users.csv', { 
  format: 'csv',
  tables: ['users'] 
});
```

## Adding New Database Types

To add support for a new database:

1. Create adapter file: `server/database/[type]-adapter.ts`
2. Implement `IDatabaseAdapter` interface
3. Add case to `createDatabaseAdapter()` factory in `database-adapter.ts`
4. Add detection logic to `detectDatabaseType()`
5. Update documentation

## Dependencies

### Required (Included)
- `pg` - PostgreSQL driver
- `csv-parse` - CSV parsing
- `csv-stringify` - CSV generation

### Optional (Install as Needed)
```bash
# MySQL/MariaDB support
npm install mysql2

# SQLite support
npm install better-sqlite3 @types/better-sqlite3
```

## Security Considerations

- Always use parameterized queries for SQL databases
- Validate file paths before opening files
- Be cautious with XML/JSON depth (prevent DoS)
- Use connection pooling for production SQL databases
- Enable SSL for remote database connections

## Examples

See `scripts/db-adapter-examples.ts` for complete usage examples.

## License

Part of the Meowstik project.
