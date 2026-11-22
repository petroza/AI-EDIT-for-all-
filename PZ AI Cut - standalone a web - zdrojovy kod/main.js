'use strict';
// PZ AI Cut Standalone – hlavní proces Electronu: okno, nabídky, dialogy souborů. Veškerý střih běží v okně (renderer).
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { syncAiPanel } = require('./tools/sync-ai-panel');
const { APP_NAME } = require('./src/core/brand');
const { tr } = require('./src/core/lang');
const { menuTemplate, ABOUT } = require('./src/core/menu');

// jazyk rozhraní (en/cs) – ukládá ho okno do settings.json, přepíná se vlaječkami nahoře vpravo
let LANG = 'en';
try {
  const f = path.join(process.env.APPDATA || __dirname, 'TN_strihatoko', 'settings.json');
  LANG = JSON.parse(require('fs').readFileSync(f, 'utf8')).lang === 'cs' ? 'cs' : 'en';
} catch (e) { /* výchozí angličtina */ }
function localize(items) {
  for (const it of items) {
    if (LANG === 'cs' && it.label && !it.keepLabel) it.label = tr(it.label);
    delete it.keepLabel;
    if (Array.isArray(it.submenu)) localize(it.submenu);
  }
  return items;
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName(APP_NAME);
// vlastní identita na liště úloh Windows (ikona a seskupení oken PZ AI Cut, ne Electron)
if (process.platform === 'win32') app.setAppUserModelId('cz.pz.aicut.standalone');

let win = null;
let forceClose = false;

function send(cmd, arg) { if (win) win.webContents.send('cmd', cmd, arg); }

function buildMenu() {
  // šablona je sdílená s webovou verzí (src/core/menu.js); local = zkratku zpracuje okno
  // (registerAccelerator: false – jinak by Ctrl+Z / Delete fungovaly i při psaní do textových polí)
  const conv = (items) => items.filter((it) => it === '-' || !it.web).map((it) => {
    if (it === '-' || it.sep) return { type: 'separator' };
    if (it.submenu) return { label: it.label, submenu: conv(it.submenu) };
    if (it.about) {
      return { label: 'About ' + APP_NAME, click: () => dialog.showMessageBox(win, { title: APP_NAME, message: APP_NAME, detail: ABOUT[LANG](app.getVersion(), false) }) };
    }
    if (it.cmd === 'openAppFolder') return { label: it.label, click: () => shell.openPath(__dirname) };
    // Reload bez Ctrl+R (vzhled S1: v Premiere je to Rychlost/Trvání – tady tiše znovu načetl okno a smazal historii Zpět)
    if (it.role) return Object.assign({ role: it.role, label: it.label }, it.accel ? { accelerator: it.accel } : {});
    const o = { label: it.label, keepLabel: it.keepLabel, accelerator: it.accel, click: () => send(it.cmd, it.arg) };
    if (it.local) o.registerAccelerator = false;
    if (it.radio) { o.type = 'radio'; o.checked = LANG === it.radio; }
    return o;
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(localize(conv(menuTemplate()))));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1680, height: 1000, minWidth: 1100, minHeight: 680,
    backgroundColor: '#1b1b1b',
    title: APP_NAME,
    icon: path.join(__dirname, 'src', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  // testy (test/standalone.js): PZ_WINDOW_SIZE=1366x768 = pevná velikost okna místo maximalizace
  const fixed = /^(\d+)x(\d+)$/.exec(process.env.PZ_WINDOW_SIZE || '');
  if (fixed) { win.setMinimumSize(800, 500); win.setBounds({ x: 30, y: 30, width: +fixed[1], height: +fixed[2] }); } else win.maximize();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    send('beforeClose');
  });
  win.on('closed', () => { win = null; });
}

ipcMain.handle('dialog', async (_e, kind, opts) => {
  if (kind === 'open') return dialog.showOpenDialog(win, opts);
  if (kind === 'save') return dialog.showSaveDialog(win, opts);
  if (kind === 'message') return dialog.showMessageBox(win, opts);
  return null;
});
ipcMain.handle('reveal', (_e, p) => { shell.showItemInFolder(p); });
ipcMain.handle('openPath', (_e, p) => shell.openPath(p));
ipcMain.on('closeNow', () => { forceClose = true; if (win) win.close(); });
ipcMain.on('setLang', (_e, l) => { const n = l === 'cs' ? 'cs' : 'en'; if (n !== LANG) { LANG = n; buildMenu(); } });
ipcMain.on('setTitle', (_e, t) => { if (win) win.setTitle(t); });

app.whenReady().then(() => {
  try { syncAiPanel(); } catch (e) { console.error('AI panel:', e.message); }
  buildMenu();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
