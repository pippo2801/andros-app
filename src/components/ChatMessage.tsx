import React, { useState } from 'react';
import { Copy, Check, Volume2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  onSpeak?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ content, role, onSpeak }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative group max-w-[85%] p-4 rounded-2xl text-slate-100 shadow-lg border ${
        role === 'user'
          ? 'bg-blue-600/30 border-blue-500/30 rounded-br-sm'
          : 'bg-slate-900/90 border-slate-800 rounded-bl-sm'
      }`}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>

        {role === 'assistant' && onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            aria-label="Leggi risposta ad alta voce"
            className="absolute top-2 right-10 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Leggi ad alta voce"
          >
            <Volume2 size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copia testo"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copia testo"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};
