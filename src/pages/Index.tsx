import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, BookOpen, Bot, CheckCircle2, Cpu, Menu, Plus, Send, Settings2,
  Sparkles, Wifi, WifiOff, X, LoaderCircle, Trash2, MessageSquarePlus,
  ShieldCheck, ExternalLink, RefreshCw, Mic, Languages,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ChatMessage } from '../components/ChatMessage';
import { TranslationPanel } from '../components/TranslationPanel';
import { ArchivePanel } from '../components/ArchivePanel';
import { SyncPanel } from '../components/SyncPanel';
import { chooseModelForTask } from '../services/aiRouter';
import type { SyncRule } from '../services/syncPackage';
import { recognizeOnce, speakText } from '../services/voice';
import {
  getAccessibilityStatus,
  openAccessibilitySettings,
  type AndrosAccessibilityStatus,
} from '../services/accessibility';
import {
  checkOllamaConnection,
  getOllamaConfig,
  saveOllamaConfig,
  sendToOllama,
  type ChatMessageData,
  type OllamaConfig,
} from '../services/ollama';

const HISTORY_KEY = 'andros.chat.history.v1';
const RULES_KEY = 'andros.memory.rules.v1';

interface MemoryRule {
  id: string;
  text: string;
  createdAt: number;
}

function loadMemoryRules(): MemoryRule[] {
  try {
    const stored = localStorage.getItem(RULES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MemoryRule =>
        item &&
        typeof item.id === 'string' &&
        typeof item.text === 'string' &&
        typeof item.createdAt === 'number',
    );
  } catch (error) {
    console.warn('Regole permanenti non disponibili:', error);
    return [];
  }
}
const WELCOME: ChatMessageData = {
  role: 'assistant',
  content: 'Ciao! Sono Andros, il tuo assistente personale. Posso aiutarti a ragionare, scrivere, programmare e lavorare sui tuoi progetti. Per rispondere uso il modello Ollama configurato nelle impostazioni.',
};

type ConnectionState = 'unknown' | 'checking' | 'online' | 'offline';

function loadHistory(): ChatMessageData[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string',
        );
      }
    }
  } catch (error) {
    console.warn('Cronologia Andros non disponibile:', error);
  }
  return [WELCOME];
}

export default function Index() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [memoryRules, setMemoryRules] = useState<MemoryRule[]>(loadMemoryRules);
  const [ruleDraft, setRuleDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageData[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<OllamaConfig>(getOllamaConfig);
  const [activeModel, setActiveModel] = useState(config.model);
  const [endpointDraft, setEndpointDraft] = useState(config.endpoint);
  const [modelDraft, setModelDraft] = useState(config.model);
  const [connection, setConnection] = useState<ConnectionState>('unknown');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [settingsError, setSettingsError] = useState('');
  const [notice, setNotice] = useState('');
  const [accessibilityStatus, setAccessibilityStatus] = useState<AndrosAccessibilityStatus | null>(null);
  const [accessibilityLoading, setAccessibilityLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch (error) {
      console.warn('Impossibile salvare la cronologia:', error);
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(memoryRules));
    } catch (error) {
      console.warn('Impossibile salvare le regole permanenti:', error);
    }
  }, [memoryRules]);

  const refreshAccessibilityStatus = async () => {
    setAccessibilityLoading(true);
    try {
      const status = await getAccessibilityStatus();
      setAccessibilityStatus(status);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Stato Accessibilità non disponibile.');
    } finally {
      setAccessibilityLoading(false);
    }
  };

  const handleOpenAccessibilitySettings = async () => {
    try {
      await openAccessibilitySettings();
      setNotice('Attiva Andros solo se desideri abilitare la funzione Accessibilità. Android richiede la tua conferma.');
      window.setTimeout(() => { void refreshAccessibilityStatus(); }, 1200);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Impossibile aprire le impostazioni Accessibilità.');
    }
  };

  const openSettings = () => {
    setEndpointDraft(config.endpoint);
    setModelDraft(config.model);
    setSettingsError('');
    setSettingsOpen(true);
    setIsSidebarOpen(false);
    void refreshAccessibilityStatus();
  };

  const openArchive = () => {
    setArchiveOpen(true);
    setIsSidebarOpen(false);
  };

  const openMemory = () => {
    setRuleDraft('');
    setMemoryOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSaveRule = () => {
    const text = ruleDraft.trim();
    if (!text) return;
    if (memoryRules.some((rule) => rule.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
      setNotice('Questa regola è già presente nella memoria.');
      return;
    }
    const newRule: MemoryRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
    };
    setMemoryRules((current) => [...current, newRule]);
    setRuleDraft('');
    setNotice('Regola permanente salvata e approvata da te.');
  };

  const handleDeleteRule = (id: string) => {
    setMemoryRules((current) => current.filter((rule) => rule.id !== id));
    setNotice('Regola rimossa dalla memoria permanente.');
  };

  const handleCheckConnection = async () => {
    setSettingsError('');
    setConnection('checking');
    try {
      const saved = saveOllamaConfig({ endpoint: endpointDraft, model: modelDraft });
      setConfig(saved);
      setEndpointDraft(saved.endpoint);
      setModelDraft(saved.model);
      const models = await checkOllamaConnection();
      setAvailableModels(models);
      setConnection('online');
      setNotice(models.length ? `Ollama collegato · ${models.length} modelli disponibili` : 'Ollama raggiungibile, ma non risultano modelli installati.');
    } catch (error) {
      setConnection('offline');
      setSettingsError(error instanceof Error ? error.message : 'Connessione non riuscita.');
    }
  };

  const handleSaveSettings = () => {
    try {
      const saved = saveOllamaConfig({ endpoint: endpointDraft, model: modelDraft });
      setConfig(saved);
      setEndpointDraft(saved.endpoint);
      setModelDraft(saved.model);
      setConnection('unknown');
      setSettingsError('');
      setSettingsOpen(false);
      setNotice('Impostazioni salvate su questo dispositivo.');
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Impossibile salvare le impostazioni.');
    }
  };

  const handleVoiceInput = async () => {
    if (voiceLoading || loading) return;
    setVoiceLoading(true);
    try {
      const result = await recognizeOnce('it-IT');
      if (result.cancelled) {
        setNotice('Dettatura annullata.');
      } else if (result.text.trim()) {
        setInput(result.text.trim());
        setNotice('Testo trascritto. Controllalo prima di premere Invia: la trascrizione non verifica l’identità di chi parla.');
      } else {
        setNotice('Non ho riconosciuto parole. Riprova parlando più vicino al microfono.');
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Riconoscimento vocale non disponibile.');
      setNotice('Controlla il permesso microfono e la disponibilità del riconoscimento vocale Android.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleSpeak = async (text: string) => {
    try {
      await speakText(text);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sintesi vocale non disponibile.');
    }
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const updatedMessages: ChatMessageData[] = [...messages, { role: 'user', content: text }];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setNotice('');

    try {
      let models = availableModels;
      if (!models.length) {
        try {
          models = await checkOllamaConnection();
          setAvailableModels(models);
        } catch {
          // The request below will show the connection error with actionable guidance.
        }
      }
      const route = chooseModelForTask(text, models, config.model);
      setActiveModel(route.model);
      const responseText = await sendToOllama(updatedMessages, route.model, memoryRules.map((rule) => rule.text));
      setMessages([...updatedMessages, { role: 'assistant', content: responseText }]);
      setConnection('online');
      setNotice(`Router automatico · ${route.model} · ${route.reason}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto.';
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: `Non sono riuscito a completare la richiesta.\n\n${message}\n\nApri Impostazioni, controlla l’indirizzo di Ollama e verifica che il modello scelto sia installato.`,
      }]);
      setConnection('offline');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadArchivedConversation = (title: string, archivedMessages: ChatMessageData[]) => {
    const restored = archivedMessages.length ? archivedMessages : [WELCOME];
    setMessages(restored);
    setNotice(`Conversazione caricata: ${title}`);
  };

  const handleNewChat = () => {
    setMessages([WELCOME]);
    setIsSidebarOpen(false);
    setNotice('Nuova conversazione avviata.');
  };

  const handleClearHistory = () => {
    setMessages([WELCOME]);
    setIsSidebarOpen(false);
    setNotice('Cronologia locale azzerata.');
  };

  const connectionLabel = connection === 'online'
    ? 'Connesso'
    : connection === 'checking'
      ? 'Verifica…'
      : connection === 'offline'
        ? 'Non connesso'
        : 'Locale · Ollama';

  return (
    <main className="relative flex h-screen min-h-[100dvh] flex-col overflow-hidden bg-[#050914] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/3 h-72 w-72 rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-20 -right-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-slate-950/75 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Apri menu"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10"
          >
            <Menu size={19} />
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-gradient-to-br from-blue-500/20 to-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-950/30">
            <Bot size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold tracking-[0.18em]">ANDROS OS</span>
              <span className="hidden rounded-md border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-cyan-300 sm:inline">PERSONAL AI</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              {connection === 'online' ? <Wifi size={12} className="text-emerald-400" /> : connection === 'offline' ? <WifiOff size={12} className="text-amber-400" /> : <Cpu size={12} />}
              <span className="truncate">{connectionLabel} · {activeModel}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Traduttore multilingue"
            title="Traduttore multilingue"
            onClick={() => setTranslationOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200 transition hover:bg-cyan-400/15"
          >
            <Languages size={18} />
          </button>
          <button
            type="button"
            aria-label="Sincronizza"
            title="Sincronizza"
            onClick={() => setSyncOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200 transition hover:bg-cyan-400/15"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            aria-label="Nuova conversazione"
            onClick={handleNewChat}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10"
          >
            <MessageSquarePlus size={18} />
          </button>
          <button
            type="button"
            aria-label="Impostazioni"
            onClick={openSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onClearHistory={handleClearHistory}
        onOpenSettings={openSettings}
        onOpenMemory={openMemory}
        onOpenArchive={openArchive}
      />

      <section className="relative z-0 flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7">
          {messages.length === 1 && messages[0]?.role === 'assistant' && (
            <div className="mx-auto mb-7 mt-2 max-w-2xl text-center sm:mt-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-blue-500/20 to-cyan-400/10 text-cyan-200 shadow-2xl shadow-cyan-950/30">
                <Sparkles size={28} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Il tuo spazio, la tua intelligenza.</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Un assistente personale collegato al modello che scegli. Le conversazioni restano salvate localmente su questo dispositivo.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['Aiutami a organizzare la giornata', 'Spiegami un concetto difficile', 'Aiutami con il codice'].map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07]">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mx-auto max-w-3xl">
            {messages.map((message, index) => (
              <ChatMessage key={index} content={message.content} role={message.role} onSpeak={message.role === 'assistant' ? () => { void handleSpeak(message.content); } : undefined} />
            ))}
            {loading && (
              <div className="mb-4 flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-cyan-400/15 bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
                  <LoaderCircle size={16} className="animate-spin text-cyan-300" />
                  Andros sta elaborando…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="relative shrink-0 border-t border-white/[0.08] bg-slate-950/80 px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6 sm:pt-4">
          {notice && (
            <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 text-xs text-slate-400">
              <span>{notice}</span>
              <button type="button" aria-label="Chiudi avviso" onClick={() => setNotice('')} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>
          )}
          <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-2 shadow-2xl shadow-black/20 focus-within:border-cyan-400/30">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Scrivi ad Andros…"
              aria-label="Messaggio per Andros"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => { void handleVoiceInput(); }}
              disabled={loading || voiceLoading}
              aria-label="Dettatura vocale"
              title="Dettatura vocale"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200 transition hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {voiceLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Mic size={18} />}
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Invia messaggio"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-600">ANDROS OS · Router automatico locale · {activeModel} · La dettatura trascrive la voce ma non autentica chi parla</p>
        </div>
      </section>

      {syncOpen && (
        <SyncPanel
          onClose={() => setSyncOpen(false)}
          onNotice={setNotice}
          currentMessages={messages}
          rules={memoryRules as SyncRule[]}
          onRulesUpdated={(rules) => setMemoryRules(rules)}
        />
      )}

      {translationOpen && (
        <TranslationPanel
          onClose={() => setTranslationOpen(false)}
          onNotice={setNotice}
        />
      )}

      {archiveOpen && (
        <ArchivePanel
          onClose={() => setArchiveOpen(false)}
          onLoadConversation={handleLoadArchivedConversation}
          onNotice={setNotice}
          currentMessages={messages}
        />
      )}

      {memoryOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setMemoryOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="memory-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><BookOpen size={20} /></div>
                <h2 id="memory-title" className="text-lg font-semibold text-white">Memoria e regole permanenti</h2>
                <p className="mt-1 text-sm leading-5 text-slate-400">Le regole che scrivi e salvi qui vengono applicate alle richieste successive. Nessuna regola viene aggiunta senza la tua conferma.</p>
              </div>
              <button type="button" aria-label="Chiudi memoria" onClick={() => setMemoryOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19} /></button>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); handleSaveRule(); }} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Nuova regola</span>
                <textarea value={ruleDraft} onChange={(event) => setRuleDraft(event.target.value)} maxLength={500} rows={3} placeholder="Esempio: prima di modificare file importanti, crea un backup." className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-5 text-white outline-none transition focus:border-cyan-400/50" />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">{ruleDraft.length}/500 caratteri</span>
                <button type="submit" disabled={!ruleDraft.trim()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /> Salva e approva</button>
              </div>
            </form>

            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Regole salvate</h3>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{memoryRules.length}</span>
              </div>
              {memoryRules.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-5 text-slate-500">Non hai ancora salvato regole permanenti.</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {memoryRules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-200">{rule.text}</p>
                      <button type="button" aria-label="Elimina regola" title="Elimina regola" onClick={() => handleDeleteRule(rule.id)} className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[10px] leading-4 text-slate-500">La memoria è conservata in locale su questo dispositivo. Le regole vengono inviate al modello Ollama come contesto di sistema quando invii un messaggio.</p>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Settings2 size={20} /></div>
                <h2 id="settings-title" className="text-lg font-semibold text-white">Connessione e modello</h2>
                <p className="mt-1 text-sm leading-5 text-slate-400">Configura il server Ollama raggiungibile dal telefono.</p>
              </div>
              <button type="button" aria-label="Chiudi impostazioni" onClick={() => setSettingsOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19} /></button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Indirizzo Ollama</span>
                <input value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} placeholder="http://127.0.0.1:11434" inputMode="url" autoCapitalize="none" autoCorrect="off" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50" />
                <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">Se Ollama gira su un PC, usa l’indirizzo IP del PC raggiungibile dalla stessa rete. 127.0.0.1 funziona solo se Ollama gira sul telefono stesso.</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Nome del modello</span>
                <input value={modelDraft} onChange={(event) => setModelDraft(event.target.value)} placeholder="qwen2.5-coder:7b" autoCapitalize="none" autoCorrect="off" list="andros-model-list" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50" />
                <datalist id="andros-model-list">{availableModels.map((model) => <option key={model} value={model} />)}</datalist>
                {availableModels.length > 0 && <p className="mt-1.5 text-[11px] text-emerald-300">{availableModels.length} modelli rilevati sul server.</p>}
              </label>

              {settingsError && <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-xs leading-5 text-rose-200"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{settingsError}</span></div>}
              {connection === 'online' && !settingsError && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3 text-xs text-emerald-200"><CheckCircle2 size={16} /> Connessione verificata.</div>}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={handleCheckConnection} disabled={connection === 'checking'} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50">
                  {connection === 'checking' ? <LoaderCircle size={16} className="animate-spin" /> : <Wifi size={16} />} Verifica
                </button>
                <button type="button" onClick={handleSaveSettings} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-3 text-sm font-semibold text-white transition hover:brightness-110">Salva impostazioni</button>
              </div>
              <p className="text-[10px] leading-4 text-slate-500">La configurazione viene salvata sul dispositivo. Ollama deve essere avviato e raggiungibile; l’app non scarica automaticamente i modelli.</p>

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">Accessibilità Android</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Base nativa in fase iniziale. Rileva soltanto lo stato del servizio e il package in primo piano; non legge i contenuti e non esegue tocchi. L’attivazione è sempre manuale nelle impostazioni Android. La dettatura vocale è separata dall’autenticazione: per ora non dimostra che chi parla sia tu.</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/[0.07] bg-slate-950/70 p-3 text-xs">
                  {!accessibilityStatus ? (
                    <span className="text-slate-400">Stato non ancora verificato.</span>
                  ) : !accessibilityStatus.supported ? (
                    <span className="text-slate-400">Disponibile solo nell’app Android installata.</span>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Servizio abilitato</span>
                        <span className={accessibilityStatus.enabled ? 'text-emerald-300' : 'text-amber-300'}>{accessibilityStatus.enabled ? 'Sì' : 'No'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Servizio attivo</span>
                        <span className={accessibilityStatus.running ? 'text-emerald-300' : 'text-amber-300'}>{accessibilityStatus.running ? 'Sì' : 'No'}</span>
                      </div>
                      {accessibilityStatus.currentPackageProtected && (
                        <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.07] p-2 text-rose-200">App protetta rilevata: Andros non deve automatizzarla.</p>
                      )}
                      <p className="pt-1 text-[10px] leading-4 text-slate-500">{accessibilityStatus.message}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { void refreshAccessibilityStatus(); }} disabled={accessibilityLoading} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50">
                    <RefreshCw size={14} className={accessibilityLoading ? 'animate-spin' : ''} /> Aggiorna stato
                  </button>
                  <button type="button" onClick={() => { void handleOpenAccessibilitySettings(); }} disabled={!accessibilityStatus?.supported} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                    <ExternalLink size={14} /> Impostazioni Android
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">Il controllo automatico delle app non è ancora attivo in questa versione. Le app bancarie e di pagamento restano escluse dalla progettazione del motore operativo.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
