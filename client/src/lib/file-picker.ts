/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    FILE-PICKER.TS - File System Access API Utilities          ║
 * ║                                                                               ║
 * ║  Provides modern file picker functionality using the File System Access API  ║
 * ║  with automatic fallback to traditional file input for unsupported browsers. ║
 * ║                                                                               ║
 * ║  Features:                                                                    ║
 * ║    - Open file(s) picker with modern native dialog                           ║
 * ║    - Save file picker with suggested name and location                       ║
 * ║    - Directory picker for uploading entire folders                           ║
 * ║    - Automatic fallback to <input type="file"> in unsupported browsers      ║
 * ║                                                                               ║
 * ║  Browser Support:                                                             ║
 * ║    - Chrome 86+, Edge 86+ (Full support)                                     ║
 * ║    - Safari, Firefox (Fallback mode)                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for opening file picker
 */
export interface OpenFileOptions {
  /** Accept file types (e.g., "image/*", ".pdf") */
  accept?: Record<string, string[]>;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Description shown in file picker dialog */
  description?: string;
}

/**
 * Options for saving file
 */
export interface SaveFileOptions {
  /** Suggested filename */
  suggestedName?: string;
  /** Accept file types for save dialog */
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

/**
 * Options for opening directory picker
 */
export interface OpenDirectoryOptions {
  /** Description shown in directory picker dialog */
  description?: string;
}

// ============================================================================
// BROWSER SUPPORT DETECTION
// ============================================================================

/**
 * Check if File System Access API is supported
 * @returns true if fully supported
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    'showOpenFilePicker' in window &&
    'showSaveFilePicker' in window &&
    'showDirectoryPicker' in window
  );
}

// ============================================================================
// OPEN FILE PICKER
// ============================================================================

/**
 * Open a file picker dialog to select file(s)
 * Uses File System Access API when available, falls back to input element
 * 
 * @param options - File picker options
 * @returns Promise with selected File objects
 * 
 * @example
 * const files = await openFilePicker({
 *   accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
 *   multiple: true
 * });
 */
export async function openFilePicker(options: OpenFileOptions = {}): Promise<File[]> {
  const { accept = {}, multiple = false, description = 'Select files' } = options;
  
  // Try File System Access API first
  if ('showOpenFilePicker' in window) {
    try {
      const types = Object.keys(accept).length > 0
        ? [{ description, accept }]
        : undefined;
      
      const handles = await (window as any).showOpenFilePicker({
        multiple,
        types,
      });
      
      // Convert FileSystemFileHandle to File
      const files: File[] = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        files.push(file);
      }
      
      return files;
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name === 'AbortError') {
        return [];
      }
      console.warn('[FilePicker] File System Access API failed, falling back:', error);
      // Fall through to fallback
    }
  }
  
  // Fallback to traditional input element
  return openFilePickerFallback(options);
}

/**
 * Fallback file picker using input element
 * @param options - File picker options
 * @returns Promise with selected File objects
 */
function openFilePickerFallback(options: OpenFileOptions): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple || false;
    
    // Convert accept format from File System Access API to input accept
    if (options.accept && Object.keys(options.accept).length > 0) {
      const acceptStrings: string[] = [];
      for (const [mimeType, extensions] of Object.entries(options.accept)) {
        acceptStrings.push(mimeType);
        acceptStrings.push(...extensions);
      }
      input.accept = acceptStrings.join(',');
    }
    
    input.onchange = () => {
      const files = Array.from(input.files || []);
      resolve(files);
    };
    
    input.oncancel = () => {
      resolve([]);
    };
    
    input.click();
  });
}

// ============================================================================
// SAVE FILE PICKER
// ============================================================================

/**
 * Open a save file picker dialog to save content
 * Uses File System Access API when available, falls back to download
 * 
 * @param content - File content (string, Blob, or ArrayBuffer)
 * @param options - Save file options
 * @returns Promise that resolves when file is saved
 * 
 * @example
 * await saveFilePicker('Hello World', {
 *   suggestedName: 'greeting.txt',
 *   types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }]
 * });
 */
export async function saveFilePicker(
  content: string | Blob | ArrayBuffer,
  options: SaveFileOptions = {}
): Promise<void> {
  const { suggestedName = 'download.txt', types } = options;
  
  // Try File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types,
      });
      
      const writable = await handle.createWritable();
      
      if (typeof content === 'string') {
        await writable.write(content);
      } else if (content instanceof Blob) {
        await writable.write(content);
      } else {
        await writable.write(new Blob([content]));
      }
      
      await writable.close();
      return;
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name === 'AbortError') {
        return;
      }
      console.warn('[FilePicker] File System Access API save failed, falling back:', error);
      // Fall through to fallback
    }
  }
  
  // Fallback to download link
  saveFilePickerFallback(content, options);
}

/**
 * Fallback file save using download link
 * @param content - File content
 * @param options - Save file options
 */
function saveFilePickerFallback(
  content: string | Blob | ArrayBuffer,
  options: SaveFileOptions
): void {
  let blob: Blob;
  
  if (content instanceof Blob) {
    blob = content;
  } else if (typeof content === 'string') {
    blob = new Blob([content], { type: 'text/plain' });
  } else {
    blob = new Blob([content]);
  }
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.suggestedName || 'download.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// DIRECTORY PICKER
// ============================================================================

/**
 * Result from directory picker with file entries
 */
export interface DirectoryEntry {
  /** Full path relative to selected directory */
  path: string;
  /** File object */
  file: File;
}

/**
 * Open a directory picker dialog to select an entire folder
 * Uses File System Access API when available, falls back to webkitdirectory
 * 
 * @param options - Directory picker options
 * @returns Promise with array of files in directory
 * 
 * @example
 * const entries = await openDirectoryPicker();
 * for (const entry of entries) {
 *   console.log(entry.path, entry.file);
 * }
 */
export async function openDirectoryPicker(
  options: OpenDirectoryOptions = {}
): Promise<DirectoryEntry[]> {
  // Try File System Access API first
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await (window as any).showDirectoryPicker();
      const entries: DirectoryEntry[] = [];
      
      // Recursively read directory contents
      await readDirectory(handle, '', entries);
      
      return entries;
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name === 'AbortError') {
        return [];
      }
      console.warn('[FilePicker] Directory picker failed, falling back:', error);
      // Fall through to fallback
    }
  }
  
  // Fallback to webkitdirectory
  return openDirectoryPickerFallback(options);
}

/**
 * Recursively read directory and subdirectories
 * @param dirHandle - Directory handle from File System Access API
 * @param path - Current path prefix
 * @param entries - Array to accumulate entries
 */
async function readDirectory(
  dirHandle: any,
  path: string,
  entries: DirectoryEntry[]
): Promise<void> {
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      entries.push({ path: entryPath, file });
    } else if (entry.kind === 'directory') {
      // Recursively read subdirectory
      await readDirectory(entry, entryPath, entries);
    }
  }
}

/**
 * Fallback directory picker using webkitdirectory attribute
 * @param options - Directory picker options
 * @returns Promise with directory entries
 */
function openDirectoryPickerFallback(
  options: OpenDirectoryOptions
): Promise<DirectoryEntry[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.multiple = true;
    
    input.onchange = () => {
      const files = Array.from(input.files || []);
      const entries: DirectoryEntry[] = files.map(file => ({
        // webkitdirectory provides webkitRelativePath
        path: (file as any).webkitRelativePath || file.name,
        file,
      }));
      resolve(entries);
    };
    
    input.oncancel = () => {
      resolve([]);
    };
    
    input.click();
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Read file as text
 * @param file - File to read
 * @returns Promise with text content
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Read file as data URL
 * @param file - File to read
 * @returns Promise with data URL
 */
export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Read file as array buffer
 * @param file - File to read
 * @returns Promise with array buffer
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
