import { useState } from 'react';
import { Check, Copy, Download, FolderArchive } from 'lucide-react';
import { ELECTRON_SOURCE_FILES } from '../data/workspaceBundles';

interface ElectronExporterViewProps {
  onDownloadZip: () => void;
}

export function ElectronExporterView({ onDownloadZip }: ElectronExporterViewProps) {
  const [selectedPath, setSelectedPath] = useState(ELECTRON_SOURCE_FILES[1].path);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeFile =
    ELECTRON_SOURCE_FILES.find((f) => f.path === selectedPath) || ELECTRON_SOURCE_FILES[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopiedPath(activeFile.path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[290px_1fr] bg-[#0B0F17]">
      <aside className="border-r border-[#1F2937] bg-[#111827] flex flex-col min-h-0">
        <div className="p-4 border-b border-[#1F2937] flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-slate-100">
            Electron Masaüstü Kaynak Paketi
          </h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Yerel bilgisayarınızda <code className="text-slate-200">cd electron &amp;&amp; npm install &amp;&amp; npm start</code> komutlarıyla doğrudan çalıştırılabilir.
          </p>
          <button
            type="button"
            onClick={onDownloadZip}
            className="mt-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Tüm Electron Projesini İndir (.zip)
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ELECTRON_SOURCE_FILES.map((file) => {
            const active = file.path === activeFile.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#161E2E] border-[#2563EB]/50 text-slate-100'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-[#161E2E]/60 hover:text-slate-200'
                }`}
              >
                <div className="font-mono text-xs font-medium truncate">{file.name}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{file.role}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-col min-h-0 min-w-0">
        <div className="px-4 py-3 border-b border-[#1F2937] bg-[#111827] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-slate-100 truncate">
              {activeFile.path}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{activeFile.role}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded-md transition-colors cursor-pointer"
            >
              {copiedPath === activeFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Kodu Kopyala
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadSingle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161E2E] hover:bg-slate-800 text-slate-200 border border-[#1F2937] rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Dosyayı İndir
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 bg-[#0B0F17]">
          <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre">
            {activeFile.content}
          </pre>
        </div>
      </section>
    </div>
  );
}
