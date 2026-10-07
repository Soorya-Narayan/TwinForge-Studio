import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev') || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 320,
    frame: false,
    resizable: false,
    transparent: true,
    center: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    const devSplashUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}/splash.html`
      : 'http://localhost:5173/splash.html';
    splashWindow.loadURL(devSplashUrl);
  } else {
    splashWindow.loadFile(path.join(__dirname, '../dist/splash.html'));
  }

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });
}

function createMainWindow() {
  const startTime = Date.now();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'TwinForge Studio · Industrial Virtual Commissioning & FAT Suite',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  // Smoothly transition from splash window to main window
  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - startTime;
    const minSplashDuration = 1600; // Allow boot animation with logo and v1.0.0 to display
    const remainingDelay = Math.max(0, minSplashDuration - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
        splashWindow = null;
      }
      mainWindow?.show();
      mainWindow?.focus();
    }, remainingDelay);
  });

  // Handle external link clicks securely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupAppMenu();
}

function setupAppMenu() {
  const isMac = process.platform === 'darwin';

  const template: any[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Export FAT Evidence Report...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('menu:export-fat');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Simulation',
      submenu: [
        {
          label: 'Restart Physics Engine',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.reload();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'TwinForge Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/Soorya-Narayan/TwinForge-Studio');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for native OS integrations
ipcMain.handle('dialog:saveFile', async (_event, options: {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  content: string;
}) => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath,
    filters: options.filters || [
      { name: 'CSV File', extensions: ['csv'] },
      { name: 'JSON Document', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!canceled && filePath) {
    await fs.writeFile(filePath, options.content, 'utf-8');
    return { canceled: false, filePath };
  }
  return { canceled: true };
});

ipcMain.handle('dialog:openFile', async (_event, options?: {
  filters?: { name: string; extensions: string[] }[];
}) => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [{ name: 'JSON Document', extensions: ['json'] }],
  });

  if (!canceled && filePaths.length > 0) {
    const content = await fs.readFile(filePaths[0], 'utf-8');
    return { canceled: false, filePath: filePaths[0], content };
  }
  return { canceled: true };
});

ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// App lifecycle
app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
