# Meowstik Browser Extension v1.0.0

## Release Date
January 14, 2026

## Overview
First production-ready release of the Meowstik Automations browser extension, serving as the designated replacement for the standalone Desktop Agent.

## What's Included

### Core Features
- ✅ **Chat Interface**: Direct AI chat from browser toolbar
- ✅ **Live Voice**: Real-time voice conversations with WebSocket streaming
- ✅ **Screen Capture**: Visible area, full page, and element selection
- ✅ **Page Analysis**: Extract and analyze page content, links, and forms
- ✅ **Browser Automation**: AI-controlled navigation, clicking, typing
- ✅ **Console/Network Monitoring**: Capture logs for AI debugging

### Technical Features
- ✅ Manifest V3 compliant
- ✅ Service worker background script
- ✅ Content script injection on all pages
- ✅ Audio worklet for voice processing
- ✅ WebSocket connection to Meowstik server
- ✅ Context menu integration
- ✅ Keyboard shortcuts (Ctrl+Shift+M, V, S)

## Installation

### Method 1: Load Unpacked (Development)
```bash
cd browser-extension
./build.sh
# Then load dist/ folder in chrome://extensions/
```

### Method 2: Install ZIP
```bash
cd browser-extension
./build.sh
# Share meowstik-extension.zip with users
```

## Requirements
- Chrome 88+ (Manifest V3 support)
- Meowstik server running (default: wss://meowstik.replit.app)
- Microphone access (for voice features)

## Known Limitations
- Voice features require microphone permission
- Full page capture may be slow on large pages
- Some websites may block automation features
- Chrome Web Store distribution pending

## Documentation
- [README.md](README.md) - Complete documentation
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [../docs/BROWSER_EXTENSION_QUICKSTART.md](../docs/BROWSER_EXTENSION_QUICKSTART.md) - User quick start

## Changes from Previous Version
This is the initial production release. Previous versions were incomplete with:
- Empty icon files (fixed)
- Incorrect audio-processor.js path (fixed)
- No build system (added)
- Missing documentation (added)

## Credits
- Built for the Meowstik AI platform
- Powered by Google Gemini API
- Chrome Extension Manifest V3

## Support
For issues or questions:
1. Check [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) troubleshooting section
2. Review browser console logs (F12)
3. Verify server connection in Settings tab
4. Rebuild extension with `./build.sh`

## License
MIT License - See main project LICENSE file
