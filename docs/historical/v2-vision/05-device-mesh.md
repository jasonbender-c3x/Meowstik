# 05 - Device Mesh

## WebSocket Infrastructure and Multi-Device Connectivity

---

## Vision

A unified mesh connecting all of Jason's devices through persistent WebSocket connections:

```
                         ┌─────────────────┐
                         │  MEOWSTIK HUB   │
                         │  (Replit Cloud) │
                         └────────┬────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │           │             │             │           │
        ▼           ▼             ▼             ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Desktop │ │ Browser │ │ Phone   │ │ Home    │ │ Car     │
   │ Agent   │ │Extension│ │ (m.site)│ │ Server  │ │ Comma3x │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
        │                       │             │           │
        ▼                       ▼             ▼           ▼
   ┌─────────┐            ┌─────────┐   ┌─────────┐  ┌─────────┐
   │ Alexa   │            │ TV      │   │ IoT     │  │ Dashcam │
   │ (rooted)│            │ Remote  │   │ Devices │  │ Vision  │
   └─────────┘            └─────────┘   └─────────┘  └─────────┘
```

---

## Existing Infrastructure

Already built and running:

| Handler | Path | Purpose |
|---------|------|---------|
| `websocket-desktop.ts` | `/ws/desktop/agent/:sessionId` | Desktop screen/input |
| `websocket-live.ts` | `/api/live/stream/:sessionId` | Live voice streaming |
| `websocket-collab.ts` | `/ws/collab/:sessionId` | Collaborative editing |
| `websocket-terminal.ts` | `/ws/terminal/:sessionId` | Shell I/O streaming |

### Package: `ws` (already installed)

```json
{
  "ws": "^8.18.0"
}
```

---

## Universal Message Protocol

Every device speaks the same JSON language:

### Message Envelope

```json
{
  "id": "msg_1705678234567_abc123",
  "type": "command|query|event|stream|heartbeat",
  "from": "desktop-001",
  "to": "hub|broadcast|device-id",
  "timestamp": "2026-01-19T12:00:00.000Z",
  "payload": { ... }
}
```

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `register` | Device → Hub | Announce presence |
| `command` | Hub → Device | Execute action |
| `query` | Hub → Device | Request information |
| `response` | Device → Hub | Answer to query |
| `event` | Device → Hub | Something happened |
| `stream` | Bidirectional | Audio/video/data chunks |
| `heartbeat` | Bidirectional | Keep-alive |

---

## Device Registration

When a device connects:

```json
{
  "type": "register",
  "from": "comma3x-001",
  "payload": {
    "device_type": "vehicle",
    "device_name": "Jason's Comma 3X",
    "capabilities": [
      "gps",
      "speed",
      "can_bus",
      "front_camera",
      "driver_camera",
      "audio_in",
      "audio_out"
    ],
    "auth_token": "xxxxx"
  }
}
```

### Hub Response

```json
{
  "type": "response",
  "to": "comma3x-001",
  "payload": {
    "status": "registered",
    "session_id": "sess_abc123",
    "heartbeat_interval": 30000
  }
}
```

---

## Device Types

### Desktop Agent

**Location:** User's computer
**Package:** `meowstik-agent` (Node.js)
**Capabilities:**
- Screen capture (configurable FPS)
- Mouse/keyboard injection
- Audio capture/playback
- File system access
- Process execution

**Connection:**
```
wss://meowstik.replit.app/ws/desktop/agent/{sessionId}?token={token}
```

---

### Browser Extension

**Location:** Chrome/Firefox
**Package:** `workspace/extension/`
**Capabilities:**
- Current page content
- Screenshot capture
- Console log monitoring
- Network request interception
- Context menu actions

**Connection:**
```
wss://meowstik.replit.app/ws/extension/{sessionId}?token={token}
```

---

### Mobile (m.meowstik.com)

**Location:** Phone browser
**Capabilities:**
- Native audio streaming
- Touch input
- Camera access
- GPS location
- Push notifications

**Connection:**
```
wss://m.meowstik.com/api/live/stream/{sessionId}
```

---

### Home Server

**Location:** Local network
**Capabilities:**
- Full agent capabilities
- Local device proxy
- SSH tunnel to cloud
- IoT hub

**Connection:**
```
wss://meowstik.replit.app/ws/homeserver/{serverId}?token={token}
```

**Sub-devices via home server:**
- Smart lights
- TV/media
- Thermostats
- Security cameras
- Rooted Alexa

---

### Comma 3X (Vehicle)

**Location:** Car
**Platform:** OpenPilot (Linux-based)
**Capabilities:**
- GPS/speed/location
- CAN bus data
- Front camera feed
- Driver monitoring camera
- Audio in/out
- Vehicle control (with safety limits)

**Use Cases:**
- "What's my ETA?"
- "Pull over safely" (future)
- "Record this moment"
- "Navigate to..."

**Connection:**
```
wss://meowstik.replit.app/ws/vehicle/{vehicleId}?token={token}
```

---

## Command Examples

### Desktop: Take Screenshot

```json
{
  "type": "command",
  "to": "desktop-001",
  "payload": {
    "action": "screenshot",
    "params": {}
  }
}
```

Response:
```json
{
  "type": "response",
  "from": "desktop-001",
  "payload": {
    "action": "screenshot",
    "result": {
      "image_ref": "screens/desktop-001/1705678234.png",
      "width": 1920,
      "height": 1080
    }
  }
}
```

---

### Alexa: Speak

```json
{
  "type": "command",
  "to": "alexa-001",
  "payload": {
    "action": "speak",
    "params": {
      "text": "Jason, wake up. You have a meeting in 15 minutes.",
      "volume": 80
    }
  }
}
```

---

### Comma 3X: Get Status

```json
{
  "type": "query",
  "to": "comma3x-001",
  "payload": {
    "action": "status"
  }
}
```

Response:
```json
{
  "type": "response",
  "from": "comma3x-001",
  "payload": {
    "gps": { "lat": 47.1234, "lng": -122.5678 },
    "speed_mph": 65,
    "eta_minutes": 12,
    "destination": "Ocean Shores Tech",
    "engaged": true,
    "driver_attention": "alert"
  }
}
```

---

### Home Server: Control TV

```json
{
  "type": "command",
  "to": "homeserver-001",
  "payload": {
    "action": "proxy",
    "target": "living-room-tv",
    "command": {
      "action": "power",
      "params": { "state": "on" }
    }
  }
}
```

---

## Stream Protocol

For audio/video data:

### Audio Chunk

```json
{
  "type": "stream",
  "from": "phone-001",
  "payload": {
    "stream_type": "audio",
    "codec": "opus",
    "sample_rate": 48000,
    "channels": 1,
    "chunk_index": 42,
    "data": "base64_encoded_audio_data..."
  }
}
```

### Video Frame

```json
{
  "type": "stream",
  "from": "desktop-001",
  "payload": {
    "stream_type": "video",
    "codec": "jpeg",
    "width": 1920,
    "height": 1080,
    "frame_index": 1234,
    "data": "base64_encoded_frame..."
  }
}
```

---

## Security Model

### Token-Based Authentication

1. Device requests registration token from authenticated session
2. Token stored securely on device
3. All connections require valid token
4. Tokens can be revoked per-device

### Encryption

- All WebSocket connections over TLS (wss://)
- Sensitive payloads can use additional encryption

### Authorization

- Creator (Jason): Full access to all devices
- Family: Read-only on permitted devices (via catch phrase)
- Guests: No device access

---

## Heartbeat Protocol

Every 30 seconds:

```json
{
  "type": "heartbeat",
  "from": "desktop-001",
  "payload": {
    "uptime_seconds": 3600,
    "memory_mb": 256,
    "cpu_percent": 5
  }
}
```

If no heartbeat received in 90 seconds, device marked offline.

---

## Hub Architecture

```
┌────────────────────────────────────────────────────────┐
│                    MEOWSTIK HUB                        │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Device     │  │   Message    │  │   Stream     │ │
│  │   Registry   │  │   Router     │  │   Manager    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Auth       │  │   Event      │  │   State      │ │
│  │   Manager    │  │   Logger     │  │   Store      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
|-----------|----------------|
| Device Registry | Track connected devices, capabilities |
| Message Router | Route messages to correct device(s) |
| Stream Manager | Handle audio/video streams |
| Auth Manager | Validate tokens, manage sessions |
| Event Logger | Audit trail of all messages |
| State Store | Device state, last known values |

---

## Implementation: WebSocket Handler

```typescript
// server/websocket-mesh.ts

import { WebSocketServer, WebSocket } from "ws";

interface Device {
  id: string;
  type: string;
  name: string;
  capabilities: string[];
  socket: WebSocket;
  lastHeartbeat: Date;
}

class DeviceMesh {
  private devices = new Map<string, Device>();
  
  register(device: Device) {
    this.devices.set(device.id, device);
    this.broadcast({
      type: "event",
      payload: {
        event: "device_connected",
        device_id: device.id,
        device_name: device.name
      }
    });
  }
  
  route(message: MeshMessage) {
    if (message.to === "broadcast") {
      this.broadcast(message);
    } else if (message.to === "hub") {
      this.handleHubMessage(message);
    } else {
      const device = this.devices.get(message.to);
      if (device) {
        device.socket.send(JSON.stringify(message));
      }
    }
  }
  
  broadcast(message: MeshMessage) {
    for (const device of this.devices.values()) {
      device.socket.send(JSON.stringify(message));
    }
  }
}
```

---

## Node Networking Packages

For extended connectivity:

| Package | Use Case |
|---------|----------|
| `ws` | ✅ Core WebSocket (already installed) |
| `socket.io` | Fallback transports if WS blocked |
| `mqtt` | Lightweight IoT pub/sub |
| `libp2p` | True P2P mesh (no central server) |
| `ngrok` | NAT traversal for local devices |

---

## Mobile Live Mode: m.meowstik.com

### The Killer Feature

A dedicated mobile-first entry point:

**URL:** `https://m.meowstik.com`

**Features:**
- Native audio streaming (not Web Audio hacks)
- Sliding content panels
- HD voice (Google Cloud TTS Neural2)
- Concurrent tool execution
- Frame capture for live/pseudo-live
- Pointer-based data flow

**Technical Stack:**
- PWA for app-like experience
- MediaRecorder API for audio capture
- WebSocket for real-time communication
- Service Worker for offline capability

---

## Device Agent Template

Minimal agent for any device:

```typescript
// meowstik-agent.ts

const MEOWSTIK_HUB = "wss://meowstik.replit.app/ws/mesh";

class MeowstikAgent {
  private ws: WebSocket;
  private deviceId: string;
  private capabilities: string[];
  
  constructor(config: AgentConfig) {
    this.deviceId = config.deviceId;
    this.capabilities = config.capabilities;
  }
  
  connect(token: string) {
    this.ws = new WebSocket(`${MEOWSTIK_HUB}?token=${token}`);
    
    this.ws.on("open", () => this.register());
    this.ws.on("message", (data) => this.handleMessage(data));
    this.ws.on("close", () => this.reconnect());
  }
  
  register() {
    this.send({
      type: "register",
      from: this.deviceId,
      payload: {
        capabilities: this.capabilities
      }
    });
    
    this.startHeartbeat();
  }
  
  handleMessage(data: string) {
    const message = JSON.parse(data);
    
    if (message.type === "command") {
      const result = this.executeCommand(message.payload);
      this.send({
        type: "response",
        from: this.deviceId,
        payload: { result }
      });
    }
  }
  
  executeCommand(payload: CommandPayload): any {
    // Device-specific implementation
  }
}
```

---

*One protocol. Infinite devices. Unified control.*
