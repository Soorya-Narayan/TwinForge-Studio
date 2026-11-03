import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OpcUaManager } from './opcuaManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev =
  process.env.NODE_ENV === 'development' ||
  process.argv.includes('--dev') ||
  (!app.isPackaged && process.env.NODE_ENV !== 'production' && !fsSync.existsSync(path.join(__dirname, '../dist/index.html')));

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
const opcuaManager = new OpcUaManager();

function getAppIcon() {
  const prodIcon = path.join(__dirname, '../dist/gooselogo.png');
  const devIcon = path.join(__dirname, '../public/gooselogo.png');
  const iconPath = fsSync.existsSync(prodIcon) ? prodIcon : devIcon;
  return nativeImage.createFromPath(iconPath);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 320,
    icon: getAppIcon(),
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
    icon: getAppIcon(),
    title: 'TwinForge Studio · Industrial Virtual Commissioning & FAT Suite',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Client Project Folder (Drawings, Datasheets, Plant Data)',
  });
  if (!canceled && filePaths.length > 0) {
    return { canceled: false, folderPath: filePaths[0] };
  }
  return { canceled: true };
});

ipcMain.handle('project:scanDirectory', async (_event, folderPath: string) => {
  try {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return { success: false, error: 'Path is not a directory' };
    }

    const folderName = path.basename(folderPath);
    const files: Array<{ name: string; relativePath: string; absolutePath: string; size: number; ext: string }> = [];

    async function scan(currentDir: string, currentRel: string, depth: number) {
      if (depth > 2) return;
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(currentDir, entry.name);
        const rel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await scan(full, rel, depth + 1);
        } else if (entry.isFile()) {
          const s = await fs.stat(full);
          files.push({
            name: entry.name,
            relativePath: rel,
            absolutePath: full,
            size: s.size,
            ext: path.extname(entry.name).toLowerCase(),
          });
        }
      }
    }

    await scan(folderPath, '', 0);

    const drawingExts = new Set(['.pdf', '.svg', '.png', '.jpg', '.jpeg', '.dwg', '.dxf']);
    const datasheetExts = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.doc', '.docx']);
    const plantDataExts = new Set(['.json', '.yaml', '.yml', '.csv']);

    const drawings = files.filter((f) => drawingExts.has(f.ext));
    const datasheets = files.filter((f) => datasheetExts.has(f.ext));
    const plantData = files.filter((f) => plantDataExts.has(f.ext));

    return {
      success: true,
      folderPath,
      folderName,
      drawings,
      datasheets,
      plantData,
      totalFiles: files.length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to scan directory' };
  }
});

ipcMain.handle('project:readFile', async (_event, filePath: string, asBinary: boolean = false) => {
  try {
    if (asBinary) {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.pdf') mime = 'application/pdf';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.svg') mime = 'image/svg+xml';
      return { success: true, dataUri: `data:${mime};base64,${buffer.toString('base64')}` };
    } else {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to read file' };
  }
});

ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  return shell.openPath(filePath);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('print:toPDF', async (event, options?: { defaultPath?: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return { canceled: true };

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export FAT Verification Report as PDF',
    defaultPath: options?.defaultPath || 'FAT-Verification-Report.pdf',
    filters: [
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  try {
    const pdfBuffer = await event.sender.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
    });

    await fs.writeFile(filePath, pdfBuffer);
    return { canceled: false, filePath };
  } catch (err: any) {
    console.error('Failed to generate PDF via printToPDF:', err);
    return { canceled: false, error: err?.message || 'Failed to generate PDF' };
  }
});

// OPC UA (node-opcua) IPC Handlers for real industrial PLC communication
ipcMain.handle('opcua:connect', async (_event, options?: any) => {
  return opcuaManager.connect(options);
});

ipcMain.handle('opcua:disconnect', async () => {
  return opcuaManager.disconnect();
});

ipcMain.handle('opcua:getStatus', () => {
  return opcuaManager.getStatus();
});

ipcMain.handle('opcua:readTags', async (_event, tags: string[]) => {
  return opcuaManager.readTags(tags);
});

ipcMain.handle('opcua:readNodeDataTypes', async (_event, tags: string[]) => {
  return opcuaManager.readNodeDataTypes(tags);
});

ipcMain.handle('opcua:writeTags', async (_event, tags: Record<string, { value: any; dataType?: string }>) => {
  return opcuaManager.writeTags(tags);
});

ipcMain.handle('opcua:startLocalServer', async (_event, port?: number) => {
  return opcuaManager.startLocalServer(port);
});

ipcMain.handle('opcua:stopLocalServer', async () => {
  return opcuaManager.stopLocalServer();
});

// App lifecycle
app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(getAppIcon());
    } catch {
      // Ignore if dock API not supported in environment
    }
  }

  createSplashWindow();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', async () => {
  await opcuaManager.destroy();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
