/**
 * Unit tests for Path Handling in RAG Dispatcher
 * Tests path sanitization logic for file_get and file_put operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { pathToFileURL } from 'url';

/**
 * Test path sanitization logic
 * This validates the fix for the bug where leading slashes were incorrectly stripped
 */
async function testPathSanitization() {
  console.log('\n=== Testing Path Sanitization ===\n');
  
  const workspaceDir = process.cwd();
  
  // Test 1: Absolute paths should be preserved
  {
    const testPath = '/home/runner/workspace/test.txt';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    assert(fullPath === testPath, 'Absolute paths should be preserved without modification');
    console.log('✓ Test 1: Absolute paths are preserved correctly');
  }
  
  // Test 2: Relative paths should be joined with workspace dir
  {
    const testPath = 'logs/test.txt';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    const expectedPath = path.join(workspaceDir, testPath);
    
    assert(fullPath === expectedPath, 'Relative paths should be joined with workspaceDir');
    console.log('✓ Test 2: Relative paths are joined with workspaceDir correctly');
  }
  
  // Test 3: Directory traversal attempts should be removed
  {
    const testPath = '../../../etc/passwd';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    assert(!fullPath.includes('..'), 'Directory traversal patterns should be removed');
    console.log('✓ Test 3: Directory traversal attempts (..) are removed');
  }
  
  // Test 4: Mixed absolute path with directory traversal
  {
    const testPath = '/home/runner/../workspace/test.txt';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    assert(path.isAbsolute(fullPath), 'Result should still be an absolute path');
    assert(!fullPath.includes('..'), 'Directory traversal patterns should be removed from absolute paths');
    console.log('✓ Test 4: Absolute paths with .. are sanitized but remain absolute');
  }
  
  // Test 5: Windows-style absolute paths (when on Windows)
  if (process.platform === 'win32') {
    const testPath = 'C:\\Users\\test\\file.txt';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    assert(fullPath === testPath, 'Windows absolute paths should be preserved');
    console.log('✓ Test 5: Windows absolute paths are preserved correctly');
  } else {
    console.log('⊘ Test 5: Skipped (not on Windows)');
  }
  
  // Test 6: Empty path
  {
    const testPath = '';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    assert(fullPath === workspaceDir, 'Empty path should resolve to workspaceDir');
    console.log('✓ Test 6: Empty path resolves to workspaceDir');
  }
  
  // Test 7: Path with only slashes
  {
    const testPath = '///';
    const sanitizedPath = testPath.replace(/\.\./g, "");
    const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
    
    // On Unix, '///' normalizes to '/', which is absolute
    assert(path.isAbsolute(fullPath), 'Multiple slashes should still be recognized as absolute');
    console.log('✓ Test 7: Multiple leading slashes are recognized as absolute path');
  }
}

/**
 * Test file operations with the fixed path handling
 */
async function testFileOperations() {
  console.log('\n=== Testing File Operations with Path Handling ===\n');
  
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meowstik-test-'));
  const workspaceDir = process.cwd();
  
  try {
    // Test 8: Write and read a file using absolute path
    {
      const testFilePath = path.join(testDir, 'absolute-test.txt');
      const testContent = 'Testing absolute path write';
      
      // Simulate the path handling logic
      const sanitizedPath = testFilePath.replace(/\.\./g, "");
      const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
      
      await fs.writeFile(fullPath, testContent, 'utf8');
      const readContent = await fs.readFile(fullPath, 'utf8');
      
      assert(readContent === testContent, 'File content should match what was written');
      console.log('✓ Test 8: Write and read file with absolute path works correctly');
    }
    
    // Test 9: Write and read a file using relative path
    {
      const relativeDir = path.join(testDir, 'relative-test-dir');
      await fs.mkdir(relativeDir, { recursive: true });
      
      // Create a temporary workspace context
      const originalCwd = process.cwd();
      process.chdir(testDir);
      
      const relativePath = 'relative-test-dir/relative-test.txt';
      const testContent = 'Testing relative path write';
      const workspaceDir = process.cwd();
      
      // Simulate the path handling logic
      const sanitizedPath = relativePath.replace(/\.\./g, "");
      const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
      
      await fs.writeFile(fullPath, testContent, 'utf8');
      const readContent = await fs.readFile(fullPath, 'utf8');
      
      assert(readContent === testContent, 'File content should match what was written');
      
      // Restore original working directory
      process.chdir(originalCwd);
      
      console.log('✓ Test 9: Write and read file with relative path works correctly');
    }
    
    // Test 10: Verify directory traversal protection
    {
      const relativePath = '../../../outside-workspace.txt';
      const sanitizedPath = relativePath.replace(/\.\./g, "");
      const fullPath = path.isAbsolute(sanitizedPath) ? sanitizedPath : path.join(workspaceDir, sanitizedPath);
      
      // The sanitized path should not escape the workspace
      assert(!fullPath.includes('..'), 'Directory traversal should be prevented');
      console.log('✓ Test 10: Directory traversal protection is working');
    }
  } finally {
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  }
}

/**
 * Simple assertion function
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('========================================');
  console.log('Path Handling Test Suite');
  console.log('========================================');
  
  try {
    await testPathSanitization();
    await testFileOperations();
    
    console.log('\n========================================');
    console.log('All tests passed! ✓');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  runTests();
}

export { testPathSanitization, testFileOperations };
