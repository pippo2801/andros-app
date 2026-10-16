import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ content, role }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [failedBlock, setFailedBlock] = useState<number | null>(null);
  const [shareNotice, setShareNotice] = useState('');

  const segments = content.split(/(```[^\n]*\n[\s\S]*?```)/g);
  const copyCodeBlock = async (code: string, index: number) => {
    setFailedBlock(null);
    try {
      if (await copyToClipboard(code)) {
        setCopiedBlock(index);
        window.setTimeout(() => setCopiedBlock((current) => current === index ? null : current), 2000);
      } else {
        setFailedBlock(index);
      }
    } catch (error) {
      setFailedBlock(index);
      console.warn('Impossibile copiare il blocco di codice:', error);
    }
  };

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      const success = await copyToClipboard(content);
      if (success) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        setCopyFailed(true);
      }
    } catch (error) {
      setCopyFailed(true);
      console.warn('Impossibile copiare il messaggio negli appunti:', error);
    }
  };

  const handleShare = async () => {
    setShareNotice('');
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Messaggio Andros', text: content });
        setShareNotice('Condivisione completata');
      } else {
        const success = await copyToClipboard(content);
        setShareNotice(success
          ? 'Condivisione diretta non disponibile: testo copiato'
          : 'Condivisione non disponibile su questo dispositivo');
      }
    } catch (error) {
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
      <div className={`relative group max-w-[85%] p-4 rounded-2xl text-slate-100 shadow-lg border ${
        role === 'user' 
          ? 'bg-blue-600/30 border-blue-500/30 rounded-br-sm' 
          : 'bg-slate-900/90 border-slate-800 rounded-bl-sm'
      }`}>
        <div className="select-text break-words pt-5 text-sm leading-relaxed">
          {segments.map((segment, index) => {
            const match = segment.match(/^\x60\x60\x60([^\n]*)\n([\s\S]*?)\n?\x60\x60\x60$/);
            if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
            const language = match[1].trim();
            const code = match[2];
            const isCopied = copiedBlock === index;
            return (
              <div key={index} className="my-3 overflow-hidden rounded-xl border border-cyan-400/20 bg-slate-950/90">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-[11px] text-slate-400">
                  <span>{language || 'Codice'}</span>
                  <button type="button" onClick={() => { void copyCodeBlock(code, index); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" aria-label={isCopied ? 'Codice copiato' : 'Copia codice'}>
                    {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {isCopied ? 'Copiato' : 'Copia codice'}
                  </button>
                </div>
                <pre className="select-text overflow-x-auto p-3 text-xs leading-5 text-slate-100"><code>{code}</code></pre>
                <div className="flex items-center justify-end border-t border-white/10 px-3 py-1.5">
                  <button type="button" onClick={() => { void copyCodeBlock(code, index); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400">
                    {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {isCopied ? 'Codice copiato' : 'Copia alla fine'}
                  </button>
                </div>
                {failedBlock === index && <p role="status" className="px-3 pb-2 text-xs text-rose-300">Copia del codice non riuscita.</p>}
              </div>
            );
          })}
        </div>
        {copyFailed && <p role="status" className="mt-2 text-xs text-rose-300">Copia non riuscita. Riprova o seleziona il testo.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { void handleShare(); }}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            aria-label="Condividi messaggio"
            title="Condividi messaggio"
          >
            <Share2 size={14} />
            Condividi
          </button>
          {shareNotice && <p role="status" aria-live="polite" className="text-xs text-amber-200">{shareNotice}</p>}
        </div>
        
        <button
          type="button"
          aria-label={copied ? 'Testo copiato' : 'Copia testo'}
          onClick={() => { void handleCopy(); }}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          title="Copia testo"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};
