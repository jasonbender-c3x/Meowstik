# Browser Extension Quick Start

This guide will help you get the Meowstik Browser Extension up and running.

## What is the Meowstik Browser Extension?

The **Meowstik Automations** browser extension is a Chrome extension that enables computer-control tools and browser automation. It serves as the replacement for the standalone Desktop Agent, providing:

- Browser automation (click, type, navigate)
- Screen capture and analysis
- Page content extraction
- Console and network log monitoring
- Live voice interaction
- Direct integration with Meowstik AI

## Installation

### Option 1: Load from Built Package (Recommended)

1. **Build the extension:**
   ```bash
   cd browser-extension
   ./build.sh
   ```

2. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `browser-extension/dist` folder

3. **Pin the extension:**
   - Click the puzzle icon in Chrome toolbar
   - Click the pin icon next to "Meowstik AI Assistant"

### Option 2: Install from ZIP

1. **Download or build the ZIP:**
   ```bash
   cd browser-extension
   ./build.sh
   # Creates: meowstik-extension.zip
   ```

2. **Extract and load:**
   - Extract the ZIP file to a folder
   - Follow steps 2-3 from Option 1 above

## Configuration

1. **Click the Meowstik extension icon** in your Chrome toolbar

2. **Go to Settings tab**

3. **Configure connection:**
   - **Server URL**: Enter your Meowstik server URL
     - Default: `wss://meowstik.replit.app`
     - Or your custom deployment URL
   - **Local Agent Port**: Default `9222` (usually don't need to change)
   - **Auto-connect**: Enable to connect automatically on startup
   - **Voice activation**: Enable "Hey Meowstik" wake word (experimental)

4. **Click "Connect"** to establish connection with Meowstik

5. **Verify connection**: Status indicator should turn green

## Usage

### Chat Interface

Click the extension icon to open the popup chat:
- Type or paste your questions
- AI responds with streaming text
- Context-aware of the current page

### Screen Capture

1. Click the extension icon
2. Go to "Screen" tab
3. Choose capture type:
   - **Visible Area**: Captures what's currently visible
   - **Full Page**: Captures entire scrollable page
   - **Select Element**: Click to select specific page element
4. Click "Analyze with AI" to send to Meowstik

### Voice Interaction

1. Click the extension icon
2. Go to "Live Voice" tab
3. Click the microphone button
4. Speak your question or command
5. AI responds with voice and text

### Keyboard Shortcuts

- `Ctrl+Shift+M` (Cmd+Shift+M on Mac): Open popup
- `Ctrl+Shift+V`: Start voice conversation
- `Ctrl+Shift+S`: Quick capture screen

### Context Menu

Right-click on any page:
- "Analyze with Meowstik AI" - Send selection or page to AI
- "Explain this" - Get explanation of selected text
- "Summarize page" - Get page summary

## Troubleshooting

### Extension Not Loading

**Error: "Manifest file is missing or unreadable"**
- Solution: Rebuild the extension with `./build.sh`
- Make sure you're selecting the `dist` folder, not the root folder

### Connection Failed

**Status shows "Disconnected"**
- Check server URL is correct (include `wss://` or `ws://`)
- Verify Meowstik server is running
- Check browser console for errors (F12)

### Voice Not Working

**Microphone access denied**
- Chrome will prompt for microphone permission
- Grant permission and try again
- Check chrome://settings/content/microphone

### Screen Capture Fails

**"Failed to capture screen"**
- Make sure you're on a regular webpage (not chrome:// pages)
- Try refreshing the page
- Check for other extensions that might block capture

## Development

### Building from Source

```bash
cd browser-extension
./build.sh
```

### Validating the Extension

```bash
cd browser-extension
bash validate.sh
```

### Making Changes

1. Edit files in `browser-extension/`
2. Run `./build.sh` to rebuild
3. Go to `chrome://extensions/`
4. Click refresh icon on Meowstik extension
5. Test your changes

## Security & Privacy

- All communication uses WebSocket Secure (WSS) encryption
- No data is stored on third-party servers
- Page content is only sent when explicitly requested
- Console logs only captured when monitoring is enabled
- Extension can be disabled/removed at any time

## Related Documentation

- [Browser Extension README](../browser-extension/README.md) - Detailed documentation
- [Browser Computer Use](./ragent/browser-computer-use.md) - AI automation features
- [Installing Desktop Agent](./ragent/install-desktop-agent.md) - Alternative for full desktop control

## Support

If you encounter issues:
1. Check the console logs (F12 → Console)
2. Verify your configuration in Settings tab
3. Try disconnecting and reconnecting
4. Rebuild the extension with `./build.sh`
5. Report issues on GitHub with console logs
