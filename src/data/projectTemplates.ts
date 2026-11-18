import { AgentConfig, ProjectWorkspace } from '../types/project';

export function createDefaultAgents(): AgentConfig[] {
  return [
    {
      id: 0,
      title: 'Mimar',
      provider: 'gemini',
      url: 'https://gemini.google.com/app',
      planKey: 'v1',
      planFile: 'plan_v1.md',
      rolePrompt:
        'Sen kıdemli bir Sistem ve Oyun Mimarısın. Proje hafızasını ve mevcut dosyaları dikkate alarak mimari planı ve temel kod yapısını üret.',
      lastTranscript: '',
      hasActiveSession: true,
    },
    {
      id: 1,
      title: 'Denetçi',
      provider: 'claude',
      url: 'https://claude.ai/new',
      planKey: 'v2',
      planFile: 'plan_v2.md',
      rolePrompt:
        'Sen kıdemli bir Güvenlik ve Performans Denetçisisin. Plandaki eksikleri, çalışma zamanı hatalarını ve performans darboğazlarını tespit edip düzelt.',
      lastTranscript: '',
      hasActiveSession: true,
    },
    {
      id: 2,
      title: 'Başmühendis',
      provider: 'chatgpt',
      url: 'https://chatgpt.com/',
      planKey: 'final',
      planFile: 'plan_final.md',
      rolePrompt:
        'Sen kıdemli bir Başmühendissin. Denetlenmiş planı üretim seviyesine getir ve doğrudan projeye uygulanabilecek `// file: <yol>` etiketli tam kod bloklarını üret.',
      lastTranscript: '',
      hasActiveSession: true,
    },
  ];
}

export function createSampleProjects(): ProjectWorkspace[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'proj-neon-space',
      name: 'Neon Uzay Savunması (Oyun)',
      sourceLabel: 'Yerleşik Şablon · HTML5 Canvas',
      createdAt: now,
      updatedAt: now,
      projectIdea:
        'Oyuna çift atış güçlendirmesi (power-up), dalga sistemi ve parçacık patlama efektleri ekle.',
      mode: 'auto',
      phase: 'idle',
      currentStage: 0,
      failedStage: null,
      plans: { v1: '', v2: '', final: '' },
      codeBlocks: [],
      logs: [
        {
          id: 'l-space-1',
          time: new Date().toTimeString().slice(0, 8),
          message: 'Neon Uzay Savunması projesi yüklendi. Canlı Önizleme sekmesinden oynayabilirsiniz.',
          level: 'info',
        },
      ],
      agents: createDefaultAgents(),
      memory: {
        architectureSummary:
          '60 FPS HTML5 Canvas arcade uzay savunma oyunu. Tek canvas döngüsü (requestAnimationFrame) üzerinde oyuncu gemisi, mermiler ve düşman dalgaları çalışır.',
        techStack: 'HTML5 Canvas · Vanilla JavaScript · CSS3',
        constraints: 'Harici görsel/ses dosyası olmadan saf Canvas vektör çizimi kullanılmalı.',
        decisions: [
          'Çarpışma tespiti AABB + yarıçap mesafesi ile yapılır.',
          'Kontroller hem klavye (Sol/Sağ + Boşluk) hem fare tıklaması ile çalışır.',
        ],
        history: [],
      },
      files: {
        'index.html': `<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neon Uzay Savunması</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="hud">
    <span>Skor: <strong id="score">0</strong></span>
    <span>Can: <strong id="lives">3</strong></span>
    <button id="restartBtn" type="button">Yeniden Başlat</button>
  </div>
  <canvas id="gameCanvas" width="760" height="460"></canvas>
  <p class="hint">Hareket: Ok Tuşları / A-D · Ateş: Boşluk veya Fare Tıkı</p>
  <script src="game.js"></script>
</body>
</html>`,
        'style.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #070b14;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 10px;
}
.hud {
  width: 760px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  padding: 8px 12px;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 6px;
}
.hud button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
canvas {
  background: radial-gradient(circle at center, #0f172a 0%, #05080f 100%);
  border: 1px solid #1f2937;
  border-radius: 8px;
}
.hint { font-size: 12px; color: #94a3b8; }`,
        'game.js': `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const restartBtn = document.getElementById('restartBtn');

let score = 0;
let lives = 3;
let gameOver = false;
const keys = {};
const bullets = [];
const enemies = [];
const stars = Array.from({ length: 65 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.6 + 0.4,
  s: Math.random() * 1.2 + 0.3
}));

const player = { x: canvas.width / 2, y: canvas.height - 44, w: 34, h: 24, speed: 6, cooldown: 0 };

function resetGame() {
  score = 0;
  lives = 3;
  gameOver = false;
  bullets.length = 0;
  enemies.length = 0;
  player.x = canvas.width / 2;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
}

restartBtn.addEventListener('click', resetGame);
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', () => {
  if (gameOver) resetGame();
  else fireBullet();
});

function fireBullet() {
  if (player.cooldown > 0 || gameOver) return;
  bullets.push({ x: player.x, y: player.y - 14, vy: -9 });
  player.cooldown = 10;
}

let spawnTick = 0;
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Yıldız arka planı
  ctx.fillStyle = '#475569';
  stars.forEach((st) => {
    st.y += st.s;
    if (st.y > canvas.height) { st.y = 0; st.x = Math.random() * canvas.width; }
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!gameOver) {
    if (keys.ArrowLeft || keys.KeyA) player.x -= player.speed;
    if (keys.ArrowRight || keys.KeyD) player.x += player.speed;
    if (keys.Space) fireBullet();
    player.x = Math.max(24, Math.min(canvas.width - 24, player.x));
    if (player.cooldown > 0) player.cooldown -= 1;

    spawnTick += 1;
    if (spawnTick % 42 === 0) {
      enemies.push({
        x: 28 + Math.random() * (canvas.width - 56),
        y: -20,
        r: 14 + Math.random() * 8,
        vy: 1.8 + Math.min(3, score * 0.015)
      });
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y += bullets[i].vy;
      if (bullets[i].y < -10) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      en.y += en.vy;
      if (en.y > canvas.height + 20) {
        enemies.splice(i, 1);
        lives -= 1;
        livesEl.textContent = lives;
        if (lives <= 0) gameOver = true;
        continue;
      }
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (Math.hypot(en.x - b.x, en.y - b.y) < en.r + 5) {
          enemies.splice(i, 1);
          bullets.splice(j, 1);
          score += 10;
          scoreEl.textContent = score;
          break;
        }
      }
    }
  }

  // Oyuncu gemisi
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 16);
  ctx.lineTo(player.x - 16, player.y + 12);
  ctx.lineTo(player.x + 16, player.y + 12);
  ctx.closePath();
  ctx.fill();

  // Mermiler
  ctx.fillStyle = '#fbbf24';
  bullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));

  // Düşmanlar
  ctx.fillStyle = '#f43f5e';
  enemies.forEach((en) => {
    ctx.beginPath();
    ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2);
    ctx.fill();
  });

  if (gameOver) {
    ctx.fillStyle = 'rgba(7, 11, 20, 0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Oyun Bitti · Skor: ' + score, canvas.width / 2, canvas.height / 2);
  }

  requestAnimationFrame(loop);
}
loop();`,
      },
    },
    {
      id: 'proj-react-tasks',
      name: 'Görev Takip Panosu (React + TS)',
      sourceLabel: 'Yerleşik Şablon · React TSX',
      createdAt: now,
      updatedAt: now,
      projectIdea:
        'Görev kartlarına öncelik filtresi ve yerel depolama (localStorage) kalıcılığı ekle.',
      mode: 'manual',
      phase: 'idle',
      currentStage: 0,
      failedStage: null,
      plans: { v1: '', v2: '', final: '' },
      codeBlocks: [],
      logs: [
        {
          id: 'l-react-1',
          time: new Date().toTimeString().slice(0, 8),
          message: 'React + TypeScript şablon projesi yüklendi.',
          level: 'info',
        },
      ],
      agents: createDefaultAgents(),
      memory: {
        architectureSummary:
          'React 19 + TypeScript + Tailwind CSS tabanlı modüler görev takip uygulaması.',
        techStack: 'React 19 · TypeScript · Tailwind CSS',
        constraints: 'Tüm bileşenler saf işlevsel React hook yapısında olmalı.',
        decisions: ['Durum yönetimi App.tsx üzerinden alt bileşenlere aktarılır.'],
        history: [],
      },
      files: {
        'index.html': `<!doctype html>
<html lang="tr">
<head><meta charset="UTF-8" /><title>Görev Panosu</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,
        'src/main.tsx': `import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);`,
        'src/index.css': `@import "tailwindcss";
body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }`,
        'src/App.tsx': `import { useState } from 'react';
import { TaskItem } from './components/TaskItem';

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Veri modelini doğrula', done: true },
    { id: 2, title: 'Canlı derleyici önizlemesini test et', done: false }
  ]);
  const [text, setText] = useState('');

  const addTask = () => {
    if (!text.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: text.trim(), done: false }]);
    setText('');
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-100">Proje Görev Panosu</h1>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Yeni görev yazın..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
        />
        <button
          onClick={addTask}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white"
        >
          Ekle
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            onToggle={() =>
              setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
            }
          />
        ))}
      </div>
    </div>
  );
}`,
        'src/components/TaskItem.tsx': `interface Props {
  task: { id: number; title: string; done: boolean };
  onToggle: () => void;
}

export function TaskItem({ task, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded text-left hover:border-slate-700"
    >
      <span className={task.done ? 'line-through text-slate-500 text-sm' : 'text-slate-100 text-sm'}>
        {task.title}
      </span>
      <span className="text-xs text-sky-400">{task.done ? 'Tamamlandı' : 'Bekliyor'}</span>
    </button>
  );
}`,
      },
    },
  ];
}
