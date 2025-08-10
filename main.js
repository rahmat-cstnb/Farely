// main.js
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const getPort = require('get-port');

let backendProcess;

async function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'farely.icns')
  });

  setTimeout(() => {
    if (isDev) {
      win.loadFile('index.html', { query: { port: port.toString() } });
    } else {
      win.loadFile(path.join(__dirname, 'index.html'), { query: { port: port.toString() } });
    }
  }, 1500); // Delay to ensure backend is ready

  // Buka DevTools (optional)
  // win.webContents.openDevTools();
}

function startBackend(port) {
  return new Promise((resolve, reject) => {
    let backendPath;
    if (isDev) {
      backendPath = path.join(__dirname, 'backend', 'server.js');
      backendProcess = spawn('node', [backendPath, '--port', port.toString()], {
        stdio: 'inherit',
        cwd: path.join(__dirname, 'backend')
      });
    } else {
      backendPath = path.join(process.resourcesPath, 'backend', 'server.js');
      backendProcess = spawn('node', [backendPath, '--port', port.toString()], {
        stdio: 'inherit'
      });
    }

    backendProcess.on('error', (err) => {
      reject(err);
    });

    // Wait a short time to assume backend is ready
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}

app.on('ready', async () => {
  try {
    const port = await getPort();
    await startBackend(port);
    await createWindow(port);
  } catch (err) {
    console.error('Failed to start backend:', err);
    dialog.showErrorBox('Backend Error', 'Failed to start the backend server. Please try again.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Matikan backend saat app ditutup
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // If backendProcess is not running, start it again with a new port
    try {
      const port = await getPort();
      await startBackend(port);
      await createWindow(port);
    } catch (err) {
      console.error('Failed to start backend:', err);
      dialog.showErrorBox('Backend Error', 'Failed to start the backend server. Please try again.');
      app.quit();
    }
  }
});