import React, { useState } from 'react';
import { Archive, BookOpen, Bot, MessageSquarePlus, Settings2, Trash2, X, Pin, PinOff, Search, Pencil, Check } from 'lucide-react';
import type { ChatSession } from '../services/chatSessions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onOpenArchive: () => void;
  sessions: ChatSession[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, onNewChat, onClearHistory, onOpenSettings, onOpenMemory, onOpenArchive,
  sessions, activeChatId, onSelectChat, onTogglePin, onDeleteChat, onRenameChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  if (!isOpen) return null;
  const normalizeSearch = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedQuery = normalizeSearch(searchQuery.trim());
  const matchesQuery = (session: ChatSession) => !normalizedQuery || normalizeSearch(session.title).includes(normalizedQuery);
  const pinned = sessions.filter((session) => session.pinned && matchesQuery(session));
  const recent = sessions.filter((session) => !session.pinned && matchesQuery(session));
  const beginRename = (session: ChatSession) => {
    setEditingId(session.id);
    setTitleDraft(session.title);
  };
  const saveRename = (id: string) => {
    try {
      onRenameChat(id, titleDraft);
      setEditingId(null);
      setTitleDraft('');
    } catch {
      // The parent displays validation feedback.
    }
  };

  const renderSession = (session: ChatSession) => (
    <div key={session.id} className={`group flex items-center gap-1 rounded-xl border px-2 py-1.5 transition ${session.id === activeChatId ? 'border-cyan-400/25 bg-cyan-400/[0.08]' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]'}`}>
      <div className="min-w-0 flex-1 py-1">
        {editingId === session.id ? (
          <form onSubmit={(event) => { event.preventDefault(); saveRename(session.id); }} className="flex items-center gap-1">
            <input autoFocus value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} maxLength={80} aria-label="Nuovo titolo" className="min-w-0 flex-1 rounded-md border border-cyan-400/30 bg-slate-950 px-2 py-1 text-xs text-white outline-none" />
            <button type="submit" aria-label="Salva titolo" className="rounded-md p-1 text-emerald-300 hover:bg-emerald-400/10"><Check size={14} /></button>
          </form>
        ) : (
          <button type="button" onClick={() => onSelectChat(session.id)} title={session.title} className="block w-full min-w-0 text-left">
            <span className="block truncate text-xs font-medium text-slate-200">{session.title}</span>
            <span className="mt-0.5 block text-[10px] text-slate-500">{session.messages.filter((message) => message.role === 'user').length} messaggi utente</span>
          </button>
        )}
      </div>
      <button type="button" aria-label="Rinomina conversazione" title="Rinomina conversazione" onClick={() => beginRename(session)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-cyan-200"><Pencil size={14} /></button>
      <button type="button" aria-label={session.pinned ? 'Rimuovi dai fissati' : 'Fissa conversazione'} title={session.pinned ? 'Rimuovi dai fissati' : 'Fissa conversazione'} onClick={() => onTogglePin(session.id)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-cyan-200">
        {session.pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      {deleteConfirmId === session.id ? (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Conferma eliminazione">
          <span className="text-[10px] text-rose-300">Eliminare?</span>
          <button type="button" aria-label="Conferma eliminazione" title="Conferma eliminazione" onClick={() => { onDeleteChat(session.id); setDeleteConfirmId(null); }} className="rounded-md p-1.5 text-rose-300 hover:bg-rose-500/15"><Check size={14} /></button>
          <button type="button" aria-label="Annulla eliminazione" title="Annulla" onClick={() => setDeleteConfirmId(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" aria-label="Elimina conversazione" title="Elimina conversazione" onClick={() => setDeleteConfirmId(session.id)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Chiudi menu" className="fixed inset-0 cursor-default bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-[min(21rem,90vw)] flex-col border-r border-white/10 bg-[#080d19] text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Bot size={22} /></div>
            <div><h1 className="text-sm font-bold tracking-[0.16em]">ANDROS OS</h1><p className="mt-0.5 text-xs text-slate-500">Assistente personale</p></div>
          </div>
          <button type="button" aria-label="Chiudi menu" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={19} /></button>
        </div>

        <div className="space-y-2 p-3">
          <button type="button" onClick={onNewChat} className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110"><MessageSquarePlus size={18} /><span>Nuova conversazione</span></button>
          <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.07]"><Settings2 size={18} className="text-cyan-300" /><span>Connessione e modello</span></button>
          <button type="button" onClick={onOpenArchive} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.07]"><Archive size={18} className="text-cyan-300" /><span>Archivio universale delle chat</span></button>
          <button type="button" onClick={onOpenMemory} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.07]"><BookOpen size={18} className="text-cyan-300" /><span>Memoria e regole permanenti</span></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-2.5 text-slate-500 focus-within:border-cyan-400/30">
            <Search size={15} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca conversazioni…" aria-label="Cerca conversazioni" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" />
            {searchQuery && <button type="button" aria-label="Cancella ricerca" onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white"><X size={13} /></button>}
          </label>
          <div className="mb-2 flex items-center justify-between px-1"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fissate</span><span className="text-[10px] text-slate-600">{sessions.filter((session) => session.pinned).length}/30</span></div>
          <div className="space-y-1">{pinned.length ? pinned.map(renderSession) : <p className="px-2 py-2 text-[11px] text-slate-600">Nessuna chat fissata.</p>}</div>
          <div className="mb-2 mt-5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recenti</div>
          <div className="space-y-1">{recent.length ? recent.map(renderSession) : <p className="px-2 py-2 text-[11px] text-slate-600">Nessun'altra conversazione.</p>}</div>
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[11px] leading-5 text-slate-500">Le conversazioni sono salvate localmente su questo dispositivo. Fissa fino a 30 chat per ritrovarle rapidamente.</p></div>
        </div>

        <div className="border-t border-white/[0.08] p-3">
          {confirmClearHistory ? (
            <div className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3">
              <p className="text-xs leading-5 text-rose-200">Rimuovere tutti i messaggi dalla conversazione corrente?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { onClearHistory(); setConfirmClearHistory(false); }} className="flex-1 rounded-lg bg-rose-500/15 px-2 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25">Conferma</button>
                <button type="button" onClick={() => setConfirmClearHistory(false)} className="flex-1 rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-300 hover:bg-white/5">Annulla</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClearHistory(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={16} /><span>Azzera conversazione corrente</span></button>
          )}
          <p className="px-3 pb-1 pt-2 text-[10px] text-slate-600">ANDROS OS · build in sviluppo</p>
        </div>
      </aside>
    </div>
  );
};
