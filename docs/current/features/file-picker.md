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

## UI Guide

### Chat Input Area - File Operation Buttons

The chat input area has **two buttons** for file operations:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Ask Meowstik anything...                                          │
│  [User types message here]                                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────│
│                                                                     │
│  [🖥️] [📎] [📁] [🎤]                            [📷] [▶️ Send]   │
│   │    │    │    │                                │      │         │
│   │    │    │    └─ Voice input                   │      └─ Send  │
│   │    │    │                                      │               │
│   │    │    └────── Folder picker                 └─ Screenshot   │
│   │    │                                                           │
│   │    └──────────── Enhanced file picker                         │
│   │                                                                │
│   └────────────────── Auto-screenshot toggle                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 📎 File Picker Button
- **Location**: Bottom-left action bar
- **Function**: Opens native OS file picker
- **Features**:
  - Select multiple files
  - Filter by file type
  - Native OS dialog (Chrome/Edge)
  - Falls back to traditional picker (Safari/Firefox)

#### 📁 Folder Picker Button
- **Location**: Next to file picker button
- **Function**: Opens directory/folder picker
- **Features**:
  - Select entire directories
  - Preserves folder structure
  - Uploads up to 50 files
  - Shows file count in toast notification

### AI Message Actions - Download Button

AI responses have a **download button** to save content to disk:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✨  Nebula AI                                         [Model 2.0]  │
│                                                                     │
│  Here's the code you requested:                                    │
│                                                                     │
│  ```javascript                                                      │
│  function greet(name) {                                            │
│    return `Hello, ${name}!`;                                       │
│  }                                                                  │
│  ```                                                                │
│                                                                     │
│  ───────────────────────────────────────────────────────────────  │
│                                                                     │
│  [📋] [⬇️] [🔄]                                      [👍] [👎]    │
│   │    │    │                                          │    │      │
│   │    │    └─ Regenerate                              │    └─ Bad │
│   │    │                                               │           │
│   │    └────── Download to file                        └─ Good    │
│   │                                                                │
│   └──────────── Copy to clipboard                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### ⬇️ Download Button
- **Location**: Between copy and regenerate buttons
- **Function**: Saves AI response to local file
- **Features**:
  - Smart file type detection
  - Suggests appropriate file extension
  - Native save dialog (Chrome/Edge)
  - Falls back to download link (other browsers)

**File Type Detection:**
- Code blocks → `.js`, `.py`, `.java`, etc. (based on language)
- JSON content → `.json`
- Default → `.txt`

### Attachment Preview Area

When files are attached, they appear above the input:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌────────┐  ┌────────┐  ┌──────────────────────┐                │
│  │  [X]   │  │  [X]   │  │  [X]                 │                │
│  │ ┌────┐ │  │ ┌────┐ │  │  📎 data.json        │                │
│  │ │IMG │ │  │ │IMG │ │  │  (5.2 KB)            │                │
│  │ └────┘ │  │ └────┘ │  │                      │                │
│  │ cat.jpg│  │ dog.png│  └──────────────────────┘                │
│  └────────┘  └────────┘                                           │
│   ↑            ↑             ↑                                     │
│   │            │             └─ Non-image file                    │
│   │            └─────────────── Image preview                     │
│   └──────────────────────────── Image preview with thumbnail     │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────│
│  Ask Meowstik anything...                                          │
│  [Type your message here]                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Image Attachments:**
- Show thumbnail preview
- Display filename below
- X button to remove (top-right corner)
- Hover shows remove button

**Non-Image Attachments:**
- Show paperclip icon
- Display filename and size
- X button to remove
- No thumbnail preview

## User Workflows

### Workflow 1: Upload Multiple Files

```
1. User clicks file picker button (📎)
   │
   ├─> Chrome/Edge: Native OS file picker appears
   │
   └─> Safari/Firefox: Browser file picker appears
   
2. User selects multiple files (Ctrl+Click or Cmd+Click)
   │
   └─> Files are read and compressed (if images)
   
3. File previews appear above input area
   │
   └─> User can remove files with X button
   
4. User types message and clicks Send
   │
   └─> Files are sent as attachments with message
```

### Workflow 2: Upload Entire Folder

```
1. User clicks folder picker button (📁)
   │
   ├─> Chrome/Edge: Native directory picker appears
   │
   └─> Safari/Firefox: "Select folder" picker with webkitdirectory
   
2. User selects a folder
   │
   └─> All files in folder are read (up to 50 files)
   
3. Toast notification shows file count
   │
   └─> "Folder Uploaded: 12 files added to the message"
   
4. File previews appear with full paths
   │
   └─> e.g., "project/src/app.js", "project/config/settings.json"
   
5. User clicks Send to upload folder contents
```

### Workflow 3: Save AI Response

```
1. AI generates response (code, text, JSON, etc.)
   │
   └─> Response appears in chat
   
2. User clicks download button (⬇️)
   │
   ├─> Chrome/Edge: Native "Save As" dialog appears
   │   └─> User chooses location and filename
   │
   └─> Safari/Firefox: File downloads automatically
       └─> Browser's default download behavior
   
3. File is saved with smart extension
   │
   ├─> Code: ai-response-2026-01-16.js
   ├─> JSON: ai-response-2026-01-16.json
   └─> Default: ai-response-2026-01-16.txt
```

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

## Accessibility

### ARIA Labels

All buttons have proper accessibility labels:

```html
<!-- File picker button -->
<button aria-label="Attach files" title="Attach files">
  📎
</button>

<!-- Folder picker button -->
<button aria-label="Attach entire folder" title="Attach entire folder">
  📁
</button>

<!-- Download button -->
<button aria-label="Download to file" title="Download to file">
  ⬇️
</button>
```

### Screen Reader Announcements

```
"File picker button. Attach files to your message."
"Folder picker button. Attach entire folder to your message."
"Download button. Save AI response to file."
"3 files attached. cat.jpg, dog.png, data.json."
"File removed. 2 files remaining."
```

### Keyboard Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| Send message | `Enter` | Send with all attachments |
| New line | `Shift + Enter` | Add line break in message |
| Remove last attachment | `Backspace` (on empty input) | Remove most recent file |

## Toast Notifications

### Success Messages

```
✓ Files Attached
  3 file(s) added to the message
  
✓ Folder Uploaded
  12 file(s) from folder added to the message
```

### Error Messages

```
✗ File Selection Failed
  Unable to select files. Please try again.
  
✗ Folder Selection Failed
  Unable to select folder. Please try again.
```

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

## Future Enhancements

Potential improvements for future versions:

- [ ] Drag-and-drop file upload
- [ ] Progress indicators for large file uploads
- [ ] File preview before sending
- [ ] Batch save multiple AI responses
- [ ] Remember last used directories
- [ ] Custom file type filters per conversation context
- [ ] Cloud storage integration (Google Drive, Dropbox)

## Related Documentation

- [File System Access API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Attachment Handling](./attachments.md)
- [Message Components](./message-components.md)

---

**Last Updated**: 2026-01-31  
**Version**: 1.0.1 (Consolidated from file-picker.md and file-picker-ui-guide.md)

**Tips:**
- Try the folder picker to upload an entire project directory in one click!
- Use the download button to save useful AI-generated code snippets!
