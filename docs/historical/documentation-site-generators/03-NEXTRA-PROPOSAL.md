# Nextra Implementation Proposal

## Overview

Nextra is a Next.js-based framework for building documentation sites, created and maintained by Vercel (the creators of Next.js). It leverages Next.js's powerful features while providing a documentation-focused developer experience.

**Repository**: https://github.com/shuding/nextra  
**License**: MIT  
**Version**: 3.2.0 (Latest as of Jan 2026)  
**GitHub Stars**: 12k+  
**Weekly Downloads**: 150k+

## Why Nextra?

### Modern Next.js Foundation

1. **Next.js 15+**: Built on latest App Router and React Server Components
2. **React-Based**: Uses React like Meowstik's frontend
3. **TypeScript Native**: Full TypeScript support
4. **Vercel Integration**: Seamless deployment to Vercel
5. **MDX First**: Rich MDX support for component embedding

### Developer Experience

- 🚀 **Fast Refresh**: Instant hot module replacement
- 📦 **Zero Config**: Works out of the box
- 🎨 **Beautiful Themes**: Docs and Blog themes included
- 🔍 **Built-in Search**: FlexSearch integration (no external service)
- 📱 **Mobile Optimized**: Responsive by default
- 🌐 **i18n Ready**: Built-in internationalization

## Technical Architecture

### Core Components

```
nextra-site/
├── pages/
│   ├── _app.tsx               # Next.js app wrapper
│   ├── _meta.json            # Navigation configuration
│   ├── index.mdx             # Homepage
│   ├── docs/
│   │   ├── _meta.json        # Docs navigation
│   │   ├── getting-started.mdx
│   │   ├── architecture/
│   │   │   ├── _meta.json
│   │   │   ├── overview.mdx
│   │   │   └── database.mdx
│   │   └── api/
│   │       └── reference.mdx
│   └── blog/
│       ├── _meta.json
│       └── announcing-v1.mdx
├── public/                   # Static assets
│   ├── logo.svg
│   └── images/
├── components/               # Custom React components
│   └── AIDemo.tsx
├── theme.config.tsx         # Theme configuration
├── next.config.mjs          # Next.js configuration
└── package.json
```

### Configuration Example

```tsx
// theme.config.tsx
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <>
      <img src="/logo.svg" alt="Meowstik" width={32} height={32} />
      <span style={{ marginLeft: '.4em', fontWeight: 800 }}>
        Meowstik
      </span>
    </>
  ),
  
  project: {
    link: 'https://github.com/jasonbender-c3x/Meowstik',
  },
  
  chat: {
    link: 'https://discord.gg/meowstik', // Optional Discord
  },
  
  docsRepositoryBase: 'https://github.com/jasonbender-c3x/Meowstik/tree/main/nextra-site',
  
  footer: {
    text: (
      <span>
        {new Date().getFullYear()} ©{' '}
        <a href="https://meowstik.ai" target="_blank">
          Meowstik
        </a>
      </span>
    ),
  },
  
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Meowstik Documentation" />
      <meta property="og:description" content="Next-generation AI assistant platform" />
    </>
  ),
  
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <div style={{ fontWeight: 800, marginTop: '1.5rem' }}>{title}</div>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  
  toc: {
    backToTop: true,
    float: true,
  },
  
  editLink: {
    text: 'Edit this page on GitHub →',
  },
  
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback',
  },
  
  navigation: {
    prev: true,
    next: true,
  },
  
  darkMode: true,
  
  primaryHue: 160, // Meowstik brand color hue
  
  search: {
    placeholder: 'Search documentation...',
  },
}

export default config
```

### Next.js Configuration

```javascript
// next.config.mjs
import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
  latex: true, // Enable LaTeX math
})

export default withNextra({
  reactStrictMode: true,
  
  // Optimize images
  images: {
    domains: ['meowstik.ai'],
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/docs',
        destination: '/docs/getting-started',
        permanent: true,
      },
    ]
  },
  
  // i18n configuration
  i18n: {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  },
})
```

### Meta Configuration

```json
// pages/docs/_meta.json
{
  "getting-started": "Getting Started",
  "architecture": "Architecture",
  "features": "Features",
  "api": "API Reference",
  "guides": "Guides",
  "contributing": "Contributing"
}

// pages/docs/architecture/_meta.json
{
  "overview": "Overview",
  "database": "Database Schema",
  "api-design": "API Design",
  "frontend": "Frontend Architecture"
}
```

## Implementation Plan

### Phase 1: Setup & Migration (Week 1)

#### Day 1: Initial Setup
```bash
# Install Nextra
cd /home/runner/work/Meowstik/Meowstik
npx create-next-app@latest nextra-docs --typescript --tailwind --app false

cd nextra-docs
npm install nextra nextra-theme-docs

# Update next.config.mjs to use Nextra
```

#### Day 2-3: Content Migration
```bash
# Create directory structure
mkdir -p pages/docs/{getting-started,architecture,features,api,guides}
mkdir -p pages/blog
mkdir -p public/images

# Copy and convert existing markdown to MDX
# .md files work as-is, but can be enhanced with React components
```

Example MDX file:
```mdx
---
title: Getting Started
description: Learn how to set up and use Meowstik
---

import { Callout } from 'nextra/components'
import { AIDemo } from '@/components/AIDemo'

# Getting Started

<Callout type="info">
  Meowstik requires Node.js 20+ and PostgreSQL 16+
</Callout>

## Installation

\`\`\`bash
npm install -g meowstik
\`\`\`

## Try It Live

<AIDemo />
```

#### Day 4-5: Custom Components & Styling

Custom React component:
```tsx
// components/AIDemo.tsx
import { useState } from 'react'
import styles from './AIDemo.module.css'

export function AIDemo() {
  const [prompt, setPrompt] = useState('')
  
  return (
    <div className={styles.demo}>
      <h3>Try Meowstik Live</h3>
      <div className={styles.chat}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Meowstik anything..."
          className={styles.input}
        />
        <iframe 
          src={`https://app.meowstik.ai/embed?prompt=${encodeURIComponent(prompt)}`}
          className={styles.iframe}
        />
      </div>
    </div>
  )
}
```

Custom styles:
```css
/* styles/globals.css */
:root {
  --nextra-primary-hue: 160deg;
  --nextra-primary-saturation: 70%;
}

/* Customize Nextra theme */
.nextra-nav-container {
  background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
}
```

### Phase 2: Advanced Features (Week 2)

#### Code Blocks with Features

Nextra has powerful code block features:
```mdx
\`\`\`tsx filename="server/index.ts" showLineNumbers {3-5}
import express from 'express'
import { storage } from './storage'

// Initialize Express app
const app = express()
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
\`\`\`
```

#### Tabs Component

```mdx
import { Tabs } from 'nextra/components'

<Tabs items={['npm', 'yarn', 'pnpm']}>
  <Tabs.Tab>
    \`\`\`bash
    npm install meowstik
    \`\`\`
  </Tabs.Tab>
  <Tabs.Tab>
    \`\`\`bash
    yarn add meowstik
    \`\`\`
  </Tabs.Tab>
  <Tabs.Tab>
    \`\`\`bash
    pnpm add meowstik
    \`\`\`
  </Tabs.Tab>
</Tabs>
```

#### API Documentation

```mdx
import { Callout, Steps } from 'nextra/components'

## Chat API

<Callout type="warning">
  Authentication required for all API endpoints
</Callout>

### POST /api/chat

Send a message to create or continue a chat.

<Steps>

### Authenticate

Get your API key from the [dashboard](https://app.meowstik.ai/settings).

### Send Request

\`\`\`bash
curl -X POST https://api.meowstik.ai/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'
\`\`\`

### Handle Response

\`\`\`json
{
  "id": "chat_123",
  "message": "Hi! How can I help?",
  "timestamp": "2026-01-14T12:00:00Z"
}
\`\`\`

</Steps>
```

### Phase 3: Deployment (Week 3)

#### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd nextra-docs
vercel --prod
```

Configuration:
```json
// vercel.json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

#### GitHub Actions (Alternative)

```yaml
# .github/workflows/deploy-nextra.yml
name: Deploy Nextra

on:
  push:
    branches: [main]
    paths:
      - 'nextra-docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: nextra-docs/package-lock.json
      
      - name: Install dependencies
        working-directory: ./nextra-docs
        run: npm ci
      
      - name: Build
        working-directory: ./nextra-docs
        run: npm run build
      
      - name: Export static site
        working-directory: ./nextra-docs
        run: npm run export
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./nextra-docs
```

## Integration with Meowstik

### Shared Components

Since both use React, you can directly import Meowstik components:

```tsx
// nextra-docs/components/MeowstikButton.tsx
// Import from main Meowstik repo
import { Button } from '../../client/src/components/ui/button'

export function MeowstikButton(props: any) {
  return <Button {...props} />
}
```

### Shared Types

```tsx
// In MDX docs
import type { ChatMessage, User } from '@/shared/schema'

// Use TypeScript types in documentation
```

### API Integration

```tsx
// components/LiveAPIExample.tsx
import { useState } from 'react'

export function LiveAPIExample() {
  const [response, setResponse] = useState(null)
  
  const callAPI = async () => {
    const res = await fetch('https://api.meowstik.ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello!' })
    })
    setResponse(await res.json())
  }
  
  return (
    <div>
      <button onClick={callAPI}>Try API</button>
      {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
    </div>
  )
}
```

## Advantages

1. ✅ **React Native**: Direct component reuse from Meowstik
2. ✅ **Next.js Features**: SSR, ISR, API routes, image optimization
3. ✅ **MDX Power**: Full React components in markdown
4. ✅ **Vercel Integration**: One-click deployment
5. ✅ **Built-in Search**: FlexSearch (no external service)
6. ✅ **Beautiful Themes**: Polished docs and blog themes
7. ✅ **Type-Safe**: Full TypeScript support
8. ✅ **Modern Stack**: Latest React and Next.js features

## Disadvantages

1. ⚠️ **Next.js Dependency**: Large framework for docs site
2. ⚠️ **Build Times**: Slower than Vite-based alternatives
3. ⚠️ **Complexity**: More complex than simpler alternatives
4. ⚠️ **Vercel Lock-in**: Best experience on Vercel (though not required)
5. ⚠️ **Bundle Size**: Larger than VitePress (~50KB)
6. ⚠️ **File-based Routing**: Requires understanding Next.js pages router

## Migration Effort Estimate

- **Setup Time**: 2-3 hours
- **Content Migration**: 1-2 days (MDX conversion)
- **Component Integration**: 2-3 days (reusing Meowstik components)
- **Customization**: 1-2 days
- **Testing & Deployment**: 1 day
- **Total**: ~1 week for complete implementation

## Performance Comparison

| Metric | Nextra | Docusaurus | VitePress |
|--------|--------|------------|-----------|
| Initial JS | ~50KB | ~100KB | ~10KB |
| Build Time (100 pages) | ~1min | ~2min | ~30s |
| Hot Reload | ~200ms | ~500ms | <50ms |
| Lighthouse Score | 97-99 | 95-98 | 100 |
| First Paint | ~0.8s | ~1.2s | ~0.4s |

## Cost Analysis

| Item | Cost | Frequency |
|------|------|-----------|
| Development Time | $0 (internal) | One-time |
| Vercel Hosting | $0 (hobby) or $20 (pro) | Monthly |
| Search (Built-in) | $0 | Monthly |
| Domain | ~$12 | Yearly |
| **Total First Year (Free)** | **~$12** | - |
| **Total First Year (Pro)** | **~$252** | - |

## Use Cases Where Nextra Excels

1. **React Ecosystem**: Team heavily uses React
2. **Component Reuse**: Want to embed existing React components
3. **Vercel Stack**: Already on Vercel
4. **Rich Interactions**: Need interactive docs with API calls
5. **Next.js Features**: Want SSR, ISR, API routes
6. **MDX-Heavy**: Content requires extensive component embedding

## Real-World Examples

- **Next.js Docs**: https://nextjs.org/docs
- **SWR**: https://swr.vercel.app/
- **Nextra**: https://nextra.site/ (self-hosted)
- **Turbo**: https://turbo.build/repo/docs

## Success Metrics

1. **Performance**: Lighthouse score > 95
2. **Build Time**: < 2 minutes
3. **Component Reuse**: > 80% of Meowstik components usable
4. **Developer Experience**: < 5 minutes to add new page
5. **User Satisfaction**: > 85% positive feedback

## Conclusion

Nextra is an **excellent choice** for Meowstik if:
- React component reuse is important
- Team prefers Next.js ecosystem
- Vercel deployment is acceptable/desired
- Want rich, interactive documentation
- MDX features are heavily utilized

**Sweet Spot**: Balances performance with React/Next.js integration. Better React integration than VitePress, better performance than Docusaurus.

**Best For**: React-heavy docs with component embeds and interactivity.

---

**Next Steps**: Review comparison matrix to make final decision between all three options.
