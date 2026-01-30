# Testing Guide: Browser Extension and Desktop Agent

This guide provides step-by-step instructions for testing the browser extension and desktop agent to verify they are functional.

## Prerequisites

1. **Environment Setup**
   ```bash
   cd /home/runner/work/Meowstik/Meowstik
   cp .env.example .env
   # Edit .env and set required variables:
   # - DATABASE_URL (PostgreSQL connection string)
   # - GEMINI_API_KEY (Google Gemini API key)
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd packages/meowstik-agent
   npm install --omit=optional  # Skip robotjs for testing
   npm run build
   cd ../..
   ```

3. **Database Setup**
   ```bash
   npm run db:push  # Apply database schema
   ```

## Testing the Desktop Agent

### Step 1: Start the Server

```bash
npm run dev
```

The server should start on port 5000 and display:
```
Server running on http://localhost:5000
Desktop WebSocket ready at ws://localhost:5000/ws/desktop
```

### Step 2: Test Agent Connection (Tokenless Mode)

In a new terminal:

```bash
cd packages/meowstik-agent
node dist/cli.js --relay ws://localhost:5000
```

**Expected Output:**
```
🐱 Meowstik Desktop Agent
=========================
Server: ws://localhost:5000
Token: localhost (tokenless)
FPS: 2
Quality: 60%
Audio: enabled
Input: enabled

Connecting to ws://localhost:5000/ws/desktop/agent/...
Connected to server
Registered: your-hostname (linux/x64)
Starting screen capture at 2 FPS...
```

**Verify:**
- ✅ Agent connects without requiring a token
- ✅ Server logs show "[Desktop WS] Creating development session for localhost agent (tokenless)"
- ✅ No errors in agent or server console
- ⚠️ If robotjs is not installed, you'll see: "robotjs not available - input injection disabled" (this is OK)
- ⚠️ If screenshot-desktop fails, placeholder frames will be sent (this is OK for testing)

### Step 3: Test Agent with Token (Production Mode)

1. In the web UI, create a desktop session and get a token, OR
2. Use the API to create a session:

```bash
curl -X POST http://localhost:5000/api/desktop/sessions \
  -H "Content-Type: application/json" | jq
```

Response will include a token. Use it:

```bash
node dist/cli.js --token YOUR_TOKEN --relay ws://localhost:5000
```

**Expected Output:**
```
Connected to server
Registered: your-hostname (linux/x64)
```

**Verify:**
- ✅ Agent connects with valid token
- ✅ Server creates a session with the provided token
- ❌ Agent should reject invalid tokens

## Testing the Browser Extension

### Step 1: Load Extension in Browser

#### Chrome/Edge/Brave

1. Navigate to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select: `/home/runner/work/Meowstik/Meowstik/packages/extension`
5. Extension icon (🐱) should appear in toolbar

#### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select: `/home/runner/work/Meowstik/Meowstik/packages/extension/manifest.json`

### Step 2: Test Extension Connection

1. Start the server: `npm run dev`

2. Click the extension icon (🐱)

3. Enter server URL: `http://localhost:5000`

4. Click **Connect**

**Expected Behavior:**
- ✅ Status changes from "Disconnected" to "Connected"
- ✅ Chat interface appears
- ✅ Tool buttons appear (Screenshot, Extract, Console, Network)
- ✅ Server logs show:
  ```
  [Extension API] Register
  [Extension API] Connection established
  ```

**Verify in Browser Console:**
- Right-click extension icon → "Inspect popup"
- Should see no errors
- Should see connection success messages

### Step 3: Test Extension Features

#### Test Chat

1. Type a message: "Hello Meowstik"
2. Click Send

**Expected:**
- ✅ Message appears in chat
- ✅ AI response appears
- ✅ Server logs show `[Extension API] Chat request`

#### Test Screenshot

1. Click the camera icon (📸) or the Screenshot tool
2. Screenshot should be captured

**Expected:**
- ✅ Message appears: "Screenshot captured and sent to AI"
- ✅ Server logs show `[Extension API] Screenshot received`

#### Test Page Content Extraction

1. Click "Extract Text" tool (📄)
2. Page content should be extracted

**Expected:**
- ✅ Message appears: "Page content extracted"
- ✅ Server logs show `[Extension API] Page content extracted`

#### Test Context Menu

1. Right-click on selected text
2. Click "Ask Meowstik about this"

**Expected:**
- ✅ Context menu item appears
- ✅ Server receives context request
- ✅ Server logs show `[Extension API] Context received`

### Step 4: Test Content Script

1. Open browser DevTools (F12) on any page
2. Go to Console tab
3. Type: `console.log("Test message")`

**Expected:**
- ✅ Content script intercepts the log
- ✅ Background script receives the log
- ✅ Extension can retrieve logs via "Console Logs" tool

## Troubleshooting

### Desktop Agent Issues

**"Cannot find module 'robotjs'"**
- This is OK - input injection will be disabled
- To fix: Install system dependencies and run `npm install robotjs`

**"Connection refused"**
- Verify server is running
- Check server URL is correct
- Check firewall settings

**"Invalid token"**
- Token may be expired or invalid
- For localhost: Don't use `--token` flag
- For production: Generate new token from server

**"screenshot-desktop not available"**
- This is OK for testing - placeholder frames will be sent
- The module works on most systems but may fail in some environments

### Browser Extension Issues

**Extension won't load**
- Check manifest.json syntax (should be valid JSON)
- Check all referenced files exist
- Check browser console for errors

**Can't connect to server**
- Verify server is running on the specified port
- Check CORS is enabled on server
- Check server URL includes `http://` or `https://`
- Try opening `http://localhost:5000/api/status` in browser

**Tools not working**
- Connect to server first
- Check browser console for errors
- Check server logs for API errors

**Content script not injecting**
- Reload the page after loading extension
- Check extension has `<all_urls>` permission
- Check content.js in page's DevTools console

## Success Criteria

### Desktop Agent ✅
- [x] Builds without errors
- [x] Connects to localhost without token
- [x] Connects with valid token
- [x] Registers with server
- [x] Works without robotjs (graceful degradation)
- [ ] Captures screen frames (if screenshot-desktop works)
- [ ] Sends input events (if robotjs is installed)

### Browser Extension ✅
- [x] Loads in browser without errors
- [x] Connects to server successfully
- [x] Chat interface works
- [x] Screenshot tool works
- [x] Content extraction works
- [x] Context menu works
- [x] Console log monitoring works
- [x] Network request monitoring works

## Automated Testing (Future)

Currently, testing is manual. Future improvements:

1. **Unit Tests**
   - Test extension message passing
   - Test agent WebSocket message handling
   - Test server API endpoints

2. **Integration Tests**
   - Test full connection flow
   - Test data flow between components
   - Test error handling

3. **E2E Tests**
   - Use Playwright to test extension
   - Test agent with mock WebSocket server
   - Test multi-agent scenarios

## Notes

- The desktop agent and extension are designed to work independently
- The agent requires a WebSocket connection to the server
- The extension uses HTTP REST API and doesn't require WebSocket
- Both can work simultaneously on the same server
- For production, both require proper authentication (tokens)
- For local development, authentication is optional for easier testing
