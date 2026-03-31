# 📘 Meowstik Core Documentation

**Current System Reference - Always Up-to-Date**

This directory contains the **active, authoritative documentation** for the Meowstik system as it exists today. These docs are maintained and should be your primary reference when working with the codebase.

For historical documentation showing the system's evolution, see [`../exhibit/`](../exhibit/).

---

## 🚀 Quick Start

**New to Meowstik?** Start here:

1. **[QUICK_START.md](QUICK_START.md)** - Get up and running in 5 minutes
2. **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Understand the big picture
3. **[FEATURES.md](FEATURES.md)** - See what Meowstik can do

---

## 📚 Essential Documentation

### System Overview
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Complete architectural overview
  - Tech stack (React, Express, PostgreSQL, Gemini AI)
  - System components and their interactions
  - Data flow diagrams
  - Deployment architecture

### Features & Capabilities
- **[FEATURES.md](FEATURES.md)** - Comprehensive feature list
  - AI chat interface
  - Google Workspace integrations
  - Voice/TTS capabilities
  - Code editor and live preview
  - Browser automation
  - Desktop agent integration

### Development
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Developer handbook
  - Local development setup
  - Project structure
  - Coding conventions
  - Testing strategies
  - Contributing guidelines

### Database
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database reference
  - All tables and columns
  - Relationships and constraints
  - Zod schemas
  - Migration guides

### API
- **[API_REFERENCE.md](API_REFERENCE.md)** - API endpoint documentation
  - REST endpoints
  - WebSocket connections
  - Request/response formats
  - Authentication
  - Rate limits

---

## 🔧 Reference Guides

### Integration Guides
- **[GOOGLE_WORKSPACE_INTEGRATION.md](GOOGLE_WORKSPACE_INTEGRATION.md)** - Gmail, Drive, Calendar, Docs, Sheets
- **[VOICE_INTEGRATION.md](VOICE_INTEGRATION.md)** - TTS, STT, Twilio, Gemini Live
- **[BROWSER_AUTOMATION.md](BROWSER_AUTOMATION.md)** - Extension, MCP server, Playwright

### Advanced Topics
- **[RAG_SYSTEM.md](RAG_SYSTEM.md)** - Retrieval Augmented Generation implementation
- **[MEMORY_MANAGEMENT.md](MEMORY_MANAGEMENT.md)** - Context and conversation memory
- **[ORCHESTRATION.md](ORCHESTRATION.md)** - Multi-LLM and task coordination

---

## 🆘 Help & Troubleshooting

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions
  - Setup problems
  - Runtime errors
  - Integration issues
  - Performance problems

- **[FAQ.md](FAQ.md)** - Frequently asked questions
  - General questions
  - Technical questions
  - Feature requests

---

## 📝 Maintenance Notes

### Document Status

| Document | Status | Last Updated | Owner |
|----------|--------|--------------|-------|
| SYSTEM_ARCHITECTURE.md | ✅ Current | 2026-01-18 | Core Team |
| FEATURES.md | ✅ Current | 2026-01-18 | Core Team |
| DATABASE_SCHEMA.md | ⚠️ Needs Update | 2026-01-15 | DB Team |
| API_REFERENCE.md | ⚠️ Needs Update | 2026-01-10 | API Team |
| DEVELOPMENT_GUIDE.md | ✅ Current | 2026-01-18 | Dev Team |

**Legend:**
- ✅ Current - Fully up-to-date
- ⚠️ Needs Update - Mostly accurate but has gaps
- 🚧 In Progress - Being actively updated
- ❌ Outdated - Do not use, see exhibit for historical version

---

## 🔄 Updating This Documentation

When you make changes to the system:

1. **Update the relevant core doc** - Keep it accurate
2. **Move superseded versions to exhibit** - Preserve history
3. **Update the CHANGELOG** - Track what changed
4. **Test examples** - Ensure code samples work
5. **Review with team** - Get feedback before merging

---

## 📖 Documentation Philosophy

**Core docs should be:**
- ✅ **Accurate** - Reflect current system state
- ✅ **Complete** - Cover all major features
- ✅ **Clear** - Easy to understand
- ✅ **Concise** - No unnecessary verbosity
- ✅ **Actionable** - Include examples and usage
- ✅ **Maintained** - Regular updates

**When to create a new doc:**
- New major feature or system
- Complex topic needing dedicated explanation
- Integration guide for external service
- When existing docs become too large (>10KB)

**When to update existing doc:**
- Feature enhancements
- Bug fixes affecting behavior
- API changes
- Configuration changes

**When to archive to exhibit:**
- Major refactor makes old approach obsolete
- Feature removed from system
- Architecture significantly changed
- Documentation superseded by better version

---

## 🔗 Related Resources

- **[Exhibit Documentation](../exhibit/)** - Historical docs showing evolution
- **[Main README](../../README.md)** - Project overview
- **[Package README](../../workspace/)** - Individual package docs
- **[GitHub Issues](https://github.com/jasonbender-c3x/Meowstik/issues)** - Bug reports and feature requests

---

## 💡 Tips for Contributors

### Writing Good Documentation

1. **Start with "Why"** - Explain the purpose before the details
2. **Use Examples** - Show don't just tell
3. **Include Diagrams** - Visual aids help understanding
4. **Link Generously** - Connect related concepts
5. **Test Your Examples** - Ensure code actually works
6. **Consider Your Audience** - Beginners vs experts need different depth

### Documentation Templates

See `templates/` directory for:
- Feature documentation template
- API endpoint template
- Integration guide template
- Troubleshooting guide template

---

## 📞 Questions or Feedback?

- **Unclear documentation?** Open an issue with "docs:" prefix
- **Missing information?** Submit a PR or create an issue
- **Found an error?** Please fix it and submit a PR!

---

**Last Updated:** January 18, 2026  
**Maintained By:** Meowstik Core Team  
**Status:** 🚧 In Active Development
