# File Picker Functionality

## Overview

Meowstik now supports modern file picker functionality using the **File System Access API**, providing users with native OS-level file dialogs for uploading files, selecting directories, and saving AI-generated content to disk.

## Features

### 1. Enhanced File Upload 📎

Users can attach files to their messages using a native file picker dialog.

**How to use:**
1. Click the paperclip (📎) button in the chat input area
2. Select one or multiple files from your computer
3. Files will be compressed (if images) and attached to your message
4. Send the message with your files

**Supported file types:**
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- Documents: `.pdf`, `.docx`, `.xlsx`
- Text files: `.txt`, `.md`, `.json`, `.csv`

### 2. Folder/Directory Upload 📁

Upload entire folders with a single click - perfect for sharing project structures or multiple related files.

**How to use:**
1. Click the folder (📁) button in the chat input area
2. Select a directory/folder from your computer
3. All files in the folder (up to 50 files) will be attached
4. File paths are preserved to maintain directory structure

**Use cases:**
- Upload an entire project folder for code review
- Share a collection of images or documents
- Backup configuration directories

### 3. Save AI Responses 💾

Download AI-generated content directly to your local file system with proper file type detection.

**How to use:**
1. After receiving an AI response, look for the download (⬇️) button
2. Click the download button
3. Choose where to save the file on your computer
4. File extension is automatically detected based on content

**Smart file type detection:**
- Code blocks → Saved with appropriate extension (`.js`, `.py`, `.java`, etc.)
- JSON content → Saved as `.json`
- Default → Saved as `.txt`

## Browser Support

### Full Support (File System Access API)
- **Chrome 86+**
- **Edge 86+**
- **Opera 72+**

These browsers provide the native OS file picker with full functionality.

### Fallback Support
- **Safari** (all versions)
- **Firefox** (all versions)
- **Older Chrome/Edge versions**

These browsers use traditional `<input type="file">` elements with `webkitdirectory` for folder support.

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              UI Components (input-area.tsx)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ File Picker  │  │Directory Pick│  │ Download Btn │     │
│  │   Button     │  │   Button     │  │ (message.tsx)│     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│         File Picker Utilities (file-picker.ts)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Feature Detection: isFileSystemAccessSupported()     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  openFilePicker() → Native picker OR fallback        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  openDirectoryPicker() → Folder picker               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  saveFilePicker() → Save to disk                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────┬────────────────────┬────────────────┬─────────────┘
          │                    │                │
          ▼                    ▼                ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
│ File System     │  │ <input> Fallback│  │ Download Link│
│ Access API      │  │ with webkitdir  │  │   Fallback   │
│ (Modern)        │  │ (Compatibility) │  │ (Compat.)    │
└─────────────────┘  └─────────────────┘  └──────────────┘
```

### Key Files

#### `/client/src/lib/file-picker.ts`
The core utility module providing file system access functionality.

**Exports:**
- `openFilePicker(options)` - Open file selection dialog
- `saveFilePicker(content, options)` - Save content to file
- `openDirectoryPicker(options)` - Select entire directories
- `isFileSystemAccessSupported()` - Check browser support
- Helper functions: `readFileAsText()`, `readFileAsDataURL()`, `readFileAsArrayBuffer()`

**Example usage:**
```typescript
import { openFilePicker, saveFilePicker } from '@/lib/file-picker';

// Open file picker
const files = await openFilePicker({
  accept: { 'image/*': ['.png', '.jpg'] },
  multiple: true
});

// Save content
await saveFilePicker('Hello World', {
  suggestedName: 'greeting.txt'
});
```

#### `/client/src/components/chat/input-area.tsx`
Chat input component with file/folder picker buttons.

**New handlers:**
- `handleEnhancedFilePicker()` - Modern file picker
- `handleDirectoryPicker()` - Folder selection

#### `/client/src/components/chat/message.tsx`
Message display component with download functionality.

**New handler:**
- `handleDownload()` - Save AI response to disk

## Security & Privacy

### Permissions
The File System Access API requires user consent for each operation:
- Users must explicitly select files/folders
- Each save operation requires user approval
- No automatic file system access

### Data Handling
- Files are read client-side only
- Content is sent to backend as base64 data URLs
- Images are automatically compressed (max 2048px, JPEG 80% quality)
- Folder uploads are limited to 50 files to prevent overload

## Limitations

### File Size
- Individual files should be < 10MB for best performance
- Very large files may cause memory issues
- Images are automatically compressed

### Directory Depth
- Subdirectories are fully traversed
- Very deep directory structures may take time to process
- Folder upload is capped at 50 files

### Browser Restrictions
- Some browsers may block certain file types
- Safari requires user gesture (click) to trigger picker
- Firefox doesn't support File System Access API yet (uses fallback)

## Future Enhancements

Potential improvements for future versions:

- [ ] Drag-and-drop file upload
- [ ] Progress indicators for large file uploads
- [ ] File preview before sending
- [ ] Batch save multiple AI responses
- [ ] Remember last used directories
- [ ] Custom file type filters per conversation context
- [ ] Cloud storage integration (Google Drive, Dropbox)

## Troubleshooting

### "File picker not working"
- **Cause**: Browser doesn't support File System Access API
- **Solution**: Feature automatically falls back to traditional file input

### "Can't select folders"
- **Cause**: Very old browser version
- **Solution**: Update browser or use individual file selection

### "Download button doesn't work"
- **Cause**: Pop-up blocker or security settings
- **Solution**: Allow pop-ups for this site, or use Chrome/Edge

### "Files too large to upload"
- **Cause**: Files exceed reasonable size limits
- **Solution**: Compress files or upload fewer files at once

## Related Documentation

- [File System Access API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Attachment Handling](./attachments.md)
- [Message Components](./message-components.md)

---

**Last Updated**: 2026-01-16  
**Version**: 1.0.0
