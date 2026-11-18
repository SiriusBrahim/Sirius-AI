import { useEffect, useRef, useState } from 'react';
import { Monitor, Play, RefreshCw, Smartphone, Tablet, Terminal } from 'lucide-react';
import { compileProjectForPreview, ProjectCompileResult } from '../utils/projectCompiler';

interface RuntimeLog {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface LivePreviewStageProps {
  projectId: string;
  projectName: string;
  files: Record<string, string>;
  compileNonce: number;
  onSendErrorToAgent: (errorReport: string) => void;
}

export function LivePreviewStage({
  projectId,
  projectName,
  files,
  compileNonce,
  onSendErrorToAgent,
}: LivePreviewStageProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [result, setResult] = useState<ProjectCompileResult | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLog[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const prevUrlsRef = useRef<string[]>([]);

  const runCompile = () => {
    prevUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const compiled = compileProjectForPreview(files);
    prevUrlsRef.current = compiled.blobUrls;
    setResult(compiled);
    setIframeKey((k) => k + 1);
    setRuntimeLogs([
      {
        id: `cmp-${Date.now()}`,
        time: new Date().toTimeString().slice(0, 8),
        level: compiled.ok ? 'info' : 'error',
        message: compiled.ok
          ? `Derleme başarılı (${compiled.entryType} · ${compiled.compiledFiles} dosya işlendi).`
          : `Derleme hatası: ${compiled.errors.map((e) => `${e.file}: ${e.message}`).join(' | ')}`,
      },
    ]);
  };

  useEffect(() => {
    runCompile();
    return () => {
      prevUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      prevUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, compileNonce]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'studio-preview') return;
      setRuntimeLogs((prev) => [
        ...prev.slice(-80),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toTimeString().slice(0, 8),
          level: data.level === 'error' ? 'error' : data.level === 'warn' ? 'warn' : 'info',
          message: String(data.message || ''),
        },
      ]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const hasErrors =
    (result && !result.ok) || runtimeLogs.some((l) => l.level === 'error');

  const collectErrorReport = () => {
    const compileErrs =
      result?.errors.map((e) => `[Derleme Hatası] ${e.file}: ${e.message}`) || [];
    const runErrs = runtimeLogs
      .filter((l) => l.level === 'error')
      .map((l) => `[Çalışma Zamanı] ${l.message}`);
    return [...compileErrs, ...runErrs].join('\n');
  };

  const widthClass =
    viewport === 'desktop'
      ? 'w-full h-full'
      : viewport === 'tablet'
        ? 'w-[768px] max-w-full h-full'
        : 'w-[390px] max-w-full h-full';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#070A10] border border-[#1F2937] rounded-lg overflow-hidden">
      {/* Önizleme Üst Araç Çubuğu */}
      <div className="px-3 py-2 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-100 truncate">{projectName}</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-[11px] text-slate-400">
            {result?.entryType === 'react-ts'
              ? 'React / TSX Derleyicisi'
              : result?.entryType === 'html-game'
                ? 'HTML5 / Canvas Çalıştırıcı'
                : 'Boş'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex bg-[#0B0F17] border border-[#1F2937] rounded p-0.5">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              title="Masaüstü"
              className={`p-1 rounded cursor-pointer ${
                viewport === 'desktop' ? 'bg-[#161E2E] text-slate-100' : 'text-slate-400'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              title="Tablet"
              className={`p-1 rounded cursor-pointer ${
                viewport === 'tablet' ? 'bg-[#161E2E] text-slate-100' : 'text-slate-400'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              title="Mobil"
              className={`p-1 rounded cursor-pointer ${
                viewport === 'mobile' ? 'bg-[#161E2E] text-slate-100' : 'text-slate-400'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={runCompile}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
          >
            <Play className="w-3 h-3" />
            Derle ve Çalıştır
          </button>
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Yeniden Başlat"
            className="p-1.5 bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConsoleOpen((o) => !o)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[#161E2E] hover:bg-slate-800 text-slate-300 border border-[#1F2937] rounded cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            Konsol
          </button>
        </div>
      </div>

      {/* Canlı Çalışan Uygulama / Oyun Iframe Sahnesi */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 bg-[#05070C] overflow-hidden">
        {result && result.ok ? (
          <iframe
            key={iframeKey}
            title="Canlı Proje Önizlemesi"
            srcDoc={result.html}
            sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
            className={`${widthClass} bg-white rounded border border-[#1F2937] transition-all`}
          />
        ) : (
          <div className="max-w-lg p-5 bg-[#111827] border border-rose-500/40 rounded-lg space-y-2">
            <div className="text-sm font-semibold text-rose-400">Derleme Başarısız</div>
            <div className="font-mono text-xs text-slate-300 space-y-1">
              {result?.errors.map((err, i) => (
                <div key={i}>
                  {err.file}: {err.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Derleyici & Çalışma Zamanı Konsolu */}
      {consoleOpen && (
        <div className="h-32 shrink-0 border-t border-[#1F2937] bg-[#0B0F17] flex flex-col">
          <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-300">
              Derleyici ve Çalışma Zamanı Konsolu ({runtimeLogs.length})
            </span>
            <div className="flex items-center gap-2">
              {hasErrors && (
                <button
                  type="button"
                  onClick={() => onSendErrorToAgent(collectErrorReport())}
                  className="px-2 py-0.5 text-[11px] font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded cursor-pointer"
                >
                  Hata Çıktısını Ajana Gönder
                </button>
              )}
              <button
                type="button"
                onClick={() => setRuntimeLogs([])}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer"
              >
                Temizle
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px]">
            {runtimeLogs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span
                  className={
                    log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
