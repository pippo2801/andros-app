import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ content, role }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

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

  return (
    <div className={`flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative group max-w-[85%] p-4 rounded-2xl text-slate-100 shadow-lg border ${
        role === 'user' 
          ? 'bg-blue-600/30 border-blue-500/30 rounded-br-sm' 
          : 'bg-slate-900/90 border-slate-800 rounded-bl-sm'
      }`}>
        <div className="whitespace-pre-wrap break-words pr-7 pt-5 text-sm leading-relaxed">{content}</div>
        {copyFailed && <p role="status" className="mt-2 text-xs text-rose-300">Copia non riuscita. Riprova o seleziona il testo.</p>}
        
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
