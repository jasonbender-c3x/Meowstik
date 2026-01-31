# Features Documentation

This directory contains detailed documentation for specific features in Meowstik.

## Available Features

### 1. [File Picker](./file-picker.md)
Modern file picker functionality using the File System Access API for uploading files, selecting directories, and saving AI-generated content.

**Key Capabilities:**
- Enhanced file upload with native OS dialogs
- Folder/directory upload support
- Save AI responses to local file system
- Smart file type detection
- Browser compatibility with graceful fallbacks

**Status:** ✅ Active

---

### 2. [Open URL](./open-url.md)
Feature for opening URLs and handling web content within the application.

**Status:** ✅ Active

---

### 3. [Environment Metadata](./environment-metadata.md)
Provides the AI with awareness of its execution environment for context-aware decisions.

**Key Capabilities:**
- Environment type detection (production vs. local)
- Server hostname awareness
- Tool availability decisions based on environment
- Secret management based on context
- Network and resource awareness

**Status:** ✅ Active

---

## Feature Status Legend

- ✅ **Active** - Feature is fully implemented and actively maintained
- 🚧 **In Development** - Feature is being developed
- 📋 **Planned** - Feature is planned for future implementation
- 🏛️ **Historical** - Feature documentation preserved for reference

## Related Documentation

- [Main Features List](../../FEATURES.md) - High-level overview of all Meowstik features
- [Quick Start Guide](../../QUICK_START.md) - Getting started with Meowstik
- [System Overview](../../SYSTEM_OVERVIEW.md) - Complete system architecture

---

**Last Updated:** 2026-01-31  
**Location:** `docs/current/features/`
