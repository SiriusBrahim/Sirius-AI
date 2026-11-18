import { useState } from 'react';
import { ARCHITECTURE_DOC_FILES } from '../data/workspaceBundles';

export function DocsViewerView() {
  const [selectedPath, setSelectedPath] = useState(ARCHITECTURE_DOC_FILES[0].path);
  const activeDoc =
    ARCHITECTURE_DOC_FILES.find((d) => d.path === selectedPath) || ARCHITECTURE_DOC_FILES[0];

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[290px_1fr] bg-[#0B0F17]">
      <aside className="border-r border-[#1F2937] bg-[#111827] flex flex-col min-h-0">
        <div className="p-4 border-b border-[#1F2937]">
          <h2 className="text-xs font-semibold text-slate-100">Mimari ve Veri Akışı Belgeleri</h2>
          <p className="text-[11px] text-slate-400 mt-1">
            docs/architecture/ altında üretilen 9 adet Mermaid belgesi.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ARCHITECTURE_DOC_FILES.map((doc) => {
            const active = doc.path === activeDoc.path;
            return (
              <button
                key={doc.path}
                type="button"
                onClick={() => setSelectedPath(doc.path)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#161E2E] border-[#2563EB]/50 text-slate-100'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-[#161E2E]/60 hover:text-slate-200'
                }`}
              >
                <div className="font-mono text-xs font-medium truncate">{doc.name}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{doc.role}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-col min-h-0 min-w-0">
        <div className="px-4 py-3 border-b border-[#1F2937] bg-[#111827]">
          <div className="font-mono text-xs font-semibold text-slate-100">{activeDoc.path}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{activeDoc.role}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-5 bg-[#0B0F17]">
          <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap max-w-5xl">
            {activeDoc.content}
          </pre>
        </div>
      </section>
    </div>
  );
}
