import { transform } from 'sucrase';

export interface CompileDiagnostic {
  file: string;
  message: string;
}

export interface ProjectCompileResult {
  ok: boolean;
  html: string;
  entryType: 'react-ts' | 'html-game' | 'empty';
  errors: CompileDiagnostic[];
  warnings: string[];
  compiledFiles: number;
  blobUrls: string[];
}

const RUNTIME_BRIDGE_SCRIPT = `
<script>
(function() {
  function forward(level, args) {
    try {
      var text = Array.prototype.slice.call(args).map(function(a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      window.parent.postMessage({ source: 'studio-preview', level: level, message: text }, '*');
    } catch (e) {}
  }
  var origLog = console.log;
  var origWarn = console.warn;
  var origErr = console.error;
  console.log = function() { forward('info', arguments); return origLog.apply(console, arguments); };
  console.warn = function() { forward('warn', arguments); return origWarn.apply(console, arguments); };
  console.error = function() { forward('error', arguments); return origErr.apply(console, arguments); };
  window.addEventListener('error', function(ev) {
    forward('error', [ev.message + (ev.filename ? ' (' + ev.filename + ':' + ev.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function(ev) {
    forward('error', ['Yakalanmayan Promise hatası: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason)]);
  });
})();
</script>
`;

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function resolveRelativePath(fromFile: string, specifier: string, allFiles: Record<string, string>): string | null {
  const cleanSpec = specifier.split('?')[0].split('#')[0];
  let baseDir = '';
  if (cleanSpec.startsWith('@/')) {
    const candidateBase = cleanSpec.slice(2);
    const trials = [
      candidateBase,
      `${candidateBase}.tsx`,
      `${candidateBase}.ts`,
      `${candidateBase}.jsx`,
      `${candidateBase}.js`,
      `${candidateBase}/index.tsx`,
      `${candidateBase}/index.ts`,
    ];
    return trials.find((t) => allFiles[t] !== undefined) || null;
  }

  if (!cleanSpec.startsWith('.')) return null;

  const parts = normalizePath(fromFile).split('/');
  parts.pop();
  const specParts = cleanSpec.split('/');
  for (const seg of specParts) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  baseDir = parts.join('/');

  const candidates = [
    baseDir,
    `${baseDir}.tsx`,
    `${baseDir}.ts`,
    `${baseDir}.jsx`,
    `${baseDir}.js`,
    `${baseDir}.css`,
    `${baseDir}.json`,
    `${baseDir}/index.tsx`,
    `${baseDir}/index.ts`,
    `${baseDir}/index.jsx`,
    `${baseDir}/index.js`,
  ];
  return candidates.find((c) => allFiles[c] !== undefined) || null;
}

export function compileProjectForPreview(rawFiles: Record<string, string>): ProjectCompileResult {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFiles)) {
    files[normalizePath(k)] = v;
  }

  const keys = Object.keys(files);
  if (keys.length === 0) {
    return {
      ok: false,
      html: '',
      entryType: 'empty',
      errors: [{ file: '-', message: 'Projede derlenecek dosya bulunamadı.' }],
      warnings: [],
      compiledFiles: 0,
      blobUrls: [],
    };
  }

  const hasTsxOrJsx = keys.some((k) => /\.(tsx|jsx)$/.test(k)) || Boolean(files['src/main.tsx'] || files['src/App.tsx']);
  const indexHtml = files['index.html'] || files['public/index.html'] || '';
  const errors: CompileDiagnostic[] = [];
  const warnings: string[] = [];
  const blobUrls: string[] = [];

  // 1. React / TypeScript / JSX Projesi Derlemesi
  if (hasTsxOrJsx || /<script[^>]+src=["']\/?src\/main\.(tsx?|jsx?)["']/.test(indexHtml)) {
    const cssChunks: string[] = [];
    let usesTailwind = false;

    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('.css')) {
        if (content.includes('@import "tailwindcss"') || content.includes("@import 'tailwindcss'") || content.includes('@tailwind')) {
          usesTailwind = true;
        }
        const cleanedCss = content
          .replace(/@import\s+["']tailwindcss["'];?/g, '')
          .replace(/@custom-variant[^;]+;/g, '');
        cssChunks.push(`/* ${path} */\n${cleanedCss}`);
      }
    }

    // Tüm TSX/TS/JSX/JS/JSON dosyalarını derle ve import yollarını tekil modül kimliklerine çevir
    const moduleUrls: Record<string, string> = {};
    const codeEntries = Object.entries(files).filter(([p]) => /\.(tsx?|jsx?|json)$/.test(p) && p !== 'package.json' && p !== 'tsconfig.json');

    let compiledCount = 0;

    for (const [filePath, rawContent] of codeEntries) {
      try {
        let source = rawContent;
        if (filePath.endsWith('.json')) {
          source = `export default ${rawContent};`;
        } else {
          // CSS yan etki importlarını temizle (zaten <style> olarak eklendi)
          source = source.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, '');

          // JSX içinde React referansı eksikse ekle
          if (/\.(tsx|jsx)$/.test(filePath) && !/\bimport\s+React\b|\bimport\s+\*\s+as\s+React\b/.test(source)) {
            source = `import React from 'react';\n${source}`;
          }

          // Göreceli importları sanal modül anahtarlarına (`@proj/...`) dönüştür
          source = source.replace(
            /((?:import|export)\s+[^'"]*?from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\2/g,
            (full, prefix, quote, spec) => {
              const resolved = resolveRelativePath(filePath, spec, files);
              if (resolved) {
                return `${prefix}${quote}@proj/${resolved}${quote}`;
              }
              return full;
            }
          );

          const result = transform(source, {
            transforms: ['typescript', 'jsx'],
            jsxRuntime: 'classic',
            filePath,
          });
          source = result.code;
        }

        const blob = new Blob([source], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        blobUrls.push(url);
        moduleUrls[`@proj/${filePath}`] = url;
        compiledCount += 1;
      } catch (err) {
        errors.push({
          file: filePath,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const entryFile =
      ['src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts', 'main.tsx', 'App.tsx', 'src/App.tsx'].find(
        (f) => files[f] !== undefined
      ) || codeEntries[0]?.[0];

    if (!entryFile) {
      errors.push({ file: '-', message: 'Giriş dosyası (src/main.tsx veya src/App.tsx) bulunamadı.' });
    }

    // Eğer yalnızca App.tsx varsa ama main.tsx yoksa otomatik mount üret
    let bootstrapScript = '';
    if (entryFile && entryFile.endsWith('App.tsx') && !files['src/main.tsx']) {
      bootstrapScript = `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import App from '@proj/${entryFile}';
        createRoot(document.getElementById('root')).render(React.createElement(App));
      `;
    } else if (entryFile) {
      bootstrapScript = `import '@proj/${entryFile}';`;
    }

    const importMap = {
      imports: {
        react: 'https://esm.sh/react@19.0.0',
        'react-dom': 'https://esm.sh/react-dom@19.0.0',
        'react-dom/client': 'https://esm.sh/react-dom@19.0.0/client',
        'lucide-react': 'https://esm.sh/lucide-react@0.475.0?deps=react@19.0.0',
        three: 'https://esm.sh/three@0.172.0',
        ...moduleUrls,
      },
    };

    const tailTag = usesTailwind || keys.some((k) => files[k].includes('className='))
      ? '<script src="https://cdn.tailwindcss.com"></script>'
      : '';

    const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${RUNTIME_BRIDGE_SCRIPT}
  ${tailTag}
  <script type="importmap">${JSON.stringify(importMap)}</script>
  <style>${cssChunks.join('\n')}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${bootstrapScript}</script>
</body>
</html>`;

    return {
      ok: errors.length === 0,
      html,
      entryType: 'react-ts',
      errors,
      warnings,
      compiledFiles: compiledCount,
      blobUrls,
    };
  }

  // 2. HTML5 / Canvas / Vanilla JS Oyun veya Web Uygulaması Derlemesi
  const htmlEntry =
    ['index.html', 'game.html', 'app.html'].find((name) => files[name] !== undefined) ||
    keys.find((k) => k.endsWith('.html'));

  let doc = htmlEntry
    ? files[htmlEntry]
    : `<!doctype html><html><head><meta charset="utf-8"/></head><body><canvas id="game"></canvas></body></html>`;

  if (!htmlEntry) {
    warnings.push('index.html bulunamadı; otomatik kapsayıcı sayfa oluşturuldu.');
  }

  let compiledCount = 0;

  // <link rel="stylesheet" href="..."> etiketlerini içe göm
  doc = doc.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
    if (!/stylesheet/i.test(tag)) return tag;
    const resolved = resolveRelativePath(htmlEntry || 'index.html', href, files) || normalizePath(href);
    if (files[resolved] !== undefined) {
      compiledCount += 1;
      return `<style>/* ${resolved} */\n${files[resolved]}</style>`;
    }
    return tag;
  });

  // <script src="..."> etiketlerini içe göm (gerekirse Sucrase ile TS -> JS çevir)
  doc = doc.replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (full, preAttr, src, postAttr) => {
    const resolved = resolveRelativePath(htmlEntry || 'index.html', src, files) || normalizePath(src);
    if (files[resolved] === undefined) return full;

    let scriptCode = files[resolved];
    if (/\.tsx?$/.test(resolved)) {
      try {
        scriptCode = transform(scriptCode, { transforms: ['typescript'] }).code;
      } catch (err) {
        errors.push({
          file: resolved,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    compiledCount += 1;
    const attrs = `${preAttr} ${postAttr}`.trim();
    return `<script ${attrs}>\n${scriptCode}\n</script>`;
  });

  // Eğer index.html hiç script içermiyorsa ama projede game.js/main.js/style.css varsa otomatik ekle
  if (!htmlEntry) {
    const cssText = keys.filter((k) => k.endsWith('.css')).map((k) => files[k]).join('\n');
    const jsFiles = keys.filter((k) => /\.(js|ts)$/.test(k));
    const jsText = jsFiles
      .map((k) => {
        compiledCount += 1;
        if (k.endsWith('.ts')) {
          try {
            return transform(files[k], { transforms: ['typescript'] }).code;
          } catch (err) {
            errors.push({ file: k, message: err instanceof Error ? err.message : String(err) });
            return '';
          }
        }
        return files[k];
      })
      .join('\n');
    doc = `<!doctype html><html><head><meta charset="utf-8"/>${RUNTIME_BRIDGE_SCRIPT}<style>${cssText}</style></head><body><div id="root"></div><script>${jsText}</script></body></html>`;
  } else {
    if (/<head[^>]*>/i.test(doc)) {
      doc = doc.replace(/<head[^>]*>/i, (m) => `${m}\n${RUNTIME_BRIDGE_SCRIPT}`);
    } else {
      doc = `${RUNTIME_BRIDGE_SCRIPT}\n${doc}`;
    }
  }

  return {
    ok: errors.length === 0,
    html: doc,
    entryType: 'html-game',
    errors,
    warnings,
    compiledFiles: Math.max(compiledCount, 1),
    blobUrls,
  };
}
