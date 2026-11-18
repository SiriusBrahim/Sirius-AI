import electronPackageJson from '../../electron/package.json?raw';
import electronMainJs from '../../electron/main.js?raw';
import electronPreloadJs from '../../electron/preload.js?raw';
import electronStealthPreloadJs from '../../electron/stealth-preload.js?raw';
import electronInjectorJs from '../../electron/injector.js?raw';
import electronSelectorsJson from '../../electron/selectors.json?raw';
import electronIndexHtml from '../../electron/index.html?raw';
import electronStylesCss from '../../electron/styles.css?raw';
import electronRendererJs from '../../electron/renderer.js?raw';
import electronReadmeMd from '../../electron/README.md?raw';

import docIndex from '../../docs/architecture/architecture-index.md?raw';
import docSystem from '../../docs/architecture/system-architecture.md?raw';
import docLifecycle from '../../docs/architecture/agent-lifecycle.md?raw';
import docBrowser from '../../docs/architecture/browser-interaction.md?raw';
import docOrch from '../../docs/architecture/multi-agent-orchestration.md?raw';
import docCodegen from '../../docs/architecture/code-generation-pipeline.md?raw';
import docProject from '../../docs/architecture/project-and-plan-flow.md?raw';
import docError from '../../docs/architecture/error-recovery.md?raw';
import docSecurity from '../../docs/architecture/security-boundaries.md?raw';

export interface BundleFile {
  path: string;
  name: string;
  role: string;
  content: string;
}

export const ELECTRON_SOURCE_FILES: BundleFile[] = [
  {
    path: 'electron/package.json',
    name: 'package.json',
    role: 'Electron 35, turndown ve turndown-plugin-gfm bağımlılıkları',
    content: electronPackageJson,
  },
  {
    path: 'electron/main.js',
    name: 'main.js',
    role: '3x WebContentsView, clipboard+paste, Turndown, path-jail ve .bak yazıcısı',
    content: electronMainJs,
  },
  {
    path: 'electron/preload.js',
    name: 'preload.js',
    role: 'Studio Renderer için sıkı contextBridge IPC izin listesi',
    content: electronPreloadJs,
  },
  {
    path: 'electron/stealth-preload.js',
    name: 'stealth-preload.js',
    role: 'WebContentsView için yalnızca navigator.webdriver maskelemesi',
    content: electronStealthPreloadJs,
  },
  {
    path: 'electron/injector.js',
    name: 'injector.js',
    role: 'DOM odaklama, gönderim tetikleme, çift doğrulama ve blok çıkarımı',
    content: electronInjectorJs,
  },
  {
    path: 'electron/selectors.json',
    name: 'selectors.json',
    role: 'Gemini, Claude, ChatGPT ve DeepSeek harici CSS seçici profilleri',
    content: electronSelectorsJson,
  },
  {
    path: 'electron/index.html',
    name: 'index.html',
    role: '3 sütunlu karanlık masaüstü arayüzü ve diff/seçici modalları',
    content: electronIndexHtml,
  },
  {
    path: 'electron/styles.css',
    name: 'styles.css',
    role: 'Karanlık arduvaz stüdyo stilleri ve fark (diff) önizleme görünümü',
    content: electronStylesCss,
  },
  {
    path: 'electron/renderer.js',
    name: 'renderer.js',
    role: '3 aşamalı boru hattı FSM, 3dk timeout, Tekrar Dene ve ResizeObserver',
    content: electronRendererJs,
  },
  {
    path: 'electron/README.md',
    name: 'README.md',
    role: 'Kurulum ve ilk çalıştırma rehberi',
    content: electronReadmeMd,
  },
];

export const ARCHITECTURE_DOC_FILES: BundleFile[] = [
  { path: 'docs/architecture/architecture-index.md', name: 'architecture-index.md', role: 'Ana mimari dizin ve açık/iyileştirme raporu', content: docIndex },
  { path: 'docs/architecture/system-architecture.md', name: 'system-architecture.md', role: '1. Sistem Mimarisi', content: docSystem },
  { path: 'docs/architecture/agent-lifecycle.md', name: 'agent-lifecycle.md', role: '2. Ajan Yaşam Döngüsü', content: docLifecycle },
  { path: 'docs/architecture/browser-interaction.md', name: 'browser-interaction.md', role: '3. Tarayıcı Etkileşim Akışı', content: docBrowser },
  { path: 'docs/architecture/multi-agent-orchestration.md', name: 'multi-agent-orchestration.md', role: '4. Çoklu Ajan Orkestrasyonu', content: docOrch },
  { path: 'docs/architecture/code-generation-pipeline.md', name: 'code-generation-pipeline.md', role: '5. Kod Üretim ve Dosya Yazma Hattı', content: docCodegen },
  { path: 'docs/architecture/project-and-plan-flow.md', name: 'project-and-plan-flow.md', role: '6. Proje ve Plan Yönetimi', content: docProject },
  { path: 'docs/architecture/error-recovery.md', name: 'error-recovery.md', role: '7. Hata ve Kurtarma Mimarisi', content: docError },
  { path: 'docs/architecture/security-boundaries.md', name: 'security-boundaries.md', role: '8. Güvenlik ve İzolasyon', content: docSecurity },
];

export const DEFAULT_SELECTORS_RAW = electronSelectorsJson;
