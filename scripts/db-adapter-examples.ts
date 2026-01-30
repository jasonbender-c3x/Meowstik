#!/usr/bin/env tsx
/**
 * =============================================================================
 * DATABASE ADAPTER USAGE EXAMPLES
 * =============================================================================
 * 
 * Examples demonstrating how to use the generic database abstraction layer.
 * Run with: tsx scripts/db-adapter-examples.ts
 * =============================================================================
 */

import { createDatabaseAdapter, parseConnectionString } from '../server/database/database-adapter';

async function examplePostgreSQL() {
  console.log('\n=== PostgreSQL Example ===\n');

  const config = parseConnectionString(process.env.DATABASE_URL || 'postgresql://localhost:5432/test');
  const db = await createDatabaseAdapter(config);

  try {
    await db.connect();
    console.log('✓ Connected to PostgreSQL');

    const tables = await db.getTables();
    console.log('✓ Tables:', tables.slice(0, 5).join(', '));

    if (tables.length > 0) {
      const count = await db.getRowCount(tables[0]);
      console.log(`✓ Row count in ${tables[0]}: ${count}`);
    }

    await db.disconnect();
    console.log('✓ Disconnected');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

async function exampleCSV() {
  console.log('\n=== CSV Example ===\n');

  const db = await createDatabaseAdapter({
    type: 'csv',
    filePath: '/tmp/test-data.csv'
  });

  try {
    await db.connect();
    console.log('✓ Connected to CSV file');

    // Insert sample data
    await db.insert('data', [
      { name: 'Alice', age: '30', city: 'NYC' },
      { name: 'Bob', age: '25', city: 'SF' },
      { name: 'Charlie', age: '35', city: 'LA' }
    ]);
    console.log('✓ Inserted 3 rows');

    // Select data
    const result = await db.select('data', {
      where: { city: 'NYC' }
    });
    console.log(`✓ Selected ${result.rowCount} rows matching city=NYC`);

    // Export to JSON
    await db.export('/tmp/test-data.json', { format: 'json', pretty: true });
    console.log('✓ Exported to JSON');

    await db.disconnect();
    console.log('✓ Disconnected');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

async function exampleJSON() {
  console.log('\n=== JSON Example ===\n');

  const db = await createDatabaseAdapter({
    type: 'json',
    filePath: '/tmp/test-data.json'
  });

  try {
    await db.connect();
    console.log('✓ Connected to JSON file');

    // Create a new table
    await db.insert('users', [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' }
    ]);
    console.log('✓ Inserted users');

    // Query
    const result = await db.select('users', {
      where: { name: 'John' }
    });
    console.log(`✓ Found user: ${JSON.stringify(result.rows[0])}`);

    // Update
    await db.update('users', { email: 'newemail@example.com' }, { name: 'John' });
    console.log('✓ Updated user email');

    // Export to CSV
    await db.export('/tmp/users.csv', { format: 'csv', tables: ['users'] });
    console.log('✓ Exported to CSV');

    await db.disconnect();
    console.log('✓ Disconnected');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

async function exampleXML() {
  console.log('\n=== XML Example ===\n');

  const db = await createDatabaseAdapter({
    type: 'xml',
    filePath: '/tmp/test-data.xml'
  });

  try {
    await db.connect();
    console.log('✓ Connected to XML file');

    // Insert data
    await db.insert('products', [
      { id: '1', name: 'Widget', price: '9.99' },
      { id: '2', name: 'Gadget', price: '19.99' }
    ]);
    console.log('✓ Inserted products');

    // Query
    const result = await db.select('products');
    console.log(`✓ Found ${result.rowCount} products`);

    // Export to JSON
    await db.export('/tmp/products.json', { format: 'json', pretty: true });
    console.log('✓ Exported to JSON');

    await db.disconnect();
    console.log('✓ Disconnected');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

async function exampleFormatConversion() {
  console.log('\n=== Format Conversion Example ===\n');

  try {
    // CSV -> JSON
    const csv = await createDatabaseAdapter({ type: 'csv', filePath: '/tmp/test-data.csv' });
    await csv.connect();
    await csv.export('/tmp/converted.json', { format: 'json', pretty: true });
    console.log('✓ Converted CSV to JSON');
    await csv.disconnect();

    // JSON -> CSV
    const json = await createDatabaseAdapter({ type: 'json', filePath: '/tmp/converted.json' });
    await json.connect();
    await json.export('/tmp/converted.csv', { format: 'csv', tables: ['data'] });
    console.log('✓ Converted JSON to CSV');
    await json.disconnect();

    console.log('✓ Format conversion complete');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

// Run all examples
async function main() {
  console.log('====================================');
  console.log('DATABASE ADAPTER EXAMPLES');
  console.log('====================================');

  await examplePostgreSQL();
  await exampleCSV();
  await exampleJSON();
  await exampleXML();
  await exampleFormatConversion();

  console.log('\n====================================');
  console.log('ALL EXAMPLES COMPLETE');
  console.log('====================================\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { examplePostgreSQL, exampleCSV, exampleJSON, exampleXML, exampleFormatConversion };
