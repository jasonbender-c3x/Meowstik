import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the server URL
  // We'll retry until it's ready
  const loadServer = () => {
    mainWindow?.loadURL('http://localhost:5000').catch(() => {
        console.log('Waiting for server...');
        setTimeout(loadServer, 1000);
    });
  };
  
  setTimeout(loadServer, 2000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  console.log('Starting Meowstik Server...');
  // Path to server/index.ts from desktop-app/dist/main.js
  // dist is in desktop-app/
  // so ../../server/index.ts
  const serverPath = path.join(__dirname, '../../server/index.ts');
  
  console.log('Server Path:', serverPath);

  // Use tsx to run the server in dev mode
  // We assume 'tsx' is available in the environment or node_modules
  // Since we are in monorepo, we can invoke it via npx or directly
  
  // Cleanest way: Spawn a new shell to run 'npm run dev' from root?
  // Or direct node execution.
  
  // Let's try direct node with tsx loader
  serverProcess = fork(serverPath, [], {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, PORT: '5000', ELECTRON_RUN: 'true' },
    cwd: path.join(__dirname, '../../') // Run from root
  });

  serverProcess.on('message', (msg) => {
    console.log('[Server]', msg);
  });

  serverProcess.on('error', (err) => {
    console.error('Server failed:', err);
  });
}

  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      startServer();
      createWindow();
    
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    });
  }

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
