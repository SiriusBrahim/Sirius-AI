'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Studio Renderer için sıkı IPC izin listesi (Allowlist)
contextBridge.exposeInMainWorld('studioAPI', {
  // Klasör, ZIP İçe Aktarma ve Dosya Sistemi
  selectProjectFolder: () => ipcRenderer.invoke('fs:select-folder'),
  importZipProject: () => ipcRenderer.invoke('fs:import-zip'),
  getProjectTree: (projectRoot) => ipcRenderer.invoke('fs:get-tree', projectRoot),
  readFile: (projectRoot, relPath) => ipcRenderer.invoke('fs:read-file', { projectRoot, relPath }),
  writeFileWithBackup: (projectRoot, relPath, content, createBackup = true) =>
    ipcRenderer.invoke('fs:write-file-with-backup', { projectRoot, relPath, content, createBackup }),
  restoreBackup: (projectRoot, backupRelPath, targetRelPath) =>
    ipcRenderer.invoke('fs:restore-backup', { projectRoot, backupRelPath, targetRelPath }),
  listBackups: (projectRoot) => ipcRenderer.invoke('fs:list-backups', projectRoot),

  // Proje Hafızası & Checkpoint Kalıcılığı
  saveCheckpoint: (projectRoot, state) =>
    ipcRenderer.invoke('checkpoint:save', { projectRoot, state }),
  loadCheckpoint: (projectRoot) => ipcRenderer.invoke('checkpoint:load', projectRoot),
  saveProjectMemory: (projectRoot, memory) =>
    ipcRenderer.invoke('memory:save', { projectRoot, memory }),
  loadProjectMemory: (projectRoot) => ipcRenderer.invoke('memory:load', projectRoot),

  // Canlı Uygulama / Oyun Derleme & Önizleme
  compileProjectPreview: (projectRoot) =>
    ipcRenderer.invoke('project:compile-preview', projectRoot),

  // Harici Seçici (selectors.json) Yönetimi
  loadSelectors: () => ipcRenderer.invoke('selectors:load'),
  saveSelectors: (selectorsObj) => ipcRenderer.invoke('selectors:save', selectorsObj),

  // WebContentsView Yönetimi
  switchAgentView: (agentIndex, bounds) =>
    ipcRenderer.invoke('view:switch', { agentIndex, bounds }),
  updateViewBounds: (bounds) =>
    ipcRenderer.invoke('view:set-bounds', bounds),
  setViewsVisible: (visible) =>
    ipcRenderer.invoke('view:set-visible', visible),
  navigateAgentView: (agentIndex, url) =>
    ipcRenderer.invoke('view:navigate', { agentIndex, url }),
  reloadAgentView: (agentIndex) =>
    ipcRenderer.invoke('view:reload', agentIndex),
  getAgentViewInfo: (agentIndex) =>
    ipcRenderer.invoke('view:get-info', agentIndex),

  // Yapıştırma Tabanlı Enjeksiyon ve Turndown Çıkarımı
  injectAndSubmitPrompt: (agentIndex, providerKey, promptText) =>
    ipcRenderer.invoke('agent:inject-submit', { agentIndex, providerKey, promptText }),
  pollCompletion: (agentIndex, providerKey) =>
    ipcRenderer.invoke('agent:poll-completion', { agentIndex, providerKey }),
  extractLatestResponse: (agentIndex, providerKey) =>
    ipcRenderer.invoke('agent:extract-response', { agentIndex, providerKey }),
  stopAgentGeneration: (agentIndex, providerKey) =>
    ipcRenderer.invoke('agent:stop-generation', { agentIndex, providerKey }),

  // Main Process -> Renderer Olay Dinleyicileri
  onViewUrlChanged: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('view:url-changed', handler);
    return () => ipcRenderer.removeListener('view:url-changed', handler);
  },
  onViewLoadFailed: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('view:load-failed', handler);
    return () => ipcRenderer.removeListener('view:load-failed', handler);
  },
  onViewLoadingState: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('view:loading-state', handler);
    return () => ipcRenderer.removeListener('view:loading-state', handler);
  },
});
