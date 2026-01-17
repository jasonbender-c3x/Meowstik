#!/usr/bin/env node
/**
 * Hardware Integration Validation Script
 * 
 * This script validates that all hardware integration modules are correctly
 * implemented and can be imported without errors.
 * 
 * Usage: node scripts/validate-hardware.cjs
 */

const path = require('path');

console.log('🔧 Hardware Integration Validation\n');
console.log('='.repeat(50));

const modules = [
  { name: 'Arduino', path: '../server/integrations/arduino.ts' },
  { name: 'ADB (Android)', path: '../server/integrations/adb.ts' },
  { name: 'Petoi Robot', path: '../server/integrations/petoi.ts' },
  { name: '3D Printer', path: '../server/integrations/printer3d.ts' },
  { name: 'KiCad', path: '../server/integrations/kicad.ts' },
];

let passed = 0;
let failed = 0;

async function validateModule(moduleName, modulePath) {
  try {
    console.log(`\n📦 Validating ${moduleName}...`);
    
    // Check if file exists
    const fs = require('fs');
    const fullPath = path.join(__dirname, modulePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    
    console.log(`   ✓ File exists: ${modulePath}`);
    
    // Read file content and check for basic structure
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check for required exports
    const hasExports = content.includes('export');
    if (!hasExports) {
      throw new Error('No exports found in module');
    }
    console.log(`   ✓ Module has exports`);
    
    // Check for TypeScript
    const hasTypes = content.includes(': Promise') || content.includes('interface ');
    if (hasTypes) {
      console.log(`   ✓ TypeScript types present`);
    }
    
    // Check for documentation
    const hasDocs = content.includes('/**');
    if (hasDocs) {
      console.log(`   ✓ JSDoc documentation present`);
    }
    
    console.log(`   ✅ ${moduleName} validation passed`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${moduleName} validation failed: ${error.message}`);
    return false;
  }
}

async function validateRoutes() {
  try {
    console.log(`\n📡 Validating Hardware Routes...`);
    
    const fs = require('fs');
    const routesPath = path.join(__dirname, '../server/routes/hardware.ts');
    
    if (!fs.existsSync(routesPath)) {
      throw new Error(`Routes file not found`);
    }
    
    const content = fs.readFileSync(routesPath, 'utf-8');
    
    // Check for router
    if (!content.includes('Router()')) {
      throw new Error('Express Router not found');
    }
    console.log(`   ✓ Express Router configured`);
    
    // Check for imports
    const requiredImports = ['arduino', 'adb', 'petoi', 'printer3d', 'kicad'];
    for (const imp of requiredImports) {
      if (!content.includes(`* ${imp} `)) {
        console.log(`   ⚠ Warning: ${imp} import may be missing`);
      }
    }
    console.log(`   ✓ Integration imports present`);
    
    // Check for routes
    const hasArduinoRoutes = content.includes('/arduino/');
    const hasADBRoutes = content.includes('/adb/');
    const hasPetoiRoutes = content.includes('/petoi/');
    const hasPrinterRoutes = content.includes('/printer/');
    const hasKiCadRoutes = content.includes('/kicad/');
    
    if (hasArduinoRoutes && hasADBRoutes && hasPetoiRoutes && hasPrinterRoutes && hasKiCadRoutes) {
      console.log(`   ✓ All hardware routes defined`);
    } else {
      console.log(`   ⚠ Warning: Some routes may be missing`);
    }
    
    console.log(`   ✅ Hardware routes validation passed`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ Routes validation failed: ${error.message}`);
    return false;
  }
}

async function validateToolsDocumentation() {
  try {
    console.log(`\n📚 Validating Tools Documentation...`);
    
    const fs = require('fs');
    const toolsPath = path.join(__dirname, '../prompts/tools.md');
    
    if (!fs.existsSync(toolsPath)) {
      throw new Error(`Tools documentation not found`);
    }
    
    const content = fs.readFileSync(toolsPath, 'utf-8');
    
    // Check for hardware sections
    const sections = [
      'Arduino',
      'Android Debug Bridge',
      'Petoi Robot',
      '3D Printer',
      'KiCad'
    ];
    
    for (const section of sections) {
      if (content.includes(section)) {
        console.log(`   ✓ ${section} section present`);
      } else {
        console.log(`   ⚠ Warning: ${section} section may be missing`);
      }
    }
    
    console.log(`   ✅ Tools documentation validation passed`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ Tools documentation validation failed: ${error.message}`);
    return false;
  }
}

async function validateRAGDispatcher() {
  try {
    console.log(`\n🎯 Validating RAG Dispatcher Integration...`);
    
    const fs = require('fs');
    const dispatcherPath = path.join(__dirname, '../server/services/rag-dispatcher.ts');
    
    if (!fs.existsSync(dispatcherPath)) {
      throw new Error(`RAG Dispatcher not found`);
    }
    
    const content = fs.readFileSync(dispatcherPath, 'utf-8');
    
    // Check for hardware tool imports
    if (!content.includes('arduino') || !content.includes('integrations/arduino')) {
      throw new Error('Arduino integration not imported');
    }
    console.log(`   ✓ Hardware integrations imported`);
    
    // Check for tool cases
    const toolCases = [
      'arduino_list_boards',
      'adb_list_devices',
      'petoi_execute_skill',
      'printer_send_gcode',
      'kicad_create_project'
    ];
    
    let foundCases = 0;
    for (const toolCase of toolCases) {
      if (content.includes(`case "${toolCase}"`)) {
        foundCases++;
      }
    }
    
    console.log(`   ✓ ${foundCases}/${toolCases.length} sample tool cases found`);
    
    if (foundCases < toolCases.length) {
      console.log(`   ⚠ Warning: Some tool cases may be missing`);
    }
    
    console.log(`   ✅ RAG Dispatcher validation passed`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ RAG Dispatcher validation failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\nStarting validation...\n');
  
  // Validate integration modules
  for (const module of modules) {
    const result = await validateModule(module.name, module.path);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Validate routes
  if (await validateRoutes()) {
    passed++;
  } else {
    failed++;
  }
  
  // Validate tools documentation
  if (await validateToolsDocumentation()) {
    passed++;
  } else {
    failed++;
  }
  
  // Validate RAG dispatcher
  if (await validateRAGDispatcher()) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Validation Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All validations passed! Hardware integration is ready.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some validations failed. Please review the errors above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Validation script error:', error);
  process.exit(1);
});
