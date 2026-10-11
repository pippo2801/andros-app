import React, { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, FileUp, ShieldCheck, X } from 'lucide-react';
import type { ChatMessageData } from '../services/ollama';
import type { SyncRule } from '../services/syncPackage';
import { createSyncPackage, importAndMergeSyncPackage, parseSyncPackage } from '../services/syncPackage';

interface SyncPanelProps {
  onClose: () => void;
  onNotice: (message: string) => void;
  currentMessages: ChatMessageData[];
  rules: SyncRule[];
  onRulesUpdated: (rules: SyncRule[]) => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({
  onClose, onNotice, currentMessages, rules, onRulesUpdated,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const exportPackage = async () => {
    setError('');
    setBusy(true);
    try {
      const pack = createSyncPackage(currentMessages, rules);
      const json = JSON.stringify(pack, null, 2);
      const file = new File([json], 'andros-sync.json', { type: 'application/json' });
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Pacchetto Andros', text: 'Backup per trasferimento manuale tra dispositivi.', files: [file] });
        onNotice('Pacchetto Andros condiviso. Importalo manualmente sull’altro dispositivo.');
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'andros-sync.json';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        onNotice('Pacchetto Andros esportato. Trasferiscilo e importalo manualmente sull’altro dispositivo.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        onNotice('Esportazione annullata.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Esportazione non riuscita.');
      }
    } finally {
      setBusy(false);
    }
  };

  const importPackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > 15 * 1024 * 1024) {
      setError('Il file supera il limite di 15 MB.');
      return;
    }
    if (!window.confirm('Vuoi importare questo pacchetto? Andros unirà le regole e le conversazioni senza sostituire la chat corrente o cancellare i dati esistenti. Le impostazioni del modello non vengono trasferite.')) {
      onNotice('Importazione annullata: i dati non sono stati modificati.');
      return;
    }
    setBusy(true);
    try {
      const pack = parseSyncPackage(await file.text());
      const result = importAndMergeSyncPackage(pack);
      try {
        const mergedRules = JSON.parse(localStorage.getItem('andros.memory.rules.v1') || '[]') as SyncRule[];
        onRulesUpdated(mergedRules);
      } catch { /* persisted rules are still available on next app start */ }
      onNotice(`Importazione completata: ${result.rulesAdded} regole e ${result.conversationsAdded} conversazioni aggiunte. La chat corrente è rimasta invariata.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Importazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sync-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><ArrowLeftRight size={20} /></div>
            <h2 id="sync-title" className="text-lg font-semibold text-white">Sincronizza Andros</h2>
            <p className="mt-1 text-sm leading-5 text-slate-400">Decidi tu quando trasferire i dati. Non parte nessuna sincronizzazione automatica.</p>
          </div>
          <button type="button" aria-label="Chiudi sincronizzazione" onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X size={19} /></button>
        </div>

        <div className="mb-4 flex gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-300" />
          <p className="text-xs leading-5 text-slate-300">Trasferimento manuale tramite file. Nessun cloud e nessuna connessione permanente tra telefono e PC. La configurazione Ollama resta separata perché gli indirizzi sono diversi per dispositivo.</p>
        </div>

        <div className="space-y-3">
          <button type="button" onClick={() => { void exportPackage(); }} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] disabled:opacity-50">
            <ArrowDownToLine size={20} className="shrink-0 text-cyan-200" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Esporta pacchetto</span><span className="mt-1 block text-xs leading-5 text-slate-400">Crea un file con cronologia corrente, regole approvate e archivio.</span></span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] disabled:opacity-50">
            <FileUp size={20} className="shrink-0 text-cyan-200" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Importa e unisci</span><span className="mt-1 block text-xs leading-5 text-slate-400">Seleziona un pacchetto Andros; le regole e le conversazioni nuove si aggiungono senza cancellare quelle presenti.</span></span>
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={(event) => { void importPackage(event); }} className="hidden" />
        </div>

        {busy && <p role="status" className="mt-4 text-xs text-cyan-200">Operazione in corso…</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200">{error}</p>}
        <p className="mt-4 text-[10px] leading-4 text-slate-500">Nota: questo è un trasferimento manuale, non una sincronizzazione cloud in tempo reale. Il formato è pronto per essere supportato anche dall’edizione Windows.</p>
      </section>
    </div>
  );
};
