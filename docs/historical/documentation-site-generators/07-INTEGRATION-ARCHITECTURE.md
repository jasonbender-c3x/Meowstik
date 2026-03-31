# Integration Architecture

## Overview

This document describes how to integrate the documentation site with Meowstik's existing architecture, including shared components, types, deployment strategies, and cross-application concerns.

## Repository Strategy

### Option 1: Monorepo (Recommended)

Keep documentation in the same repository as the main application.

**Structure:**
```
Meowstik/
├── client/              # Frontend React app
├── server/              # Backend Express app
├── shared/              # Shared types and utilities
├── docs/                # Existing markdown files
├── nextra-docs/         # NEW: Documentation site
│   ├── pages/
│   ├── components/
│   ├── public/
│   └── package.json
├── package.json         # Root package.json (workspace)
└── README.md
```

**Benefits:**
- ✅ Single source of truth
- ✅ Shared components and types easily accessible
- ✅ Synchronized versioning
- ✅ Easier to keep docs updated with code changes
- ✅ Single CI/CD pipeline

**Workspace Configuration:**
```json
// Root package.json
{
  "name": "meowstik-monorepo",
  "private": true,
  "workspace": [
    "client",
    "server",
    "shared",
    "nextra-docs"
  ],
  "scripts": {
    "dev:app": "npm run dev --workspace=client",
    "dev:docs": "npm run dev --workspace=nextra-docs",
    "build:app": "npm run build --workspace=client && npm run build --workspace=server",
    "build:docs": "npm run build --workspace=nextra-docs"
  }
}
```

### Option 2: Separate Repository

Keep documentation in a separate repository.

**Benefits:**
- ✅ Independent deployment
- ✅ Separate permissions
- ✅ Cleaner separation of concerns

**Drawbacks:**
- ⚠️ Harder to keep in sync
- ⚠️ More complex CI/CD
- ⚠️ Cannot directly import shared code

**Recommendation**: Use monorepo (Option 1) for better maintainability.

## Shared Component Architecture

### Strategy 1: Direct Import (React-based solutions only)

For Nextra and Docusaurus, directly import Meowstik components:

```typescript
// nextra-docs/components/SharedButton.tsx
import { Button } from '../../client/src/components/ui/button'
import type { ButtonProps } from '../../client/src/components/ui/button'

export function DocButton(props: ButtonProps) {
  return <Button {...props} />
}
```

Usage in documentation:
```mdx
import { DocButton } from '@/components/SharedButton'

# Getting Started

<DocButton variant="primary">Try Meowstik</DocButton>
```

### Strategy 2: Component Library Package

Create a shared component library:

```
Meowstik/
├── workspace/
│   └── ui/                  # NEW: Shared UI components
│       ├── src/
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   └── index.ts
│       └── package.json
├── client/
│   └── package.json         # depends on @meowstik/ui
├── nextra-docs/
│   └── package.json         # depends on @meowstik/ui
```

```json
// workspace/ui/package.json
{
  "name": "@meowstik/ui",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### Strategy 3: Wrapper Components (VitePress)

For VitePress (Vue-based), create Vue wrappers:

```vue
<!-- vitepress-docs/.vitepress/theme/components/MeowstikButton.vue -->
<template>
  <button :class="buttonClass" @click="handleClick">
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Replicate Meowstik button styles
const props = defineProps<{
  variant?: 'primary' | 'secondary'
}>()

const buttonClass = computed(() => {
  // Mirror Meowstik button classes
  return `meowstik-button meowstik-button-${props.variant || 'primary'}`
})

const handleClick = () => {
  // Handle button click
}
</script>

<style scoped>
/* Import or replicate Meowstik button styles */
@import '../../../client/src/components/ui/button.css';
</style>
```

## Type Sharing

### Shared Type Definitions

```typescript
// shared/types.ts
export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export interface User {
  id: string
  email: string
  name: string
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  userId: string
}
```

### Using Shared Types in Docs

```typescript
// nextra-docs/components/APIExample.tsx
import type { ChatMessage } from '../../shared/types'

export function ChatAPIExample() {
  // Use shared types for examples
  const exampleMessage: ChatMessage = {
    id: '123',
    content: 'Hello!',
    role: 'user',
    timestamp: new Date()
  }
  
  return (
    <pre>{JSON.stringify(exampleMessage, null, 2)}</pre>
  )
}
```

### Auto-Generated API Docs

Generate API documentation from TypeScript types:

```typescript
// scripts/generate-api-docs.ts
import { Project } from 'ts-morph'
import fs from 'fs'

const project = new Project({
  tsConfigFilePath: './shared/tsconfig.json'
})

const sourceFile = project.getSourceFile('shared/types.ts')!

function generateMarkdown() {
  let markdown = '# API Types\n\n'
  
  for (const interface_ of sourceFile.getInterfaces()) {
    markdown += `## ${interface_.getName()}\n\n`
    markdown += '```typescript\n'
    markdown += interface_.getText()
    markdown += '\n```\n\n'
    
    // Add property descriptions from JSDoc
    for (const prop of interface_.getProperties()) {
      const docs = prop.getJsDocs()[0]
      if (docs) {
        markdown += `- **${prop.getName()}**: ${docs.getDescription()}\n`
      }
    }
    markdown += '\n'
  }
  
  return markdown
}

fs.writeFileSync(
  'nextra-docs/pages/api/types.mdx',
  generateMarkdown()
)
```

Run in CI/CD:
```yaml
# .github/workflows/docs.yml
- name: Generate API docs
  run: npm run generate-api-docs
  
- name: Build docs
  run: npm run build:docs
```

## Cross-Application Linking

### Main App → Documentation

```typescript
// client/src/components/HelpMenu.tsx
import { ExternalLink } from 'lucide-react'

export function HelpMenu() {
  return (
    <nav>
      <a href="https://docs.meowstik.ai" target="_blank" rel="noopener">
        Documentation <ExternalLink size={16} />
      </a>
      <a href="https://docs.meowstik.ai/api" target="_blank">
        API Reference
      </a>
      <a href="https://docs.meowstik.ai/guides/getting-started" target="_blank">
        Getting Started
      </a>
    </nav>
  )
}
```

### Documentation → Main App

```mdx
// nextra-docs/pages/index.mdx
import { Button } from '@/components/SharedButton'

# Welcome to Meowstik

<Button 
  as="a" 
  href="https://app.meowstik.ai"
  variant="primary"
  target="_blank"
>
  Launch Meowstik App
</Button>

Ready to try it? [Sign up for free](https://app.meowstik.ai/signup)
```

### Context-Aware Links

```typescript
// nextra-docs/components/SmartLink.tsx
export function SmartLink({ href, children }) {
  // Detect if running in same domain
  const isSameDomain = href.startsWith('/') || href.includes('meowstik.ai')
  
  // For API endpoints, link to both docs and try it live
  if (href.startsWith('/api/')) {
    return (
      <div className="api-link">
        <a href={href}>📚 {children} Docs</a>
        <a href={`https://app.meowstik.ai/playground${href}`}>
          🚀 Try it Live
        </a>
      </div>
    )
  }
  
  return <a href={href} target={isSameDomain ? '_self' : '_blank'}>{children}</a>
}
```

## Embedding Meowstik Features in Docs

### Live Chat Demo

```tsx
// nextra-docs/components/LiveChatDemo.tsx
import { useState } from 'react'

export function LiveChatDemo() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  
  const sendMessage = async () => {
    const res = await fetch('https://api.meowstik.ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DEMO_API_KEY}`
      },
      body: JSON.stringify({ message })
    })
    
    const data = await res.json()
    setResponse(data.message)
  }
  
  return (
    <div className="live-demo">
      <h3>Try Meowstik</h3>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask Meowstik anything..."
      />
      <button onClick={sendMessage}>Send</button>
      {response && (
        <div className="response">
          <strong>Meowstik:</strong> {response}
        </div>
      )}
    </div>
  )
}
```

Usage:
```mdx
import { LiveChatDemo } from '@/components/LiveChatDemo'

# Chat API

Try the Chat API right here in the docs:

<LiveChatDemo />
```

### Code Editor Embed

```tsx
// nextra-docs/components/CodeEditorEmbed.tsx
export function CodeEditorEmbed({ initialCode }) {
  return (
    <iframe
      src={`https://app.meowstik.ai/embed/editor?code=${encodeURIComponent(initialCode)}`}
      width="100%"
      height="500px"
      frameBorder="0"
      title="Meowstik Code Editor"
    />
  )
}
```

## Deployment Architecture

### Subdomain Strategy

```
Meowstik Infrastructure:
├── meowstik.ai (or app.meowstik.ai)    # Main application
├── docs.meowstik.ai                     # Documentation site
├── api.meowstik.ai                      # API endpoints
└── status.meowstik.ai                   # Status page (optional)
```

### DNS Configuration

```
# Cloudflare DNS or similar
A     meowstik.ai              → 76.76.21.21 (Vercel)
CNAME docs.meowstik.ai         → cname.vercel-dns.com
CNAME api.meowstik.ai          → meowstik-api.onrender.com
```

### CORS Configuration

```typescript
// server/index.ts
import cors from 'cors'

const allowedOrigins = [
  'https://meowstik.ai',
  'https://app.meowstik.ai',
  'https://docs.meowstik.ai',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : null,
].filter(Boolean)

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))
```

## CI/CD Integration

### Unified Pipeline

```yaml
# .github/workflows/deploy-all.yml
name: Deploy All

on:
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      app: ${{ steps.filter.outputs.app }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            app:
              - 'client/**'
              - 'server/**'
              - 'shared/**'
            docs:
              - 'nextra-docs/**'
  
  deploy-app:
    needs: changes
    if: ${{ needs.changes.outputs.app == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Application
        # ... deploy main app
  
  deploy-docs:
    needs: changes
    if: ${{ needs.changes.outputs.docs == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        working-directory: ./nextra-docs
        run: npm ci
      
      - name: Build documentation
        working-directory: ./nextra-docs
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: ./nextra-docs
          vercel-project-id: ${{ secrets.VERCEL_DOCS_PROJECT_ID }}
```

### Preview Deployments

```yaml
# .github/workflows/preview-docs.yml
name: Preview Docs

on:
  pull_request:
    paths:
      - 'nextra-docs/**'

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: ./nextra-docs
          github-comment: true
      
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '📚 Documentation preview: ${{ steps.deploy.outputs.preview-url }}'
            })
```

## Authentication & Access Control

### Public Documentation

Most documentation should be public:
- Getting Started
- Features
- API Reference
- Guides

### Private/Gated Content (Optional)

For enterprise features or internal docs:

```typescript
// nextra-docs/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Check if accessing private docs
  if (pathname.startsWith('/docs/enterprise')) {
    const session = request.cookies.get('meowstik-session')
    
    if (!session) {
      // Redirect to login
      return NextResponse.redirect(new URL('https://app.meowstik.ai/login', request.url))
    }
    
    // Verify session with main app
    // ... verification logic
  }
  
  return NextResponse.next()
}
```

## Analytics & Monitoring

### Unified Analytics

Track both app and docs usage:

```typescript
// shared/analytics.ts
export function trackEvent(event: string, properties?: Record<string, any>) {
  // Send to analytics service
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, properties)
  }
}

export function trackPageView(page: string) {
  trackEvent('page_view', { page })
}
```

Usage in docs:
```typescript
// nextra-docs/pages/_app.tsx
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { trackPageView } from '../../shared/analytics'

function MyApp({ Component, pageProps }) {
  const router = useRouter()
  
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      trackPageView(url)
    }
    
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router.events])
  
  return <Component {...pageProps} />
}
```

### Error Tracking

Unified error tracking:

```typescript
// nextra-docs/sentry.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Group docs errors separately
  tags: {
    app: 'docs'
  }
})
```

## Version Synchronization

### Keep Docs in Sync with App Version

```typescript
// nextra-docs/lib/version.ts
import packageJson from '../../../package.json'

export const APP_VERSION = packageJson.version
export const DOCS_VERSION = '1.0.0'

export function isDocsOutdated() {
  return DOCS_VERSION !== APP_VERSION
}
```

Show version banner:
```tsx
// nextra-docs/components/VersionBanner.tsx
import { isDocsOutdated, APP_VERSION } from '@/lib/version'

export function VersionBanner() {
  if (!isDocsOutdated()) return null
  
  return (
    <div className="version-banner">
      ⚠️ Documentation may be outdated. App version: {APP_VERSION}
      <a href="/changelog">View Changelog</a>
    </div>
  )
}
```

## Search Integration

### Unified Search

Search across both app and docs:

```typescript
// Algolia configuration (if using)
const appIndex = algoliasearch(appId, apiKey).initIndex('meowstik_app')
const docsIndex = algoliasearch(appId, apiKey).initIndex('meowstik_docs')

// Combined search
async function searchAll(query: string) {
  const [appResults, docsResults] = await Promise.all([
    appIndex.search(query),
    docsIndex.search(query)
  ])
  
  return {
    app: appResults.hits,
    docs: docsResults.hits
  }
}
```

## Conclusion

Successful integration requires:
1. **Shared Infrastructure**: Monorepo or well-defined sharing mechanisms
2. **Type Safety**: Shared TypeScript types
3. **Cross-Linking**: Easy navigation between app and docs
4. **Unified Deployment**: Single CI/CD pipeline
5. **Consistent Branding**: Shared components and styles

With this architecture, Meowstik documentation will feel like a natural extension of the main application.

---

**Ready to implement?** Let's create the GitHub issue to track progress!
