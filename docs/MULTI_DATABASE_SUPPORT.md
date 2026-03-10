# Multi-Database Support Implementation

## Overview

Meowstik now includes a comprehensive database abstraction layer that enables the LLM to interact with multiple database types and file formats through a unified interface.

## Supported Formats

### Production-Ready ✅
- **PostgreSQL** - Full SQL database support with transactions
- **CSV Files** - Tabular data with headers
- **JSON Files** - Structured data with nested objects
- **XML Files** - Hierarchical data structures

### Coming Soon (Stub Implementations)
- **MySQL/MariaDB** - Install `mysql2` to enable
- **SQLite** - Install `better-sqlite3` to enable

## Key Features

### 1. Unified Interface
All database types implement the same `IDatabaseAdapter` interface:
- `connect()` / `disconnect()` - Connection management
- `getTables()` / `getTableSchema()` - Schema introspection
- `select()` / `insert()` / `update()` / `delete()` - CRUD operations
- `export()` / `import()` - Format conversion
- `beginTransaction()` / `commit()` / `rollback()` - Transaction support

### 2. Auto-Detection
The system automatically detects database type from connection strings:
```
postgresql://...  → PostgreSQL
mysql://...       → MySQL
/path/to/file.csv → CSV
/path/to/file.json → JSON
/path/to/file.xml  → XML
```

### 3. Format Conversion
Easy conversion between formats:
- SQL databases ↔ CSV
- SQL databases ↔ JSON
- CSV ↔ JSON ↔ XML
- Any format to any other format

### 4. LLM-Friendly API
Simple, predictable method signatures that LLMs can easily understand and generate code for.

## Architecture

```
server/database/
├── database-adapter.ts       # Core interface and factory
├── postgresql-adapter.ts     # PostgreSQL implementation
├── csv-adapter.ts           # CSV file implementation
├── json-adapter.ts          # JSON file implementation
├── xml-adapter.ts           # XML file implementation
├── mysql-adapter.ts         # MySQL stub (requires mysql2)
├── sqlite-adapter.ts        # SQLite stub (requires better-sqlite3)
└── README.md                # Detailed documentation
```

## Usage Examples

### Basic Connection
```typescript
import { createDatabaseAdapter, parseConnectionString } from './server/database/database-adapter';

// Auto-detect from connection string
const config = parseConnectionString('postgresql://localhost:5432/mydb');
const db = await createDatabaseAdapter(config);

await db.connect();
const tables = await db.getTables();
await db.disconnect();
```

### CSV Manipulation
```typescript
const db = await createDatabaseAdapter({
  type: 'csv',
  filePath: '/path/to/data.csv'
});

await db.connect();

// Read data
const result = await db.select('data', {
  where: { status: 'active' },
  limit: 10
});

// Add rows
await db.insert('data', [
  { name: 'Alice', status: 'active' }
]);

// Export to JSON
await db.export('/path/to/output.json', { format: 'json' });

await db.disconnect();
```

### JSON Database
```typescript
const db = await createDatabaseAdapter({
  type: 'json',
  filePath: '/path/to/database.json'
});

await db.connect();

// JSON files support multiple "tables"
const tables = await db.getTables(); // e.g., ['users', 'posts']

// Query a table
const users = await db.select('users', {
  where: { age: 30 }
});

// Update records
await db.update('users', 
  { verified: true }, 
  { email: 'alice@example.com' }
);

await db.disconnect();
```

### Format Conversion
```typescript
// CSV to JSON
const csv = await createDatabaseAdapter({ type: 'csv', filePath: 'data.csv' });
await csv.connect();
await csv.export('data.json', { format: 'json', pretty: true });
await csv.disconnect();

// JSON to CSV
const json = await createDatabaseAdapter({ type: 'json', filePath: 'data.json' });
await json.connect();
await json.export('data.csv', { format: 'csv', tables: ['users'] });
await json.disconnect();
```

## LLM Integration

The abstraction layer is designed specifically for LLM interaction:

### Example LLM Prompt:
```
I have a CSV file at /data/users.csv with columns: name, email, age.
Filter for users over 30 and export to JSON.
```

### LLM Generated Code:
```typescript
const db = await createDatabaseAdapter({
  type: 'csv',
  filePath: '/data/users.csv'
});

await db.connect();

const result = await db.select('data', {
  where: (row) => parseInt(row.age) > 30
});

await db.export('/data/filtered-users.json', {
  format: 'json',
  pretty: true
});

await db.disconnect();
```

## Security

### SQL Injection Protection
- PostgreSQL adapter uses parameterized queries
- All user input is properly escaped

### File System Safety
- Validates file paths before operations
- Prevents directory traversal attacks
- Checks file existence and permissions

### Resource Management
- Connection pooling for SQL databases
- Automatic cleanup on disconnect
- Transaction rollback on errors

## Performance

### SQL Databases
- Uses connection pooling
- Prepared statements for repeated queries
- Batch inserts supported

### File Formats
- Streaming for large files
- Lazy loading where possible
- Efficient parsing libraries (csv-parse, etc.)

## Dependencies

### Required (Already Installed)
- `pg` - PostgreSQL driver
- `drizzle-orm` - ORM for PostgreSQL

### New Dependencies (Added)
- `csv-parse` - CSV parsing
- `csv-stringify` - CSV generation

### Optional (User Can Install)
- `mysql2` - MySQL support
- `better-sqlite3` - SQLite support

## Testing

Run examples:
```bash
tsx scripts/db-adapter-examples.ts
```

## Extending

To add support for a new database type:

1. Create adapter file: `server/database/[type]-adapter.ts`
2. Implement `IDatabaseAdapter` interface
3. Add to factory in `database-adapter.ts`
4. Add detection logic to `detectDatabaseType()`
5. Update documentation

See `mysql-adapter.ts` for stub template.

## Migration Path

### For Existing Code
The existing PostgreSQL-specific code continues to work unchanged. The new abstraction layer is additive:

- Old: Direct use of `storage` singleton
- New: Can use `createDatabaseAdapter()` for flexibility
- Both: Work side-by-side

### For New Features
Use the abstraction layer for new database-related features to enable multi-database support from the start.

## Future Enhancements

Potential additions:
- MongoDB adapter (NoSQL)
- Redis adapter (key-value)
- DynamoDB adapter (AWS)
- GraphQL adapter (API layer)
- Firestore adapter (Google Cloud)

## Documentation

- **Main README**: `server/database/README.md` - Complete API documentation
- **Examples**: `scripts/db-adapter-examples.ts` - Working examples
- **This Document**: Architecture and integration guide

## Related Files

- `scripts/db-export.ts` - PostgreSQL export utility (existing)
- `scripts/db-import.ts` - PostgreSQL import utility (existing)
- `scripts/db-migrate.ts` - Migration orchestration (existing)
- `server/storage.ts` - App storage layer (existing)
- `shared/schema.ts` - Database schema definitions (existing)

## Configuration

Add to `.env.example`:
```bash
# Database connections (examples)
DATABASE_URL=postgresql://...
MYSQL_URL=mysql://...
SQLITE_PATH=/path/to/db.sqlite

# File-based databases
CSV_DATA_PATH=/path/to/data.csv
JSON_DATA_PATH=/path/to/data.json
XML_DATA_PATH=/path/to/data.xml
```

## Benefits for LLM

1. **Consistency**: Same API across all database types
2. **Simplicity**: Clear, predictable methods
3. **Flexibility**: Easy format conversion
4. **Type Safety**: TypeScript interfaces provide structure
5. **Error Handling**: Consistent error messages
6. **Discoverability**: Well-documented with examples

## Conclusion

The database abstraction layer significantly enhances Meowstik's capabilities, allowing the LLM to work with various data sources through a single, unified interface. This makes database manipulation more accessible and flexible while maintaining type safety and security.
