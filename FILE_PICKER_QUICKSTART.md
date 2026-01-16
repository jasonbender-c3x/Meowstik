# File Picker Feature - Quick Start

## What's New?

This update adds modern file picker functionality to Meowstik, enabling you to:

1. **📎 Upload Files** - Select multiple files using your OS's native file picker
2. **📁 Upload Folders** - Upload entire directories with one click
3. **💾 Save AI Responses** - Download AI-generated content to your local file system

## Quick Demo

### Upload Files
```
1. Click the paperclip button (📎) in the chat input
2. Select one or more files
3. Files appear as previews above the input
4. Type your message and click Send
```

### Upload Folder
```
1. Click the folder button (📁) in the chat input
2. Select a directory from your computer
3. All files (up to 50) are attached at once
4. Folder structure is preserved in filenames
5. Click Send to upload
```

### Save AI Response
```
1. Receive an AI response with code or content
2. Click the download button (⬇️) below the message
3. Choose where to save the file
4. File is saved with smart file type detection
```

## Button Locations

### Chat Input Area (Bottom Left)
```
[🖥️] [📎] [📁] [🎤] ...................... [📷] [▶️]
      ↑    ↑
      │    └── NEW: Folder picker
      └── Enhanced file picker
```

### AI Message Actions (Bottom of AI messages)
```
[📋] [⬇️] [🔄] ........................... [👍] [👎]
      ↑
      └── NEW: Download button
```

## Browser Support

- **Chrome/Edge 86+**: Full native file picker support
- **Safari/Firefox**: Automatic fallback (traditional file input)

## Documentation

For complete details, see:
- [Technical Documentation](./docs/features/file-picker.md)
- [UI Guide with Diagrams](./docs/features/file-picker-ui-guide.md)

## Testing

To test the feature:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open Chrome or Edge (for full File System Access API support)

3. Navigate to the chat interface

4. Test the three main features:
   - Click 📎 to upload files
   - Click 📁 to upload a folder
   - Get an AI response and click ⬇️ to download it

## Code Structure

```
client/src/
├── lib/
│   └── file-picker.ts              # Core File System Access API utilities
├── components/
│   └── chat/
│       ├── input-area.tsx          # Added folder picker button
│       └── message.tsx             # Added download button
docs/features/
├── file-picker.md                  # Technical documentation
└── file-picker-ui-guide.md         # Visual UI guide
```

## Key Functions

### `openFilePicker(options)`
Opens a file selection dialog with native OS picker when available.

```typescript
const files = await openFilePicker({
  accept: { 'image/*': ['.png', '.jpg'] },
  multiple: true
});
```

### `openDirectoryPicker(options)`
Opens a directory selection dialog to upload entire folders.

```typescript
const entries = await openDirectoryPicker();
// Returns array of { path: string, file: File }
```

### `saveFilePicker(content, options)`
Saves content to a file with native save dialog.

```typescript
await saveFilePicker('Hello World', {
  suggestedName: 'greeting.txt'
});
```

## Next Steps

- [ ] Test in Chrome/Edge for full functionality
- [ ] Test fallback in Safari/Firefox
- [ ] Try uploading different file types
- [ ] Test folder upload with nested directories
- [ ] Test downloading various AI response types (code, JSON, text)

## Troubleshooting

**Q: File picker not working?**  
A: Feature automatically falls back to traditional file input in unsupported browsers.

**Q: Can't select folders?**  
A: Make sure you're using a modern browser (Chrome 86+, Edge 86+) or the fallback will use webkitdirectory.

**Q: Download button doesn't work?**  
A: Check browser pop-up blocker settings. Chrome/Edge work best.

## Feedback

If you encounter any issues or have suggestions, please:
1. Check the troubleshooting section in [file-picker.md](./docs/features/file-picker.md)
2. Open an issue on GitHub
3. Provide browser version and error console output

---

**Happy file picking! 🎉**
