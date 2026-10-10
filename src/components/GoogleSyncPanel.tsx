import React, { useState } from 'react';
import { Cloud, CloudDownload, CloudUpload, LogIn, LogOut, ShieldCheck, X, AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { signInWithGoogle, syncAndrosSnapshot, type AndrosSyncSnapshot, type GoogleSession } from '../services/googleDriveSync';
import { loadArchivedConversations, saveArchivedConversations } from '../services/conversationArchive';

const CLIENT_KEY = 'andros.google.oauth-client-id.v1';
const RULES_KEY = 'andros.memory.rules.v1';

interface GoogleSyncPanelProps {
  onClose: () => void;
  onSynced: (rules: Array<{ id: string; text: string; createdAt: number }>) => void;
}

export const GoogleSyncPanel: React.FC<GoogleSyncPanelProps> = ({ onClose, onSynced }) => {
  const [clientId, setClientId] = useState(() => {
    try { return localStorage.getItem(CLIENT_KEY) || ''; } catch { return ''; }
  });
  const [session, setSession] = useState<GoogleSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const signIn = async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const id = clientId.trim();
      if (!id) throw new Error('Inserisci il Client ID OAuth di Google.');
      localStorage.setItem(CLIENT_KEY, id);
      const result = await signInWithGoogle(id);
      setSession(result);
      setStatus(`Accesso Google riuscito${result.email ? `: ${result.email}` : ''}. Puoi sincronizzare archivio e regole.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Accesso Google non riuscito.');
    } finally { setBusy(false); }
  };

  const sync = async () => {
    if (!session) return;
    setBusy(true); setError(''); setStatus('');
    try {
      let archive: unknown[] = [];
      let rules: unknown[] = [];
      try { archive = loadArchivedConversations(); } catch { archive = []; }
      try {
        const parsed = JSON.parse(localStorage.getItem(RULES_KEY) || '[]');
        if (Array.isArray(parsed)) rules = parsed;
      } catch { rules = []; }
      const local: AndrosSyncSnapshot = { schema: 1, updatedAt: Date.now(), archive, rules };
      const merged = await syncAndrosSnapshot(session.accessToken, local);
      saveArchivedConversations(merged.archive as ReturnType<typeof loadArchivedConversations>);
      localStorage.setItem(RULES_KEY, JSON.stringify(merged.rules));
      onSynced(merged.rules as Array<{ id: string; text: string; createdAt: number }>);
      setStatus(`Sincronizzazione completata: ${merged.archive.length} conversazioni e ${merged.rules.length} regole disponibili su Google Drive.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sincronizzazione non riuscita.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="google-sync-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Cloud size={20} /></div>
            <h2 id="google-sync-title" className="text-lg font-semibold text-white">Account Google e sincronizzazione</h2>
            <p className="mt-1 text-sm leading-5 text-slate-400">File di sincronizzazione visibile in Google Drive, che puoi controllare ed eliminare.</p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19} /></button>
        </header>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-300">Google OAuth Client ID</span>
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="123456789-....apps.googleusercontent.com" autoCapitalize="none" autoCorrect="off" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50" />
            <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">È necessario registrare l’app Android com.andros.app in Google Cloud e abilitare Google Drive API. Non inserire password o client secret.</span>
          </label>
          {session && <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><ShieldCheck size={19} className="shrink-0 text-emerald-300" /><div className="min-w-0"><p className="text-sm font-medium text-emerald-200">Google collegato</p><p className="truncate text-xs text-slate-400">{session.email || session.displayName || 'Account autorizzato per questa sessione'}</p></div><button type="button" onClick={() => { setSession(null); setStatus('Sessione Google scollegata.'); }} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Disconnetti"><LogOut size={16} /></button></div>}
          {error && <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          {status && <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-200"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{status}</div>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy} onClick={() => void signIn()} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <LogIn size={16} />} Accedi con Google</button>
            <button type="button" disabled={busy || !session} onClick={() => void sync()} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <CloudUpload size={16} />} Sincronizza</button>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="flex items-start gap-2"><CloudDownload size={15} className="mt-0.5 shrink-0 text-cyan-300" /><p className="text-[11px] leading-5 text-slate-400">La sincronizzazione unisce archivio conversazioni e regole permanenti per ID, evitando duplicati. Crea o aggiorna il file ANDROS OS nella tua area Drive; puoi vederlo ed eliminarlo. Il token resta in memoria e non viene salvato su disco.</p></div>
          </div>
        </div>
      </section>
    </div>
  );
};
