import React from 'react';
import { BookOpen, Bot, MessageSquarePlus, Settings2, Trash2, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNewChat,
  onClearHistory,
  onOpenSettings,
  onOpenMemory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Chiudi menu"
        className="fixed inset-0 cursor-default bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-[min(19rem,86vw)] flex-col border-r border-white/10 bg-[#080d19] text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[0.16em]">ANDROS OS</h1>
              <p className="mt-0.5 text-xs text-slate-500">Assistente personale</p>
            </div>
          </div>
          <button type="button" aria-label="Chiudi menu" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X size={19} />
          </button>
        </div>

        <div className="space-y-2 p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110"
          >
            <MessageSquarePlus size={18} />
            <span>Nuova conversazione</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.07]"
          >
            <Settings2 size={18} className="text-cyan-300" />
            <span>Connessione e modello</span>
          </button>
          <button
            type="button"
            onClick={onOpenMemory}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.07]"
          >
            <BookOpen size={18} className="text-cyan-300" />
            <span>Memoria e regole permanenti</span>
          </button>
        </div>

        <div className="flex-1 px-4 py-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Memoria locale</div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <p className="text-xs leading-5 text-slate-400">La conversazione corrente viene salvata su questo dispositivo e resta disponibile quando riapri l’app.</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] p-3">
          <button
            type="button"
            onClick={onClearHistory}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 size={16} />
            <span>Azzera conversazione</span>
          </button>
          <p className="px-3 pb-1 pt-2 text-[10px] text-slate-600">ANDROS OS · build in sviluppo</p>
        </div>
      </aside>
    </div>
  );
};
