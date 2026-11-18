'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, dialog, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const zlib = require('zlib');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const { transform } = require('sucrase');
const {
  buildFocusInputScript,
  buildClickSendScript,
  buildCheckStatusScript,
  buildExtractResponseScript,
  buildClickStopScript,
} = require('./injector');

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

const DEFAULT_AGENT_URLS = [
  'https://gemini.google.com/app',
  'https://claude.ai/new',
  'https://chatgpt.com/',
];

const SELECTORS_PATH = path.join(__dirname, 'selectors.json');

let mainWindow = null;
const agentViews = [];
let activeViewIndex = 0;
let lastKnownBounds = { x: 340, y: 150, width: 720, height: 640 };
let viewsVisible = true;
const writeLocks = new Map();

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  fence: '```',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndownService.use(gfm);

turndownService.addRule('fencedPreCode', {
  filter(node) {
    return node.nodeName === 'PRE' && node.querySelector('code');
  },
  replacement(_content, node) {
    const codeEl = node.querySelector('code');
    const cls = `${codeEl.getAttribute('class') || ''} ${node.getAttribute('class') || ''}`;
    const match = cls.match(/language-([a-zA-Z0-9_+-]+)|lang-([a-zA-Z0-9_+-]+)/);
    const lang = match ? match[1] || match[2] : '';
    const text = (codeEl.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withWriteLock(key, fn) {
  const previous = writeLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  writeLocks.set(key, previous.then(() => next));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (writeLocks.get(key) === next) {
      writeLocks.delete(key);
    }
  }
}

function resolveSafeProjectPath(projectRoot, relPath) {
  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new Error('Geçerli bir proje klasörü seçilmedi.');
  }
  const rootResolved = path.resolve(projectRoot);
  const cleanRel = String(relPath || '').replace(/^[/\\]+/, '');
  const targetResolved = path.resolve(rootResolved, cleanRel);
  if (targetResolved !== rootResolved && !targetResolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Güvenlik ihlali: Proje klasörü dışına erişim engellendi.');
  }
  return { rootResolved, targetResolved, cleanRel };
}

async function readSelectorsFile() {
  const raw = await fs.readFile(SELECTORS_PATH, 'utf8');
  return JSON.parse(raw);
}

function applyViewBounds() {
  const safeW = Math.max(Math.round(lastKnownBounds.width || 800), 400);
  const safeH = Math.max(Math.round(lastKnownBounds.height || 600), 300);

  agentViews.forEach((view, idx) => {
    if (!view) return;
    if (viewsVisible && idx === activeViewIndex) {
      view.setBounds({
        x: Math.round(lastKnownBounds.x),
        y: Math.round(lastKnownBounds.y),
        width: safeW,
        height: safeH,
      });
    } else {
      view.setBounds({
        x: -12000,
        y: 0,
        width: Math.max(safeW, 1024),
        height: Math.max(safeH, 700),
      });
    }
  });
}

function createAgentViews() {
  const agentSession = session.fromPartition('persist:agent_session');
  agentSession.setUserAgent(CHROME_UA);

  DEFAULT_AGENT_URLS.forEach((url, idx) => {
    const view = new WebContentsView({
      webPreferences: {
        partition: 'persist:agent_session',
        preload: path.join(__dirname, 'stealth-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    view.webContents.setUserAgent(CHROME_UA);

    view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')) {
        view.webContents.loadURL(targetUrl);
      }
      return { action: 'deny' };
    });

    view.webContents.on('did-navigate', (_event, newUrl) => {
      mainWindow?.webContents.send('view:url-changed', { agentIndex: idx, url: newUrl });
    });

    view.webContents.on('did-navigate-in-page', (_event, newUrl) => {
      mainWindow?.webContents.send('view:url-changed', { agentIndex: idx, url: newUrl });
    });

    view.webContents.on('did-start-loading', () => {
      mainWindow?.webContents.send('view:loading-state', { agentIndex: idx, loading: true });
    });

    view.webContents.on('did-stop-loading', () => {
      mainWindow?.webContents.send('view:loading-state', { agentIndex: idx, loading: false });
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return;
      mainWindow?.webContents.send('view:load-failed', {
        agentIndex: idx,
        errorCode,
        errorDescription,
        url: validatedURL,
      });
    });

    mainWindow.contentView.addChildView(view);
    agentViews.push(view);
    view.webContents.loadURL(url);
  });

  applyViewBounds();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0B0F17',
    title: 'Multi-Agent AI Browser Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  createAgentViews();

  mainWindow.on('resize', () => applyViewBounds());
  mainWindow.on('closed', () => {
    agentViews.length = 0;
    mainWindow = null;
  });
}

async function scanDirectoryTree(dirPath, rootPath, depth = 0) {
  if (depth > 4) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.studio-backups']);
  const results = [];

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      const children = await scanDirectoryTree(fullPath, rootPath, depth + 1);
      results.push({ name: entry.name, path: relPath, type: 'dir', children });
    } else {
      results.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }
  return results;
}

async function readFlatProjectFiles(dirPath, rootPath, map = {}, depth = 0) {
  if (depth > 4) return map;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.studio-backups']);
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await readFlatProjectFiles(fullPath, rootPath, map, depth + 1);
    } else if (/\.(html?|css|js|jsx|ts|tsx|json|md|svg)$/i.test(entry.name)) {
      const stat = await fs.stat(fullPath);
      if (stat.size <= 512_000) {
        map[relPath] = await fs.readFile(fullPath, 'utf8');
      }
    }
  }
  return map;
}

function extractZipBuffer(buffer) {
  const entries = new Map();
  let eocd = -1;
  const minOff = Math.max(0, buffer.length - 65558);
  for (let i = buffer.length - 22; i >= minOff; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Geçersiz ZIP arşivi.');

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let ptr = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const fileName = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLen).replace(/\\/g, '/');
    ptr += 46 + nameLen + extraLen + commentLen;

    if (fileName.endsWith('/') || fileName.includes('node_modules/') || fileName.includes('.git/')) {
      continue;
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const slice = buffer.subarray(dataStart, dataStart + compSize);

    let rawData;
    if (method === 0) rawData = slice;
    else if (method === 8) rawData = zlib.inflateRawSync(slice);
    else continue;

    entries.set(fileName, rawData);
  }

  // Tek ortak üst klasör varsa soy
  const keys = Array.from(entries.keys());
  const firstSeg = keys[0]?.split('/')[0];
  if (keys.length > 0 && keys.every((k) => k.includes('/') && k.split('/')[0] === firstSeg)) {
    const stripped = new Map();
    for (const [k, v] of entries.entries()) {
      stripped.set(k.slice(firstSeg.length + 1), v);
    }
    return stripped;
  }
  return entries;
}

// IPC İşleyicileri
ipcMain.handle('fs:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Proje Klasörü Seç',
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const projectRoot = result.filePaths[0];
  const tree = await scanDirectoryTree(projectRoot, projectRoot);
  return { canceled: false, projectRoot, tree };
});

ipcMain.handle('fs:import-zip', async () => {
  const zipRes = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP Arşivleri', extensions: ['zip'] }],
    title: 'Proje ZIP Dosyası Seç',
  });
  if (zipRes.canceled || !zipRes.filePaths.length) return { canceled: true };

  const zipPath = zipRes.filePaths[0];
  const zipBaseName = path.basename(zipPath, '.zip');
  const destBase = path.join(app.getPath('userData'), 'imported-projects', `${zipBaseName}-${Date.now()}`);
  await fs.mkdir(destBase, { recursive: true });

  const buf = await fs.readFile(zipPath);
  const extractedMap = extractZipBuffer(buf);
  let count = 0;
  for (const [rel, data] of extractedMap.entries()) {
    try {
      const { targetResolved } = resolveSafeProjectPath(destBase, rel);
      await fs.mkdir(path.dirname(targetResolved), { recursive: true });
      await fs.writeFile(targetResolved, data);
      count += 1;
    } catch {
      // Güvenli olmayan yolları atla
    }
  }
  const tree = await scanDirectoryTree(destBase, destBase);
  return { canceled: false, projectRoot: destBase, projectName: zipBaseName, fileCount: count, tree };
});

ipcMain.handle('fs:get-tree', async (_event, projectRoot) => {
  const { rootResolved } = resolveSafeProjectPath(projectRoot, '');
  const tree = await scanDirectoryTree(rootResolved, rootResolved);
  return { ok: true, tree };
});

ipcMain.handle('fs:read-file', async (_event, { projectRoot, relPath }) => {
  try {
    const { targetResolved } = resolveSafeProjectPath(projectRoot, relPath);
    if (!fsSync.existsSync(targetResolved)) return { ok: true, exists: false, content: '' };
    const content = await fs.readFile(targetResolved, 'utf8');
    return { ok: true, exists: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:write-file-with-backup', async (_event, { projectRoot, relPath, content, createBackup }) => {
  try {
    const { rootResolved, targetResolved, cleanRel } = resolveSafeProjectPath(projectRoot, relPath);
    return await withWriteLock(targetResolved, async () => {
      let backupRelPath = null;
      await fs.mkdir(path.dirname(targetResolved), { recursive: true });

      if (createBackup && fsSync.existsSync(targetResolved)) {
        const prevContent = await fs.readFile(targetResolved, 'utf8');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = cleanRel.replace(/[/\\]/g, '__');
        const backupDir = path.join(rootResolved, '.studio-backups');
        await fs.mkdir(backupDir, { recursive: true });
        const backupFull = path.join(backupDir, `${safeName}.${stamp}.bak`);
        await fs.writeFile(backupFull, prevContent, 'utf8');
        backupRelPath = path.relative(rootResolved, backupFull).replace(/\\/g, '/');
      }

      const tempPath = `${targetResolved}.tmp-${Date.now()}`;
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, targetResolved);
      return { ok: true, relPath: cleanRel, backupRelPath };
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:list-backups', async (_event, projectRoot) => {
  try {
    const { rootResolved } = resolveSafeProjectPath(projectRoot, '');
    const backupDir = path.join(rootResolved, '.studio-backups');
    if (!fsSync.existsSync(backupDir)) return { ok: true, backups: [] };
    const files = await fs.readdir(backupDir);
    return { ok: true, backups: files.sort().reverse().map((name) => `.studio-backups/${name}`) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:restore-backup', async (_event, { projectRoot, backupRelPath, targetRelPath }) => {
  try {
    const backupResolved = resolveSafeProjectPath(projectRoot, backupRelPath).targetResolved;
    const targetResolved = resolveSafeProjectPath(projectRoot, targetRelPath).targetResolved;
    return await withWriteLock(targetResolved, async () => {
      const content = await fs.readFile(backupResolved, 'utf8');
      await fs.writeFile(targetResolved, content, 'utf8');
      return { ok: true };
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('checkpoint:save', async (_event, { projectRoot, state }) => {
  try {
    if (!projectRoot) return { ok: false };
    const { targetResolved } = resolveSafeProjectPath(projectRoot, '.studio-state.json');
    await fs.writeFile(targetResolved, JSON.stringify(state, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('checkpoint:load', async (_event, projectRoot) => {
  try {
    if (!projectRoot) return { ok: false };
    const { targetResolved } = resolveSafeProjectPath(projectRoot, '.studio-state.json');
    if (!fsSync.existsSync(targetResolved)) return { ok: true, state: null };
    return { ok: true, state: JSON.parse(await fs.readFile(targetResolved, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('memory:save', async (_event, { projectRoot, memory }) => {
  try {
    if (!projectRoot) return { ok: false };
    const { targetResolved } = resolveSafeProjectPath(projectRoot, '.studio-memory.json');
    await fs.writeFile(targetResolved, JSON.stringify(memory, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('memory:load', async (_event, projectRoot) => {
  try {
    if (!projectRoot) return { ok: false };
    const { targetResolved } = resolveSafeProjectPath(projectRoot, '.studio-memory.json');
    if (!fsSync.existsSync(targetResolved)) return { ok: true, memory: null };
    return { ok: true, memory: JSON.parse(await fs.readFile(targetResolved, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Canlı Önizleme Derleyicisi (HTML/Canvas + TS/TSX Sucrase)
ipcMain.handle('project:compile-preview', async (_event, projectRoot) => {
  try {
    const { rootResolved } = resolveSafeProjectPath(projectRoot, '');
    const files = await readFlatProjectFiles(rootResolved, rootResolved);
    const keys = Object.keys(files);
    if (keys.length === 0) {
      return { ok: false, error: 'Projede derlenecek dosya bulunamadı.' };
    }

    const htmlEntry = ['index.html', 'game.html', 'app.html'].find((k) => files[k] !== undefined);
    let doc = htmlEntry || '<!doctype html><html><head><meta charset="utf-8"/></head><body><div id="root"></div></body></html>';
    if (htmlEntry) doc = files[htmlEntry];

    doc = doc.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
      if (!/stylesheet/i.test(tag)) return tag;
      const clean = href.replace(/^\.?\//, '');
      return files[clean] ? `<style>\n${files[clean]}\n</style>` : tag;
    });

    const errors = [];
    doc = doc.replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (full, pre, src, post) => {
      const clean = src.replace(/^\.?\//, '');
      if (!files[clean]) return full;
      let code = files[clean];
      if (/\.(tsx?|jsx)$/.test(clean)) {
        try {
          code = transform(code, { transforms: ['typescript', 'jsx'], jsxRuntime: 'classic' }).code;
        } catch (e) {
          errors.push(`${clean}: ${e.message}`);
        }
      }
      return `<script ${pre} ${post}>\n${code}\n</script>`;
    });

    return { ok: errors.length === 0, html: doc, errors, fileCount: keys.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('selectors:load', async () => {
  try {
    return { ok: true, selectors: await readSelectorsFile() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('selectors:save', async (_event, selectorsObj) => {
  try {
    await fs.writeFile(SELECTORS_PATH, JSON.stringify(selectorsObj, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('view:switch', async (_event, { agentIndex, bounds }) => {
  activeViewIndex = agentIndex;
  if (bounds) lastKnownBounds = bounds;
  applyViewBounds();
  return { ok: true };
});

ipcMain.handle('view:set-bounds', async (_event, bounds) => {
  if (bounds) lastKnownBounds = bounds;
  applyViewBounds();
  return { ok: true };
});

ipcMain.handle('view:set-visible', async (_event, visible) => {
  viewsVisible = Boolean(visible);
  applyViewBounds();
  return { ok: true };
});

ipcMain.handle('view:navigate', async (_event, { agentIndex, url }) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false, error: 'Geçersiz ajan sekmesi.' };
  const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  await view.webContents.loadURL(normalized);
  return { ok: true, url: normalized };
});

ipcMain.handle('view:reload', async (_event, agentIndex) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false };
  view.webContents.reload();
  return { ok: true };
});

ipcMain.handle('view:get-info', async (_event, agentIndex) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false };
  return { ok: true, url: view.webContents.getURL(), title: view.webContents.getTitle() };
});

ipcMain.handle('agent:inject-submit', async (_event, { agentIndex, providerKey, promptText }) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false, error: 'Ajan görünümü bulunamadı.' };

  try {
    const selectorsMap = await readSelectorsFile();
    const cfg = selectorsMap[providerKey];
    if (!cfg) return { ok: false, error: `selectors.json içinde '${providerKey}' profili bulunamadı.` };

    const focusRes = await view.webContents.executeJavaScript(
      buildFocusInputScript(cfg.inputSelectors),
      true
    );
    if (!focusRes || !focusRes.ok) {
      return { ok: false, error: focusRes?.reason || 'Giriş kutusuna odaklanılamadı.' };
    }

    const prevClipboard = clipboard.readText();
    clipboard.writeText(promptText);
    view.webContents.focus();
    view.webContents.paste();
    await delay(220);
    clipboard.writeText(prevClipboard);

    await delay(250);
    const sendRes = await view.webContents.executeJavaScript(
      buildClickSendScript(cfg.sendButtonSelectors, cfg.inputSelectors),
      true
    );
    if (!sendRes || !sendRes.ok) {
      return { ok: false, error: sendRes?.reason || 'Gönder butonu tetiklenemedi.' };
    }
    return { ok: true, method: sendRes.method };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('agent:poll-completion', async (_event, { agentIndex, providerKey }) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false, error: 'Ajan görünümü bulunamadı.' };

  try {
    const selectorsMap = await readSelectorsFile();
    const cfg = selectorsMap[providerKey];
    if (!cfg) return { ok: false, error: 'Sağlayıcı seçicisi bulunamadı.' };
    const status = await view.webContents.executeJavaScript(buildCheckStatusScript(cfg), true);
    return { ok: true, status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('agent:extract-response', async (_event, { agentIndex, providerKey }) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false, error: 'Ajan görünümü bulunamadı.' };

  try {
    const selectorsMap = await readSelectorsFile();
    const cfg = selectorsMap[providerKey];
    if (!cfg) return { ok: false, error: 'Sağlayıcı seçicisi bulunamadı.' };

    const extracted = await view.webContents.executeJavaScript(
      buildExtractResponseScript(cfg.responseBubbleSelectors),
      true
    );
    if (!extracted || !extracted.ok) {
      return { ok: false, error: extracted?.reason || 'Yanıt çıkarılamadı.' };
    }

    let markdown = '';
    try {
      markdown = turndownService.turndown(extracted.html || '').trim();
    } catch {
      markdown = extracted.plainText || '';
    }
    if (!markdown) return { ok: false, error: 'Boş yanıt döndü.' };
    return { ok: true, markdown, codeBlocks: extracted.codeBlocks || [] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('agent:stop-generation', async (_event, { agentIndex, providerKey }) => {
  const view = agentViews[agentIndex];
  if (!view) return { ok: false };
  try {
    const selectorsMap = await readSelectorsFile();
    const cfg = selectorsMap[providerKey];
    if (!cfg) return { ok: false };
    return await view.webContents.executeJavaScript(
      buildClickStopScript(cfg.stopButtonSelectors),
      true
    );
  } catch {
    return { ok: false };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
