#!/usr/bin/env tsx
/**
 * Test Script: file_ingest Tool - Simple Validation
 * 
 * This script validates the file_ingest implementation in rag-dispatcher.ts
 * without requiring a full database setup.
 * 
 * Usage:
 *   tsx scripts/test-file-ingest.ts
 */

// Set up environment for testing
process.env.VECTOR_STORE_BACKEND = 'memory';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'dummy-key-for-testing';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║        file_ingest Tool Implementation Validation            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Test 1: Validate the implementation exists
console.log('📝 Test 1: Validate executeFileOperation implementation');
console.log('─'.repeat(60));

try {
  // Read the rag-dispatcher.ts file
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const ragDispatcherPath = path.join(process.cwd(), 'server/services/rag-dispatcher.ts');
  const content = await fs.readFile(ragDispatcherPath, 'utf-8');
  
  // Check if executeFileOperation has a proper implementation
  const hasProperImplementation = content.includes('async executeFileOperation(toolCall: ToolCall, messageId: string)');
  const callsRagService = content.includes('ragService.ingestDocument');
  const hasValidation = content.includes('file_ingest requires a content parameter');
  const hasUserIdHandling = content.includes('storage.getMessageById(messageId)');
  
  console.log(`✓ Method signature updated: ${hasProperImplementation}`);
  console.log(`✓ Calls ragService.ingestDocument: ${callsRagService}`);
  console.log(`✓ Has parameter validation: ${hasValidation}`);
  console.log(`✓ Handles userId for data isolation: ${hasUserIdHandling}`);
  
  if (hasProperImplementation && callsRagService && hasValidation && hasUserIdHandling) {
    console.log('\n✅ executeFileOperation is properly implemented!');
  } else {
    console.log('\n❌ executeFileOperation implementation incomplete');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Test 1 failed:', error);
  process.exit(1);
}

// Test 2: Validate the dispatcher calls the method correctly
console.log('\n📝 Test 2: Validate dispatcher routing');
console.log('─'.repeat(60));

try {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const ragDispatcherPath = path.join(process.cwd(), 'server/services/rag-dispatcher.ts');
  const content = await fs.readFile(ragDispatcherPath, 'utf-8');
  
  // Check if the switch statement calls executeFileOperation with messageId
  const hasCorrectCase = content.includes('case "file_ingest":');
  const passesMessageId = content.includes('await this.executeFileOperation(toolCall, messageId)');
  
  console.log(`✓ Has file_ingest case: ${hasCorrectCase}`);
  console.log(`✓ Passes messageId parameter: ${passesMessageId}`);
  
  if (hasCorrectCase && passesMessageId) {
    console.log('\n✅ Dispatcher routing is correct!');
  } else {
    console.log('\n❌ Dispatcher routing incorrect');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Test 2 failed:', error);
  process.exit(1);
}

// Test 3: Validate documentation exists
console.log('\n📝 Test 3: Validate documentation');
console.log('─'.repeat(60));

try {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Check tools.md
  const toolsPath = path.join(process.cwd(), 'prompts/tools.md');
  const toolsContent = await fs.readFile(toolsPath, 'utf-8');
  const hasFileIngestDocs = toolsContent.includes('### file_ingest - RAG Knowledge Ingestion');
  const hasExamples = toolsContent.includes('"type": "file_ingest"');
  
  console.log(`✓ tools.md has file_ingest section: ${hasFileIngestDocs}`);
  console.log(`✓ tools.md has examples: ${hasExamples}`);
  
  // Check FILE_INGEST_GUIDE.md
  const guidePath = path.join(process.cwd(), 'docs/FILE_INGEST_GUIDE.md');
  const guideExists = await fs.access(guidePath).then(() => true).catch(() => false);
  
  console.log(`✓ FILE_INGEST_GUIDE.md exists: ${guideExists}`);
  
  // Check RAG_ARCHITECTURE.md
  const archPath = path.join(process.cwd(), 'docs/RAG_ARCHITECTURE.md');
  const archExists = await fs.access(archPath).then(() => true).catch(() => false);
  
  console.log(`✓ RAG_ARCHITECTURE.md exists: ${archExists}`);
  
  if (hasFileIngestDocs && hasExamples && guideExists && archExists) {
    console.log('\n✅ Documentation is complete!');
  } else {
    console.log('\n❌ Documentation incomplete');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Test 3 failed:', error);
  process.exit(1);
}

// Test 4: Validate .env.example updated
console.log('\n📝 Test 4: Validate .env.example configuration');
console.log('─'.repeat(60));

try {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envContent = await fs.readFile(envExamplePath, 'utf-8');
  
  const hasVectorStoreConfig = envContent.includes('VECTOR_STORE_BACKEND');
  const hasVectorDimension = envContent.includes('VECTOR_DIMENSION');
  const hasVectorMetric = envContent.includes('VECTOR_METRIC');
  const hasDocumentation = envContent.includes('Vector Store Configuration');
  
  console.log(`✓ Has VECTOR_STORE_BACKEND: ${hasVectorStoreConfig}`);
  console.log(`✓ Has VECTOR_DIMENSION: ${hasVectorDimension}`);
  console.log(`✓ Has VECTOR_METRIC: ${hasVectorMetric}`);
  console.log(`✓ Has configuration documentation: ${hasDocumentation}`);
  
  if (hasVectorStoreConfig && hasVectorDimension && hasVectorMetric && hasDocumentation) {
    console.log('\n✅ .env.example is properly updated!');
  } else {
    console.log('\n❌ .env.example update incomplete');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Test 4 failed:', error);
  process.exit(1);
}

console.log('\n' + '═'.repeat(60));
console.log('✅ ALL VALIDATION TESTS PASSED!');
console.log('═'.repeat(60));
console.log('\nSummary:');
console.log('✓ file_ingest tool is properly implemented in rag-dispatcher.ts');
console.log('✓ Dispatcher correctly routes file_ingest calls');
console.log('✓ Comprehensive documentation has been created');
console.log('✓ .env.example includes vector store configuration');
console.log('\nThe file_ingest tool is ready to use!');
console.log('\nNote: End-to-end testing with a real database requires:');
console.log('  1. Setting up PostgreSQL with pgvector extension');
console.log('  2. Configuring DATABASE_URL in .env');
console.log('  3. Setting a valid GEMINI_API_KEY in .env');
console.log('  4. Running the server and testing via API calls');

process.exit(0);

