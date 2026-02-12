# Meowstik Browser Extension

Browser extension for Meowstik AI Assistant - provides page analysis, screenshot capture, and AI-powered assistance directly in your browser.

## Features

- 🐱 **AI Chat** - Chat with Meowstik AI from any webpage
- 📸 **Screenshot Analysis** - Capture and analyze screenshots with AI vision
- 📄 **Content Extraction** - Extract and analyze page content
- 🖥️ **Console Monitoring** - Capture and analyze console logs
- 🌐 **Network Analysis** - Monitor network requests
- ⚡ **Context Menu** - Right-click integration for quick actions

## Installation (Development)

### Chrome / Edge / Brave

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Enable **Developer mode** (toggle in the top-right corner)

3. Click **Load unpacked**

4. Navigate to and select: `workspace/extension/`

5. The extension icon (🐱) should appear in your toolbar

### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`

2. Click **Load Temporary Add-on**

3. Navigate to `workspace/extension/` and select `manifest.json`

4. The extension is now loaded temporarily (until Firefox restart)

## Usage

### First Time Setup

1. Click the Meowstik extension icon (🐱) in your toolbar

2. Enter your Meowstik server URL:
   - Local development: `http://localhost:5000`
   - Production: Your deployed server URL (e.g., `https://your-app.replit.app`)

3. Click **Connect**

4. Once connected, you'll see the chat interface and tools

### Chat with AI

1. Type your message in the chat input
2. Press Enter or click Send
3. Meowstik will respond with AI-generated answers

### Quick Tools

- **Screenshot** (📸) - Capture the current page
- **Extract Text** (📄) - Extract text content from the page
- **Console Logs** (🖥️) - View captured console logs
- **Network** (🌐) - View captured network requests

### Context Menu

Right-click on:
- Selected text - "Ask Meowstik about this"
- Images - Analyze with AI vision
- Links - Get information about the link

## Development

### Project Structure

```
workspace/extension/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker for background tasks
├── content.js          # Content script injected into pages
├── content.css         # Styles for content script
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── popup.css           # Popup styles
├── sidebar.html        # Sidebar panel UI
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Files

- **manifest.json** - Defines extension permissions, scripts, and resources
- **background.js** - Handles context menus, console/network monitoring
- **content.js** - Injected into web pages, intercepts console logs
- **popup.js** - Main extension UI logic, handles server communication

### API Endpoints

The extension communicates with the Meowstik server via these endpoints:

- `POST /api/extension/register` - Register and get auth token
- `POST /api/extension/connect` - Establish session
- `POST /api/extension/chat` - Send chat messages
- `POST /api/extension/screenshot` - Upload screenshots
- `POST /api/extension/content` - Upload page content
- `POST /api/extension/context` - Send context from context menu

### Testing

1. Load the extension in development mode (see Installation)
2. Start the Meowstik server: `npm run dev` (from project root)
3. Click the extension icon and connect to `http://localhost:5000`
4. Test the chat and tools
5. Check browser console and server logs for errors

### Debugging

- **Extension Console**: Right-click extension icon → "Inspect popup"
- **Background Console**: Chrome Extensions → Service Worker → "Inspect"
- **Content Script Console**: F12 Developer Tools on any page
- **Server Logs**: Check terminal running `npm run dev`

## Permissions

The extension requires these permissions:

- `activeTab` - Access current tab for screenshots and content
- `storage` - Store server URL and session info
- `tabs` - Query and interact with browser tabs
- `scripting` - Inject content scripts
- `contextMenus` - Add right-click menu items
- `webRequest` - Monitor network requests
- `<all_urls>` - Access all websites (for content analysis)

## Troubleshooting

### Extension won't load
- Make sure you selected the correct folder (`workspace/extension/`)
- Check that `manifest.json` exists and is valid JSON
- Check browser console for errors

### Can't connect to server
- Verify server is running: `npm run dev`
- Check server URL is correct (include `http://` or `https://`)
- Check CORS settings on the server
- Check browser console for network errors

### Tools not working
- Make sure you're connected to the server first
- Check browser console for JavaScript errors
- Verify server endpoints are responding (check Network tab)

### Content script not injecting
- Try reloading the page after loading the extension
- Check the extension has permission for that URL
- Check content.js for errors in the page's developer console

## Building for Production

Currently, the extension is meant for development use. To prepare for production:

1. Update `manifest.json` with production server URL (if hardcoded)
2. Minify JavaScript files
3. Optimize images
4. Create a ZIP package:
   ```bash
   cd workspace/extension
   zip -r meowstik-extension.zip . -x "*.git*" "node_modules/*"
   ```
5. Upload to Chrome Web Store or Firefox Add-ons

## Security Notes

- Extension token expires after 1 hour of inactivity
- Tokens are stored in browser's local storage (encrypted by browser)
- Session data is kept in memory on the server
- Always use HTTPS in production for server URL

## Contributing

When making changes to the extension:

1. Test in multiple browsers (Chrome, Firefox, Edge)
2. Test with both local and remote servers
3. Check console for errors
4. Verify all tools work correctly
5. Update this README if adding new features

## License

MIT
