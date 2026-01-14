# Meowstik Browser Extension

AI-powered browser assistant with voice, screen capture, and automation capabilities.

## Features

- **Chat Interface**: Chat with Meowstik AI directly from your browser
- **Live Voice**: Real-time voice conversations using WebSocket streaming
- **Screen Capture**: Capture visible area, full page, or select elements for AI analysis
- **Page Analysis**: Extract and analyze page content, links, forms
- **Browser Automation**: AI can navigate, click, type, and interact with pages
- **Console/Network Logs**: Capture and send logs to AI for debugging

## Installation

### Quick Install (Recommended)

1. Download the latest release: [meowstik-extension.zip](meowstik-extension.zip)
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the extracted `dist` folder
6. Or drag and drop the ZIP file onto the extensions page

### From Source (Development)

1. Clone or download this repository
2. Navigate to the `browser-extension` directory
3. Run the build script:
   ```bash
   ./build.sh
   ```
4. Load the generated `dist` folder in Chrome as described above

### Configuration

1. Click the Meowstik extension icon
2. Go to Settings tab
3. Enter your server URL (default: `wss://meowstik.replit.app`)
4. Click "Connect"

## Keyboard Shortcuts

- `Ctrl+Shift+M` (Cmd+Shift+M on Mac): Open popup
- `Ctrl+Shift+V`: Start voice conversation
- `Ctrl+Shift+S`: Quick capture screen

## Architecture

```
browser-extension/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Persistent WebSocket connection
├── content/
│   ├── content-script.js  # Page interaction & DOM access
│   └── content-style.css  # Injected styles
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Popup logic
│   └── audio-processor.js # Voice audio worklet
└── icons/                 # Extension icons
```

## Communication Flow

```
┌─────────────┐    WebSocket    ┌─────────────────┐
│   Popup     │◄──────────────►│ Meowstik Server │
└─────────────┘                 └─────────────────┘
       │                               │
       │ Chrome APIs                   │
       ▼                               ▼
┌─────────────┐                 ┌─────────────────┐
│  Background │◄──────────────►│   Local Agent   │
│   Worker    │    WebSocket    │   (Playwright)  │
└─────────────┘                 └─────────────────┘
       │
       │ chrome.tabs.sendMessage
       ▼
┌─────────────┐
│   Content   │
│   Script    │
└─────────────┘
```

## Permissions

- `tabs`: Access tab information
- `activeTab`: Interact with current tab
- `storage`: Save settings
- `scripting`: Execute scripts in pages
- `contextMenus`: Right-click menu
- `notifications`: Show notifications
- `<all_urls>`: Access all websites

## Integration with Local Agent

The extension can communicate with the Meowstik Local Agent running on your computer for enhanced capabilities:

1. Start the local agent: `npm start` in `local-agent/`
2. Extension automatically connects via WebSocket
3. Local agent provides Playwright browser automation

## Privacy

- All communication is encrypted via WSS
- No data is stored on third-party servers
- Console logs are only sent when explicitly requested
- You control what pages the extension can access

## Building for Distribution

To create a distributable package of the extension:

```bash
./build.sh
```

This will:
- Create a `dist/` folder with all necessary files
- Generate `meowstik-extension.zip` ready for distribution
- Verify all files are included correctly

The generated ZIP can be:
- Shared with users for manual installation
- Submitted to the Chrome Web Store (requires additional preparation)
- Deployed to internal enterprise extension repositories

### Chrome Web Store Submission (Future)

To prepare for Chrome Web Store:

1. Create high-quality promotional images (1280x800, 640x400, etc.)
2. Write detailed description and privacy policy
3. Set up developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Upload `meowstik-extension.zip`
5. Fill in store listing details
6. Submit for review

## Development

### File Structure

```
browser-extension/
├── manifest.json          # Extension configuration
├── build.sh              # Build script
├── .gitignore            # Git ignore rules
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   ├── content-script.js  # Page interaction
│   └── content-style.css  # Injected styles
├── popup/
│   ├── popup.html        # Popup UI
│   ├── popup.css         # Popup styles
│   ├── popup.js          # Popup logic
│   └── audio-processor.js # Audio worklet
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Testing Changes

1. Make your code changes
2. Run `./build.sh` to rebuild
3. Go to `chrome://extensions/`
4. Click the refresh icon on the Meowstik extension
5. Test your changes

### Debugging

- **Background Worker**: `chrome://extensions/` → Inspect views: service worker
- **Popup**: Right-click extension icon → Inspect popup
- **Content Script**: Open DevTools on any page, check Console for extension logs

