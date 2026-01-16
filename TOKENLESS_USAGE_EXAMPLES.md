# Tokenless Localhost Connection - Usage Examples

## Development Mode (Tokenless)

### Starting the Agent
```bash
$ meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/

🐱 Meowstik Desktop Agent starting...
📡 Connecting to relay: ws://localhost:5000/ws/desktop/agent/
🔓 Development Mode: Connecting to localhost without token
✅ Connected to relay
📸 Starting screen capture (interval: 100ms)
```

### Server Logs
```
[Desktop WS] Creating development session for localhost agent (tokenless)
[DesktopRelay] Development session created (tokenless): ds_abc123xyz789
[Desktop WS] Agent connected: ds_abc123xyz789
[DesktopRelay] Agent registered for session ds_abc123xyz789: MyComputer (darwin)
```

## Production Mode (Token Required)

### Attempting Without Token (Fails)
```bash
$ NODE_ENV=production meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/

❌ Error: --token is required for non-localhost connections
Usage: meowstik-agent --token YOUR_TOKEN [--relay wss://...]

For local development, you can omit --token when connecting to localhost:
  meowstik-agent --relay ws://localhost:5000/ws/desktop
```

### With Token (Success)
```bash
$ NODE_ENV=production meowstik-agent \
    --token abc123xyz789 \
    --relay wss://my-app.replit.app/ws/desktop

🐱 Meowstik Desktop Agent starting...
📡 Connecting to relay: wss://my-app.replit.app/ws/desktop
✅ Connected to relay
📸 Starting screen capture (interval: 100ms)
```

## Feature Comparison

| Feature | Development | Production |
|---------|-------------|------------|
| **Token Required** | ❌ No (localhost only) | ✅ Yes (always) |
| **Connection Type** | ws://localhost:* | wss://* |
| **Environment** | NODE_ENV !== "production" | NODE_ENV === "production" |
| **IP Check** | Must be 127.0.0.1 | Any |
| **Session Type** | Temporary dev session | Normal session |
| **Use Case** | Local testing | Deployed application |

## Error Messages

### Non-localhost without Token
```
❌ Error: --token is required for non-localhost connections
```

### Production Mode (Server)
```
[Desktop WS] Agent connection rejected: no token (not localhost or production mode)
```

### Invalid Token
```
[Desktop WS] Agent connection rejected: invalid token
```

## Testing the Feature

### Quick Test Script
```bash
# Terminal 1: Start dev server
export NODE_ENV=development
npm run dev

# Terminal 2: Connect agent without token
cd desktop-agent
npm run dev -- --relay ws://localhost:5000/ws/desktop/agent/

# Expected: Agent connects successfully
# You should see: "🔓 Development Mode: Connecting to localhost without token"
```

### Verify Production Mode
```bash
# Terminal 1: Start production server
export NODE_ENV=production
npm start

# Terminal 2: Try to connect without token (should fail)
meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/

# Expected: Connection rejected
# You should see: "❌ Error: --token is required for non-localhost connections"
```

## Development Workflow

### Before (With Token)
```bash
# Step 1: Open web app
open http://localhost:5000/collaborate

# Step 2: Click "Start Desktop Session"

# Step 3: Copy token

# Step 4: Run agent with token
meowstik-agent --token LONG_TOKEN_STRING --relay ws://localhost:5000/ws/desktop
```

### After (Tokenless)
```bash
# Just run the agent!
meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/
```

**Time saved**: ~30 seconds per restart during development

## Security Notes

### ✅ Safe Development Practices
```bash
# Local development (safe)
export NODE_ENV=development
meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/
```

### ❌ DO NOT DO THIS
```bash
# Don't disable production mode in deployment
export NODE_ENV=development  # ❌ Dangerous!
npm start  # This would allow tokenless connections in production!

# Don't try to connect tokenless to remote servers
meowstik-agent --relay ws://remote-server.com/ws/desktop/agent/  # ❌ Will fail
```

### 🔒 Production Deployment
```bash
# Always set production environment
export NODE_ENV=production
npm start

# Always use tokens for agents
meowstik-agent \
  --token $(cat session-token.txt) \
  --relay wss://secure-app.com/ws/desktop
```

## Tips

1. **Use localhost explicitly**: `localhost` works better than `127.0.0.1` in some environments
2. **Check NODE_ENV**: Verify your server is in development mode
3. **Port flexibility**: Any port works as long as hostname is `localhost`
4. **IPv6 support**: Both IPv4 and IPv6 localhost addresses are supported

## Related Documentation

- [Full Feature Guide](../docs/desktop-agent-localhost-dev.md)
- [Installation Guide](../docs/ragent/install-desktop-agent.md)
- [Implementation Summary](../IMPLEMENTATION_TOKENLESS_LOCALHOST.md)
