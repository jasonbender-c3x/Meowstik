import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  openDirectoryPickerWithHandle,
  requestDirectoryPermission,
  checkDirectoryPermission,
  readFileFromHandle,
  writeFileToHandle,
  listDirectoryHandle,
  existsInHandle,
  isFileSystemAccessSupported,
} from '@/lib/file-picker';
import {
  saveDirectoryHandle,
  loadDirectoryHandle,
  clearDirectoryHandle,
} from '@/lib/local-drive-store';

interface LocalDriveState {
  isSupported: boolean;
  isConnected: boolean;
  folderName: string | null;
  needsPermission: boolean;
}

interface LocalDriveContextValue extends LocalDriveState {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  requestAccess: () => Promise<boolean>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listFiles: (path?: string) => Promise<Array<{ name: string; kind: 'file' | 'directory' }>>;
  exists: (path: string) => Promise<boolean>;
}

const LocalDriveContext = createContext<LocalDriveContextValue | null>(null);

interface LocalDriveProviderProps {
  children: ReactNode;
}

export function LocalDriveProvider({ children }: LocalDriveProviderProps) {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [state, setState] = useState<LocalDriveState>({
    isSupported: false,
    isConnected: false,
    folderName: null,
    needsPermission: false,
  });

  useEffect(() => {
    const supported = isFileSystemAccessSupported();
    setState(prev => ({ ...prev, isSupported: supported }));
    
    if (supported) {
      loadStoredHandle();
    }
  }, []);

  async function loadStoredHandle() {
    const stored = await loadDirectoryHandle();
    if (stored) {
      const hasPermission = await checkDirectoryPermission(stored.handle);
      setHandle(stored.handle);
      setState(prev => ({
        ...prev,
        isConnected: hasPermission,
        folderName: stored.name,
        needsPermission: !hasPermission,
      }));
    }
  }

  const connect = useCallback(async (): Promise<boolean> => {
    const result = await openDirectoryPickerWithHandle();
    if (!result) return false;

    setHandle(result.handle);
    await saveDirectoryHandle(result.handle);
    
    setState(prev => ({
      ...prev,
      isConnected: true,
      folderName: result.name,
      needsPermission: false,
    }));
    
    return true;
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    setHandle(null);
    await clearDirectoryHandle();
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      folderName: null,
      needsPermission: false,
    }));
  }, []);

  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (!handle) return false;
    
    const granted = await requestDirectoryPermission(handle);
    if (granted) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        needsPermission: false,
      }));
    }
    return granted;
  }, [handle]);

  const readFile = useCallback(async (path: string): Promise<string> => {
    if (!handle) throw new Error('No local drive connected');
    if (!state.isConnected) throw new Error('Permission not granted');
    return readFileFromHandle(handle, path);
  }, [handle, state.isConnected]);

  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    if (!handle) throw new Error('No local drive connected');
    if (!state.isConnected) throw new Error('Permission not granted');
    await writeFileToHandle(handle, path, content);
  }, [handle, state.isConnected]);

  const listFiles = useCallback(async (path?: string): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> => {
    if (!handle) throw new Error('No local drive connected');
    if (!state.isConnected) throw new Error('Permission not granted');
    return listDirectoryHandle(handle, path);
  }, [handle, state.isConnected]);

  const exists = useCallback(async (path: string): Promise<boolean> => {
    if (!handle) return false;
    if (!state.isConnected) return false;
    return existsInHandle(handle, path);
  }, [handle, state.isConnected]);

  const value: LocalDriveContextValue = {
    ...state,
    connect,
    disconnect,
    requestAccess,
    readFile,
    writeFile,
    listFiles,
    exists,
  };

  return (
    <LocalDriveContext.Provider value={value}>
      {children}
    </LocalDriveContext.Provider>
  );
}

export function useLocalDrive(): LocalDriveContextValue {
  const context = useContext(LocalDriveContext);
  if (!context) {
    throw new Error('useLocalDrive must be used within a LocalDriveProvider');
  }
  return context;
}
