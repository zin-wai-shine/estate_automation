const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;

// Read / persist window state
function getWindowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const file = getWindowStateFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (_) {}
  return { width: 1480, height: 940 };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(getWindowStateFile(), JSON.stringify(bounds), 'utf8');
  } catch (_) {}
}

// Check if a local port is responding
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolveAppUrl() {
  // 1. Check custom PORT from env
  if (process.env.APP_PORT && (await checkPort(Number(process.env.APP_PORT)))) {
    return `http://localhost:${process.env.APP_PORT}`;
  }
  // 2. Check default docker / vite port 5174
  if (await checkPort(5174)) {
    return 'http://localhost:5174';
  }
  // 3. Check fallback port 5173
  if (await checkPort(5173)) {
    return 'http://localhost:5173';
  }
  // 4. Fallback to 5174 anyway
  return 'http://localhost:5174';
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
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
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const state = loadWindowState();
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: state.width || 1480,
    height: state.height || 940,
    x: state.x,
    y: state.y,
    minWidth: 1040,
    minHeight: 680,
    title: 'BoltHaven Property Automation',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0b0f17',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  createMenu();

  // Load URL
  const targetUrl = await resolveAppUrl();
  console.log('[ELECTRON] Loading app from:', targetUrl);
  mainWindow.loadURL(targetUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links (e.g. Facebook URLs, external sites) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle load errors gracefully
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[ELECTRON] Page failed to load (${errorCode}): ${errorDescription}`);
    setTimeout(async () => {
      if (mainWindow) {
        const retryUrl = await resolveAppUrl();
        mainWindow.loadURL(retryUrl);
      }
    }, 2000);
  });
}

app.whenReady().then(async () => {
  const electron = require('electron');
  if (electron.nativeTheme) {
    electron.nativeTheme.themeSource = 'dark';
  }

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
