# Meowstik Packages

This directory contains standalone packages for extending Meowstik's capabilities. Each package serves a distinct purpose and can be used independently.

## 📦 Available Packages

### 🌐 `extension/` - Browser Extension
**Purpose:** Browser automation and web page interaction

The browser extension provides AI assistance within your web browser:
- 📄 Interacts with web pages (DOM manipulation, form filling, clicking)
- 🔍 Captures page content and context
- 🎯 Right-click context menu integration
- 📸 Screenshot and element capture
- 🚫 **Limitation:** Only works within the browser - cannot control other desktop applications

**Installation:** Load as unpacked extension in Chrome/Edge
**Use when:** You need AI to help with web browsing, research, or web-based tasks

---

### 🖥️ `desktop-agent/` - Desktop Remote Control Agent
**Purpose:** Full desktop automation and remote control

The desktop agent provides **complete system-level control** of your computer:
- 🖥️ Real-time screen capture of your entire desktop
- 🖱️ Mouse control (move, click, scroll) across all applications
- ⌨️ Keyboard input injection (typing, shortcuts)
- 🔄 Bidirectional AI control - AI can see and interact with anything on your screen
- 🚫 **Limitation:** Requires native dependencies (robotjs) for system-level access

**Installation:** `npm install -g @meowstik/desktop-agent`
**Use when:** You need AI to control desktop applications, perform system tasks, or work outside the browser

---

## 🤔 Which Package Do I Need?

| Scenario | Package to Use |
|----------|---------------|
| Automate web forms or browser tasks | `extension/` |
| Control desktop apps (VSCode, Photoshop, etc.) | `desktop-agent/` |
| AI needs to see my entire screen | `desktop-agent/` |
| Work with web pages only | `extension/` |
| Need full keyboard/mouse control | `desktop-agent/` |
| Simple browser automation | `extension/` |

---

## 🔒 Security Considerations

- **Extension:** Runs in browser sandbox with limited permissions
- **Desktop Agent:** Has full system access - only connect to trusted servers
- Both use token-based authentication
- Desktop agent supports localhost development mode without tokens

---

## 📚 Documentation

- [Desktop Agent README](./desktop-agent/README.md) - Installation and usage
- [Main Project README](../README.md) - Overall project documentation
- [Local Development Guide](../docs/local-development.md) - Development setup

---

## 🛠️ Development

Each package is independently buildable:

```bash
# Desktop Agent
cd packages/desktop-agent
npm install
npm run build

# Extension
cd packages/extension
# Load as unpacked extension in browser
```
