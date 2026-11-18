'use strict';

const STAGE_TIMEOUT_MS = 180_000;
const STABILITY_WINDOW_MS = 3_000;
const POLL_INTERVAL_MS = 500;
const AUTO_COOLDOWN_SECONDS = 4;

const DEFAULT_AGENTS = [
  {
    id: 0,
    title: 'Mimar',
    provider: 'gemini',
    url: 'https://gemini.google.com/app',
    planKey: 'v1',
    planFile: 'plan_v1.md',
    rolePrompt:
      'Sen kıdemli bir Sistem ve Oyun Mimarısın. Proje hafızasını dikkate alarak sistem bileşenlerini, veri modellerini ve teknik mimari planını net Markdown başlıklarıyla oluştur.',
  },
  {
    id: 1,
    title: 'Denetçi',
    provider: 'claude',
    url: 'https://claude.ai/new',
    planKey: 'v2',
    planFile: 'plan_v2.md',
    rolePrompt:
      'Sen kıdemli bir Güvenlik ve Mimari Denetçisisin. Bu plandaki eksikleri, güvenlik açıklarını, darboğazları ve mantık hatalarını bul; tüm sorunları gidererek planı yeniden yaz.',
  },
  {
    id: 2,
    title: 'Başmühendis',
    provider: 'chatgpt',
    url: 'https://chatgpt.com/',
    planKey: 'final',
    planFile: 'plan_final.md',
    rolePrompt:
      'Sen kıdemli bir Başmühendissin. Bu denetlenmiş planı son haline getir; tam dosya ağacını ve çalışır kod mimarisini ayrı kod blokları halinde ekle.',
  },
];

const PROVIDER_URLS = {
  gemini: 'https://gemini.google.com/app',
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  deepseek: 'https://chat.deepseek.com/',
};

const state = {
  projectRoot: null,
  selectedTargetFile: '',
  mode: 'auto',
  centerMode: 'agent', // 'agent' | 'preview'
  activeAgentIndex: 0,
  activePlanTab: 'v1',
  phase: 'idle',
  currentStage: 0,
  failedStage: null,
  agents: JSON.parse(JSON.stringify(DEFAULT_AGENTS)),
  plans: { v1: '', v2: '', final: '' },
  memory: { summary: '', techStack: '', constraints: '' },
  codeBlocks: [],
  pendingApply: null,
  pollTimer: null,
  cooldownTimer: null,
};

const el = {
  workspace: document.getElementById('workspaceGrid'),
  paneLeft: document.getElementById('paneLeft'),
  paneRight: document.getElementById('paneRight'),
  resizerLeft: document.getElementById('resizerLeft'),
  resizerRight: document.getElementById('resizerRight'),
  statusBadgeLabel: document.getElementById('statusBadgeLabel'),
  stageMetaText: document.getElementById('stageMetaText'),
  timeoutMetaText: document.getElementById('timeoutMetaText'),
  btnSelectFolder: document.getElementById('btnSelectFolder'),
  btnImportZip: document.getElementById('btnImportZip'),
  projectPathDisplay: document.getElementById('projectPathDisplay'),
  fileTreeContainer: document.getElementById('fileTreeContainer'),
  projectPromptInput: document.getElementById('projectPromptInput'),
  btnModeAuto: document.getElementById('btnModeAuto'),
  btnModeManual: document.getElementById('btnModeManual'),
  btnStart: document.getElementById('btnStart'),
  btnPause: document.getElementById('btnPause'),
  btnNextAgent: document.getElementById('btnNextAgent'),
  btnRetry: document.getElementById('btnRetry'),
  btnReset: document.getElementById('btnReset'),
  planEditor: document.getElementById('planEditor'),
  btnSavePlan: document.getElementById('btnSavePlan'),
  agentTabs: document.getElementById('agentTabs'),
  btnPreviewTab: document.getElementById('btnPreviewTab'),
  agentBrowserPane: document.getElementById('agentBrowserPane'),
  livePreviewPane: document.getElementById('livePreviewPane'),
  btnCompilePreview: document.getElementById('btnCompilePreview'),
  previewStatusLabel: document.getElementById('previewStatusLabel'),
  livePreviewIframe: document.getElementById('livePreviewIframe'),
  providerSelect: document.getElementById('providerSelect'),
  urlInput: document.getElementById('urlInput'),
  btnNavigate: document.getElementById('btnNavigate'),
  btnReloadView: document.getElementById('btnReloadView'),
  roleTitleLabel: document.getElementById('roleTitleLabel'),
  rolePromptInput: document.getElementById('rolePromptInput'),
  btnToggleRole: document.getElementById('btnToggleRole'),
  webViewHost: document.getElementById('webViewHost'),
  logContainer: document.getElementById('logContainer'),
  btnClearLogs: document.getElementById('btnClearLogs'),
  btnManualExtract: document.getElementById('btnManualExtract'),
  targetFileInput: document.getElementById('targetFileInput'),
  codeBlocksContainer: document.getElementById('codeBlocksContainer'),
  diffModal: document.getElementById('diffModal'),
  diffTargetInfo: document.getElementById('diffTargetInfo'),
  diffPreviewContainer: document.getElementById('diffPreviewContainer'),
  btnCloseDiff: document.getElementById('btnCloseDiff'),
  btnCancelDiff: document.getElementById('btnCancelDiff'),
  btnConfirmApply: document.getElementById('btnConfirmApply'),
  btnOpenMemory: document.getElementById('btnOpenMemory'),
  memoryModal: document.getElementById('memoryModal'),
  memSummaryInput: document.getElementById('memSummaryInput'),
  memStackInput: document.getElementById('memStackInput'),
  memConstraintsInput: document.getElementById('memConstraintsInput'),
  btnCloseMemory: document.getElementById('btnCloseMemory'),
  btnCancelMemory: document.getElementById('btnCancelMemory'),
  btnSaveMemory: document.getElementById('btnSaveMemory'),
  btnOpenSelectors: document.getElementById('btnOpenSelectors'),
  selectorsModal: document.getElementById('selectorsModal'),
  selectorsJsonEditor: document.getElementById('selectorsJsonEditor'),
  selectorsErrorText: document.getElementById('selectorsErrorText'),
  btnCloseSelectors: document.getElementById('btnCloseSelectors'),
  btnCancelSelectors: document.getElementById('btnCancelSelectors'),
  btnSaveSelectors: document.getElementById('btnSaveSelectors'),
};

function addLog(message, level = 'info') {
  const time = new Date().toTimeString().slice(0, 8);
  const row = document.createElement('div');
  row.className = 'log-entry';
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = time;
  const msgSpan = document.createElement('span');
  msgSpan.className = `log-${level}`;
  msgSpan.textContent = message;
  row.appendChild(timeSpan);
  row.appendChild(msgSpan);
  el.logContainer.appendChild(row);
  el.logContainer.scrollTop = el.logContainer.scrollHeight;
}

function getHostBounds() {
  const rect = el.webViewHost.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function syncBounds() {
  if (!window.studioAPI || state.centerMode !== 'agent') return;
  window.studioAPI.updateViewBounds(getHostBounds());
}

function updateStatusUI() {
  const map = {
    idle: ['Hazır', 'status-idle'],
    running: ['Çalışıyor', 'status-running'],
    waiting_manual: ['Manuel Onay Bekleniyor', 'status-paused'],
    cooldown: ['Sonraki Ajana Geçiliyor', 'status-running'],
    paused: ['Duraklatıldı', 'status-paused'],
    completed: ['Tamamlandı', 'status-completed'],
    error: ['Hata / Zaman Aşımı', 'status-error'],
  };
  const [label, cls] = map[state.phase] || map.idle;
  el.statusBadgeLabel.textContent = label;
  el.statusBadgeLabel.className = `status-text ${cls}`;
  el.stageMetaText.textContent = `Aşama ${state.currentStage}/3`;

  const isRunning = state.phase === 'running' || state.phase === 'cooldown';
  el.btnStart.disabled = isRunning || state.phase === 'waiting_manual';
  el.btnPause.disabled = !isRunning && state.phase !== 'paused';
  el.btnPause.textContent = state.phase === 'paused' ? 'Devam Et' : 'Duraklat';
  el.btnNextAgent.disabled = state.phase !== 'waiting_manual';
  el.btnRetry.hidden = state.phase !== 'error';
}

function renderAgentTabs() {
  const buttons = el.agentTabs.querySelectorAll('.agent-tab[data-agent]');
  buttons.forEach((btn, idx) => {
    const agent = state.agents[idx];
    const providerLabel = agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1);
    btn.textContent = `${idx + 1}. ${agent.title} · ${providerLabel}`;
    btn.classList.toggle('active', state.centerMode === 'agent' && idx === state.activeAgentIndex);
  });
  el.btnPreviewTab.classList.toggle('active', state.centerMode === 'preview');

  const active = state.agents[state.activeAgentIndex];
  el.providerSelect.value = active.provider;
  el.urlInput.value = active.url;
  el.roleTitleLabel.textContent = `Sistem Rolü Şablonu (Ajan ${active.id + 1}: ${active.title})`;
  el.rolePromptInput.value = active.rolePrompt;
}

async function switchToAgentTab(index) {
  state.centerMode = 'agent';
  state.activeAgentIndex = index;
  el.agentBrowserPane.hidden = false;
  el.livePreviewPane.hidden = true;
  renderAgentTabs();
  if (window.studioAPI) {
    await window.studioAPI.setViewsVisible(true);
    await window.studioAPI.switchAgentView(index, getHostBounds());
  }
}

async function switchToPreviewTab() {
  state.centerMode = 'preview';
  el.agentBrowserPane.hidden = true;
  el.livePreviewPane.hidden = false;
  renderAgentTabs();
  if (window.studioAPI) {
    await window.studioAPI.setViewsVisible(false);
    await compileAndShowPreview();
  }
}

async function compileAndShowPreview() {
  if (!state.projectRoot || !window.studioAPI) {
    el.previewStatusLabel.textContent = 'Önizleme için önce klasör veya ZIP yükleyin.';
    return;
  }
  const res = await window.studioAPI.compileProjectPreview(state.projectRoot);
  if (!res.ok) {
    el.previewStatusLabel.textContent = `Derleme hatası: ${res.error || (res.errors || []).join(', ')}`;
    addLog(el.previewStatusLabel.textContent, 'error');
    return;
  }
  el.livePreviewIframe.srcdoc = res.html;
  el.previewStatusLabel.textContent = `Derlendi (${res.fileCount} dosya)`;
  addLog(`Canlı önizleme derlendi (${res.fileCount} dosya).`, 'success');
}

function renderFileTree(nodes, container, depth = 0) {
  if (!nodes || nodes.length === 0) {
    container.innerHTML = '<div class="empty-hint">Klasör boş.</div>';
    return;
  }
  nodes.forEach((node) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tree-item ${node.type === 'dir' ? 'tree-dir' : ''} ${
      state.selectedTargetFile === node.path ? 'selected' : ''
    }`;
    btn.style.paddingLeft = `${8 + depth * 12}px`;
    btn.textContent = node.type === 'dir' ? `[${node.name}]` : node.name;

    if (node.type === 'file') {
      btn.addEventListener('click', () => {
        state.selectedTargetFile = node.path;
        el.targetFileInput.value = node.path;
        refreshTreeHighlight();
      });
    }
    container.appendChild(btn);
    if (node.type === 'dir' && node.children) {
      renderFileTree(node.children, container, depth + 1);
    }
  });
}

function refreshTreeHighlight() {
  if (!state.projectRoot || !window.studioAPI) return;
  window.studioAPI.getProjectTree(state.projectRoot).then((res) => {
    if (res.ok) {
      el.fileTreeContainer.innerHTML = '';
      renderFileTree(res.tree, el.fileTreeContainer);
    }
  });
}

async function openProjectRoot(projectRoot, tree, labelText) {
  state.projectRoot = projectRoot;
  el.projectPathDisplay.textContent = labelText || projectRoot;
  el.fileTreeContainer.innerHTML = '';
  renderFileTree(tree, el.fileTreeContainer);

  const memRes = await window.studioAPI.loadProjectMemory(projectRoot);
  if (memRes.ok && memRes.memory) {
    state.memory = memRes.memory;
    addLog('Proje hafızası (.studio-memory.json) yüklendi.', 'info');
  } else {
    state.memory = { summary: '', techStack: '', constraints: '' };
  }

  const cp = await window.studioAPI.loadCheckpoint(projectRoot);
  if (cp.ok && cp.state) {
    if (cp.state.plans) {
      state.plans = { ...state.plans, ...cp.state.plans };
      el.planEditor.value = state.plans[state.activePlanTab] || '';
    }
    if (cp.state.projectIdea && !el.projectPromptInput.value) {
      el.projectPromptInput.value = cp.state.projectIdea;
    }
    addLog('Önceki kontrol noktası (.studio-state.json) geri yüklendi.', 'info');
  }
}

function renderCodeBlocks() {
  el.codeBlocksContainer.innerHTML = '';
  if (!state.codeBlocks.length) {
    el.codeBlocksContainer.innerHTML =
      '<div class="empty-hint">Henüz ayrıştırılmış kod bloğu yok.</div>';
    return;
  }

  state.codeBlocks.forEach((block) => {
    const card = document.createElement('div');
    card.className = 'code-card';
    const head = document.createElement('div');
    head.className = 'code-card-head';

    const meta = document.createElement('span');
    meta.className = 'code-meta mono';
    const lines = block.code.split('\n').length;
    meta.textContent = `${block.agentTitle || 'Ajan'} · ${block.language} · ${lines} satır${
      block.fileHint ? ` · ${block.fileHint}` : ''
    }`;

    const btnApply = document.createElement('button');
    btnApply.type = 'button';
    btnApply.className = 'btn btn-primary btn-sm';
    btnApply.textContent = 'Önizle ve Uygula';
    btnApply.addEventListener('click', () => openDiffModal(block));

    head.appendChild(meta);
    head.appendChild(btnApply);

    const pre = document.createElement('pre');
    pre.className = 'code-card-pre mono';
    pre.textContent = block.code;

    card.appendChild(head);
    card.appendChild(pre);
    el.codeBlocksContainer.appendChild(card);
  });
}

function computeLineDiff(oldText, newText) {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText.split('\n');
  const rows = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) rows.push({ type: 'ctx', text: `  ${n}` });
    else {
      if (o !== undefined) rows.push({ type: 'del', text: `- ${o}` });
      if (n !== undefined) rows.push({ type: 'add', text: `+ ${n}` });
    }
  }
  return rows;
}

async function openDiffModal(block) {
  if (!state.projectRoot) {
    addLog('Dosyaya uygulamak için önce sol panelden proje klasörü veya ZIP seçin.', 'warn');
    return;
  }
  const targetRel = (el.targetFileInput.value || block.fileHint || '').trim();
  if (!targetRel) {
    addLog('Lütfen sol ağaçtan bir hedef dosya seçin veya dosya yolu yazın.', 'warn');
    return;
  }

  const readRes = await window.studioAPI.readFile(state.projectRoot, targetRel);
  if (!readRes.ok) {
    addLog(`Dosya okuma hatası: ${readRes.error}`, 'error');
    return;
  }

  const oldContent = readRes.exists ? readRes.content : '';
  const diffRows = computeLineDiff(oldContent, block.code);

  el.diffTargetInfo.textContent = readRes.exists
    ? `Hedef: ${targetRel} (Mevcut dosyanın .bak yedeği alınacak)`
    : `Hedef: ${targetRel} (Yeni dosya oluşturulacak)`;

  el.diffPreviewContainer.innerHTML = '';
  diffRows.forEach((row) => {
    const div = document.createElement('div');
    div.className = `diff-line diff-${row.type}`;
    div.textContent = row.text;
    el.diffPreviewContainer.appendChild(div);
  });

  state.pendingApply = { targetRel, content: block.code };
  await window.studioAPI.setViewsVisible(false);
  el.diffModal.hidden = false;
}

async function closeDiffModal() {
  el.diffModal.hidden = true;
  state.pendingApply = null;
  if (state.centerMode === 'agent') {
    await window.studioAPI.setViewsVisible(true);
  }
}

async function persistCheckpoint() {
  if (!state.projectRoot || !window.studioAPI) return;
  await window.studioAPI.saveCheckpoint(state.projectRoot, {
    phase: state.phase,
    currentStage: state.currentStage,
    mode: state.mode,
    projectIdea: el.projectPromptInput.value,
    plans: state.plans,
    savedAt: new Date().toISOString(),
  });
}

async function savePlanToDisk(planKey, content) {
  state.plans[planKey] = content;
  if (state.activePlanTab === planKey) el.planEditor.value = content;
  const fileMap = { v1: 'plan_v1.md', v2: 'plan_v2.md', final: 'plan_final.md' };
  const fileName = fileMap[planKey];
  if (state.projectRoot && window.studioAPI) {
    const res = await window.studioAPI.writeFileWithBackup(state.projectRoot, fileName, content, true);
    if (res.ok) {
      addLog(`${fileName} proje klasörüne kaydedildi.`, 'success');
      refreshTreeHighlight();
    } else {
      addLog(`${fileName} yazılamadı: ${res.error}`, 'error');
    }
  }
  await persistCheckpoint();
}

function clearTimers() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.cooldownTimer) {
    clearInterval(state.cooldownTimer);
    state.cooldownTimer = null;
  }
}

async function runStage(stageNumber) {
  clearTimers();
  const agentIndex = stageNumber - 1;
  const agent = state.agents[agentIndex];
  state.currentStage = stageNumber;
  state.phase = 'running';
  state.failedStage = null;
  await switchToAgentTab(agentIndex);
  updateStatusUI();

  let payloadInput = '';
  if (stageNumber === 1) payloadInput = el.projectPromptInput.value.trim();
  else if (stageNumber === 2) payloadInput = state.plans.v1.trim();
  else payloadInput = state.plans.v2.trim();

  if (!payloadInput) {
    state.phase = 'error';
    state.failedStage = stageNumber;
    updateStatusUI();
    addLog(`Aşama ${stageNumber} için girdi boş.`, 'error');
    return;
  }

  const memoryBlock =
    state.memory.summary || state.memory.techStack || state.memory.constraints
      ? `\n\n[PROJE HAFIZASI]\nÖzet: ${state.memory.summary}\nTeknoloji: ${state.memory.techStack}\nKısıtlar: ${state.memory.constraints}`
      : '';

  const fullPrompt = `${agent.rolePrompt}${memoryBlock}\n\n---\n\n${payloadInput}`;
  addLog(`Ajan ${stageNumber} (${agent.title} · ${agent.provider}) görev enjekte ediliyor...`, 'info');

  const injectRes = await window.studioAPI.injectAndSubmitPrompt(agentIndex, agent.provider, fullPrompt);
  if (!injectRes.ok) {
    state.phase = 'error';
    state.failedStage = stageNumber;
    updateStatusUI();
    addLog(`Enjeksiyon hatası: ${injectRes.error}`, 'error');
    return;
  }

  const startedAt = Date.now();
  let lastLen = 0;
  let stableSince = null;

  const pollLoop = async () => {
    if (state.phase !== 'running') return;

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, Math.ceil((STAGE_TIMEOUT_MS - elapsed) / 1000));
    el.timeoutMetaText.textContent = `Kalan süre ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

    if (elapsed >= STAGE_TIMEOUT_MS) {
      state.phase = 'error';
      state.failedStage = stageNumber;
      updateStatusUI();
      addLog(`Aşama ${stageNumber} 3 dakikalık zaman aşımına ulaştı.`, 'error');
      return;
    }

    const pollRes = await window.studioAPI.pollCompletion(agentIndex, agent.provider);
    if (!pollRes.ok) {
      state.pollTimer = setTimeout(pollLoop, POLL_INTERVAL_MS);
      return;
    }

    const s = pollRes.status;
    if (s.authWall) {
      state.phase = 'error';
      state.failedStage = stageNumber;
      updateStatusUI();
      addLog(`Ajan ${stageNumber} oturum/doğrulama duvarıyla karşılaştı.`, 'warn');
      return;
    }

    const controlsFinished = !s.stopVisible && (s.sendReady || s.latestTextLength > 0);
    if (controlsFinished && s.latestTextLength > 0) {
      if (s.latestTextLength === lastLen) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= STABILITY_WINDOW_MS) {
          await finalizeStage(stageNumber);
          return;
        }
      } else {
        lastLen = s.latestTextLength;
        stableSince = Date.now();
      }
    } else {
      lastLen = s.latestTextLength;
      stableSince = null;
    }

    state.pollTimer = setTimeout(pollLoop, POLL_INTERVAL_MS);
  };

  state.pollTimer = setTimeout(pollLoop, 1200);
}

async function finalizeStage(stageNumber) {
  const agentIndex = stageNumber - 1;
  const agent = state.agents[agentIndex];
  const extractRes = await window.studioAPI.extractLatestResponse(agentIndex, agent.provider);

  if (!extractRes.ok || !extractRes.markdown) {
    state.phase = 'error';
    state.failedStage = stageNumber;
    updateStatusUI();
    addLog(`Yanıt çıkarılamadı: ${extractRes.error || 'Boş çıktı'}`, 'error');
    return;
  }

  await savePlanToDisk(agent.planKey, extractRes.markdown);
  const newBlocks = (extractRes.codeBlocks || []).map((b) => ({ ...b, agentTitle: agent.title }));
  if (newBlocks.length) {
    state.codeBlocks = [...newBlocks, ...state.codeBlocks];
    renderCodeBlocks();
    addLog(`${newBlocks.length} adet kod bloğu sağ panele aktarıldı.`, 'info');
  }

  if (stageNumber >= 3) {
    state.phase = 'completed';
    el.timeoutMetaText.textContent = 'Süre sınırı 03:00';
    updateStatusUI();
    addLog('3 aşamalı çoklu ajan boru hattı tamamlandı.', 'success');
    await persistCheckpoint();
    return;
  }

  if (state.mode === 'manual') {
    state.phase = 'waiting_manual';
    updateStatusUI();
    addLog(`Aşama ${stageNumber} tamamlandı. 'Sonraki Ajana Aktar' bekleniyor.`, 'warn');
    await persistCheckpoint();
    return;
  }

  state.phase = 'cooldown';
  updateStatusUI();
  let left = AUTO_COOLDOWN_SECONDS;
  addLog(`Aşama ${stageNumber} tamamlandı. ${left}sn sonra Ajan ${stageNumber + 1}'e aktarılıyor...`, 'success');
  state.cooldownTimer = setInterval(() => {
    if (state.phase !== 'cooldown') return;
    left -= 1;
    el.timeoutMetaText.textContent = `Geçiş ${left}sn`;
    if (left <= 0) {
      clearInterval(state.cooldownTimer);
      state.cooldownTimer = null;
      runStage(stageNumber + 1);
    }
  }, 1000);
}

// Olay Dinleyicileri
el.btnSelectFolder.addEventListener('click', async () => {
  const res = await window.studioAPI.selectProjectFolder();
  if (res.canceled) return;
  await openProjectRoot(res.projectRoot, res.tree, res.projectRoot);
  addLog(`Proje klasörü açıldı: ${res.projectRoot}`, 'success');
});

el.btnImportZip.addEventListener('click', async () => {
  const res = await window.studioAPI.importZipProject();
  if (res.canceled) return;
  await openProjectRoot(res.projectRoot, res.tree, `${res.projectName} (${res.fileCount} dosya)`);
  addLog(`ZIP projesi içe aktarıldı: ${res.projectName}`, 'success');
  await switchToPreviewTab();
});

el.btnModeAuto.addEventListener('click', () => {
  state.mode = 'auto';
  el.btnModeAuto.classList.add('active');
  el.btnModeManual.classList.remove('active');
});

el.btnModeManual.addEventListener('click', () => {
  state.mode = 'manual';
  el.btnModeManual.classList.add('active');
  el.btnModeAuto.classList.remove('active');
});

el.btnStart.addEventListener('click', () => {
  if (!el.projectPromptInput.value.trim()) {
    addLog('Lütfen önce "Proje Fikri ve Ana Görev" alanını doldurun.', 'warn');
    return;
  }
  runStage(1);
});

el.btnPause.addEventListener('click', () => {
  if (state.phase === 'paused') {
    runStage(state.currentStage || 1);
  } else {
    clearTimers();
    state.phase = 'paused';
    updateStatusUI();
    addLog('Süreç duraklatıldı.', 'warn');
  }
});

el.btnNextAgent.addEventListener('click', () => {
  if (state.phase !== 'waiting_manual') return;
  const nextStage = state.currentStage + 1;
  if (nextStage <= 3) runStage(nextStage);
});

el.btnRetry.addEventListener('click', () => {
  runStage(state.failedStage || state.currentStage || 1);
});

el.btnReset.addEventListener('click', () => {
  clearTimers();
  state.phase = 'idle';
  state.currentStage = 0;
  state.failedStage = null;
  state.plans = { v1: '', v2: '', final: '' };
  state.codeBlocks = [];
  el.planEditor.value = '';
  el.timeoutMetaText.textContent = 'Süre sınırı 03:00';
  renderCodeBlocks();
  updateStatusUI();
  addLog('Orkestra durumu sıfırlandı.', 'info');
});

document.querySelectorAll('.plan-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.plan-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.activePlanTab = tab.dataset.plan;
    el.planEditor.value = state.plans[state.activePlanTab] || '';
  });
});

el.planEditor.addEventListener('input', () => {
  state.plans[state.activePlanTab] = el.planEditor.value;
});

el.btnSavePlan.addEventListener('click', () => {
  savePlanToDisk(state.activePlanTab, el.planEditor.value);
});

el.agentTabs.querySelectorAll('.agent-tab[data-agent]').forEach((btn) => {
  btn.addEventListener('click', () => switchToAgentTab(Number(btn.dataset.agent)));
});

el.btnPreviewTab.addEventListener('click', switchToPreviewTab);
el.btnCompilePreview.addEventListener('click', compileAndShowPreview);

el.providerSelect.addEventListener('change', () => {
  const active = state.agents[state.activeAgentIndex];
  active.provider = el.providerSelect.value;
  active.url = PROVIDER_URLS[active.provider] || active.url;
  el.urlInput.value = active.url;
  renderAgentTabs();
  window.studioAPI.navigateAgentView(state.activeAgentIndex, active.url);
});

el.btnNavigate.addEventListener('click', () => {
  const active = state.agents[state.activeAgentIndex];
  active.url = el.urlInput.value.trim();
  window.studioAPI.navigateAgentView(state.activeAgentIndex, active.url);
});

el.urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.btnNavigate.click();
});

el.btnReloadView.addEventListener('click', () => {
  window.studioAPI.reloadAgentView(state.activeAgentIndex);
});

el.rolePromptInput.addEventListener('input', () => {
  state.agents[state.activeAgentIndex].rolePrompt = el.rolePromptInput.value;
});

el.btnToggleRole.addEventListener('click', () => {
  const collapsed = el.rolePromptInput.classList.toggle('collapsed');
  el.btnToggleRole.textContent = collapsed ? 'Genişlet' : 'Daralt';
  setTimeout(syncBounds, 50);
});

el.btnClearLogs.addEventListener('click', () => {
  el.logContainer.innerHTML = '';
});

el.btnManualExtract.addEventListener('click', async () => {
  const active = state.agents[state.activeAgentIndex];
  const res = await window.studioAPI.extractLatestResponse(active.id, active.provider);
  if (!res.ok) {
    addLog(`Manuel tarama başarısız: ${res.error}`, 'warn');
    return;
  }
  const blocks = (res.codeBlocks || []).map((b) => ({ ...b, agentTitle: active.title }));
  state.codeBlocks = [...blocks, ...state.codeBlocks];
  renderCodeBlocks();
  addLog(`${active.title} sekmesinden ${blocks.length} kod bloğu çıkarıldı.`, 'success');
});

el.btnCloseDiff.addEventListener('click', closeDiffModal);
el.btnCancelDiff.addEventListener('click', closeDiffModal);
el.btnConfirmApply.addEventListener('click', async () => {
  if (!state.pendingApply || !state.projectRoot) return;
  const { targetRel, content } = state.pendingApply;
  const res = await window.studioAPI.writeFileWithBackup(state.projectRoot, targetRel, content, true);
  await closeDiffModal();
  if (res.ok) {
    addLog(
      `${res.relPath} güncellendi${res.backupRelPath ? ` (Yedek: ${res.backupRelPath})` : ''}.`,
      'success'
    );
    refreshTreeHighlight();
    if (state.centerMode === 'preview') await compileAndShowPreview();
  } else {
    addLog(`Yazma hatası: ${res.error}`, 'error');
  }
});

// Proje Hafızası Modalı
el.btnOpenMemory.addEventListener('click', async () => {
  el.memSummaryInput.value = state.memory.summary || '';
  el.memStackInput.value = state.memory.techStack || '';
  el.memConstraintsInput.value = state.memory.constraints || '';
  await window.studioAPI.setViewsVisible(false);
  el.memoryModal.hidden = false;
});

async function closeMemoryModal() {
  el.memoryModal.hidden = true;
  if (state.centerMode === 'agent') await window.studioAPI.setViewsVisible(true);
}

el.btnCloseMemory.addEventListener('click', closeMemoryModal);
el.btnCancelMemory.addEventListener('click', closeMemoryModal);
el.btnSaveMemory.addEventListener('click', async () => {
  state.memory = {
    summary: el.memSummaryInput.value.trim(),
    techStack: el.memStackInput.value.trim(),
    constraints: el.memConstraintsInput.value.trim(),
  };
  if (state.projectRoot) {
    await window.studioAPI.saveProjectMemory(state.projectRoot, state.memory);
    addLog('Proje hafızası (.studio-memory.json) kaydedildi.', 'success');
  }
  await closeMemoryModal();
});

// Harici Seçici Düzenleyici Modalı
el.btnOpenSelectors.addEventListener('click', async () => {
  const res = await window.studioAPI.loadSelectors();
  if (!res.ok) {
    addLog(`selectors.json okunamadı: ${res.error}`, 'error');
    return;
  }
  el.selectorsJsonEditor.value = JSON.stringify(res.selectors, null, 2);
  el.selectorsErrorText.hidden = true;
  await window.studioAPI.setViewsVisible(false);
  el.selectorsModal.hidden = false;
});

async function closeSelectorsModal() {
  el.selectorsModal.hidden = true;
  if (state.centerMode === 'agent') await window.studioAPI.setViewsVisible(true);
}

el.btnCloseSelectors.addEventListener('click', closeSelectorsModal);
el.btnCancelSelectors.addEventListener('click', closeSelectorsModal);
el.btnSaveSelectors.addEventListener('click', async () => {
  try {
    const parsed = JSON.parse(el.selectorsJsonEditor.value);
    const saveRes = await window.studioAPI.saveSelectors(parsed);
    if (!saveRes.ok) throw new Error(saveRes.error);
    await closeSelectorsModal();
    addLog('Harici selectors.json yapılandırması kaydedildi.', 'success');
  } catch (err) {
    el.selectorsErrorText.textContent = `JSON Hatası: ${err.message}`;
    el.selectorsErrorText.hidden = false;
  }
});

function setupResizer(resizerEl, side) {
  let dragging = false;
  resizerEl.addEventListener('mousedown', () => {
    dragging = true;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const totalW = window.innerWidth;
    const leftW = side === 'left' ? Math.max(240, Math.min(480, e.clientX)) : el.paneLeft.offsetWidth;
    const rightW =
      side === 'right'
        ? Math.max(260, Math.min(520, totalW - e.clientX))
        : el.paneRight.offsetWidth;
    el.workspace.style.gridTemplateColumns = `${leftW}px 5px 1fr 5px ${rightW}px`;
    syncBounds();
  });
  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = '';
      syncBounds();
    }
  });
}

setupResizer(el.resizerLeft, 'left');
setupResizer(el.resizerRight, 'right');

if (window.studioAPI) {
  window.studioAPI.onViewUrlChanged(({ agentIndex, url }) => {
    state.agents[agentIndex].url = url;
    if (agentIndex === state.activeAgentIndex) el.urlInput.value = url;
  });

  window.studioAPI.onViewLoadFailed(({ agentIndex, errorDescription, url }) => {
    addLog(`Ajan ${agentIndex + 1} sayfa yükleme hatası (${url}): ${errorDescription}`, 'error');
  });

  const resizeObserver = new ResizeObserver(() => syncBounds());
  resizeObserver.observe(el.webViewHost);
}

renderAgentTabs();
updateStatusUI();
addLog('Multi-Agent AI Browser Studio başlatıldı. 3 WebContentsView arka planda hazır.', 'info');
