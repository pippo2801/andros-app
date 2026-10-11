import React, { useRef, useState } from 'react';
import { Download, FileUp, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  createSyncPackage,
  importAndMergeSyncPackage,
  parseSyncPackage,
  type SyncRule,
} from '../services/syncPackage';
import type { ChatMessageData } from '../services/ollama';

interface SyncPanelProps {
  onClose: () => void;
  onNotice: (message: string) => void;
  currentMessages: ChatMessageData[];
  rules: SyncRule[];
  onRulesUpdated: (rules: SyncRule[]) => void;
}

const RULES_KEY = 'andros.memory.rules.v1';

function readCurrentRules(): SyncRule[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RULES_KEY) || '[]');
    return Array.isArray(value) ? value as SyncRule[] : [];
  } catch {
    return [];
  }
}

function downloadPackage(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncPanel({
  onClose,
  onNotice,
  currentMessages,
  rules,
  onRulesUpdated,
}: SyncPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pack = createSyncPackage(currentMessages, rules);
      const file = new File(
        [JSON.stringify(pack, null, 2)],
        `andros-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        { type: 'application/json' },
      );

      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Pacchetto Andros OS', text: 'Trasferimento manuale dei dati Andros', files: [file] });
        onNotice('Pacchetto Andros condiviso. Il trasferimento avviene solo se scegli una destinazione.');
      } else {
        downloadPackage(file);
        onNotice('Pacchetto JSON esportato. Trasferiscilo manualmente sull’altro dispositivo.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onNotice('Condivisione annullata: nessun trasferimento completato.');
      } else {
        onNotice(error instanceof Error ? `Esportazione non riuscita: ${error.message}` : 'Esportazione non riuscita.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setSelectedName(file.name);
    try {
      const raw = await file.text();
      const pack = parseSyncPackage(raw);
      const currentRules = readCurrentRules();
      const newRules = pack.rules.filter((incoming) =>
        !currentRules.some((existing) => existing.text.trim().toLocaleLowerCase() === incoming.text.trim().toLocaleLowerCase()),
      );
      const estimatedConversations = pack.conversations.length + (pack.currentConversation.some((m) => m.role === 'user' && m.content.trim()) ? 1 : 0);
      const accepted = window.confirm(
        `Importare e unire il pacchetto selezionato?\n\nRegole nuove: circa ${newRules.length}\nConversazioni in ingresso: fino a ${estimatedConversations}\n\nLa chat attiva non verrà sostituita. L’operazione non invia dati a Internet.`,
      );
      if (!accepted) {
        onNotice('Importazione annullata. Nessun dato modificato.');
        return;
      }
      const result = importAndMergeSyncPackage(pack);
      onRulesUpdated(readCurrentRules());
      onNotice(`Unione completata: ${result.rulesAdded} regole e ${result.conversationsAdded} conversazioni aggiunte. ${result.currentConversationArchived ? 'La chat importata è stata aggiunta all’archivio.' : ''}`);
    } catch (error) {
      onNotice(error instanceof Error ? `Importazione non riuscita: ${error.message}` : 'Importazione non riuscita. Nessun dato dovrebbe essere stato modificato.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sync-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><RefreshCw size={20} /></div>
            <h2 id="sync-title" className="text-lg font-semibold text-white">Sincronizzazione manuale</h2>
            <p className="mt-1 text-sm leading-5 text-slate-400">Tu decidi quando esportare o importare. Andros non trasferisce nulla in automatico e non usa un cloud per questa funzione.</p>
          </div>
          <button type="button" aria-label="Chiudi sincronizzazione" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X size={19} /></button>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.045] p-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-cyan-200" />
          <p className="text-xs leading-5 text-slate-300">Il pacchetto contiene la conversazione corrente, le regole permanenti approvate e l’archivio. Non include l’indirizzo del motore AI. Importare aggiunge i dati senza sostituire la chat attiva.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => { void handleExport(); }} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] disabled:opacity-50">
            <Download size={20} className="text-cyan-200" />
            <span className="text-sm font-semibold text-white">Esporta pacchetto</span>
            <span className="text-[11px] leading-4 text-slate-400">Condividi o salva un file JSON.</span>
          </button>
          <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] disabled:opacity-50">
            <FileUp size={20} className="text-cyan-200" />
            <span className="text-sm font-semibold text-white">Importa e unisci</span>
            <span className="text-[11px] leading-4 text-slate-400">Scegli un pacchetto e conferma l’unione.</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Seleziona pacchetto di sincronizzazione"
          onChange={(event) => { void handleImport(event.target.files?.[0]); }}
        />
        {selectedName && <p className="mt-3 truncate text-[11px] text-slate-500">Ultimo file selezionato: {selectedName}</p>}
        {busy && <p className="mt-3 flex items-center gap-2 text-xs text-cyan-200"><RefreshCw size={14} className="animate-spin" /> Operazione in corso…</p>}
        <p className="mt-4 text-[10px] leading-4 text-slate-500">Prima di trasferire un pacchetto, ricorda che le conversazioni possono contenere informazioni personali. Il file resta sotto il tuo controllo.</p>
      </section>
    </div>
  );
}

export default SyncPanel;
