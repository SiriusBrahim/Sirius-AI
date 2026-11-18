import { useState } from 'react';
import { ProjectMemory } from '../types/project';

interface ProjectMemoryModalProps {
  projectName: string;
  memory: ProjectMemory;
  onClose: () => void;
  onSave: (nextMemory: ProjectMemory) => void;
}

export function ProjectMemoryModal({
  projectName,
  memory,
  onClose,
  onSave,
}: ProjectMemoryModalProps) {
  const [summary, setSummary] = useState(memory.architectureSummary);
  const [techStack, setTechStack] = useState(memory.techStack);
  const [constraints, setConstraints] = useState(memory.constraints);
  const [decisionsText, setDecisionsText] = useState(memory.decisions.join('\n'));

  const handleSubmit = () => {
    onSave({
      ...memory,
      architectureSummary: summary.trim(),
      techStack: techStack.trim(),
      constraints: constraints.trim(),
      decisions: decisionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#111827] border border-[#1F2937] rounded-lg flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Proje Hafızası · {projectName}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Her ajan çalıştırıldığında bu projeye özel hafıza otomatik olarak bağlam şeklinde enjekte edilir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
          >
            Kapat
          </button>
        </div>

        <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Mimari Özet
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F2937] rounded p-2.5 text-xs text-slate-100 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Teknoloji Yığını
              </label>
              <input
                type="text"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full bg-[#0B0F17] border border-[#1F2937] rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Kısıtlar ve Kurallar
              </label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                className="w-full bg-[#0B0F17] border border-[#1F2937] rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Alınan Mimari Kararlar (Her satır bir karar)
            </label>
            <textarea
              rows={4}
              value={decisionsText}
              onChange={(e) => setDecisionsText(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F2937] rounded p-2.5 font-mono text-xs text-slate-100 outline-none resize-none"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300 mb-1">
              Ajan Çalıştırma Hafıza Geçmişi ({memory.history.length})
            </div>
            <div className="bg-[#0B0F17] border border-[#1F2937] rounded p-2.5 max-h-36 overflow-y-auto space-y-1.5">
              {memory.history.length === 0 ? (
                <div className="text-[11px] text-slate-500">
                  Bu projede henüz tamamlanmış ajan oturumu kaydı yok.
                </div>
              ) : (
                memory.history.map((item) => (
                  <div key={item.id} className="text-[11px] text-slate-300">
                    <span className="font-mono text-slate-500">{item.timestamp}</span> ·{' '}
                    <span className="font-semibold text-sky-400">
                      Aşama {item.stage} ({item.agentTitle})
                    </span>{' '}
                    — {item.summary}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#1F2937] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-[#161E2E] text-slate-200 border border-[#1F2937] rounded cursor-pointer"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
          >
            Hafızayı Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
