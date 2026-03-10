/**
 * Local Drive Store - IndexedDB persistence for File System Access API handles
 * 
 * Stores directory handles in IndexedDB so users can quickly re-grant access
 * on subsequent sessions without re-selecting the folder.
 */

const DB_NAME = 'meowstik-local-drive';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'local-drive';

interface StoredHandle {
  key: string;
  handle: FileSystemDirectoryHandle;
  name: string;
  grantedAt: number;
}

/**
 * Open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save a directory handle to IndexedDB
 */
export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data: StoredHandle = {
      key: HANDLE_KEY,
      handle,
      name: handle.name,
      grantedAt: Date.now(),
    };
    
    const request = store.put(data);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Load a stored directory handle from IndexedDB
 * Note: The handle will need permission re-granted via user gesture
 */
export async function loadDirectoryHandle(): Promise<StoredHandle | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(HANDLE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('[LocalDriveStore] Failed to load handle:', error);
    return null;
  }
}

/**
 * Clear stored directory handle
 */
export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(HANDLE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('[LocalDriveStore] Failed to clear handle:', error);
  }
}

/**
 * Check if we have a stored handle
 */
export async function hasStoredHandle(): Promise<boolean> {
  const stored = await loadDirectoryHandle();
  return stored !== null;
}
