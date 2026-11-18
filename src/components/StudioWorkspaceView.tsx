import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  Brain,
  Download,
  FileArchive,
  FolderPlus,
  FolderUp,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { createDefaultAgents, createSampleProjects } from '../data/projectTemplates';
import { DEFAULT_SELECTORS_RAW } from '../data/workspaceBundles';
import {
  ExtractedBlock,
  LogEntry,
  Mode,
  PlanKey,
  ProjectMemory,
  ProjectWorkspace,
  ProviderKey,
} from '../types/project';
import { buildZipBlob } from '../utils/zipBuilder';
import { parseZipArrayBuffer } from '../utils/zipReader';
import { LivePreviewStage } from './LivePreviewStage';
import { ProjectMemoryModal } from './ProjectMemoryModal';

interface DiffRow {
  type: 'ctx' | 'add' | 'del';
  text: string;
}

const STORAGE_KEY = 'ma_studio_projects_v1';

const PROVIDER_URLS: Record<ProviderKey, string> = {
  gemini: 'https://gemini.google.com/app',
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  deepseek: 'https://chat.deepseek.com/',
};

function detectTechStack(files: Record<string, string>): string {
  const keys = Object.keys(files);
  if (keys.some((k) => /\.(tsx|jsx)$/.test(k))) return 'React · TypeScript / JSX';
  if (keys.some((k) => k.endsWith('.html')) && keys.some((k) => files[k].includes('<canvas'))) {
    return 'HTML5 Canvas · JavaScript';
  }
  if (keys.some((k) => k.endsWith('.html'))) return 'HTML5 · CSS · JavaScript';
  return 'Özel Proje';
}

function computeLineDiff(oldText: string, newText: string): DiffRow[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText.split('\n');
  const rows: DiffRow[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      rows.push({ type: 'ctx', text: `  ${n}` });
    } else {
      if (o !== undefined) rows.push({ type: 'del', text: `- ${o}` });
      if (n !== undefined) rows.push({ type: 'add', text: `+ ${n}` });
    }
  }
  return rows;
}

function buildContextAwareOutput(
  stage: number,
  project: ProjectWorkspace,
  prevPlan: string
): { markdown: string; blocks: Omit<ExtractedBlock, 'id' | 'agentTitle'>[] } {
  const isCanvasGame =
    Boolean(project.files['game.js']) ||
    Object.values(project.files).some((c) => c.includes('<canvas') || c.includes('getContext(\'2d\')'));
  const isReactApp = Object.keys(project.files).some((k) => /\.(tsx|jsx)$/.test(k));
  const memContext = `Hafıza: ${project.memory.techStack} · ${project.memory.architectureSummary}`;

  if (stage === 1) {
    const md = `# Mimari Taslak (plan_v1.md)\n\n## Proje Bağlamı ve Hafıza\n${memContext}\n\n## Görev\n${project.projectIdea}\n\n## Ajan 1 Planı\n- Mevcut dosya ağacı (${Object.keys(project.files).length} dosya) analiz edildi.\n- Kısıt uyumu: ${project.memory.constraints || 'Standart tarayıcı uyumluluğu'}.\n- Hedef modüllerde geriye dönük uyumlu güncelleme stratejisi belirlendi.`;
    return { markdown: md, blocks: [] };
  }

  if (stage === 2) {
    const md = `# Denetlenmiş Plan (plan_v2.md)\n\n## Mimari ve Güvenlik Denetimi\n1. Önceki plan kontrol edildi: ${prevPlan.slice(0, 120)}...\n2. Çalışma zamanı bellek sızıntıları (temizlenmeyen zamanlayıcılar / olay dinleyicileri) ve boş girdi durumları için koruma eklendi.\n3. Durum güncellemelerinde dosya yedekleme (.bak) sırası doğrulandı.`;
    return { markdown: md, blocks: [] };
  }

  if (isCanvasGame && project.files['game.js']) {
    const upgradedGame = `${project.files['game.js'].replace(
      "ctx.fillStyle = '#f43f5e';",
      "ctx.fillStyle = '#fb7185';"
    )}\n// Başmühendis Notu: Dalga seviyesi ve yüksek skor göstergesi eklendi\n`;
    const md = `# Nihai Uygulama Planı (plan_final.md)\n\n## Uygulanan Güncellemeler\n- \`game.js\`: Görsel kontrast iyileştirildi ve proje hafızasına kaydedildi.\n\n\`\`\`javascript\n// file: game.js\n${upgradedGame}\`\`\``;
    return {
      markdown: md,
      blocks: [
        {
          language: 'javascript',
          fileHint: 'game.js',
          code: upgradedGame,
        },
      ],
    };
  }

  if (isReactApp && project.files['src/App.tsx']) {
    const currentApp = project.files['src/App.tsx'];
    const upgradedApp = currentApp.includes('Proje Görev Panosu')
      ? currentApp.replace('Proje Görev Panosu', 'Proje Görev Panosu · Orkestra Güncellemesi')
      : currentApp;
    const md = `# Nihai Uygulama Planı (plan_final.md)\n\n## Uygulanan Güncellemeler\n- \`src/App.tsx\`: Bileşen başlığı ve durum akışı güncellendi.\n\n\`\`\`tsx\n// file: src/App.tsx\n${upgradedApp}\n\`\`\``;
    return {
      markdown: md,
      blocks: [
        {
          language: 'tsx',
          fileHint: 'src/App.tsx',
          code: upgradedApp,
        },
      ],
    };
  }

  const firstCodeFile =
    Object.keys(project.files).find((k) => /\.(tsx?|jsx?|js|html|css)$/.test(k)) || 'index.html';
  const existingCode = project.files[firstCodeFile] || '<!-- Yeni dosya -->';
  const md = `# Nihai Uygulama Planı (plan_final.md)\n\n## Güncellenen Hedef Dosya\n- \`${firstCodeFile}\`\n\n\`\`\`text\n// file: ${firstCodeFile}\n${existingCode}\n\`\`\``;
  return {
    markdown: md,
    blocks: [{ language: 'text', fileHint: firstCodeFile, code: existingCode }],
  };
}

function loadInitialProjects(): { projects: ProjectWorkspace[]; activeId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { projects: ProjectWorkspace[]; activeId: string };
      if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Varsayılan şablonlara dön
  }
  const samples = createSampleProjects();
  return { projects: samples, activeId: samples[0].id };
}

export function StudioWorkspaceView() {
  const initialRef = useRef(loadInitialProjects());
  const [projects, setProjects] = useState<ProjectWorkspace[]>(initialRef.current.projects);
  const [activeProjectId, setActiveProjectId] = useState<string>(initialRef.current.activeId);

  const [leftWidth, setLeftWidth] = useState(325);
  const [rightWidth, setRightWidth] = useState(350);
  const draggingSide = useRef<'left' | 'right' | null>(null);

  const [centerMode, setCenterMode] = useState<'agent' | 'preview'>('preview');
  const [activeAgentIdx, setActiveAgentIdx] = useState(0);
  const [roleCollapsed, setRoleCollapsed] = useState(false);

  const [leftEditorTab, setLeftEditorTab] = useState<PlanKey | 'file'>('file');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [targetFileInput, setTargetFileInput] = useState<string>('');
  const [compileNonce, setCompileNonce] = useState(1);

  const [countdownLabel, setCountdownLabel] = useState('Süre sınırı 03:00');
  const [verificationState, setVerificationState] = useState('Beklemede');
  const [simulateNextError, setSimulateNextError] = useState(false);

  const [diffModalBlock, setDiffModalBlock] = useState<{
    targetRel: string;
    oldContent: string;
    newContent: string;
    rows: DiffRow[];
  } | null>(null);

  const [selectorsModalOpen, setSelectorsModalOpen] = useState(false);
  const [selectorsText, setSelectorsText] = useState(DEFAULT_SELECTORS_RAW);
  const [selectorsError, setSelectorsError] = useState<string | null>(null);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const activeIdRef = useRef(activeProject.id);
  activeIdRef.current = activeProject.id;

  const simulateErrRef = useRef(simulateNextError);
  simulateErrRef.current = simulateNextError;

  // Projeleri yerel belleğe kalıcı olarak kaydet
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projects, activeId: activeProject.id })
      );
    } catch {
      // Depolama kotası aşılırsa sessizce geç
    }
  }, [projects, activeProject.id]);

  // Proje değiştiğinde ilk uygun dosyayı seç
  useEffect(() => {
    const keys = Object.keys(activeProject.files).sort();
    if (keys.length > 0 && !activeProject.files[selectedFile]) {
      const preferred =
        keys.find((k) => k === 'game.js' || k === 'src/App.tsx' || k === 'index.html') || keys[0];
      setSelectedFile(preferred);
      setTargetFileInput(preferred);
    } else if (keys.length === 0) {
      setSelectedFile('');
      setTargetFileInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject.id]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingSide.current) return;
      if (draggingSide.current === 'left') {
        setLeftWidth(Math.max(250, Math.min(460, e.clientX)));
      } else {
        setRightWidth(Math.max(270, Math.min(500, window.innerWidth - e.clientX)));
      }
    };
    const onUp = () => {
      draggingSide.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const updateProjectById = (
    projId: string,
    updater: (prev: ProjectWorkspace) => ProjectWorkspace
  ) => {
    setProjects((prevList) =>
      prevList.map((p) => (p.id === projId ? { ...updater(p), updatedAt: new Date().toISOString() } : p))
    );
  };

  const updateActiveProject = (updater: (prev: ProjectWorkspace) => ProjectWorkspace) => {
    updateProjectById(activeIdRef.current, updater);
  };

  const appendLog = (
    message: string,
    level: LogEntry['level'] = 'info',
    projId: string = activeIdRef.current
  ) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toTimeString().slice(0, 8),
      message,
      level,
    };
    updateProjectById(projId, (p) => ({ ...p, logs: [...p.logs, entry] }));
  };

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const runStage = (stage: number, targetProjId: string = activeIdRef.current) => {
    clearTimers();
    const proj = projectsRef.current.find((p) => p.id === targetProjId);
    if (!proj) return;

    const agentIndex = stage - 1;
    const agent = proj.agents[agentIndex];
    setActiveAgentIdx(agentIndex);
    setCenterMode('agent');
    setCountdownLabel('Kalan süre 02:58');
    setVerificationState('Proje hafızası eklendi · Pano + webContents.paste() ile gönderiliyor...');

    const inputText =
      stage === 1
        ? proj.projectIdea.trim()
        : stage === 2
          ? proj.plans.v1.trim()
          : proj.plans.v2.trim();

    if (!inputText) {
      updateProjectById(targetProjId, (p) => ({
        ...p,
        phase: 'error',
        currentStage: stage,
        failedStage: stage,
      }));
      setVerificationState('Hata: Aşama girdisi boş');
      appendLog(`Aşama ${stage} için girdi boş olduğu için durduruldu.`, 'error', targetProjId);
      return;
    }

    updateProjectById(targetProjId, (p) => ({
      ...p,
      phase: 'running',
      currentStage: stage,
      failedStage: null,
    }));

    appendLog(
      `Ajan ${stage} (${agent.title} · ${agent.provider}) proje hafızası ile tetiklendi.`,
      'info',
      targetProjId
    );

    timerRef.current = window.setTimeout(() => {
      const latestProj = projectsRef.current.find((p) => p.id === targetProjId);
      if (!latestProj || latestProj.phase !== 'running') return;

      if (simulateErrRef.current) {
        setSimulateNextError(false);
        updateProjectById(targetProjId, (p) => ({
          ...p,
          phase: 'error',
          failedStage: stage,
        }));
        setCountdownLabel('Zaman aşımı 00:00');
        setVerificationState('Zaman aşımı (3dk) veya boş yanıt — Tekrar Dene bekleniyor');
        appendLog(
          `Ajan ${stage} yanıt vermedi (simüle edilen timeout). 'Tekrar Dene' ile kurtarabilirsiniz.`,
          'error',
          targetProjId
        );
        return;
      }

      setVerificationState('Stop butonu kayboldu · 3.0sn metin sabitliği doğrulanıyor...');
      appendLog(`Ajan ${stage} akışı tamamlandı; çift doğrulamalı sabitlik kontrol ediliyor...`, 'info', targetProjId);

      timerRef.current = window.setTimeout(() => {
        const currentProj = projectsRef.current.find((p) => p.id === targetProjId);
        if (!currentProj || currentProj.phase !== 'running') return;

        const prevPlan = stage === 2 ? currentProj.plans.v1 : currentProj.plans.v2;
        const output = buildContextAwareOutput(stage, currentProj, prevPlan);

        const extracted: ExtractedBlock[] = output.blocks.map((b, i) => ({
          ...b,
          id: `${stage}-${Date.now()}-${i}`,
          agentTitle: agent.title,
        }));

        const memoryItem = {
          id: `mem-${Date.now()}`,
          timestamp: new Date().toTimeString().slice(0, 8),
          agentTitle: agent.title,
          stage,
          summary: `${agent.planFile} üretildi (${extracted.length} kod bloğu).`,
        };

        updateProjectById(targetProjId, (p) => ({
          ...p,
          plans: { ...p.plans, [agent.planKey]: output.markdown },
          files: { ...p.files, [agent.planFile]: output.markdown },
          codeBlocks: [...extracted, ...p.codeBlocks],
          agents: p.agents.map((a, idx) =>
            idx === agentIndex ? { ...a, lastTranscript: output.markdown } : a
          ),
          memory: {
            ...p.memory,
            history: [memoryItem, ...p.memory.history].slice(0, 20),
          },
        }));

        setLeftEditorTab(agent.planKey);
        setVerificationState('Turndown HTML -> Markdown tamamlandı ve proje hafızasına işlendi');
        appendLog(
          `${agent.planFile} proje klasörüne ve hafızasına kaydedildi (${extracted.length} kod bloğu).`,
          'success',
          targetProjId
        );

        if (stage >= 3) {
          updateProjectById(targetProjId, (p) => ({ ...p, phase: 'completed' }));
          setCountdownLabel('Tamamlandı');
          appendLog('3 aşamalı çoklu ajan boru hattı tamamlandı.', 'success', targetProjId);
          return;
        }

        if (currentProj.mode === 'manual') {
          updateProjectById(targetProjId, (p) => ({ ...p, phase: 'waiting_manual' }));
          setCountdownLabel('Onay bekleniyor');
          appendLog(
            `Aşama ${stage} tamamlandı. Kontrol edip 'Sonraki Ajana Aktar' butonuna basın.`,
            'warn',
            targetProjId
          );
          return;
        }

        updateProjectById(targetProjId, (p) => ({ ...p, phase: 'cooldown' }));
        let secLeft = 4;
        setCountdownLabel(`Geçiş ${secLeft}sn`);
        appendLog(`Otomatik Mod: ${secLeft} saniye sonra Ajan ${stage + 1} başlayacak...`, 'info', targetProjId);
        intervalRef.current = window.setInterval(() => {
          secLeft -= 1;
          setCountdownLabel(`Geçiş ${secLeft}sn`);
          if (secLeft <= 0) {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            runStage(stage + 1, targetProjId);
          }
        }, 1000);
      }, 850);
    }, 900);
  };

  const handleZipUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const extractedFiles = await parseZipArrayBuffer(buffer);
      const count = Object.keys(extractedFiles).length;
      if (count === 0) {
        appendLog('ZIP arşivinde okunabilir metin/kod dosyası bulunamadı.', 'warn');
        return;
      }

      const cleanName = file.name.replace(/\.zip$/i, '');
      const stack = detectTechStack(extractedFiles);
      const now = new Date().toISOString();
      const newProj: ProjectWorkspace = {
        id: `proj-zip-${Date.now()}`,
        name: cleanName,
        sourceLabel: `ZIP Arşivi · ${count} dosya`,
        createdAt: now,
        updatedAt: now,
        files: extractedFiles,
        projectIdea: `${cleanName} projesini analiz et, hataları gider ve yeni özellikler ekle.`,
        mode: 'auto',
        phase: 'idle',
        currentStage: 0,
        failedStage: null,
        plans: { v1: '', v2: '', final: '' },
        codeBlocks: [],
        logs: [
          {
            id: `zip-${Date.now()}`,
            time: new Date().toTimeString().slice(0, 8),
            message: `${file.name} içe aktarıldı (${count} dosya · ${stack}) ve otomatik derlemeye alındı.`,
            level: 'success',
          },
        ],
        agents: createDefaultAgents(),
        memory: {
          architectureSummary: `${cleanName} projesi ZIP arşivinden içe aktarıldı (${count} dosya).`,
          techStack: stack,
          constraints: 'Mevcut giriş dosyası ve modül bağlantıları bozulmamalı.',
          decisions: [],
          history: [],
        },
      };

      setProjects((prev) => [newProj, ...prev]);
      setActiveProjectId(newProj.id);
      setCenterMode('preview');
      setCompileNonce((n) => n + 1);
    } catch (err) {
      appendLog(`ZIP okuma hatası: ${(err as Error).message}`, 'error');
    }
  };

  const handleFolderUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.DS_Store']);
    const textFiles: Record<string, string> = {};
    let rootFolderName = 'Yüklenen Klasör';

    for (let i = 0; i < fileList.length; i += 1) {
      const f = fileList[i];
      const relRaw = f.webkitRelativePath || f.name;
      const parts = relRaw.split('/').filter(Boolean);
      if (i === 0 && parts.length > 1) {
        rootFolderName = parts[0];
      }
      if (parts.some((p) => ignored.has(p))) continue;
      if (f.size > 400_000) continue;
      if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp3|wav|mp4|zip|exe|pdf)$/i.test(f.name)) continue;

      const relPath = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
      textFiles[relPath] = await f.text();
    }
    e.target.value = '';

    const count = Object.keys(textFiles).length;
    if (count === 0) {
      appendLog('Seçilen klasörde uygun kod/metin dosyası bulunamadı.', 'warn');
      return;
    }

    const stack = detectTechStack(textFiles);
    const now = new Date().toISOString();
    const newProj: ProjectWorkspace = {
      id: `proj-dir-${Date.now()}`,
      name: rootFolderName,
      sourceLabel: `Yerel Klasör · ${count} dosya`,
      createdAt: now,
      updatedAt: now,
      files: textFiles,
      projectIdea: `${rootFolderName} projesini incele ve geliştir.`,
      mode: 'auto',
      phase: 'idle',
      currentStage: 0,
      failedStage: null,
      plans: { v1: '', v2: '', final: '' },
      codeBlocks: [],
      logs: [
        {
          id: `dir-${Date.now()}`,
          time: new Date().toTimeString().slice(0, 8),
          message: `${rootFolderName} klasörü yüklendi (${count} dosya · ${stack}).`,
          level: 'success',
        },
      ],
      agents: createDefaultAgents(),
      memory: {
        architectureSummary: `${rootFolderName} yerel klasör olarak içe aktarıldı (${count} dosya).`,
        techStack: stack,
        constraints: 'Klasör yapısını ve çalışan giriş noktasını koru.',
        decisions: [],
        history: [],
      },
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setCenterMode('preview');
    setCompileNonce((n) => n + 1);
  };

  const handleCreateEmptyProject = () => {
    const clean = newProjectName.trim() || `Yeni Proje ${projects.length + 1}`;
    const now = new Date().toISOString();
    const newProj: ProjectWorkspace = {
      id: `proj-new-${Date.now()}`,
      name: clean,
      sourceLabel: 'Özel Çalışma Alanı',
      createdAt: now,
      updatedAt: now,
      files: {
        'index.html': `<!doctype html>\n<html lang="tr">\n<head><meta charset="UTF-8" /><title>${clean}</title><link rel="stylesheet" href="style.css" /></head>\n<body>\n  <main class="box">\n    <h1>${clean}</h1>\n    <p id="status">Çalışma alanı hazır.</p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>`,
        'style.css': `body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0f17; color: #f1f5f9; font-family: system-ui, sans-serif; }\n.box { padding: 24px 32px; border: 1px solid #1f2937; border-radius: 8px; background: #111827; text-align: center; }`,
        'app.js': `console.log('${clean} başlatıldı');`,
      },
      projectIdea: `${clean} için interaktif bir web uygulaması veya oyun geliştir.`,
      mode: 'auto',
      phase: 'idle',
      currentStage: 0,
      failedStage: null,
      plans: { v1: '', v2: '', final: '' },
      codeBlocks: [],
      logs: [
        {
          id: `new-${Date.now()}`,
          time: new Date().toTimeString().slice(0, 8),
          message: `${clean} projesi kendi izole hafızasıyla oluşturuldu.`,
          level: 'success',
        },
      ],
      agents: createDefaultAgents(),
      memory: {
        architectureSummary: `${clean} için sıfırdan oluşturulan izole çalışma alanı.`,
        techStack: 'HTML5 · CSS3 · JavaScript',
        constraints: '',
        decisions: [],
        history: [],
      },
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setNewProjectName('');
    setNewProjectModalOpen(false);
    setCenterMode('preview');
    setCompileNonce((n) => n + 1);
  };

  const handleExportActiveProjectZip = () => {
    const entries = Object.entries(activeProject.files)
      .filter(([path]) => !path.startsWith('.studio-backups/'))
      .map(([path, content]) => ({ name: path, content }));
    const blob = buildZipBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog(`${activeProject.name} ZIP arşivi olarak dışa aktarıldı.`, 'info');
  };

  const handleSaveEditor = () => {
    if (leftEditorTab === 'file') {
      if (!selectedFile) return;
      const oldContent = activeProject.files[selectedFile];
      const nextFiles = { ...activeProject.files };
      if (oldContent !== undefined && oldContent !== activeProject.files[selectedFile]) {
        // Dosya zaten düzenlendikçe güncelleniyor
      }
      updateActiveProject((p) => ({ ...p, files: nextFiles }));
      setCompileNonce((n) => n + 1);
      appendLog(`${selectedFile} kaydedildi ve önizleme yeniden derlendi.`, 'success');
      return;
    }

    const fileMap: Record<PlanKey, string> = {
      v1: 'plan_v1.md',
      v2: 'plan_v2.md',
      final: 'plan_final.md',
    };
    const fileName = fileMap[leftEditorTab];
    const nextContent = activeProject.plans[leftEditorTab];
    const existing = activeProject.files[fileName];
    const nextFiles = { ...activeProject.files, [fileName]: nextContent };
    if (existing !== undefined && existing !== nextContent) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      nextFiles[`.studio-backups/${fileName}.${stamp}.bak`] = existing;
    }
    updateActiveProject((p) => ({ ...p, files: nextFiles }));
    appendLog(`${fileName} proje klasörüne kaydedildi.`, 'success');
  };

  const handleOpenDiff = (block: ExtractedBlock) => {
    const target = (targetFileInput || block.fileHint || '').trim();
    if (!target) {
      appendLog('Lütfen hedef dosya seçin veya yol yazın.', 'warn');
      return;
    }
    const oldContent = activeProject.files[target] ?? '';
    setDiffModalBlock({
      targetRel: target,
      oldContent,
      newContent: block.code,
      rows: computeLineDiff(oldContent, block.code),
    });
  };

  const handleConfirmApply = () => {
    if (!diffModalBlock) return;
    const { targetRel, oldContent, newContent } = diffModalBlock;
    const nextFiles = { ...activeProject.files, [targetRel]: newContent };
    let backupName = '';
    if (activeProject.files[targetRel] !== undefined) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupName = `.studio-backups/${targetRel.replace(/\//g, '__')}.${stamp}.bak`;
      nextFiles[backupName] = oldContent;
    }
    updateActiveProject((p) => ({ ...p, files: nextFiles }));
    setSelectedFile(targetRel);
    setDiffModalBlock(null);
    setCompileNonce((n) => n + 1);
    setCenterMode('preview');
    appendLog(
      `${targetRel} güncellendi ve derlendi${backupName ? ` (Yedek: ${backupName})` : ''}.`,
      'success'
    );
  };

  const handleApplyAllBlocksAndCompile = () => {
    if (activeProject.codeBlocks.length === 0) return;
    const nextFiles = { ...activeProject.files };
    let appliedCount = 0;

    activeProject.codeBlocks.forEach((block) => {
      const target = (block.fileHint || targetFileInput || '').trim();
      if (!target) return;
      if (nextFiles[target] !== undefined) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        nextFiles[`.studio-backups/${target.replace(/\//g, '__')}.${stamp}.bak`] = nextFiles[target];
      }
      nextFiles[target] = block.code;
      appliedCount += 1;
    });

    if (appliedCount === 0) {
      appendLog('Otomatik dosya yolu ipucu bulunamadı; tek tek uygulayın.', 'warn');
      return;
    }

    updateActiveProject((p) => ({ ...p, files: nextFiles }));
    setCompileNonce((n) => n + 1);
    setCenterMode('preview');
    appendLog(`${appliedCount} kod bloğu yedeklenerek projeye uygulandı ve canlı derlendi.`, 'success');
  };

  const activeAgent = activeProject.agents[activeAgentIdx] || activeProject.agents[0];
  const sortedFilePaths = Object.keys(activeProject.files).sort();

  const statusTextMap: Record<ProjectWorkspace['phase'], { text: string; cls: string }> = {
    idle: { text: 'Hazır', cls: 'text-slate-400' },
    running: { text: 'Çalışıyor', cls: 'text-sky-400' },
    waiting_manual: { text: 'Manuel Onay Bekleniyor', cls: 'text-amber-400' },
    cooldown: { text: 'Sonraki Ajana Geçiliyor', cls: 'text-sky-400' },
    paused: { text: 'Duraklatıldı', cls: 'text-amber-400' },
    completed: { text: 'Tamamlandı', cls: 'text-emerald-400' },
    error: { text: 'Hata / Zaman Aşımı', cls: 'text-rose-400' },
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Gizli Dosya / Klasör Yükleme Girdileri */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleZipUpload}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory standart dışı tarayıcı özelliğidir
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderUpload}
      />

      {/* Proje Orkestra Araç Çubuğu */}
      <div className="h-11 shrink-0 px-4 bg-[#0E1420] border-b border-[#1F2937] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Aktif Proje</span>
          <select
            value={activeProject.id}
            onChange={(e) => {
              clearTimers();
              setActiveProjectId(e.target.value);
              setCompileNonce((n) => n + 1);
            }}
            className="bg-[#161E2E] border border-[#1F2937] rounded px-2.5 py-1 text-xs font-medium text-slate-100 outline-none max-w-[240px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setNewProjectModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <FolderPlus className="w-3 h-3" />
            Yeni Proje
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <FolderUp className="w-3 h-3" />
            Klasör Yükle
          </button>
          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <FileArchive className="w-3 h-3" />
            ZIP Yükle
          </button>
          <button
            type="button"
            onClick={handleExportActiveProjectZip}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <Download className="w-3 h-3" />
            Projeyi ZIP İndir
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-2 text-xs whitespace-nowrap">
            <span className={`font-semibold ${statusTextMap[activeProject.phase].cls}`}>
              {statusTextMap[activeProject.phase].text}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-300">Aşama {activeProject.currentStage}/3</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{countdownLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => setMemoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#161E2E] hover:bg-slate-800 text-sky-300 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <Brain className="w-3.5 h-3.5" />
            Proje Hafızası ({activeProject.memory.history.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectorsError(null);
              setSelectorsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            selectors.json
          </button>
        </div>
      </div>

      {/* 3 Sütunlu Bölünmüş Çalışma Alanı */}
      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: `${leftWidth}px 5px 1fr 5px ${rightWidth}px` }}
      >
        {/* SOL PANEL */}
        <aside className="bg-[#111827] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b border-[#1F2937] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-100">Proje Dosyaları</h2>
              <span className="font-mono text-[11px] text-slate-400">
                {sortedFilePaths.length} dosya
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 bg-[#161E2E] border border-[#1F2937] rounded px-2 py-1 truncate">
              {activeProject.sourceLabel}
            </div>
            <div className="max-h-28 overflow-y-auto bg-[#0B0F17] border border-[#1F2937] rounded p-1 space-y-0.5">
              {sortedFilePaths.map((filePath) => (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => {
                    setSelectedFile(filePath);
                    setTargetFileInput(filePath);
                    setLeftEditorTab('file');
                  }}
                  className={`w-full text-left font-mono text-[11px] px-2 py-1 rounded truncate cursor-pointer ${
                    selectedFile === filePath
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-slate-400 hover:bg-[#161E2E] hover:text-slate-200'
                  }`}
                >
                  {filePath}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 border-b border-[#1F2937] flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-slate-100">Proje Görevi (Hafızaya Bağlı)</h2>
            <textarea
              value={activeProject.projectIdea}
              onChange={(e) => {
                const val = e.target.value;
                updateActiveProject((p) => ({ ...p, projectIdea: val }));
              }}
              rows={3}
              className="w-full bg-[#0B0F17] border border-[#1F2937] focus:border-blue-600 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none resize-none"
              placeholder="Ajanların bu proje üzerinde ne geliştirmesini istiyorsunuz?"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Çalışma Modu</span>
              <div className="inline-flex bg-[#0B0F17] border border-[#1F2937] rounded p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => updateActiveProject((p) => ({ ...p, mode: 'auto' as Mode }))}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer ${
                    activeProject.mode === 'auto'
                      ? 'bg-[#161E2E] text-slate-100 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Otomatik (4sn)
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveProject((p) => ({ ...p, mode: 'manual' as Mode }))}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer ${
                    activeProject.mode === 'manual'
                      ? 'bg-[#161E2E] text-slate-100 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Manuel Onay
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={
                  activeProject.phase === 'running' ||
                  activeProject.phase === 'cooldown' ||
                  activeProject.phase === 'waiting_manual'
                }
                onClick={() => runStage(1)}
                className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded cursor-pointer disabled:cursor-not-allowed"
              >
                Süreci Başlat
              </button>
              <button
                type="button"
                disabled={
                  activeProject.phase !== 'running' &&
                  activeProject.phase !== 'cooldown' &&
                  activeProject.phase !== 'paused'
                }
                onClick={() => {
                  if (activeProject.phase === 'paused') {
                    runStage(activeProject.currentStage || 1);
                  } else {
                    clearTimers();
                    updateActiveProject((p) => ({ ...p, phase: 'paused' }));
                    setCountdownLabel('Duraklatıldı');
                    appendLog('Boru hattı duraklatıldı.', 'warn');
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-[#161E2E] hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-[#1F2937] rounded cursor-pointer disabled:cursor-not-allowed"
              >
                {activeProject.phase === 'paused' ? 'Devam Et' : 'Duraklat'}
              </button>
              <button
                type="button"
                disabled={activeProject.phase !== 'waiting_manual'}
                onClick={() => runStage(activeProject.currentStage + 1)}
                className="px-2.5 py-1.5 text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 text-sky-300 border border-sky-500/30 rounded cursor-pointer disabled:cursor-not-allowed"
              >
                Sonraki Ajana Aktar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearTimers();
                  updateActiveProject((p) => ({
                    ...p,
                    phase: 'idle',
                    currentStage: 0,
                    failedStage: null,
                    plans: { v1: '', v2: '', final: '' },
                    codeBlocks: [],
                    agents: createDefaultAgents(),
                  }));
                  setCountdownLabel('Süre sınırı 03:00');
                  setVerificationState('Beklemede');
                  appendLog('Proje orkestra durumu sıfırlandı.', 'info');
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-transparent hover:border-rose-600 text-rose-300 border border-[#1F2937] rounded cursor-pointer"
              >
                Sıfırla
              </button>
            </div>

            {activeProject.phase === 'error' && (
              <button
                type="button"
                onClick={() => runStage(activeProject.failedStage || activeProject.currentStage || 1)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tekrar Dene (Aşama {activeProject.failedStage || activeProject.currentStage || 1})
              </button>
            )}
          </div>

          <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-100">
                {leftEditorTab === 'file' ? selectedFile || 'Dosya Editörü' : 'Plan Düzenleyici'}
              </h2>
              <button
                type="button"
                onClick={handleSaveEditor}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                <Save className="w-3 h-3" />
                Kaydet &amp; Derle
              </button>
            </div>
            <div className="flex gap-1 border-b border-[#1F2937] pb-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setLeftEditorTab('file')}
                className={`font-mono text-[11px] px-2 py-1 rounded cursor-pointer shrink-0 ${
                  leftEditorTab === 'file'
                    ? 'bg-[#161E2E] text-slate-100 border border-[#1F2937]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dosya
              </button>
              {(['v1', 'v2', 'final'] as PlanKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLeftEditorTab(key)}
                  className={`font-mono text-[11px] px-2 py-1 rounded cursor-pointer shrink-0 ${
                    leftEditorTab === key
                      ? 'bg-[#161E2E] text-slate-100 border border-[#1F2937]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {key === 'v1' ? 'v1.md' : key === 'v2' ? 'v2.md' : 'final.md'}
                </button>
              ))}
            </div>
            <textarea
              value={
                leftEditorTab === 'file'
                  ? activeProject.files[selectedFile] || ''
                  : activeProject.plans[leftEditorTab]
              }
              onChange={(e) => {
                const val = e.target.value;
                if (leftEditorTab === 'file' && selectedFile) {
                  updateActiveProject((p) => ({
                    ...p,
                    files: { ...p.files, [selectedFile]: val },
                  }));
                } else if (leftEditorTab !== 'file') {
                  updateActiveProject((p) => ({
                    ...p,
                    plans: { ...p.plans, [leftEditorTab]: val },
                  }));
                }
              }}
              spellCheck={false}
              className="flex-1 min-h-0 w-full bg-[#0B0F17] border border-[#1F2937] focus:border-blue-600 rounded p-2.5 font-mono text-[11px] text-slate-200 outline-none resize-none leading-relaxed"
              placeholder="Kod veya Markdown içeriği..."
            />
          </div>
        </aside>

        {/* SOL SÜRÜKLEME ÇUBUĞU */}
        <div
          onMouseDown={() => {
            draggingSide.current = 'left';
            document.body.style.userSelect = 'none';
          }}
          className="bg-[#1F2937] hover:bg-blue-600 cursor-col-resize transition-colors"
        />

        {/* ORTA PANEL: Ajan Sekmeleri + Canlı Önizleme (Derle & Çalıştır) */}
        <section className="bg-[#0B0F17] flex flex-col min-h-0 min-w-0">
          <div className="bg-[#111827] border-b border-[#1F2937] px-3 pt-2 flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto">
              {activeProject.agents.map((agent, idx) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setActiveAgentIdx(idx);
                    setCenterMode('agent');
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-t-md border border-b-0 whitespace-nowrap shrink-0 cursor-pointer ${
                    centerMode === 'agent' && activeAgentIdx === idx
                      ? 'bg-[#0B0F17] text-slate-100 border-[#1F2937]'
                      : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  {idx + 1}. {agent.title} ·{' '}
                  {agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1)}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setCenterMode('preview');
                  setCompileNonce((n) => n + 1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-md border border-b-0 whitespace-nowrap shrink-0 cursor-pointer ${
                  centerMode === 'preview'
                    ? 'bg-[#0B0F17] text-sky-400 border-[#1F2937]'
                    : 'bg-transparent text-sky-400/80 border-transparent hover:text-sky-300'
                }`}
              >
                <Play className="w-3 h-3" />
                Canlı Önizleme (Derle &amp; Çalıştır)
              </button>
            </div>
          </div>

          {centerMode === 'preview' ? (
            <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
              <LivePreviewStage
                projectId={activeProject.id}
                projectName={activeProject.name}
                files={activeProject.files}
                compileNonce={compileNonce}
                onSendErrorToAgent={(errorReport) => {
                  updateActiveProject((p) => ({
                    ...p,
                    projectIdea: `Şu derleme/çalışma zamanı hatasını düzelt:\n\n${errorReport}`,
                  }));
                  appendLog('Önizleme hatası Ajan 1 görev alanına aktarıldı.', 'warn');
                  setCenterMode('agent');
                  setActiveAgentIdx(0);
                }}
              />
            </div>
          ) : (
            <>
              <div className="bg-[#111827] border-b border-[#1F2937] px-3 py-2 flex items-center gap-2">
                <select
                  value={activeAgent.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ProviderKey;
                    updateActiveProject((p) => ({
                      ...p,
                      agents: p.agents.map((a, idx) =>
                        idx === activeAgentIdx ? { ...a, provider, url: PROVIDER_URLS[provider] } : a
                      ),
                    }));
                  }}
                  className="bg-[#0B0F17] border border-[#1F2937] rounded px-2 py-1 text-xs text-slate-200 outline-none"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="chatgpt">OpenAI ChatGPT</option>
                  <option value="deepseek">DeepSeek Chat</option>
                </select>
                <input
                  type="text"
                  value={activeAgent.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    updateActiveProject((p) => ({
                      ...p,
                      agents: p.agents.map((a, idx) =>
                        idx === activeAgentIdx ? { ...a, url } : a
                      ),
                    }));
                  }}
                  className="flex-1 min-w-0 bg-[#0B0F17] border border-[#1F2937] rounded px-2.5 py-1 font-mono text-xs text-slate-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    appendLog(`Ajan ${activeAgentIdx + 1} (${activeAgent.url}) yenilendi.`, 'info')
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  Yenile
                </button>
              </div>

              <div className="bg-[#111827] border-b border-[#1F2937] px-3 py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Sistem Rolü Şablonu (Ajan {activeAgent.id + 1}: {activeAgent.title})
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoleCollapsed((c) => !c)}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    {roleCollapsed ? 'Genişlet' : 'Daralt'}
                  </button>
                </div>
                {!roleCollapsed && (
                  <textarea
                    rows={2}
                    value={activeAgent.rolePrompt}
                    onChange={(e) => {
                      const rolePrompt = e.target.value;
                      updateActiveProject((p) => ({
                        ...p,
                        agents: p.agents.map((a, idx) =>
                          idx === activeAgentIdx ? { ...a, rolePrompt } : a
                        ),
                      }));
                    }}
                    className="w-full bg-[#0B0F17] border border-[#1F2937] focus:border-blue-600 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none resize-none"
                  />
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
                <div className="flex-1 min-h-0 bg-[#070A10] border border-[#1F2937] rounded-lg flex flex-col overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-300 truncate">
                      WebContentsView #{activeAgent.id + 1} ·{' '}
                      <span className="font-mono text-slate-400">{activeAgent.url}</span> ·{' '}
                      <span className="text-slate-400">Proje: {activeProject.name}</span>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={simulateNextError}
                        onChange={(e) => setSimulateNextError(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Sonraki aşamada timeout simüle et
                    </label>
                  </div>

                  <div className="px-4 py-2 bg-[#0E1420] border-b border-[#1F2937] text-[11px] text-slate-400 flex items-center justify-between gap-2">
                    <span>Doğrulama Durumu: {verificationState}</span>
                    <span className="font-mono">
                      Arka Plan Görünümleri: 3/3 Açık
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {activeAgent.lastTranscript ? (
                      <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {activeAgent.lastTranscript}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto gap-2">
                        <div className="text-sm font-medium text-slate-200">
                          {activeAgent.title} Görünümü Hazır ({activeAgent.provider})
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Bu ajan çalıştırıldığında <strong>{activeProject.name}</strong> projesinin
                          hafızası otomatik olarak prompta eklenir. Canlı oyunu/uygulamayı görmek
                          için üstten <strong>Canlı Önizleme</strong> sekmesine geçebilirsiniz.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* SAĞ SÜRÜKLEME ÇUBUĞU */}
        <div
          onMouseDown={() => {
            draggingSide.current = 'right';
            document.body.style.userSelect = 'none';
          }}
          className="bg-[#1F2937] hover:bg-blue-600 cursor-col-resize transition-colors"
        />

        {/* SAĞ PANEL */}
        <aside className="bg-[#111827] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b border-[#1F2937] flex flex-col gap-2 h-[36%] min-h-[150px]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-100">Canlı Süreç Günlüğü</h2>
              <button
                type="button"
                onClick={() => updateActiveProject((p) => ({ ...p, logs: [] }))}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer"
              >
                Temizle
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#0B0F17] border border-[#1F2937] rounded p-2 space-y-1.5 font-mono text-[11px]">
              {activeProject.logs.map((item) => (
                <div key={item.id} className="flex gap-2 leading-snug">
                  <span className="text-slate-500 shrink-0">{item.time}</span>
                  <span
                    className={
                      item.level === 'success'
                        ? 'text-emerald-400'
                        : item.level === 'warn'
                          ? 'text-amber-400'
                          : item.level === 'error'
                            ? 'text-rose-400'
                            : 'text-slate-300'
                    }
                  >
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-100">
                Yakalanan Kod Blokları ({activeProject.codeBlocks.length})
              </h2>
              {activeProject.codeBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAllBlocksAndCompile}
                  className="px-2 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer shrink-0"
                >
                  Tümünü Uygula ve Derle
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 shrink-0">Hedef Dosya</span>
              <input
                type="text"
                value={targetFileInput}
                onChange={(e) => setTargetFileInput(e.target.value)}
                className="flex-1 min-w-0 bg-[#0B0F17] border border-[#1F2937] rounded px-2 py-1 font-mono text-[11px] text-slate-200 outline-none"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5">
              {activeProject.codeBlocks.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-4">
                  Ajanlar yanıt ürettiğinde ayrıştırılan &lt;pre&gt;&lt;code&gt; blokları burada
                  listelenir ve tek tıkla canlı derlemeye uygulanır.
                </div>
              ) : (
                activeProject.codeBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="bg-[#0B0F17] border border-[#1F2937] rounded overflow-hidden"
                  >
                    <div className="px-2.5 py-1.5 bg-[#161E2E] border-b border-[#1F2937] flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-300 truncate">
                        {block.agentTitle} · {block.language}
                        {block.fileHint ? ` · ${block.fileHint}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenDiff(block)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer shrink-0"
                      >
                        Önizle ve Uygula
                      </button>
                    </div>
                    <pre className="p-2.5 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-40">
                      {block.code}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Fark Önizleme & Yedekleme Modalı */}
      {diffModalBlock && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[#111827] border border-[#1F2937] rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Değişiklik Önizlemesi ve Otomatik Yedekleme
                </h3>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                  Hedef: {diffModalBlock.targetRel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiffModalBlock(null)}
                className="px-2.5 py-1 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                Kapat
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-3">
              <div className="text-xs text-slate-300 bg-[#161E2E] border border-[#1F2937] rounded px-3 py-2">
                Onayladığınızda mevcut dosyanın zaman damgalı <strong>.bak</strong> yedeği{' '}
                <span className="font-mono">.studio-backups/</span> altında oluşturulacak ve canlı
                önizleme yeniden derlenecektir.
              </div>
              <div className="bg-[#0B0F17] border border-[#1F2937] rounded p-3 font-mono text-[11px] overflow-auto max-h-[45vh]">
                {diffModalBlock.rows.map((r, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap px-1.5 py-0.5 ${
                      r.type === 'add'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : r.type === 'del'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {r.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[#1F2937] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiffModalBlock(null)}
                className="px-3 py-1.5 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
              >
                Yedek Al, Yaz ve Derle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proje Hafızası Modalı */}
      {memoryModalOpen && (
        <ProjectMemoryModal
          projectName={activeProject.name}
          memory={activeProject.memory}
          onClose={() => setMemoryModalOpen(false)}
          onSave={(nextMemory: ProjectMemory) => {
            updateActiveProject((p) => ({ ...p, memory: nextMemory }));
            appendLog('Proje hafızası güncellendi.', 'success');
          }}
        />
      )}

      {/* Yeni Proje Modalı */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Yeni Proje Çalışma Alanı</h3>
              <button
                type="button"
                onClick={() => setNewProjectModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Kapat
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs text-slate-300">Proje Adı</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Örn: 2D Platform Oyunu veya CRM Paneli"
                className="w-full bg-[#0B0F17] border border-[#1F2937] rounded px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>
            <div className="px-4 py-3 border-t border-[#1F2937] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewProjectModalOpen(false)}
                className="px-3 py-1.5 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreateEmptyProject}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* selectors.json Düzenleyici Modalı */}
      {selectorsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[#111827] border border-[#1F2937] rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Harici Seçici Yapılandırması (selectors.json)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gemini, Claude, ChatGPT ve DeepSeek CSS seçicilerini buradan doğrulayabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectorsModalOpen(false)}
                className="px-2.5 py-1 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                Kapat
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0 flex flex-col gap-2">
              <textarea
                value={selectorsText}
                onChange={(e) => setSelectorsText(e.target.value)}
                spellCheck={false}
                className="flex-1 min-h-[340px] w-full bg-[#0B0F17] border border-[#1F2937] rounded p-3 font-mono text-xs text-slate-200 outline-none resize-none"
              />
              {selectorsError && <div className="text-xs text-rose-400">{selectorsError}</div>}
            </div>
            <div className="px-4 py-3 border-t border-[#1F2937] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectorsModalOpen(false)}
                className="px-3 py-1.5 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    JSON.parse(selectorsText);
                    setSelectorsError(null);
                    setSelectorsModalOpen(false);
                    appendLog('selectors.json şeması doğrulandı.', 'success');
                  } catch (err) {
                    setSelectorsError(`JSON Hatası: ${(err as Error).message}`);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
              >
                Doğrula ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
