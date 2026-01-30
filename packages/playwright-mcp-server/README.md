# Playwright MCP Server

A Model Context Protocol (MCP) server that exposes Playwright browser automation to AI assistants like Claude.

## What is This?

This server acts as a bridge between AI models and web browsers, allowing AI to:
- Navigate websites
- Click buttons and fill forms
- Take screenshots
- Extract data from pages
- Execute JavaScript
- Manage multiple browser tabs

## Installation

```bash
cd packages/playwright-mcp-server
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the server
npm run build
```

## Usage

### 1. Run Standalone

```bash
npm start
```

The server communicates via stdio (standard input/output).

### 2. Connect to Claude Desktop

Add to your Claude Desktop config file:

**macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/absolute/path/to/Meowstik/packages/playwright-mcp-server/build/index.js"]
    }
  }
}
```

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["C:\\path\\to\\Meowstik\\packages\\playwright-mcp-server\\build\\index.js"]
    }
  }
}
```

### 3. Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Available Tools

### Navigation
- `browser_navigate` - Go to a URL
- `browser_wait_for_selector` - Wait for element to appear

### Interaction
- `browser_click` - Click an element
- `browser_fill` - Fill out form fields
- `browser_select` - Select dropdown options

### Data Extraction
- `browser_screenshot` - Capture screenshots
- `browser_extract_text` - Get text content
- `browser_get_html` - Get HTML source
- `browser_evaluate` - Execute JavaScript

### Tab Management
- `browser_new_page` - Create new tab
- `browser_close_page` - Close a tab
- `browser_list_pages` - List all open tabs

### Cookies
- `browser_get_cookies` - Get cookies
- `browser_set_cookie` - Set a cookie

## Examples

### With Claude

Once connected, you can ask Claude:

```
"Go to github.com and take a screenshot"

"Navigate to example.com, click the login button, 
fill in username as 'test' and password as 'pass123', 
then click submit"

"Open wikipedia.org, search for 'Artificial Intelligence', 
and extract the first paragraph"
```

Claude will use the available tools automatically!

### Programmatic Usage (Advanced)

```typescript
// Send JSON-RPC request via stdio
const request = {
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "browser_navigate",
    arguments: {
      url: "https://example.com"
    }
  },
  id: 1
};
```

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run
npm start
```

## Architecture

```
┌─────────────┐      MCP Protocol      ┌──────────────────┐
│             │ ◄──────────────────────►│                  │
│  AI Model   │   (JSON-RPC over        │  Playwright MCP  │
│  (Claude)   │    stdio)               │     Server       │
│             │                          │                  │
└─────────────┘                          └────────┬─────────┘
                                                  │
                                                  │ Controls
                                                  ▼
                                         ┌─────────────────┐
                                         │   Playwright    │
                                         │   (Chromium)    │
                                         └─────────────────┘
```

## Security Considerations

- The server runs with full browser access
- Only expose to trusted AI models
- Consider running in a sandboxed environment for production use
- Screenshots may contain sensitive information

## Troubleshooting

### "Browser not found"
```bash
npx playwright install chromium
```

### "Permission denied"
```bash
chmod +x build/index.js
```

### "Module not found"
```bash
npm install
npm run build
```

## Features

✅ Full Playwright API access  
✅ Screenshot capability  
✅ Multi-tab support  
✅ Cookie management  
✅ JavaScript execution  
✅ Form automation  
✅ Wait for elements  
✅ Error handling  

## Future Enhancements

- [ ] Add Firefox/WebKit support
- [ ] Network interception
- [ ] File uploads/downloads
- [ ] Geolocation spoofing
- [ ] Mobile device emulation
- [ ] Video recording
- [ ] Performance metrics
- [ ] Authentication helpers

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Playwright Docs](https://playwright.dev/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## License

MIT
