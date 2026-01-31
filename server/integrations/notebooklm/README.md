# NotebookLM Puppeteer Integration

A comprehensive Puppeteer-based automation library for programmatically interacting with Google's NotebookLM. This integration enables headless access to NotebookLM's powerful AI research and note-taking capabilities.

## Features

- **Browser Automation**: Automated browser management with Playwright
- **Authentication**: Google account authentication with session persistence
- **Notebook Management**: Create and manage NotebookLM notebooks
- **Source Management**: Upload documents (PDFs, text files, URLs)
- **AI-Powered Q&A**: Ask questions and receive AI-generated answers with citations
- **Error Handling**: Robust error handling with retry logic
- **Event-Driven**: Real-time progress tracking via event emitters

## Architecture

```
server/integrations/notebooklm/
├── index.ts              # Main NotebookLM class
├── types.ts              # TypeScript type definitions
├── browser-manager.ts    # Browser lifecycle management
├── auth-manager.ts       # Google authentication
├── selectors.ts          # UI selector configurations
└── utils.ts              # Retry and utility functions
```

## Installation

The integration is built into the Meowstik project and uses existing dependencies:

- `playwright` - Browser automation
- `playwright-core` - Core Playwright functionality

No additional dependencies are required.

## Quick Start

### Basic Usage

```typescript
import { NotebookLM } from './server/integrations/notebooklm';

// Initialize
const nlm = new NotebookLM({
  headless: false,  // Set to true for headless mode
  debug: true,
  cookiePath: './.notebooklm-cookies.json',
});

// Authenticate (manual login for first time)
await nlm.initialize();
await nlm.manualLogin();

// Create a notebook
const notebookId = await nlm.createNotebook('My Research');

// Add a source
await nlm.addSource({
  type: 'file',
  path: './research-paper.pdf',
  title: 'Research Paper',
});

// Ask a question
const answer = await nlm.ask('What are the main findings?');
console.log(answer.text);

// Clean up
await nlm.close();
```

### Running the Example

```bash
# Run the example script
npm run dev:notebooklm

# Or using tsx directly
tsx server/examples/notebooklm-example.ts
```

## API Reference

### NotebookLM Class

#### Constructor

```typescript
new NotebookLM(options?: NotebookLMOptions)
```

**Options:**
- `headless` (boolean): Run browser in headless mode (default: `true`)
- `cookiePath` (string): Path to save authentication cookies
- `timeout` (number): Default timeout for operations (default: `30000`)
- `userDataDir` (string): Browser user data directory
- `debug` (boolean): Enable debug logging

#### Methods

##### `initialize(): Promise<void>`
Initialize the browser and set up authentication manager.

##### `authenticate(options?: AuthOptions): Promise<void>`
Authenticate with Google using credentials or saved cookies.

**Parameters:**
- `email` (string): Google account email
- `password` (string): Google account password
- `totpSecret` (string, optional): TOTP secret for 2FA

##### `manualLogin(timeoutMs?: number): Promise<void>`
Open browser for manual login (recommended for first-time setup).

**Parameters:**
- `timeoutMs` (number): Timeout for manual login (default: `300000` = 5 minutes)

##### `isAuthenticated(): Promise<boolean>`
Check if currently authenticated with NotebookLM.

##### `createNotebook(name: string): Promise<string>`
Create a new notebook and return its ID.

##### `openNotebook(notebookId: string): Promise<void>`
Open an existing notebook by ID.

##### `addSource(source: Source): Promise<SourceInfo>`
Add a source to the current notebook.

**Source Types:**
```typescript
// File upload
{
  type: 'file',
  path: './document.pdf',
  title: 'My Document'
}

// URL (not yet implemented)
{
  type: 'url',
  url: 'https://example.com/article'
}

// Text (not yet implemented)
{
  type: 'text',
  text: 'Document content...',
  title: 'My Text'
}
```

##### `ask(question: string): Promise<Answer>`
Ask a question to the current notebook and receive an AI-generated answer.

**Returns:**
```typescript
{
  text: string;           // Answer text
  citations: Citation[];  // Source citations
}
```

##### `screenshot(filepath: string): Promise<void>`
Take a screenshot of the current page.

##### `close(): Promise<void>`
Close the browser and clean up resources.

## Events

The `NotebookLM` class extends `EventEmitter` and emits the following events:

```typescript
// Upload events
nlm.on('upload:start', (file: string) => { });
nlm.on('upload:progress', (percent: number) => { });
nlm.on('upload:complete', (source: SourceInfo) => { });
nlm.on('upload:error', (error: Error) => { });

// Query events
nlm.on('query:start', (question: string) => { });
nlm.on('query:response', (answer: Answer) => { });
nlm.on('query:error', (error: Error) => { });

// Generation events
nlm.on('generation:start', (type: string) => { });
nlm.on('generation:complete', (content: any) => { });
nlm.on('generation:error', (error: Error) => { });
```

## Authentication

### First-Time Setup

1. **Manual Login (Recommended)**
   ```typescript
   const nlm = new NotebookLM({ headless: false });
   await nlm.initialize();
   await nlm.manualLogin();
   ```
   
   This opens a browser window where you can manually log in to your Google account. The session is saved to cookies for future use.

2. **Cookie Persistence**
   
   After manual login, cookies are saved to `.notebooklm-cookies.json` (or your specified path). Future sessions will automatically use these cookies.

3. **Session Expiration**
   
   Cookies expire after 7 days. You'll need to re-authenticate if they expire.

### Security Considerations

- **Never commit cookie files** to version control
- Store cookies in a secure location
- Use environment variables for sensitive data
- Consider encrypting cookie storage for production use

## Error Handling

The integration includes robust error handling with retry logic:

```typescript
import { NotebookLMError, withRetry } from './server/integrations/notebooklm';

try {
  const answer = await nlm.ask('What is this about?');
} catch (error) {
  if (error instanceof NotebookLMError) {
    console.error(`Error [${error.code}]:`, error.message);
    console.log(`Recoverable: ${error.recoverable}`);
  }
}
```

### Error Types

- `AuthenticationError`: Authentication failures (not recoverable)
- `NetworkError`: Network issues (recoverable with retry)
- `SelectorNotFoundError`: UI element not found (recoverable with retry)
- `TimeoutError`: Operation timeout (recoverable with retry)

## Limitations

### Current Limitations

1. **Manual 2FA**: Two-factor authentication requires manual intervention
2. **UI Changes**: Selectors may break if Google updates NotebookLM's UI
3. **URL/Text Sources**: Not yet implemented (file upload only)
4. **Content Generation**: Summary, study guide, FAQ generation not yet implemented
5. **Notebook Listing**: Cannot list existing notebooks yet

### Future Enhancements

- [ ] Implement URL and text source addition
- [ ] Add content generation (summaries, study guides, FAQs)
- [ ] Notebook listing and search
- [ ] Audio overview generation
- [ ] Export functionality
- [ ] Better citation extraction
- [ ] Rate limiting
- [ ] Proxy support

## Troubleshooting

### Browser Not Opening

If the browser doesn't open in non-headless mode:

```typescript
const nlm = new NotebookLM({
  headless: false,
  debug: true,
});
```

### Selector Not Found Errors

The integration uses multiple fallback selectors. If you encounter selector errors:

1. Update selectors in `selectors.ts`
2. Take a screenshot to debug: `await nlm.screenshot('./debug.png')`
3. Check if NotebookLM's UI has changed

### Authentication Issues

If authentication fails:

1. Delete the cookie file and try manual login again
2. Ensure you're using a valid Google account
3. Check if NotebookLM is accessible in your region
4. Try disabling 2FA temporarily for testing

## Development

### Project Structure

```
server/integrations/notebooklm/
├── index.ts              # Main NotebookLM class
├── types.ts              # TypeScript type definitions
├── browser-manager.ts    # Browser lifecycle management
├── auth-manager.ts       # Google authentication
├── selectors.ts          # UI selector configurations
└── utils.ts              # Retry and utility functions
```

### Adding New Features

1. Define types in `types.ts`
2. Add selectors in `selectors.ts`
3. Implement functionality in `index.ts` or new module
4. Update this README with new API methods

### Testing

Manual testing is currently recommended:

```bash
tsx server/examples/notebooklm-example.ts
```

## Contributing

Contributions are welcome! Please:

1. Test changes thoroughly with manual testing
2. Update selectors if UI changes are detected
3. Add examples for new features
4. Update this README

## License

MIT - Same as the parent Meowstik project

## Acknowledgments

Based on the comprehensive NotebookLM Puppeteer Integration Proposal, implementing automated access to Google's NotebookLM using Playwright browser automation.
