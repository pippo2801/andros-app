import React, { useMemo, useRef, useState } from 'react';
import { Archive, Search, Upload, Download, Trash2, X, MessageSquareText, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  exportArchivedConversations,
  loadArchivedConversations,
  parseArchiveFile,
  saveArchivedConversations,
  searchArchivedConversations,
  type ArchivedConversation,
  type ArchivedMessage,
} from '../services/conversationArchive';
import type { ChatMessageData } from '../services/ollama';

interface ArchivePanelProps {
  onClose: () => void;
  onLoadConversation: (title: string, messages: ChatMessageData[]) => void;
  onNotice: (message: string) => void;
  currentMessages: ChatMessageData[];
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({ onClose, onLoadConversation, onNotice, currentMessages }) => {
  const [conversations, setConversations] = useState<ArchivedConversation[]>(loadArchivedConversations);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchArchivedConversations(conversations, query), [conversations, query]);

  const persist = (next: ArchivedConversation[]) => {
    saveArchivedConversations(next);
    setConversations(next);
  };

  const saveCurrentConversation = () => {
    const meaningful = currentMessages.filter((message) => message.content.trim());
    if (!meaningful.length) {
      setError('La conversazione corrente è vuota.');
      return;
    }
    const firstUser = meaningful.find((message) => message.role === 'user');
    const title = firstUser?.content.trim().slice(0, 72) || 'Conversazione Andros';
    const saved: ArchivedConversation = {
      id: `andros-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      source: 'Andros OS · locale',
      importedAt: Date.now(),
      messages: meaningful.map((message) => ({ role: message.role, content: message.content })),
    };
    try {
      persist([...conversations, saved]);
      setStatus('Conversazione corrente salvata nell’archivio locale.');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare la conversazione.');
    }
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setStatus('');
    let imported = 0;
    try {
      let next = [...conversations];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`Il file “${file.name}” supera il limite di 5 MB.`);
        }
        const parsed = parseArchiveFile(file.name, await file.text());
        next = [...next, ...parsed];
        imported += parsed.length;
      }
      persist(next);
      setStatus(imported ? `Importate ${imported} conversazioni. Ora puoi cercarle per parole chiave.` : 'Non ho trovato conversazioni riconoscibili nei file selezionati.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Importazione non riuscita.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeConversation = (id: string) => {
    const target = conversations.find((item) => item.id === id);
    if (!target) return;
    try {
      persist(conversations.filter((item) => item.id !== id));
      setStatus('Conversazione rimossa dall’archivio locale.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile aggiornare l’archivio.');
    }
  };

  const exportAll = () => {
    try {
      const blob = new Blob([exportArchivedConversations(conversations)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'andros-archivio-conversazioni.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Esportazione dell’archivio avviata.');
    } catch {
      setError('Non è stato possibile esportare l’archivio.');
    }
  };

  const openResult = (title: string, messages: ArchivedMessage[]) => {
    onLoadConversation(title, messages.map((message) => ({ role: message.role, content: message.content })));
    onNotice(`Conversazione “${title}” caricata dalla memoria archivio.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="archive-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1120] shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-5 sm:p-6">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Archive size={20} /></div>
            <h2 id="archive-title" className="text-lg font-semibold text-white">Archivio universale delle chat</h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-slate-400">Importa esportazioni delle conversazioni e cerca nei loro contenuti. I dati restano in locale su questo dispositivo.</p>
          </div>
          <button type="button" aria-label="Chiudi archivio" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19} /></button>
        </header>

        <div className="space-y-3 border-b border-white/[0.08] p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-3 text-sm font-semibold text-white hover:brightness-110"><Upload size={16} /> Importa chat</button>
            <button type="button" onClick={saveCurrentConversation} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-400/[0.12]"><MessageSquareText size={16} /> Salva chat corrente</button>
            <button type="button" onClick={exportAll} disabled={!conversations.length} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40"><Download size={16} /> Esporta archivio</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,.txt,.md,.html,.htm,.csv,application/json,text/plain,text/html" multiple className="hidden" onChange={(event) => void importFiles(event.target.files)} />
          <p className="text-[11px] leading-4 text-slate-500">Formati: JSON, TXT, MD, HTML e CSV (max 5 MB per file). Per ChatGPT, estrai conversations.json dal file ZIP esportato. Per altri servizi, importa un file testuale o JSON compatibile.</p>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 focus-within:border-cyan-400/40">
            <Search size={17} className="shrink-0 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca codice, progetto, argomento…" aria-label="Cerca nell’archivio" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            {query && <button type="button" aria-label="Cancella ricerca" onClick={() => setQuery('')} className="text-slate-500 hover:text-white"><X size={14} /></button>}
          </label>
          <div className="flex items-center justify-between text-[11px] text-slate-500"><span>{conversations.length} conversazioni archiviate</span><span>{query ? `${results.length} risultati` : 'Ricerca locale'}</span></div>
          {status && <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-200"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{status}</div>}
          {error && <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {query ? (
            results.length ? <ul className="space-y-2">{results.map(({ conversation, message }, index) => (
              <li key={`${conversation.id}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <button type="button" onClick={() => openResult(conversation.title, conversation.messages)} className="block w-full text-left">
                  <span className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><MessageSquareText size={14} />{conversation.title}</span>
                  <span className="mt-2 line-clamp-4 block whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{message.content}</span>
                  <span className="mt-2 block text-[10px] text-slate-500">{message.role === 'user' ? 'Domanda' : 'Risposta'} · {conversation.source}</span>
                </button>
              </li>
            ))}</ul> : <p className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-500">Nessun risultato. Prova parole diverse o importa altre conversazioni.</p>
          ) : (
            conversations.length ? <ul className="space-y-2">{[...conversations].reverse().map((conversation) => (
              <li key={conversation.id} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <FileText size={17} className="mt-0.5 shrink-0 text-slate-500" />
                <button type="button" onClick={() => openResult(conversation.title, conversation.messages)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-slate-100">{conversation.title}</span>
                  <span className="mt-1 block text-[10px] text-slate-500">{conversation.messages.length} messaggi · {conversation.source} · {new Date(conversation.importedAt).toLocaleDateString()}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-400">{conversation.messages[0]?.content || 'Conversazione senza testo'}</span>
                </button>
                <button type="button" aria-label="Elimina conversazione" title="Elimina conversazione" onClick={() => removeConversation(conversation.id)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={15} /></button>
              </li>
            ))}</ul> : <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center"><Archive size={24} className="mx-auto mb-3 text-slate-600" /><p className="text-sm font-medium text-slate-300">L’archivio è vuoto</p><p className="mt-1 text-xs leading-5 text-slate-500">Importa un’esportazione per poter cercare nelle vecchie conversazioni senza doverle riaprire una per una.</p></div>
          )}
        </div>
      </section>
    </div>
  );
};
