import React, { useEffect, useRef, useState } from 'react';
import { Languages, MonitorSmartphone, RefreshCw, Volume2, X, Copy, LoaderCircle, ShieldAlert } from 'lucide-react';
import { speakText } from '../services/voice';
import { getLastVisibleScreenText, type ScreenTextSnapshot } from '../services/screenText';
import { translateText, TRANSLATION_LANGUAGES, type TranslationLanguage } from '../services/translation';

interface TranslationPanelProps {
  onClose: () => void;
  onNotice: (message: string) => void;
}

export function TranslationPanel({ onClose, onNotice }: TranslationPanelProps) {
  const [sourceLanguage, setSourceLanguage] = useState<TranslationLanguage>('auto');
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('it');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [screenBusy, setScreenBusy] = useState(false);
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [snapshot, setSnapshot] = useState<ScreenTextSnapshot | null>(null);
  const [error, setError] = useState('');
  const refreshTimer = useRef<number | null>(null);

  const captureScreenText = async (quiet = false) => {
    setScreenBusy(true);
    try {
      const result = await getLastVisibleScreenText();
      setSnapshot(result);
      if (!result.supported) {
        if (!quiet) setError(result.message);
      } else if (result.protected) {
        setSourceText('');
        setTranslatedText('');
        if (!quiet) setError('Schermata protetta: acquisizione e traduzione sono disabilitate.');
      } else if (result.text.trim()) {
        setSourceText(result.text);
        if (!quiet) {
          setError('');
          onNotice('Testo accessibile dell’ultima app non protetta acquisito. Premi Traduci per tradurlo.');
        }
      } else if (!quiet) {
        setError(result.message || 'Nessun testo accessibile disponibile. Alcune app richiedono OCR, non ancora integrato.');
      }
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Acquisizione dello schermo non riuscita.');
    } finally {
      setScreenBusy(false);
    }
  };

  useEffect(() => {
    if (liveRefresh) {
      void captureScreenText(true);
      refreshTimer.current = window.setInterval(() => { void captureScreenText(true); }, 2500);
    } else if (refreshTimer.current !== null) {
      window.clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    return () => {
      if (refreshTimer.current !== null) window.clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    };
  }, [liveRefresh]);

  const handleTranslate = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await translateText(sourceText, targetLanguage, sourceLanguage);
      setTranslatedText(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Traduzione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      onNotice('Traduzione copiata negli appunti.');
    } catch {
      setError('Copia non disponibile: seleziona manualmente la traduzione.');
    }
  };

  const languageOptions = TRANSLATION_LANGUAGES.filter((language) => language.code !== 'auto');

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="translation-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1120] p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Languages size={21} /></div>
            <div>
              <h2 id="translation-title" className="text-lg font-semibold text-white">Traduttore multilingue</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Usa il modello Ollama configurato. Con un modello locale la traduzione può funzionare senza inviare il testo a servizi esterni.</p>
            </div>
          </div>
          <button type="button" aria-label="Chiudi traduttore" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19} /></button>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-300">Lingua di origine
            <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value as TranslationLanguage)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white">
              <option value="auto">Rilevamento automatico</option>
              {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-300">Traduci in
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value as TranslationLanguage)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white">
              {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mb-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><MonitorSmartphone size={16} className="text-cyan-300" /> Traduzione dello schermo</div>
            <button type="button" onClick={() => void captureScreenText()} disabled={screenBusy} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-slate-200 disabled:opacity-50">
              {screenBusy ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Acquisisci testo
            </button>
          </div>
          <p className="text-[11px] leading-5 text-slate-400">Legge solo testo esposto dall’accessibilità Android dell’ultima app non protetta. Il servizio va attivato manualmente nelle impostazioni Android. Non è ancora OCR e non mostra una sovrapposizione sopra l’app originale.</p>
          {snapshot?.sourcePackage && <p className="mt-2 break-all text-[10px] text-slate-500">Origine: {snapshot.sourcePackage}{snapshot.capturedAt ? ` · ${new Date(snapshot.capturedAt).toLocaleTimeString()}` : ''}</p>}
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={liveRefresh} onChange={(e) => setLiveRefresh(e.target.checked)} />
            Aggiorna automaticamente il testo disponibile ogni 2,5 secondi
          </label>
          {snapshot?.protected && <p className="mt-2 flex items-center gap-2 text-xs text-rose-200"><ShieldAlert size={14} /> App protetta: contenuto bloccato.</p>}
        </div>

        <label className="block text-xs text-slate-300">Testo originale
          <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={5} maxLength={12000} placeholder="Scrivi o incolla un testo, oppure acquisiscilo dallo schermo…" className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-5 text-white outline-none focus:border-cyan-400/40" />
        </label>
        <button type="button" onClick={() => void handleTranslate()} disabled={busy || !sourceText.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Languages size={16} />} {busy ? 'Traduzione in corso…' : 'Traduci'}
        </button>

        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-xs leading-5 text-rose-200">{error}</p>}

        {translatedText && <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Traduzione</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleCopy()} title="Copia traduzione" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><Copy size={15} /></button>
              <button type="button" onClick={() => void speakText(translatedText).catch((e) => setError(e instanceof Error ? e.message : 'Sintesi vocale non disponibile.'))} title="Ascolta traduzione" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><Volume2 size={15} /></button>
            </div>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{translatedText}</p>
        </div>}
        <p className="mt-4 text-[10px] leading-4 text-slate-500">La qualità e le lingue effettivamente supportate dipendono dal modello installato. Nessun servizio di traduzione esterno a pagamento è richiesto.</p>
      </section>
    </div>
  );
}
