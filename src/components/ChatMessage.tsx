import React, { useState } from 'react';
import { Check, Copy, Share2, Volume2, VolumeX } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

interface CodeSegment {
  type: 'text' | 'code';
  value: string;
  language?: string;
}

function splitCodeBlocks(value: string): CodeSegment[] {
  const segments: CodeSegment[] = [];
  const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: value.slice(cursor, match.index) });
    }
    segments.push({
      type: 'code',
      language: match[1].trim(),
      value: match[2].replace(/\n$/, ''),
    });
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length || segments.length === 0) {
    segments.push({ type: 'text', value: value.slice(cursor) });
  }
  return segments;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ content, role }) => {
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const segments = splitCodeBlocks(content);

  const copyText = async (text: string, codeIndex?: number) => {
    const success = await copyToClipboard(text);
    if (success) {
      if (codeIndex === undefined) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedCode(codeIndex);
        window.setTimeout(() => setCopiedCode(null), 2000);
      }
    }
    return success;
  };

  const handleSpeak = () => {
    if (!speechSupported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const spokenText = content.replace(/```[\s\S]*?```/g, ' blocco di codice ');
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = document.documentElement.lang || 'it-IT';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const handleShare = async () => {
    setShareNotice('');
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Messaggio Andros', text: content });
        setShareNotice('Condivisione completata');
        window.setTimeout(() => setShareNotice(''), 2500);
        return;
      }
      const success = await copyToClipboard(content);
      setShareNotice(success
        ? 'Condivisione non disponibile: testo copiato'
        : 'Condivisione non disponibile su questo dispositivo');
    } catch (error) {
      // Cancelled shares are normal user behaviour and should not trigger a copy.
      if (error instanceof Error && error.name === 'AbortError') return;
      const success = await copyToClipboard(content);
      setShareNotice(success
        ? 'Condivisione non riuscita: testo copiato'
        : 'Impossibile condividere o copiare il messaggio');
    }
    window.setTimeout(() => setShareNotice(''), 3000);
  };

  return (
    <div className={`flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative group max-w-[92%] sm:max-w-[85%] min-w-0 p-4 rounded-2xl text-slate-100 shadow-lg border ${
        role === 'user'
          ? 'bg-blue-600/30 border-blue-500/30 rounded-br-sm'
          : 'bg-slate-900/90 border-slate-800 rounded-bl-sm'
      }`}>
        <div className="space-y-3 text-sm leading-relaxed">
          {segments.map((segment, index) => segment.type === 'code' ? (
            <div key={index} className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90">
              <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-3 py-2 text-xs text-slate-400">
                <span className="truncate">{segment.language || 'Codice'}</span>
                <button
                  type="button"
                  onClick={() => void copyText(segment.value, index)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  aria-label="Copia codice"
                  title="Copia codice"
                >
                  {copiedCode === index ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCode === index ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
              <pre className="max-w-full overflow-x-auto p-3 text-xs leading-5 text-amber-50"><code>{segment.value}</code></pre>
              <div className="flex justify-end border-t border-slate-700/80 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => void copyText(segment.value, index)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  aria-label="Copia codice dal fondo del blocco"
                  title="Copia codice"
                >
                  {copiedCode === index ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCode === index ? 'Copiato' : 'Copia codice'}</span>
                </button>
              </div>
            </div>
          ) : segment.value ? (
            <p key={index} className="whitespace-pre-wrap break-words">{segment.value}</p>
          ) : null)}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-white/[0.08] pt-2">
          <button
            type="button"
            onClick={() => void copyText(content)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            title="Copia tutto il messaggio"
            aria-label="Copia tutto il messaggio"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copiato' : 'Copia'}</span>
          </button>
          {role === 'assistant' && speechSupported && (
            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              title={speaking ? 'Interrompi lettura' : 'Leggi messaggio ad alta voce'}
              aria-label={speaking ? 'Interrompi lettura del messaggio' : 'Leggi messaggio ad alta voce'}
              aria-pressed={speaking}
            >
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{speaking ? 'Interrompi' : 'Leggi'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            title="Condividi messaggio"
            aria-label="Condividi messaggio"
          >
            <Share2 size={14} />
            <span>Condividi</span>
          </button>
        </div>
        {shareNotice && (
          <p className="mt-1 text-right text-xs text-slate-400" role="status" aria-live="polite">
            {shareNotice}
          </p>
        )}
      </div>
    </div>
  );
};
