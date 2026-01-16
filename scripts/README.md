# Scripts

Utility scripts for managing the Meowstik application.

## Icon Generation

### Generate Icons
Generate browser extension icons in multiple sizes:

```bash
python3 scripts/generate-icons.py
```

**Requirements:**
- Python 3.x
- Pillow library (`pip3 install Pillow`)

**Output:**
- `browser-extension/icons/` - Icons for the standalone browser extension
- `extension/icons/` - Icons for the legacy extension
- `extension-src/icons/` - Icons for the built extension (via Vite)
- `public/icons/` - Icons for the web app

## Agent Attribution Scripts

### Seed Agents
Initialize the database with default agent identities:

```bash
npm run seed:agents
```

This creates:
- **Agentia Compiler** - Main AI agent (enabled)
- **Guest Agent** - Limited access agent (enabled)
- **Agents 2-9** - Reserved for future use (disabled)

### Demonstrate Agent Attribution
Show how the agent attribution system works:

```bash
# Dry run (shows what would happen)
npx tsx scripts/demo-agent-attribution.ts

# Create actual demo PR
CREATE_DEMO_PR=true npx tsx scripts/demo-agent-attribution.ts
```

The demonstration:
1. Lists all available agents
2. Shows agent configuration
3. Displays attribution examples
4. Shows recent activity logs
5. Optionally creates a test PR with agent attribution

### Check Agent Activity
View recent agent activities:

```bash
curl http://localhost:5000/api/agents/activity/recent?limit=20
```

## Other Scripts

### NotebookLM Preparation
Prepare codebase files for ingestion into Google NotebookLM:

```bash
# Use default settings (entire repository → ./notebooklm-output)
npm run prepare:notebooklm

# Specify source directory
npm run prepare:notebooklm -- --source server

# Specify output directory
npm run prepare:notebooklm -- --output /tmp/my-code

# Specify file extensions
npm run prepare:notebooklm -- --extensions ts,js,md

# Combine options
npm run prepare:notebooklm -- --source client --output /tmp/frontend --extensions tsx,ts,css
```

**What it does:**
- Traverses project directories recursively
- Finds files with specified extensions (default: ts, js, tsx, jsx, py, html, css, md, json, yaml, sql, sh, bash, xml)
- Copies files to output directory with NotebookLM-friendly names
- Converts paths like `server/services/auth.ts` → `server-services-auth-ts.txt`
- Excludes build artifacts and dependencies (node_modules, dist, etc.)
- Handles broken symlinks gracefully

**Use case:** Upload the generated .txt files to Google NotebookLM to enable AI-powered querying of your codebase.

### Build
Build the production bundle:

```bash
npm run build
```

### Database Push
Apply database schema changes:

```bash
npm run db:push
```

### Type Check
Run TypeScript type checking:

```bash
npm run check
```

## Development

All scripts use TypeScript and can be run with `tsx`:

```bash
npx tsx scripts/<script-name>.ts
```

## Environment Variables

Some scripts may require:
- `DATABASE_URL` - PostgreSQL connection string
- `GITHUB_TOKEN` - GitHub OAuth token (managed by Replit connector)
- `TARGET_REPO` - Target repository for demos (default: jasonbender-c3x/app)
