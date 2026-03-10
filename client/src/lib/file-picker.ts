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

// ============================================================================
// PERSISTENT DIRECTORY HANDLE
// ============================================================================

/**
 * Result from directory picker with persistent handle
 */
export interface DirectoryHandleResult {
  handle: FileSystemDirectoryHandle;
  name: string;
}

/**
 * Open a directory picker and return the handle for persistent access
 * The handle can be stored in IndexedDB and re-requested later
 * 
 * @returns Promise with directory handle or null if cancelled
 */
export async function openDirectoryPickerWithHandle(): Promise<DirectoryHandleResult | null> {
  if (!('showDirectoryPicker' in window)) {
    console.warn('[FilePicker] Directory picker with handle requires File System Access API');
    return null;
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    }) as FileSystemDirectoryHandle;
    
    return {
      handle,
      name: handle.name,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Request permission for a stored directory handle
 * Must be called after user gesture (e.g., button click)
 * 
 * @param handle - Previously stored directory handle
 * @returns true if permission granted
 */
export async function requestDirectoryPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const permission = await (handle as any).requestPermission({ mode: 'readwrite' });
    return permission === 'granted';
  } catch (error) {
    console.error('[FilePicker] Permission request failed:', error);
    return false;
  }
}

/**
 * Check if we have permission for a directory handle
 * 
 * @param handle - Directory handle to check
 * @returns true if we have readwrite permission
 */
export async function checkDirectoryPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const permission = await (handle as any).queryPermission({ mode: 'readwrite' });
    return permission === 'granted';
  } catch (error) {
    return false;
  }
}

/**
 * Read a file from a directory handle by path
 * 
 * @param dirHandle - Directory handle
 * @param filePath - Path relative to directory (e.g., "folder/file.txt")
 * @returns File content as string
 */
export async function readFileFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  const parts = filePath.split('/').filter(Boolean);
  let currentHandle: FileSystemDirectoryHandle = dirHandle;
  
  // Navigate to parent directories
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
  }
  
  // Get the file
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Write a file to a directory handle by path
 * Creates parent directories if they don't exist
 * 
 * @param dirHandle - Directory handle
 * @param filePath - Path relative to directory (e.g., "folder/file.txt")
 * @param content - Content to write
 */
export async function writeFileToHandle(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
  content: string | Blob | ArrayBuffer
): Promise<void> {
  const parts = filePath.split('/').filter(Boolean);
  let currentHandle: FileSystemDirectoryHandle = dirHandle;
  
  // Navigate/create parent directories
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
  }
  
  // Create/get the file
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await (fileHandle as any).createWritable();
  
  await writable.write(content);
  await writable.close();
}

/**
 * List files in a directory handle
 * 
 * @param dirHandle - Directory handle
 * @param path - Optional subdirectory path
 * @returns Array of file/directory names with types
 */
export async function listDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> {
  let targetHandle = dirHandle;
  
  // Navigate to subdirectory if path provided
  if (path) {
    const parts = path.split('/').filter(Boolean);
    for (const part of parts) {
      targetHandle = await targetHandle.getDirectoryHandle(part);
    }
  }
  
  const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
  for await (const entry of (targetHandle as any).values()) {
    entries.push({ name: entry.name, kind: entry.kind });
  }
  
  return entries.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Check if a file/directory exists in a handle
 */
export async function existsInHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<boolean> {
  try {
    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = dirHandle;
    
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    
    const name = parts[parts.length - 1];
    try {
      await currentHandle.getFileHandle(name);
      return true;
    } catch {
      try {
        await currentHandle.getDirectoryHandle(name);
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}
