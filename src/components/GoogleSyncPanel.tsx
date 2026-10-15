import React, { useState } from 'react';
import { Cloud, CloudDownload, CloudUpload, LogIn, LogOut, ShieldCheck, X, AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { signInWithGoogle, syncAndrosSnapshot, type AndrosSyncSnapshot, type GoogleSession } from '../services/googleDriveSync';
import { loadArchivedConversationsForSync, loadArchivedConversations, saveArchivedConversations } from '../services/conversationArchive';
import { loadChatSessionStateForSync, loadDeletedChatSessions, saveChatSessionState, saveDeletedChatSessions, type ChatSession } from '../services/chatSessions';

const CLIENT_KEY = 'andros.google.oauth-client-id.v1';
const RULES_KEY = 'andros.memory.rules.v1';

interface MemoryRule {
  id: string;
  text: string;
  createdAt: number;
}

interface GoogleSyncPanelProps {
  onClose: () => void;
  onSynced: (data: { rules: MemoryRule[]; sessions: ChatSession[] }) => void;
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
      setStatus(`Accesso Google riuscito${result.email ? `: ${result.email}` : ''}. Puoi sincronizzare chat, archivio e regole.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Accesso Google non riuscito.');
    } finally { setBusy(false); }
  };

  const sync = async () => {
    if (!session) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const archive: unknown[] = loadArchivedConversationsForSync();
      const rawRules = localStorage.getItem(RULES_KEY);
      let rules: unknown[] = [];
      if (rawRules !== null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawRules);
        } catch {
          throw new Error('Le regole permanenti locali sono danneggiate. La sincronizzazione è stata interrotta per proteggere il backup.');
        }
        if (!Array.isArray(parsed) || !parsed.every((rule) =>
          Boolean(rule && typeof rule === 'object' &&
            typeof rule.id === 'string' && typeof rule.text === 'string' &&
            typeof rule.createdAt === 'number' && Number.isFinite(rule.createdAt)))) {
          throw new Error('Le regole permanenti locali non hanno un formato valido. La sincronizzazione è stata interrotta per proteggere il backup.');
        }
        rules = parsed;
      }
      const chatState = loadChatSessionStateForSync();
      const local: AndrosSyncSnapshot = {
        schema: 3,
        updatedAt: Date.now(),
        archive,
        rules,
        sessions: chatState.sessions,
        deletedSessions: loadDeletedChatSessions(),
      };
      const merged = await syncAndrosSnapshot(session.accessToken, local);

      // Validate the complete merged snapshot before changing any local storage.
      // Filtering invalid records here could silently discard data after Drive was updated.
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        Boolean(value && typeof value === 'object' && !Array.isArray(value));
      const validRules = merged.rules.filter((rule) =>
        isRecord(rule) && typeof rule.id === 'string' && Boolean(rule.id.trim()) &&
        typeof rule.text === 'string' &&
        typeof rule.createdAt === 'number' && Number.isFinite(rule.createdAt));
      if (validRules.length !== merged.rules.length) {
        throw new Error('Le regole unite dalla sincronizzazione non sono valide. I dati locali non sono stati aggiornati.');
      }
      const validSessions = merged.sessions.filter((item) =>
        isRecord(item) && typeof item.id === 'string' && Boolean(item.id.trim()) &&
        typeof item.title === 'string' &&
        Array.isArray(item.messages) && item.messages.every((message) =>
          isRecord(message) &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string') &&
        typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) &&
        typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) &&
        typeof item.pinned === 'boolean');
      if (validSessions.length !== merged.sessions.length) {
        throw new Error('Le chat unite dalla sincronizzazione non sono valide. I dati locali non sono stati aggiornati.');
      }
      const validArchive = merged.archive.every((item) =>
        isRecord(item) && typeof item.id === 'string' && Boolean(item.id.trim()) &&
        typeof item.title === 'string' && typeof item.source === 'string' &&
        typeof item.importedAt === 'number' && Number.isFinite(item.importedAt) &&
        Array.isArray(item.messages) && item.messages.every((message) =>
          isRecord(message) &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'));
      if (!validArchive) {
        throw new Error('L’archivio unito dalla sincronizzazione non è valido. I dati locali non sono stati aggiornati.');
      }

      // Snapshot the current values so a quota/write error does not leave a half-applied sync.
      const storageKeys = [
        'andros.archive.conversations.v1',
        RULES_KEY,
        'andros.chat.sessions.deleted.v1',
        'andros.chat.sessions.v1',
      ] as const;
      const previousValues = storageKeys.map((key) => ({ key, value: localStorage.getItem(key) }));
      const activeId = validSessions.some((item) => item.id === chatState.activeId)
        ? chatState.activeId
        : validSessions[0]?.id || chatState.activeId;
      try {
        // All records are validated before the first local write.
        saveArchivedConversations(merged.archive as ReturnType<typeof loadArchivedConversations>);
        localStorage.setItem(RULES_KEY, JSON.stringify(validRules));
        saveDeletedChatSessions(merged.deletedSessions);
        saveChatSessionState({ activeId, sessions: validSessions as ChatSession[] });
      } catch (writeError) {
        let rollbackFailed = false;
        for (const previous of previousValues.reverse()) {
          try {
            if (previous.value === null) localStorage.removeItem(previous.key);
            else localStorage.setItem(previous.key, previous.value);
          } catch {
            rollbackFailed = true;
          }
        }
        if (rollbackFailed) {
          throw new Error('La sincronizzazione non è riuscita e il ripristino locale è stato incompleto. Controlla chat, archivio e memoria prima di riprovare.');
        }
        throw writeError;
      }
      onSynced({ rules: validRules as MemoryRule[], sessions: validSessions as ChatSession[] });
      setStatus(`Sincronizzazione completata: ${validSessions.length} chat, ${merged.archive.length} conversazioni archiviate e ${validRules.length} regole disponibili su Google Drive.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sincronizzazione non riuscita.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="google-sync-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Cloud size={20} /></div>
            <h2 id="google-sync-title" className="text-lg font-semibold text-white">Account Google e sincronizzazione</h2>
            <p className="mt-1 text-sm leading-5 text-slate-400">File di sincronizzazione visibile in Google Drive, che puoi controllare ed eliminare.</p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X size={19} /></button>
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
            <div className="flex items-start gap-2"><CloudDownload size={15} className="mt-0.5 shrink-0 text-cyan-300" /><p className="text-[11px] leading-5 text-slate-400">La sincronizzazione unisce chat, archivio e regole per ID. Le eliminazioni delle chat vengono propagate tramite un registro di cancellazione, così una chat eliminata non dovrebbe ricomparire sugli altri dispositivi. I backup precedenti vengono migrati al nuovo formato. Il token resta in memoria e non viene salvato su disco.</p></div>
          </div>
        </div>
      </section>
    </div>
  );
};
