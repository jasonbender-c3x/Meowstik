# Browser Extension Deployment Checklist

This checklist ensures the Meowstik Browser Extension is properly deployed and functional.

## Pre-Deployment Checklist

- [x] **Icons Generated**: All 4 icon sizes (16x16, 32x32, 48x48, 128x128) are valid PNG files
- [x] **Manifest Valid**: manifest.json passes JSON validation
- [x] **JavaScript Syntax**: All JS files are syntax-error-free
- [x] **Paths Fixed**: audio-processor.js path corrected in manifest and popup.js
- [x] **Build Script**: build.sh creates dist/ folder and ZIP package
- [x] **Validation Script**: validate.sh checks all requirements
- [x] **Gitignore**: Build artifacts excluded from version control
- [x] **Documentation**: README updated with build/deployment instructions

## Build Steps

1. **Navigate to extension directory:**
   ```bash
   cd browser-extension
   ```

2. **Run validation:**
   ```bash
   bash validate.sh
   ```
   Expected: All checks pass ✅

3. **Build distribution package:**
   ```bash
   ./build.sh
   ```
   Expected: Creates `dist/` folder and `meowstik-extension.zip`

4. **Verify build output:**
   ```bash
   ls -lh meowstik-extension.zip
   ls -la dist/
   ```
   Expected: ZIP file ~23KB, dist/ contains all source files

## Installation Testing

### Test in Chrome

1. **Load unpacked extension:**
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `browser-extension/dist` folder
   - ✅ Extension appears in list

2. **Verify extension loads:**
   - ✅ No errors in console
   - ✅ Extension icon appears in toolbar
   - ✅ Can pin extension to toolbar

3. **Test popup:**
   - Click extension icon
   - ✅ Popup opens successfully
   - ✅ All 4 tabs visible (Chat, Live Voice, Screen, Settings)
   - ✅ No console errors

4. **Test tabs:**
   - ✅ Chat tab: Input field and send button present
   - ✅ Live Voice tab: Microphone button and visualizer present
   - ✅ Screen tab: 3 capture buttons present
   - ✅ Settings tab: All input fields and buttons present

5. **Test settings:**
   - Enter server URL (e.g., `wss://meowstik.replit.app`)
   - Click "Save Settings"
   - ✅ Settings save successfully
   - ✅ Toast notification appears (or console message)

6. **Test connection (if server available):**
   - Click "Connect" button
   - ✅ Status changes to "Connecting..." then "Connected"
   - ✅ Status dot turns green
   - ✅ Badge updates

### Test on Web Page

1. **Navigate to any webpage** (e.g., example.com)

2. **Test content script:**
   - Open DevTools (F12)
   - Check Console for extension logs
   - ✅ Content script loaded without errors

3. **Test context menu:**
   - Right-click on page
   - ✅ "Analyze with Meowstik AI" appears
   - ✅ "Explain this" appears (when text selected)
   - ✅ "Summarize page" appears

4. **Test keyboard shortcuts:**
   - Press `Ctrl+Shift+M` (Cmd+Shift+M on Mac)
   - ✅ Popup opens

## Feature Testing

### Screen Capture

1. **Open extension popup → Screen tab**

2. **Test Visible Area capture:**
   - Click "Visible Area" button
   - ✅ Screenshot appears in preview
   - ✅ "Analyze with AI" button becomes enabled

3. **Test Full Page capture:**
   - Click "Full Page" button
   - ✅ Full page screenshot appears
   - Note: May take several seconds

4. **Test Element Selection:**
   - Click "Select Element" button
   - ✅ Popup closes
   - ✅ Cursor changes to crosshair
   - Hover over elements
   - ✅ Elements highlight with pink outline
   - Press Escape
   - ✅ Selection mode exits

### Live Voice (Basic UI Test)

1. **Open extension popup → Live Voice tab**

2. **Test microphone access:**
   - Click microphone button
   - ✅ Browser prompts for microphone permission
   - Grant permission
   - ✅ Button turns green with pulse animation
   - ✅ Audio visualizer shows waveform

3. **Stop voice:**
   - Click microphone button again
   - ✅ Recording stops
   - ✅ Button returns to normal state

### Chat Interface

1. **Open extension popup → Chat tab**

2. **Test input:**
   - Type a message in input field
   - ✅ Can type normally
   - Press Enter
   - ✅ Message appears in chat area
   - ✅ Message marked as "user"

3. **Test send button:**
   - Type message
   - Click send button
   - ✅ Message appears

## Security Checks

- [x] **No hardcoded credentials**: Check all files for API keys or tokens
- [x] **Permissions justified**: All manifest permissions are necessary
- [x] **HTTPS/WSS only**: Server URL validation uses secure protocols
- [x] **No eval() in content**: Content script doesn't use eval (except in controlled executeScript)
- [x] **CSP compliant**: No inline scripts in HTML files

## Documentation Verification

- [x] **README.md**: Complete with installation and usage instructions
- [x] **BROWSER_EXTENSION_QUICKSTART.md**: User-friendly quick start guide
- [x] **Main README.md**: References browser extension
- [x] **Build instructions**: Clear and accurate
- [x] **Troubleshooting section**: Common issues documented

## Distribution Checklist

### For Manual Distribution

- [x] **ZIP package**: meowstik-extension.zip is ready
- [x] **Installation instructions**: Documented in README
- [x] **Minimum Chrome version**: Manifest v3 requires Chrome 88+
- [x] **Supported platforms**: Windows, macOS, Linux (all Chrome versions)

### For Chrome Web Store (Future)

- [ ] **Store assets**: Create promotional images (1280x800, 640x400, 440x280, 128x128)
- [ ] **Privacy policy**: Write and host privacy policy
- [ ] **Detailed description**: 132-character summary + full description
- [ ] **Screenshots**: 5-7 high-quality screenshots
- [ ] **Developer account**: Set up Chrome Web Store developer account ($5 one-time fee)
- [ ] **Category**: Productivity
- [ ] **Pricing**: Free

## Post-Deployment

- [x] **Version control**: Changes committed to git
- [x] **Build artifacts**: Excluded via .gitignore
- [x] **Documentation**: Up to date
- [x] **Validation**: All checks pass

## Rollback Plan

If issues are found after deployment:

1. **Identify the issue** from user reports or logs
2. **Test fix locally** with validate.sh
3. **Rebuild** with ./build.sh
4. **Distribute new version**
5. **Update documentation** if needed

## Success Criteria

✅ All items in this checklist are complete
✅ Extension loads without errors in Chrome
✅ All UI elements render correctly
✅ No console errors during normal operation
✅ Settings can be saved and loaded
✅ Screen capture functionality works
✅ Documentation is accurate and complete

---

## Sign-Off

- **Build Date**: 2026-01-14
- **Version**: 1.0.0
- **Validation Status**: ✅ PASSED
- **Ready for Distribution**: ✅ YES

**Notes**: 
- Extension has been fully validated and tested
- All JavaScript files are syntax-error-free
- Icons are properly generated with Meowstik branding
- Build system is automated and reproducible
- Documentation is comprehensive and user-friendly

**Next Steps**:
1. Distribute meowstik-extension.zip to users
2. Monitor for user feedback and issues
3. Prepare Chrome Web Store submission (optional)
4. Consider automated testing in future versions
