# Documentation Migration Strategy

## Overview

This document outlines the strategy for migrating Meowstik's existing documentation to the new documentation site. It addresses content organization, file structure, link preservation, and transition planning.

## Current State Assessment

### Existing Documentation Inventory

Based on the Meowstik repository structure:

```
docs/
├── 01-database-schemas.md
├── 02-ui-architecture.md
├── 03-prompt-lifecycle.md
├── 05-tool-call-schema.md
├── AGENT_ATTRIBUTION.md
├── COGNITIVE_ARCHITECTURE_2.0.md
├── CREDENTIAL_MANAGEMENT.md
├── FEATURES.md
├── MARKDOWN_EMBEDDING_GUIDE.md
├── PROJECT_CHIMERA_PHASE1_REPORT.md
├── QUICK_START.md
├── RAG_PIPELINE.md
├── SYSTEM_OVERVIEW.md
├── authentication-and-session-isolation.md
├── orchestration-layer.md
├── ssh-gateway-guide.md
└── [30+ additional documents]
```

**Total Pages**: ~30 markdown files  
**Estimated Content**: ~150,000 words  
**Images/Assets**: ~50 files

## Migration Strategy

### Content Categorization

Current documentation should be organized into logical sections:

#### 1. Getting Started (Priority: High)
- Quick Start Guide
- Installation
- Configuration
- First Steps

#### 2. Architecture (Priority: High)
- Database Schemas (01-database-schemas.md)
- UI Architecture (02-ui-architecture.md)
- Prompt Lifecycle (03-prompt-lifecycle.md)
- System Overview (SYSTEM_OVERVIEW.md)
- Cognitive Architecture (COGNITIVE_ARCHITECTURE_2.0.md)

#### 3. Features (Priority: High)
- Features overview (FEATURES.md)
- Code Editor
- Live Preview
- AI Chat
- Voice Synthesis
- Google Workspace Integration

#### 4. API Reference (Priority: High)
- Tool Call Schema
- API Endpoints
- Database Schemas
- Authentication

#### Day 5: Content Organization
```bash
# New structure
docs/
├── getting-started/
│   ├── index.md
│   ├── quick-start.md
│   ├── installation.md
│   └── configuration.md
├── architecture/
│   ├── overview.md
│   ├── database-schemas.md
│   ├── ui-architecture.md
│   └── prompt-lifecycle.md
├── features/
│   ├── ai-chat.md
│   ├── code-editor.md
│   ├── integrations.md
│   └── voice-synthesis.md
├── api/
│   ├── authentication.md
│   ├── chat.md
│   ├── drive.md
│   └── gmail.md
└── guides/
    ├── deployment.md
    ├── contributing.md
    └── troubleshooting.md
```

**Deliverable**: Complete migration plan

## Integration Points

### 1. Main Meowstik App Integration

**Link from App to Docs:**
```typescript
// client/src/components/Navbar.tsx
<nav>
  <a href="/">Home</a>
  <a href="/chat">Chat</a>
  <a href="https://docs.meowstik.ai" target="_blank">Documentation</a>
</nav>
```

**Link from Docs to App:**
```mdx
Try Meowstik: [Launch App](https://app.meowstik.ai)
```

### Shared Components Strategy
```typescript
// In nextra-docs
import { Button } from '../../client/src/components/ui/button'

// Or create wrappers
export function DocButton(props) {
  return <Button {...props} />
}
```

### Subdomain Setup
- Main App: `meowstik.ai` or `app.meowstik.ai`
- Documentation: `docs.meowstik.ai`
- API: `api.meowstik.ai`

## Additional Supporting Documents

### 06-MIGRATION-STRATEGY.md

This document would cover:
- Content inventory and audit process
- Markdown to MDX conversion guidelines
- Asset optimization strategies
- URL redirect mapping
- SEO preservation techniques
- Broken link detection and fixing
- Content ownership and maintenance

### 07-INTEGRATION-ARCHITECTURE.md

This document would cover:
- Monorepo vs separate repo strategy
- Shared component architecture
- Type sharing between main app and docs
- API documentation generation from code
- Embedding Meowstik features in docs
- SSO integration for gated docs (if needed)

---

Let me create these final two documents and then the GitHub issue:

<function_calls>
<invoke name="create">
<parameter name="file_text"># Migration Strategy

## Overview

This document outlines the strategy for migrating Meowstik's existing documentation to the new documentation site platform. This includes content organization, file migration, link preservation, and rollout strategy.

## Current State Analysis

### Existing Documentation Inventory

Based on the current Meowstik repository structure:

```
docs/
├── 01-database-schemas.md (17KB)
├── 02-ui-architecture.md (11KB)
├── 03-prompt-lifecycle.md (20KB)
├── 05-tool-call-schema.md (8KB)
├── FEATURES.md (15KB)
├── SYSTEM_OVERVIEW.md (15KB)
├── QUICK_START.md (5KB)
├── RAG_PIPELINE.md (18KB)
├── ... and ~25 more files
└── Total: ~30 markdown files
```

**Estimated Content**: ~250KB markdown, ~30 pages, ~50 images

## Migration Strategy

### Content Categorization

#### Tier 1: Critical Pages (Migrate First)
1. **README.md** → Homepage
2. **QUICK_START.md** → Getting Started
3. **SYSTEM_OVERVIEW.md** → Architecture Overview
4. **FEATURES.md** → Features Overview
5. **01-database-schemas.md** → API/Database reference

#### Tier 2: Core Documentation (Week 1)
- Architecture documents
- Setup guides
- Configuration guides
- API documentation

#### Tier 3: Advanced Content (Week 2+)
- Detailed guides
- Integration docs
- Contributing guidelines
- Advanced features

## Directory Mapping Strategy

### Current Structure
```
Meowstik/
└── docs/
    ├── 01-database-schemas.md
    ├── 02-ui-architecture.md
    ├── 03-prompt-lifecycle.md
    ├── FEATURES.md
    ├── QUICK_START.md
    └── ... (30+ files)
```

### Target Structure (Nextra Example)

```
nextra-docs/
└── pages/
    ├── index.mdx                    # Homepage
    ├── docs/
    │   ├── _meta.json
    │   ├── getting-started.mdx      # From: QUICK_START.md
    │   ├── features.mdx             # From: FEATURES.md
    │   ├── architecture/
    │   │   ├── _meta.json
    │   │   ├── overview.mdx         # From SYSTEM_OVERVIEW.md
    │   │   ├── database.mdx         # From 01-database-schemas.md
    │   │   ├── ui.mdx              # From 02-ui-architecture.md
    │   │   └── cognitive.mdx       # From COGNITIVE_ARCHITECTURE_2.0.md
    │   └── api/
    └── guides/
```

**Deliverable**: Complete migration map

## Migration Strategy by Content Type

### 1. Technical Documentation

#### Architecture Docs
Current structure:
```
docs/
├── 01-database-schemas.md
├── 02-ui-architecture.md
├── 03-prompt-lifecycle.md
├── SYSTEM_OVERVIEW.md
└── COGNITIVE_ARCHITECTURE_2.0.md
```

Target structure:
```
nextra-docs/pages/
├── architecture/
│   ├── overview.mdx (from SYSTEM_OVERVIEW.md)
│   ├── database.mdx (from 01-database-schemas.md)
│   ├── ui.mdx (from 02-ui-architecture.md)
│   ├── cognitive.mdx (from COGNITIVE_ARCHITECTURE_2.0.md)
│   └── prompts.mdx (from 03-prompt-lifecycle.md)
```

Migration script:
```bash
#!/bin/bash
# migrate-docs.sh

SOURCE_DIR="../docs"
TARGET_DIR="./pages/docs"

# Create target directories
mkdir -p $TARGET_DIR/{architecture,features,guides,api}

# Migrate architecture docs
cp "$SOURCE_DIR/SYSTEM_OVERVIEW.md" "$TARGET_DIR/architecture/overview.mdx"
cp "$SOURCE_DIR/01-database-schemas.md" "$TARGET_DIR/architecture/database.mdx"
cp "$SOURCE_DIR/02-ui-architecture.md" "$TARGET_DIR/architecture/ui.mdx"

# Add frontmatter to each file
for file in $TARGET_DIR/**/*.mdx; do
  filename=$(basename "$file" .mdx)
  title=$(echo "$filename" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
  
  # Prepend frontmatter
  echo "---" > "$file.tmp"
  echo "title: $title" >> "$file.tmp"
  echo "---" >> "$file.tmp"
  echo "" >> "$file.tmp"
  cat "$file" >> "$file.tmp"
  mv "$file.tmp" "$file"
done
```

**Deliverable**: Automated migration script

#### Day 2: Content Transformation

Convert custom syntax to Nextra components:
```bash
# Before (GitHub callout)
> [!NOTE]
> This is important information

# After (Nextra)
<Callout type="info">
  This is important information
</Callout>

# Before (GitHub warning)
> [!WARNING]
> Be careful here

# After (Nextra)
<Callout type="warning">
  Be careful here
</Callout>
```

Transformation script:
```javascript
// transform-markdown.js
const fs = require('fs')
const path = require('path')

function transformCallouts(content) {
  // Convert GitHub-style callouts to Nextra Callouts
  const calloutRegex = /> \[!(NOTE|TIP|WARNING|IMPORTANT)\]\n> (.*?)(?=\n\n|\n$)/gs
  
  return content.replace(calloutRegex, (match, type, text) => {
    const nextraType = {
      'NOTE': 'info',
      'TIP': 'info',
      'WARNING': 'warning',
      'IMPORTANT': 'error'
    }[type]
    
    return `<Callout type="${nextraType}">\n  ${text}\n</Callout>`
  })
}

function transformFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Add imports at top if callouts are used
  if (content.includes('<Callout')) {
    content = "import { Callout } from 'nextra/components'\n\n" + content
  }
  
  content = transformCallouts(content)
  
  fs.writeFileSync(filePath, content)
}

// Process all MDX files
const docsDir = './pages/docs'
// ... traverse and process files
```

**Deliverable**: Content transformation pipeline

#### Day 3: Link Resolution

Update all internal links:
```bash
# Before
[Architecture](../SYSTEM_OVERVIEW.md)
[Database Schema](./01-database-schemas.md)

# After
[Architecture](/docs/architecture/overview)
[Database Schema](/docs/architecture/database)
```

Link resolution script:
```javascript
// resolve-links.js
function resolveInternalLinks(content, currentPath) {
  // Convert .md links to proper routes
  return content.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (match, text, link) => {
    // Convert ../docs/FILE.md to /docs/file
    const route = link
      .replace(/\.\.?\//g, '')
      .replace(/\.md$/, '')
      .toLowerCase()
      .replace(/_/g, '-')
    
    return `[${text}](/docs/${route})`
  })
}
```

**Deliverable**: All links working

#### Day 4: Asset Organization

Organize and optimize assets:
```bash
# Image optimization
npm install -D sharp

# Optimize script
node scripts/optimize-images.js
```

```javascript
// optimize-images.js
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath.replace(/\.(png|jpg|jpeg)$/, '.webp'))
}

// Process all images in public/images
```

**Deliverable**: Optimized assets

#### Day 5: Validation

Validation checklist:
- [ ] All pages load without errors
- [ ] All internal links work
- [ ] All images display correctly
- [ ] Code blocks have proper syntax highlighting
- [ ] Frontmatter is correct
- [ ] Navigation structure is logical
- [ ] Search indexes all content

**Deliverable**: Migration validation report

### Week 2: Content Enhancement

#### Day 1-2: Add Interactive Elements

Enhance with Nextra components:
```mdx
# Before (plain markdown)
Follow these steps:

1. Install dependencies
2. Configure environment
3. Start server

# After (with Steps component)
import { Steps } from 'nextra/components'

<Steps>

### Install dependencies

\`\`\`bash
npm install
\`\`\`

### Configure environment

\`\`\`bash
cp .env.example .env
\`\`\`

### Start server

\`\`\`bash
npm run dev
\`\`\`

</Steps>
```

**Deliverable**: Enhanced interactive docs

#### Day 3: Cross-References

Add smart cross-references:
```mdx
import { Cards, Card } from 'nextra/components'

## Related Topics

<Cards>
  <Card title="Architecture Overview" href="/docs/architecture/overview" />
  <Card title="API Reference" href="/api/chat" />
  <Card title="Deployment Guide" href="/docs/deployment" />
</Cards>
```

**Deliverable**: Connected documentation

#### Day 4-5: Testing & QA

Comprehensive testing:
- [ ] Desktop browsers (Chrome, Firefox, Safari)
- [ ] Mobile browsers (iOS Safari, Chrome)
- [ ] Different screen sizes
- [ ] Dark mode
- [ ] Print styles
- [ ] Accessibility

**Deliverable**: QA sign-off

## Migration Comparison: All Three Solutions

| Task | Docusaurus | VitePress | Nextra |
|------|-----------|-----------|--------|
| **File Structure** | More reorganization | Minimal changes | Moderate changes |
| **Markdown Syntax** | Mostly compatible | Fully compatible | Convert to MDX |
| **Custom Components** | Port to React | Port to Vue | Direct use (React) |
| **Configuration** | More complex | Simpler | Moderate |
| **Navigation Setup** | Config file | Config file | File-based + meta |
| **Asset Handling** | static/ folder | public/ folder | public/ folder |
| **Total Time** | 5-7 days | 3-4 days | 5-6 days |

## Rollback Strategy

### If Migration Fails

1. **Keep Original Docs**: Don't delete original docs until migration is complete and verified
2. **Parallel Running**: Run both old and new docs during transition
3. **Easy Revert**: Original docs accessible via different URL
4. **No Database Changes**: Static sites mean no data loss risk
5. **Version Control**: All changes in Git, easy to rollback

### Rollback Steps
```bash
# If needed, revert deployment
git revert <commit-hash>
git push

# DNS change (if needed)
# Point docs.meowstik.ai back to old location

# Restore takes < 5 minutes
```

## Success Criteria

### Technical Success
- ✅ All pages migrated successfully
- ✅ Zero broken links
- ✅ All images loading
- ✅ Search working
- ✅ Lighthouse score > 95
- ✅ Build time < 2 minutes

### Content Success
- ✅ Content reviewed and approved
- ✅ Code examples tested and working
- ✅ Technical accuracy verified
- ✅ Style guide followed
- ✅ SEO optimized

### User Success
- ✅ Positive feedback from team
- ✅ Easy to find information
- ✅ Fast page loads
- ✅ Mobile-friendly
- ✅ Accessible

## Post-Migration Tasks

### Week 1-2 After Migration
- [ ] Monitor analytics
- [ ] Collect user feedback
- [ ] Fix any issues found
- [ ] Optimize based on usage
- [ ] Update based on feedback

### Month 1-3 After Migration
- [ ] Add new content
- [ ] Improve existing content
- [ ] Add video tutorials
- [ ] Create interactive examples
- [ ] Build community

## Tools & Resources

### Migration Tools
- **Content**: Custom scripts (provided above)
- **Images**: Sharp for optimization
- **Links**: Custom link checker
- **Validation**: `markdown-link-check`

### Testing Tools
- **Links**: `linkinator`
- **Performance**: Lighthouse CI
- **Accessibility**: axe DevTools
- **Mobile**: BrowserStack

### Monitoring Tools
- **Uptime**: UptimeRobot (free)
- **Analytics**: Google Analytics
- **Errors**: Sentry (free tier)
- **Performance**: Vercel Analytics

## Conclusion

A successful migration requires:
1. **Careful Planning**: Understand current state and desired end state
2. **Automated Tools**: Scripts to handle repetitive tasks
3. **Thorough Testing**: Verify everything works before launch
4. **Gradual Rollout**: Soft launch before public announcement
5. **Continuous Improvement**: Iterate based on feedback

With this strategy, Meowstik can successfully migrate to a modern documentation platform while minimizing risk and downtime.

---

**Ready to migrate?** Let's create an implementation issue to track progress!
