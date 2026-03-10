/**
 * =============================================================================
 * PREPARE NOTEBOOKLM EXTRAS
 * =============================================================================
 * 
 * Generates context-rich "Meta" files for NotebookLM ingestion.
 * 
 * OUTPUTS:
 * 1. meowstik_history.txt    - Git log (The "Why")
 * 2. meowstik_schema.txt     - DB Schema & Types (The "Skeleton")
 * 3. meowstik_health.txt     - Type Check & Lint Status (The "Reality")
 * 4. meowstik_api_stack.txt  - Tech Stack & Doc Links (The "Textbook")
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const OUTPUT_DIR = path.resolve(process.cwd(), 'notebooklm-ingest');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// =============================================================================
// 1. HISTORY (Git Log)
// =============================================================================
function generateHistory() {
  console.log('📜 Generating meowstik_history.txt...');
  const outFile = path.join(OUTPUT_DIR, 'meowstik_history.txt');
  
  try {
    // UPDATED: No limit (-n removed), showing ALL history
    const log = execSync('git log --pretty=format:"%h - %an, %ar : %s" --stat', { encoding: 'utf8' });
    
    let content = "MEOWSTIK PROJECT HISTORY (FULL)\n";
    content += "================================================================================\n";
    content += "Use this to understand project momentum, recent changes, and coding patterns.\n";
    content += "================================================================================\n\n";
    content += log;
    
    fs.writeFileSync(outFile, content);
    console.log('✅ History generation complete.');
  } catch (error) {
    console.warn('⚠️ Could not generate git history (is this a git repo?)');
    fs.writeFileSync(outFile, "Git history unavailable.");
  }
}

// =============================================================================
// 2. SCHEMA (Database & Types)
// =============================================================================
function generateSchema() {
  console.log('☠️ Generating meowstik_schema.txt...');
  const outFile = path.join(OUTPUT_DIR, 'meowstik_schema.txt');
  
  // Files to concatenate for schema definition
  const schemaFiles = [
    'shared/schema.ts',
    'server/db.ts',
    'drizzle.config.ts'
  ];

  let content = "MEOWSTIK DATA SCHEMA (The Skeleton)\n";
  content += "================================================================================\n";
  content += "Use this as the definitive reference for Database Tables, Zod Schemas, and Types.\n";
  content += "================================================================================\n\n";

  for (const file of schemaFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      content += `\n--- FILE: ${file} ---\n`;
      content += fs.readFileSync(fullPath, 'utf8');
      content += "\n";
    }
  }

  // Attempt to list migrations
  try {
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
        content += "\n--- MIGRATIONS (SQL) ---\n";
        const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        for (const sql of sqlFiles) {
            content += `\n-- Migration: ${sql} --\n`;
            content += fs.readFileSync(path.join(migrationsDir, sql), 'utf8');
        }
    }
  } catch (e) { /* ignore */ }

  fs.writeFileSync(outFile, content);
  console.log('✅ Schema generation complete.');
}

// =============================================================================
// 3. HEALTH (Type Check)
// =============================================================================
function generateHealth() {
  console.log('🏥 Generating meowstik_health.txt...');
  const outFile = path.join(OUTPUT_DIR, 'meowstik_health.txt');
  
  let content = "MEOWSTIK PROJECT HEALTH REPORT\n";
  content += "================================================================================\n";
  content += "Generated: " + new Date().toISOString() + "\n";
  content += "================================================================================\n\n";

  // Run TSC
  content += "--- TYPE CHECK (tsc --noEmit) ---\n";
  try {
      // We expect this might fail, so we catch it to record the errors
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      content += "✅ TypeScript Check Passed! No errors found.\n";
  } catch (error: any) {
      content += "❌ TypeScript Errors Found:\n\n";
      // stdout contains the compilation output usually
      content += error.stdout?.toString() || "";
      content += error.stderr?.toString() || "";
  }

  fs.writeFileSync(outFile, content);
  console.log('✅ Health report generated.');
}

// =============================================================================
// 4. API STACK (Documentation Links)
// =============================================================================
function generateApiStack() {
  console.log('📚 Generating meowstik_api_stack.txt...');
  const outFile = path.join(OUTPUT_DIR, 'meowstik_api_stack.txt');

  const docLinks: Record<string, string> = {
    // Core
    "Typescript": "https://www.typescriptlang.org/docs/",
    "Node.js": "https://nodejs.org/docs/latest/api/",
    "Express": "https://expressjs.com/en/4x/api.html",
    "Vite": "https://vitejs.dev/guide/",
    "React": "https://react.dev/reference/react",
    
    // Database
    "Drizzle ORM": "https://orm.drizzle.team/docs/overview",
    "PostgreSQL": "https://www.postgresql.org/docs/",
    
    // AI
    "Google Generative AI SDK": "https://ai.google.dev/api/rest/v1beta/models/generateContent",
    "LangChain (Concept)": "https://js.langchain.com/docs/get_started/introduction",
    
    // Integrations
    "Twilio Voice": "https://www.twilio.com/docs/voice/api",
    "Twilio SMS": "https://www.twilio.com/docs/sms/api",
    "GitHub REST API": "https://docs.github.com/en/rest",
    "GitHub Octokit": "https://github.com/octokit/octokit.js",
    "Google Drive API": "https://developers.google.com/drive/api/v3/reference",
    "Google Docs API": "https://developers.google.com/docs/api/reference/rest",
    "Google Gmail API": "https://developers.google.com/gmail/api/reference/rest",
    "Google Calendar API": "https://developers.google.com/calendar/api/v3",
    
    // Browser/Agents
    "Playwright": "https://playwright.dev/docs/intro",
    "Puppeteer": "https://pptr.dev/",
    "nut.js": "https://nutjs.dev/",
    
    // Utils
    "Zod": "https://zod.dev/",
    "TanStack Query": "https://tanstack.com/query/latest/docs/framework/react/overview",
    "Tailwind CSS": "https://tailwindcss.com/docs"
  };

  let content = "MEOWSTIK TECH STACK & API REFERENCE\n";
  content += "================================================================================\n";
  content += "Use these links to find the definitive API manuals for our stack.\n";
  content += "================================================================================\n\n";

  // 1. Dependency List
  content += "--- INSTALLED DEPENDENCIES (package.json) ---\n";
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    content += JSON.stringify(pkg.dependencies, null, 2);
    content += "\n\n";
    content += "--- DEV DEPENDENCIES ---\n";
    content += JSON.stringify(pkg.devDependencies, null, 2);
    content += "\n\n";
  } catch (e) {
    content += "Error reading package.json\n\n";
  }

  // 2. Doc Links
  content += "--- OFFICIAL DOCUMENTATION LINKS ---\n";
  for (const [tech, url] of Object.entries(docLinks)) {
    content += `[${tech}]: ${url}\n`;
  }
  
  // 3. Local Integration map
  content += "\n--- LOCAL INTEGRATION MAP (Where to find wrapper code) ---\n";
  const integrationsDir = path.resolve(process.cwd(), 'server/integrations');
  if (fs.existsSync(integrationsDir)) {
      const files = fs.readdirSync(integrationsDir).filter(f => f.endsWith('.ts'));
      for (const f of files) {
          content += `- ${f.padEnd(25)} : Wraps external API for internal use\n`;
      }
  }

  fs.writeFileSync(outFile, content);
  console.log('✅ API Stack map generated.');
}

// Run All
console.log('🚀 Starting Extras Generation...');
generateHistory();
generateSchema();
generateHealth();
generateApiStack();
console.log('🎉 All extras generated in ./notebooklm-ingest/');
