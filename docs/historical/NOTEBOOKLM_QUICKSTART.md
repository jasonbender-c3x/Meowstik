# NotebookLM Integration - Quick Start Guide

This guide will help you get started with the NotebookLM Puppeteer integration in the Meowstik project.

## Table of Contents

1. [What is NotebookLM Integration?](#what-is-notebooklm-integration)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Quick Start](#quick-start)
5. [Common Use Cases](#common-use-cases)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

---

## What is NotebookLM Integration?

The NotebookLM integration provides programmatic access to Google's NotebookLM through browser automation using Playwright. This allows you to:

- **Automate notebook creation and management**
- **Upload documents programmatically** (PDFs, text files, etc.)
- **Ask questions and receive AI-generated answers**
- **Extract citations and references**
- **Integrate NotebookLM into your workflows**

---

## Prerequisites

Before using the NotebookLM integration, ensure you have:

1. **Node.js** (v18 or higher)
2. **A Google account** with access to NotebookLM
3. **Playwright browsers installed** (automatically installed with npm install)

---

## Installation

The NotebookLM integration is built into Meowstik. Simply install the project dependencies:

```bash
npm install
```

Playwright browsers will be installed automatically. If you need to install them manually:

```bash
npx playwright install chromium
```

---

## Quick Start

### Step 1: Validate Installation

First, run the validation test to ensure everything is set up correctly:

```bash
npm run test:notebooklm
```

You should see:
```
✓ All validation tests passed!
```

### Step 2: Run the Example

Run the included example to see the integration in action:

```bash
npm run dev:notebooklm
```

**Important Notes:**
- The browser will open in **non-headless mode** for the example
- You'll need to **manually log in** to your Google account the first time
- Your session will be saved for future use

### Step 3: Create Your Own Script

Create a new file `my-notebooklm-script.ts`:

```typescript
import { NotebookLM } from './server/integrations/notebooklm';

async function main() {
  // Initialize
  const nlm = new NotebookLM({
    headless: false,  // Set to true after first login
    debug: true,
  });

  // Initialize and authenticate
  await nlm.initialize();
  await nlm.manualLogin(); // Only needed first time

  // Create a notebook
  const notebookId = await nlm.createNotebook('My Research');
  
  // Add a source
  await nlm.addSource({
    type: 'file',
    path: './my-document.pdf',
  });

  // Ask a question
  const answer = await nlm.ask('What is this document about?');
  console.log(answer.text);

  // Clean up
  await nlm.close();
}

main();
```

Run it:
```bash
npx tsx my-notebooklm-script.ts
```

---

## Common Use Cases

### Use Case 1: Batch Document Analysis

Upload multiple documents and ask questions about them:

```typescript
import { NotebookLM } from './server/integrations/notebooklm';
import { promises as fs } from 'fs';
import path from 'path';

async function analyzeDocuments(documentsDir: string) {
  const nlm = new NotebookLM({ headless: true });
  
  await nlm.initialize();
  const isAuth = await nlm.isAuthenticated();
  if (!isAuth) {
    throw new Error('Please authenticate first');
  }

  // Create notebook
  const notebookId = await nlm.createNotebook('Batch Analysis');

  // Upload all PDFs from directory
  const files = await fs.readdir(documentsDir);
  for (const file of files) {
    if (file.endsWith('.pdf')) {
      await nlm.addSource({
        type: 'file',
        path: path.join(documentsDir, file),
        title: file,
      });
    }
  }

  // Ask questions
  const questions = [
    'What are the main themes across all documents?',
    'Summarize the key findings.',
    'What are the common conclusions?',
  ];

  for (const question of questions) {
    const answer = await nlm.ask(question);
    console.log(`\nQ: ${question}`);
    console.log(`A: ${answer.text}`);
  }

  await nlm.close();
}

analyzeDocuments('./research-papers');
```

### Use Case 2: Research Assistant

Create an interactive research assistant:

```typescript
import { NotebookLM } from './server/integrations/notebooklm';
import readline from 'readline';

async function researchAssistant() {
  const nlm = new NotebookLM({ headless: true });
  await nlm.initialize();

  const notebookId = await nlm.createNotebook('Research Session');

  // Set up event listeners for real-time feedback
  nlm.on('query:start', (q) => console.log(`\nAsking: ${q}`));
  nlm.on('query:response', (a) => console.log(`Answer received!`));

  // Interactive question loop
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Research Assistant Ready. Type "exit" to quit.\n');

  const askQuestion = () => {
    rl.question('Your question: ', async (question) => {
      if (question.toLowerCase() === 'exit') {
        await nlm.close();
        rl.close();
        return;
      }

      try {
        const answer = await nlm.ask(question);
        console.log(`\n${answer.text}\n`);
      } catch (error) {
        console.error('Error:', error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

researchAssistant();
```

### Use Case 3: Event-Driven Progress Tracking

Monitor upload and query progress:

```typescript
import { NotebookLM } from './server/integrations/notebooklm';

async function trackProgress() {
  const nlm = new NotebookLM({ headless: true });

  // Set up event listeners
  nlm.on('upload:start', (file) => {
    console.log(`📤 Starting upload: ${file}`);
  });

  nlm.on('upload:progress', (percent) => {
    console.log(`📊 Upload progress: ${percent}%`);
  });

  nlm.on('upload:complete', (source) => {
    console.log(`✓ Upload complete: ${source.title}`);
  });

  nlm.on('query:start', (question) => {
    console.log(`❓ Asking: ${question}`);
  });

  nlm.on('query:response', (answer) => {
    console.log(`✓ Answer: ${answer.text.substring(0, 100)}...`);
  });

  // Your code here
  await nlm.initialize();
  // ...
}

trackProgress();
```

---

## Troubleshooting

### Issue: "Browser not opening"

**Solution:** Make sure you're running in non-headless mode for initial setup:
```typescript
const nlm = new NotebookLM({ headless: false });
```

### Issue: "Authentication failed"

**Solution:** 
1. Delete the cookie file: `rm .notebooklm-cookies.json`
2. Run again with `headless: false`
3. Manually log in when prompted

### Issue: "Selector not found"

**Solution:** Google may have updated NotebookLM's UI. The integration uses multiple fallback selectors, but if all fail:
1. Take a screenshot: `await nlm.screenshot('./debug.png')`
2. Report the issue or update selectors in `server/integrations/notebooklm/selectors.ts`

### Issue: "Timeout errors"

**Solution:** Increase timeout in options:
```typescript
const nlm = new NotebookLM({ 
  timeout: 60000  // 60 seconds
});
```

---

## API Reference

See the full API documentation in:
- [NotebookLM README](./server/integrations/notebooklm/README.md)

### Quick Reference

#### Initialize and Authenticate
```typescript
const nlm = new NotebookLM(options);
await nlm.initialize();
await nlm.manualLogin();  // First time only
```

#### Create Notebook
```typescript
const notebookId = await nlm.createNotebook('Notebook Name');
```

#### Add Source
```typescript
await nlm.addSource({
  type: 'file',
  path: './document.pdf',
  title: 'My Document'
});
```

#### Ask Question
```typescript
const answer = await nlm.ask('What is this about?');
console.log(answer.text);
console.log(answer.citations);
```

#### Clean Up
```typescript
await nlm.close();
```

---

## Next Steps

1. **Read the full README**: [server/integrations/notebooklm/README.md](./server/integrations/notebooklm/README.md)
2. **Explore the example**: [server/examples/notebooklm-example.ts](./server/examples/notebooklm-example.ts)
3. **Check the source code**: [server/integrations/notebooklm/](./server/integrations/notebooklm/)

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [API Reference](#api-reference)
3. Examine the example scripts in `server/examples/`

---

**Happy automating with NotebookLM! 🚀**
