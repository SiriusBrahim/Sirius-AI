import { useState } from 'react';
import { FolderArchive } from 'lucide-react';
import { DocsViewerView } from './components/DocsViewerView';
import { ElectronExporterView } from './components/ElectronExporterView';
import { StudioWorkspaceView } from './components/StudioWorkspaceView';
import { ELECTRON_SOURCE_FILES } from './data/workspaceBundles';
import { buildZipBlob } from './utils/zipBuilder';

type TopTab = 'studio' | 'electron' | 'docs';

export default function App() {
  const [activeTab, setActiveTab] = useState<TopTab>('studio');

  const handleDownloadZip = () => {
    const blob = buildZipBlob(
      ELECTRON_SOURCE_FILES.map((file) => ({
        name: file.path,
        content: file.content,
      }))
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multi-agent-ai-browser-studio-electron.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F17] text-slate-100 overflow-hidden">
      {/* 3 Bölgeli Sabit Üst Çubuk */}
      <header className="h-12 shrink-0 px-6 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between gap-8">
        <span className="text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          Multi-Agent AI Browser Studio
        </span>

        <nav className="flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'studio'
                ? 'border-blue-500 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Çalışma Alanı
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('electron')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'electron'
                ? 'border-blue-500 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Electron Kaynak Paketi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'docs'
                ? 'border-blue-500 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Mimari Belgeler
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Electron ZIP İndir
          </button>
        </div>
      </header>

      {activeTab === 'studio' && <StudioWorkspaceView />}
      {activeTab === 'electron' && <ElectronExporterView onDownloadZip={handleDownloadZip} />}
      {activeTab === 'docs' && <DocsViewerView />}
    </div>
  );
}
