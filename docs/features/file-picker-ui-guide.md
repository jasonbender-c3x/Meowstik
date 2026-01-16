# File Picker UI Guide

## Chat Input Area - New Buttons

The chat input area now has **two new buttons** for file operations:

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
│   │    │    └────── NEW: Folder picker            └─ Screenshot   │
│   │    │                                                           │
│   │    └──────────── NEW: Enhanced file picker                    │
│   │                                                                │
│   └────────────────── Auto-screenshot toggle                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Button Details

#### 📎 File Picker (Enhanced)
- **Location**: Bottom-left action bar
- **Function**: Opens native OS file picker
- **Features**:
  - Select multiple files
  - Filter by file type
  - Native OS dialog (Chrome/Edge)
  - Falls back to traditional picker (Safari/Firefox)

#### 📁 Folder Picker (NEW)
- **Location**: Next to file picker button
- **Function**: Opens directory/folder picker
- **Features**:
  - Select entire directories
  - Preserves folder structure
  - Uploads up to 50 files
  - Shows file count in toast notification

## AI Message Actions - Download Button

AI responses now have a **download button** to save content to disk:

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
│   │    └────── NEW: Download to file                   └─ Good    │
│   │                                                                │
│   └──────────── Copy to clipboard                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Download Button Details

#### ⬇️ Download Button (NEW)
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

## Visual States

### File Picker Button States

```
Normal State (Idle):
[📎]  ← Gray icon, hover shows primary color

Hover State:
[📎]  ← Primary color, slight background highlight

After Selection:
[📎]  ← Returns to normal, files shown above input
```

### Folder Picker Button States

```
Normal State:
[📁]  ← Gray icon, hover shows primary color

Hover State:
[📁]  ← Primary color with background highlight

Processing:
[📁]  ← Brief processing while reading files
```

### Download Button States

```
Normal State:
[⬇️]  ← Gray icon in AI message footer

Hover State:
[⬇️]  ← Darker gray with background highlight

Clicking:
[⬇️]  ← Shows native save dialog immediately
```

## Attachment Preview Area

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

### Image Attachments
- Show thumbnail preview
- Display filename below
- X button to remove (top-right corner)
- Hover shows remove button

### Non-Image Attachments
- Show paperclip icon
- Display filename and size
- X button to remove
- No thumbnail preview

## Keyboard Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| Send message | `Enter` | Send with all attachments |
| New line | `Shift + Enter` | Add line break in message |
| Remove last attachment | `Backspace` (on empty input) | Remove most recent file |

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

---

**Tip**: Try the folder picker to upload an entire project directory in one click!
**Tip**: Use the download button to save useful AI-generated code snippets!
