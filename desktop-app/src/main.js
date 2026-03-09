/**
 * =============================================================================
 * MEOWSTIK DESKTOP - ELECTRON MAIN PROCESS
 * =============================================================================
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

// Disable GPU to prevent crashes in headless environments
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Load .env variables
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '.env') });
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch (e) {
  console.log('⚠️  [Main] Could not load dotenv');
}

let mainWindow = null;
let tray = null;
let backendProcess = null;
let backendPort = 5001;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || 
              __dirname.includes('Meowstik') || 
              !app.isPackaged;

function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

async function waitForBackend(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/status`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      console.log(`✅ Backend ready on port ${port}`);
      return true;
    } catch (e) {
      if ((i + 1) % 5 === 0) console.log(`⏳ Waiting for backend... ${i + 1}/${maxAttempts}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

async function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = getResourcePath('server');
    const workspaceRoot = path.join(__dirname, '..', '..');
    
    // Use absolute paths for everything to avoid ENOENT
    const nodePath = process.execPath; // Path to the electron/node executable
    const tsxPath = path.join(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const indexPath = path.join(serverPath, 'index.ts');

    const env = {
      ...process.env,
      PORT: backendPort.toString(),
      NODE_ENV: isDev ? 'development' : 'production',
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    };

    console.log(`🚀 Starting backend from: ${serverPath}`);
    console.log(`   Command: ${nodePath} ${tsxPath} ${indexPath}`);

    // Spawn node directly with tsx as a script to avoid shell issues
    backendProcess = spawn(nodePath, [tsxPath, indexPath], {
      cwd: serverPath,
      env: env,
      shell: false, // MANDATORY: Avoid /bin/sh dependency
      stdio: ['pipe', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', (data) => console.log(`[Backend] ${data.toString().trim()}`));
    backendProcess.stderr.on('data', (data) => console.error(`[Backend Error] ${data.toString().trim()}`));

    backendProcess.on('error', (error) => {
      console.error('❌ Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (!isQuitting) {
        dialog.showErrorBox('Backend Error', 'The backend server has stopped unexpectedly.');
      }
    });

    waitForBackend(backendPort, 120).then(ready => {
      if (ready) resolve();
      else reject(new Error('Backend timeout'));
    });
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });
  mainWindow.loadURL(`http://localhost:${backendPort}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow.hide(); } });
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createTray();
    createMenu();
    createWindow();
  } catch (error) {
    console.error('❌ Startup Error:', error);
  }
});

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow.show() },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
}

function createMenu() {
  const menu = Menu.buildFromTemplate([{ label: 'File', submenu: [{ role: 'quit' }] }]);
  Menu.setApplicationMenu(menu);
}

app.on('before-quit', () => { isQuitting = true; stopBackend(); });
process.on('uncaughtException', (e) => { console.error('Uncaught Exception:', e); stopBackend(); });
