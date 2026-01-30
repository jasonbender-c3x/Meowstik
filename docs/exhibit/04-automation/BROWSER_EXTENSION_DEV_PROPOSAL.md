# Browser Extension Development Server Proposal

## Executive Summary

This document proposes a comprehensive development workflow for the Meowstik browser extension that enables local testing, hot reloading, and streamlined debugging. The goal is to create a developer-friendly environment that reduces friction when building and testing browser extension features.

---

## Problem Statement

Currently, the Meowstik browser extension development workflow has several pain points:

### Current Challenges

1. **Manual Reload Required**: After every code change, developers must:
   - Navigate to `chrome://extensions`
   - Click the reload button
   - Reopen the extension popup
   - Navigate back to their test state

2. **No Build Pipeline**: The extension uses plain JavaScript files without:
   - TypeScript compilation
   - Module bundling
   - Tree-shaking
   - Minification
   - Source maps for debugging

3. **Limited Development Tools**:
   - No live reload on file changes
   - No integrated development server
   - Manual file watching required
   - Difficult to debug across multiple contexts (background, content, popup)

4. **Inconsistent with Main App**: The main Meowstik app uses:
   - Vite for fast development
   - TypeScript for type safety
   - Hot Module Replacement (HMR)
   - Modern build tooling
   
   But the extension is still plain JS with manual reloads.

5. **Testing Friction**: 
   - Hard to test WebSocket connections locally
   - Difficult to mock server responses
   - No automated testing setup
   - Manual verification of all features after changes

---

## Proposed Solution

### Overview

Create a modern development environment for the browser extension that includes:

1. **Build System**: Vite-based bundler for extension files
2. **Live Reload**: Automatic extension reload on file changes
3. **TypeScript Support**: Type-safe extension development
4. **Local Development Server**: Mock server for testing without backend
5. **Development Scripts**: Streamlined npm commands for common tasks
6. **Source Maps**: Easy debugging in Chrome DevTools
7. **Hot Module Replacement**: Instant updates without full reload (where possible)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Development Environment                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐         ┌─────────────────┐               │
│  │  Vite Dev      │         │  Extension      │               │
│  │  Server        │────────▶│  Builder        │               │
│  │  (Port 5001)   │         │  (Rollup-based) │               │
│  └────────────────┘         └─────────────────┘               │
│         │                            │                         │
│         │ File Watch                 │ Build Output            │
│         ▼                            ▼                         │
│  ┌────────────────┐         ┌─────────────────┐               │
│  │  TypeScript    │         │  dist/extension/│               │
│  │  Source Files  │────────▶│  - manifest.json│               │
│  │  /extension-src│         │  - popup/       │               │
│  └────────────────┘         │  - background/  │               │
│                              │  - content/     │               │
│                              └─────────────────┘               │
│                                      │                         │
│                                      │ Auto-reload             │
│                                      ▼                         │
│                              ┌─────────────────┐               │
│                              │ Chrome Extension│               │
│                              │ Hot Reloader    │               │
│                              └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Design

### 1. Build System (Vite + Rollup)

**Why Vite?**
- Already used in the main Meowstik app (consistency)
- Fast development builds with esbuild
- Excellent TypeScript support
- Plugin ecosystem for Chrome extensions
- Built-in hot module replacement

**Build Configuration:**

```typescript
// vite.config.extension.ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './extension-src/manifest';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist/extension',
    rollupOptions: {
      input: {
        popup: 'extension-src/popup/popup.html',
        background: 'extension-src/background/service-worker.ts',
        content: 'extension-src/content/content-script.ts',
      },
    },
  },
});
```

### 2. Source Structure

**New Directory Layout:**

```
extension-src/              # TypeScript source files
├── manifest.ts             # Manifest generator with types
├── background/
│   ├── service-worker.ts   # Main background script
│   ├── websocket.ts        # WebSocket client
│   └── commands.ts         # Command handlers
├── content/
│   ├── content-script.ts   # Content script entry
│   ├── page-analyzer.ts    # DOM analysis
│   └── styles.css          # Injected styles
├── popup/
│   ├── popup.html          # Popup template
│   ├── popup.ts            # Popup logic
│   ├── components/         # React components (future)
│   └── styles.css          # Popup styles
├── shared/
│   ├── types.ts            # Shared TypeScript types
│   ├── constants.ts        # Configuration constants
│   └── utils.ts            # Shared utilities
└── assets/
    └── icons/              # Extension icons

dist/extension/             # Built extension (gitignored)
└── (Same structure, compiled JS)

browser-extension/          # Legacy files (to be migrated)
```

### 3. Live Reload System

**Approach A: File Watcher + Chrome Reload**

Use a file watcher that triggers Chrome to reload the extension:

```typescript
// scripts/watch-extension.ts
import chokidar from 'chokidar';
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8081 });

chokidar.watch('dist/extension/**/*').on('change', (path) => {
  console.log(`File changed: ${path}`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'reload' }));
    }
  });
});
```

**Approach B: CRXJS Plugin (Recommended)**

Use the `@crxjs/vite-plugin` which provides:
- Automatic extension reloading
- Hot module replacement for popup pages
- Service worker hot restart
- Content script injection updates

### 4. Development Server

**Mock Backend Server:**

Create a development server that simulates the Meowstik backend:

```typescript
// scripts/dev-server.ts
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express();
const wss = new WebSocketServer({ port: 8080 });

// Mock WebSocket endpoint
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    
    // Simulate AI responses
    if (message.type === 'chat') {
      ws.send(JSON.stringify({
        type: 'response',
        content: 'Mock AI response',
        streaming: false
      }));
    }
  });
});

app.listen(3001, () => {
  console.log('Extension dev server running on http://localhost:3001');
});
```

### 5. TypeScript Migration

**Benefits:**
- Type safety prevents runtime errors
- Better IDE autocomplete
- Shared types with main app
- Easier refactoring

**Migration Strategy:**
1. Create `extension-src/` with TypeScript files
2. Keep `browser-extension/` for backwards compatibility
3. Gradually migrate files one-by-one
4. Remove old files once migration is complete

**Shared Types Example:**

```typescript
// extension-src/shared/types.ts
import type { Chat, Message } from '@shared/schema';

export interface ExtensionMessage {
  type: 'chat' | 'capture' | 'analyze';
  payload: unknown;
}

export interface BackgroundMessage extends ExtensionMessage {
  tabId: number;
  timestamp: number;
}

export interface PopupState {
  isConnected: boolean;
  currentChat: Chat | null;
  messages: Message[];
}
```

### 6. Development Scripts

**Proposed npm Scripts:**

```json
{
  "scripts": {
    // Development
    "dev:extension": "vite build --config vite.config.extension.ts --watch --mode development",
    "dev:extension-server": "tsx scripts/dev-server.ts",
    "dev:full": "concurrently \"npm run dev\" \"npm run dev:extension\" \"npm run dev:extension-server\"",
    
    // Building
    "build:extension": "vite build --config vite.config.extension.ts",
    "build:extension:prod": "vite build --config vite.config.extension.ts --mode production",
    
    // Testing
    "test:extension": "vitest --config vitest.config.extension.ts",
    
    // Packaging
    "package:extension": "npm run build:extension:prod && tsx scripts/package-extension.ts",
    
    // Utilities
    "clean:extension": "rm -rf dist/extension",
    "watch:extension": "tsx scripts/watch-extension.ts"
  }
}
```

---

## Implementation Phases

### Phase 1: Basic Build System (Week 1)

**Goals:**
- Set up Vite configuration for extension
- Create basic TypeScript structure
- Build manifest dynamically
- Output extension to `dist/extension/`

**Deliverables:**
- `vite.config.extension.ts`
- `extension-src/` directory structure
- Working build command
- Documentation

**Success Criteria:**
- Extension builds successfully
- Can be loaded in Chrome
- All existing features work

### Phase 2: Live Reload (Week 1-2)

**Goals:**
- Implement file watching
- Add automatic extension reload
- Set up source maps for debugging

**Deliverables:**
- Watch mode script
- Chrome reload mechanism
- Development mode configuration

**Success Criteria:**
- Extension reloads on file save
- Changes appear within 2 seconds
- No manual reload needed
- Source maps work in DevTools

### Phase 3: TypeScript Migration (Week 2-3)

**Goals:**
- Migrate background script to TypeScript
- Migrate content script to TypeScript
- Migrate popup to TypeScript
- Add shared type definitions

**Deliverables:**
- Fully typed extension source
- Shared types with main app
- Type checking in CI/CD

**Success Criteria:**
- No `any` types
- Full IntelliSense support
- Type errors caught at build time
- Successful CI/CD runs

### Phase 4: Development Server (Week 3-4)

**Goals:**
- Create mock WebSocket server
- Add mock API endpoints
- Simulate AI responses
- Enable offline development

**Deliverables:**
- Express dev server
- Mock response handlers
- Development environment variables
- Server documentation

**Success Criteria:**
- Can test extension without backend
- Mock responses simulate real behavior
- Latency and streaming work
- Easy to add new mock scenarios

### Phase 5: Developer Experience (Week 4)

**Goals:**
- Add logging utilities
- Create debugging helpers
- Improve error messages
- Document workflows

**Deliverables:**
- Debug logging system
- Developer documentation
- Troubleshooting guide
- Quick start guide

**Success Criteria:**
- New developers can start in < 10 minutes
- Clear error messages
- Easy to debug issues
- Good documentation

---

## Benefits

### For Developers

1. **Faster Iteration**: 
   - Changes visible in 2 seconds vs 30+ seconds
   - No context switching to reload extension
   - Stay in flow state

2. **Better Debugging**:
   - Source maps show original TypeScript
   - Type errors caught early
   - Clear stack traces

3. **Modern Tooling**:
   - IDE autocomplete
   - Refactoring support
   - Import/export statements
   - ES modules

4. **Reduced Friction**:
   - One command to start: `npm run dev:full`
   - Automatic everything
   - Less mental overhead

### For the Project

1. **Code Quality**:
   - Type safety prevents bugs
   - Shared types ensure consistency
   - Linting and formatting

2. **Maintainability**:
   - Modern, familiar tooling
   - Standard patterns
   - Easy onboarding

3. **Testing**:
   - Unit tests possible
   - Mock server for integration tests
   - CI/CD integration

4. **Consistency**:
   - Same tools as main app
   - Unified development experience
   - Shared configurations

---

## Technical Considerations

### 1. Chrome Extension Manifest V3

**Challenges:**
- Service workers instead of background pages
- Limited dynamic code execution
- Stricter Content Security Policy

**Solutions:**
- Use static imports only
- Pre-bundle all dependencies
- Use chrome.scripting API for dynamic code

### 2. WebSocket Connections

**Challenge**: Service workers can sleep, disconnecting WebSocket

**Solution**: 
- Reconnection logic in service worker
- Persistent connection management
- State synchronization on wake

### 3. Content Script Injection

**Challenge**: Content scripts run in isolated context

**Solution**:
- Use message passing
- Inject scripts dynamically when needed
- Keep content script small

### 4. Build Size

**Challenge**: Extension size impacts load time

**Solution**:
- Tree-shaking to remove unused code
- Code splitting for popup/background/content
- Lazy loading of heavy dependencies
- Minification in production

### 5. Development vs Production

**Challenge**: Different behavior in dev vs prod

**Solution**:
- Environment variables for config
- Mock server only in development
- Production builds optimized
- Feature flags for testing

---

## Security Considerations

### 1. Content Security Policy

**Requirements:**
- No inline scripts
- No `eval()` or `Function()`
- External resources must be declared

**Implementation:**
- All scripts built into extension
- External resources in manifest
- Use `chrome.scripting.executeScript` for dynamic code

### 2. Permissions

**Principle**: Request minimum permissions needed

**Current Permissions:**
- `tabs`: For tab information
- `activeTab`: For current tab access
- `storage`: For settings
- `scripting`: For content injection
- `webNavigation`: For page events
- `contextMenus`: For right-click menu
- `notifications`: For user feedback

**Review**: Ensure each permission is necessary

### 3. API Key Management

**Challenge**: Don't expose API keys in extension

**Solution**:
- Keys stored server-side
- Authentication via tokens
- Extension only stores auth token
- Tokens have limited scope

---

## Testing Strategy

### 1. Unit Tests

**Framework**: Vitest

**Coverage**:
- Utility functions
- Message handlers
- State management
- Type validators

**Example**:

```typescript
// extension-src/shared/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatPageContent } from '../utils';

describe('formatPageContent', () => {
  it('extracts text from HTML', () => {
    const html = '<div>Hello <strong>World</strong></div>';
    const text = formatPageContent(html);
    expect(text).toBe('Hello World');
  });
});
```

### 2. Integration Tests

**Framework**: Playwright

**Coverage**:
- Extension loading
- Popup interaction
- WebSocket connection
- Page content extraction

**Example**:

```typescript
// tests/extension.test.ts
import { test, expect, chromium } from '@playwright/test';

test('extension loads successfully', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=./dist/extension`,
      `--load-extension=./dist/extension`,
    ],
  });
  
  const popup = await context.newPage();
  await popup.goto('chrome-extension://[id]/popup/popup.html');
  
  await expect(popup.locator('h1')).toHaveText('Meowstik');
});
```

### 3. Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] WebSocket connects to server
- [ ] Chat messages send and receive
- [ ] Screen capture works
- [ ] Content script extracts page data
- [ ] Context menu items appear
- [ ] Keyboard shortcuts work
- [ ] Settings persist
- [ ] Works across browser restart

---

## Dependencies

### New Dependencies

```json
{
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "chokidar": "^3.5.3",
    "concurrently": "^8.2.2",
    "webextension-polyfill": "^0.10.0",
    "@types/chrome": "^0.0.254",
    "vitest": "^1.0.4"
  }
}
```

**Package Descriptions:**

- `@crxjs/vite-plugin`: Vite plugin for Chrome extensions with HMR
- `chokidar`: File system watcher
- `concurrently`: Run multiple npm scripts
- `webextension-polyfill`: Cross-browser extension API
- `@types/chrome`: TypeScript types for Chrome APIs
- `vitest`: Unit testing framework

---

## Migration Path

### Step 1: Parallel Development (Recommended)

**Approach:**
- Keep existing `browser-extension/` working
- Build new system in `extension-src/`
- Test thoroughly before switching
- Flip switch when ready

**Pros:**
- No disruption to current development
- Safe rollback if issues
- Time to test thoroughly

**Cons:**
- Maintaining two systems temporarily
- More disk space

### Step 2: Direct Migration (Risky)

**Approach:**
- Rename `browser-extension/` to `browser-extension-old/`
- Create new structure immediately
- Migrate files one by one

**Pros:**
- Faster migration
- Forces completion

**Cons:**
- Breaks current workflow
- No rollback option
- High risk

### Step 3: Hybrid Approach (Balanced)

**Approach:**
- Set up build system first
- Compile existing JS files as-is
- Gradually convert to TypeScript
- Remove old files when confident

**Pros:**
- Immediate benefits (live reload)
- Gradual TypeScript adoption
- Lower risk

**Cons:**
- Still some duplication
- Longer timeline

---

## Documentation Requirements

### 1. Setup Guide

**Audience**: New developers

**Contents**:
- Prerequisites installation
- Clone and setup
- Run development server
- Load extension in Chrome
- Make first change

**Format**: Step-by-step with screenshots

### 2. Development Workflow

**Audience**: Active developers

**Contents**:
- Common tasks (add feature, fix bug)
- File organization
- Where to find things
- Best practices

**Format**: Task-oriented

### 3. Architecture Overview

**Audience**: Senior developers, maintainers

**Contents**:
- System architecture
- Communication flow
- State management
- Extension lifecycle

**Format**: Diagrams and explanations

### 4. Troubleshooting Guide

**Audience**: All developers

**Contents**:
- Common errors and solutions
- Debugging techniques
- Reset procedures
- Getting help

**Format**: Problem/solution pairs

### 5. API Reference

**Audience**: Developers extending the system

**Contents**:
- Message types
- Function signatures
- Configuration options
- Examples

**Format**: Reference documentation

---

## Success Metrics

### Quantitative

- **Build Time**: < 3 seconds for development builds
- **Reload Time**: < 2 seconds from file save to extension updated
- **Bundle Size**: < 500KB total (gzipped)
- **Type Coverage**: > 95% (no `any` types)
- **Test Coverage**: > 80% for utility functions

### Qualitative

- Developer satisfaction (survey)
- Ease of onboarding new developers
- Frequency of extension-related bugs
- Time to implement new features
- Code review feedback

---

## Risks and Mitigations

### Risk 1: Breaking Existing Functionality

**Probability**: Medium  
**Impact**: High

**Mitigation**:
- Comprehensive testing before switching
- Keep old extension as fallback
- Gradual rollout
- Feature parity checklist

### Risk 2: Build System Complexity

**Probability**: Medium  
**Impact**: Medium

**Mitigation**:
- Use proven tools (@crxjs/vite-plugin)
- Document configuration thoroughly
- Keep build config simple
- Provide troubleshooting guide

### Risk 3: Chrome Extension API Changes

**Probability**: Low  
**Impact**: Medium

**Mitigation**:
- Follow Chrome extension best practices
- Use stable APIs only
- Monitor Chrome release notes
- Have migration plan for API changes

### Risk 4: Developer Adoption

**Probability**: Low  
**Impact**: Medium

**Mitigation**:
- Excellent documentation
- Training sessions
- Gradual introduction
- Highlight benefits clearly

### Risk 5: Performance Regression

**Probability**: Low  
**Impact**: High

**Mitigation**:
- Performance testing
- Bundle size monitoring
- Profiling tools
- Optimization guidelines

---

## Timeline

### Week 1: Foundation
- Set up Vite configuration
- Create directory structure
- Implement basic build
- Test in Chrome

### Week 2: Enhancement
- Add live reload
- Implement watch mode
- Set up source maps
- Create dev scripts

### Week 3: Migration
- Convert background script to TypeScript
- Convert content script to TypeScript
- Convert popup to TypeScript
- Add type definitions

### Week 4: Polish
- Create dev server
- Add testing setup
- Write documentation
- Train team

**Total Timeline**: 4 weeks (1 month)

---

## Open Questions

1. **Should we migrate to React for the popup UI?**
   - Pros: Component reusability, state management, testing
   - Cons: Bundle size increase, learning curve, complexity
   - Decision: Defer to Phase 2, keep vanilla JS for now

2. **Do we need a separate extension for development vs production?**
   - Could have different extension IDs for testing
   - Prevents conflicts with production
   - Recommend: Single extension with environment detection

3. **Should we support Firefox and Safari?**
   - webextension-polyfill helps
   - Manifest V3 is Chrome-first
   - Decision: Chrome only for now, add others later

4. **How to handle extension updates in production?**
   - Auto-update via Chrome Web Store
   - Manual update for unpacked dev versions
   - Need update notification system?

5. **What about mobile testing?**
   - Chrome extensions don't work on mobile
   - Consider Kiwi Browser for Android testing
   - iOS: No extension support

---

## Alternatives Considered

### Alternative 1: Webpack

**Pros:**
- More mature
- Better extension ecosystem
- Well-documented patterns

**Cons:**
- Slower builds
- More complex configuration
- Not used elsewhere in project

**Decision**: Reject - Vite is faster and already in use

### Alternative 2: Plain TypeScript Compiler

**Pros:**
- Simplest approach
- No bundler complexity
- Fast compilation

**Cons:**
- No tree-shaking
- No code splitting
- No HMR
- Manual watch mode

**Decision**: Reject - Missing too many features

### Alternative 3: Rollup Directly

**Pros:**
- Excellent tree-shaking
- Plugin ecosystem
- Full control

**Cons:**
- More configuration
- No dev server
- No HMR built-in

**Decision**: Reject - Vite provides Rollup + more

### Alternative 4: Parcel

**Pros:**
- Zero configuration
- Fast builds
- Good defaults

**Cons:**
- Less control
- Smaller community for extensions
- Not used in main app

**Decision**: Reject - Less suitable for extensions

---

## Conclusion

Implementing a modern development server and build system for the Meowstik browser extension will significantly improve developer productivity and code quality. The proposed solution using Vite, TypeScript, and automated reload provides:

1. **Faster Development**: Iterations measured in seconds, not minutes
2. **Better Code Quality**: Type safety catches bugs before runtime
3. **Modern Tooling**: Industry-standard development experience
4. **Easier Testing**: Mock server enables offline development
5. **Team Consistency**: Same tools as main application

The 4-week timeline is realistic and the phased approach minimizes risk. The investment will pay dividends in reduced debugging time, fewer bugs, and faster feature delivery.

**Recommendation**: Proceed with implementation, starting with Phase 1 (Basic Build System) and Phase 2 (Live Reload) as the highest-impact improvements.

---

## Next Steps

1. **Review this proposal** with the development team
2. **Gather feedback** and address concerns
3. **Approve implementation** plan and timeline
4. **Create implementation document** with step-by-step instructions
5. **Begin Phase 1** implementation
6. **Iterate based on** developer feedback

---

## Appendix A: Example Configurations

### vite.config.extension.ts

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifest from './extension-src/manifest';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@extension': path.resolve(__dirname, 'extension-src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist/extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'extension-src/popup/popup.html',
      },
    },
  },
  server: {
    port: 5001,
  },
});
```

### tsconfig.extension.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/extension",
    "rootDir": "./extension-src",
    "types": ["chrome", "node"],
    "lib": ["ES2020", "DOM"],
    "module": "ES2020",
    "target": "ES2020",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["extension-src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Appendix B: Resources

### Documentation
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)
- [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)

### Tools
- [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)
- [Extension Reloader](https://github.com/SimplGy/chrome-extension-reloader)
- [Plasmo Framework](https://www.plasmo.com/) (alternative framework)

### Examples
- [Vite Chrome Extension Template](https://github.com/JohnBra/vite-web-extension)
- [Chrome Extension TypeScript Starter](https://github.com/chibat/chrome-extension-typescript-starter)

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Author**: Meowstik Development Team  
**Status**: Proposal - Awaiting Review
