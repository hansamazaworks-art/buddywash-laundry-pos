const { app, BrowserWindow, Menu, Tray, dialog, shell, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server');

let win = null, srv = null, tray = null;
const ICON = path.join(__dirname, 'build', 'icon.png');

if(!app.requestSingleInstanceLock()){ app.quit(); }
else app.on('second-instance', () => { if(win){ if(win.isMinimized()) win.restore(); win.focus(); } });

const lanText = () => srv && srv.urls.length
  ? srv.urls.join('\n') : `(no network connection found — connect this PC to the shop Wi-Fi/LAN)`;

function showAddress(){
  dialog.showMessageBox(win, {
    type: 'info', title: 'Share on your network', buttons: ['OK', 'Copy address'], defaultId: 0,
    message: 'Other devices on the same Wi-Fi / LAN can open Buddy Wash at:',
    detail: lanText() + '\n\n(Press Ctrl+L any time to see this again.)\n\nKeep this app open — it is the shop server. If a device cannot connect, run allow-firewall.bat once on this PC (as Administrator).'
  }).then(r => { if(r.response === 1 && srv && srv.urls[0]) clipboard.writeText(srv.urls[0]); });
}

// No File/View menu bar. Everything is reachable from the tray icon or shortcuts.
function buildTray(){
  try{
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
    tray.setToolTip('Buddy Wash — shop server');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show window', click: () => { if(win){ win.show(); win.focus(); } } },
      { label: 'Show LAN address…', click: showAddress },
      { label: 'Copy LAN address', click: () => srv && srv.urls[0] && clipboard.writeText(srv.urls[0]) },
      { type: 'separator' },
      { label: 'Open data folder', click: () => shell.openPath(srv.dataDir) },
      { label: 'Open backups folder', click: () => shell.openPath(path.join(srv.dataDir, 'backups')) },
      { type: 'separator' },
      { label: 'Quit (stops sharing)', click: () => app.quit() }
    ]));
    tray.on('click', () => { if(win){ win.show(); win.focus(); } });
  }catch(e){ /* tray is optional */ }
}

async function boot(){
  const dataDir = path.join(app.getPath('userData'), 'data');
  try{
    srv = await startServer({ dataDir, publicDir: path.join(__dirname, 'public'), port: Number(process.env.PORT) || 3000 });
  }catch(e){
    dialog.showErrorBox('Buddy Wash could not start its server', String(e.message || e));
    return app.quit();
  }
  Menu.setApplicationMenu(null);
  buildTray();
  win = new BrowserWindow({ width: 1400, height: 900, title: 'Buddy Wash', backgroundColor: '#eef5f4', icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, devTools: false } });
  win.removeMenu();
  // Keyboard shortcuts (replace the old menu): Ctrl+L address, F5 reload, F11 fullscreen, Ctrl +/-/0 zoom.
  win.webContents.on('before-input-event', (e, i) => {
    if(i.type !== 'keyDown') return;
    const c = i.control || i.meta, k = i.key;
    if(c && k.toLowerCase() === 'l'){ e.preventDefault(); showAddress(); }
    else if(k === 'F5' || (c && k.toLowerCase() === 'r')){ e.preventDefault(); win.webContents.reload(); }
    else if(k === 'F11'){ e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    else if(c && (k === '=' || k === '+')){ e.preventDefault(); win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); }
    else if(c && k === '-'){ e.preventDefault(); win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); }
    else if(c && k === '0'){ e.preventDefault(); win.webContents.setZoomLevel(0); }
  });
  win.setTitle(`Buddy Wash — LAN: ${srv.urls[0] || 'localhost:' + srv.port}`);
  win.webContents.on('page-title-updated', e => e.preventDefault());
  // Print windows (about:blank) open in-app; real web links open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if(/^https?:/i.test(url) && !url.startsWith(`http://localhost:${srv.port}`)){ shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON } };
  });
  win.loadURL(`http://localhost:${srv.port}/`);
  win.on('closed', () => { win = null; });

  // Show the shop's network address once, the first time the app runs.
  const flag = path.join(dataDir, '.address-shown');
  if(!fs.existsSync(flag)){ fs.writeFileSync(flag, '1'); win.webContents.once('did-finish-load', showAddress); }
}

app.whenReady().then(boot);
app.on('before-quit', () => { if(srv) srv.store.flush(); });
app.on('window-all-closed', () => app.quit());
