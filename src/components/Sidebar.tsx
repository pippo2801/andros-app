import React from 'react';
import { MessageSquare, Image, Terminal, Trash2, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onClearHistory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNewChat, onClearHistory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-full text-slate-200 z-10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
              A
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-wide">ANDROS</h1>
              <p className="text-xs text-slate-400">Assistente autonomo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-sm shadow-lg shadow-blue-600/20 hover:opacity-95 transition-all"
          >
            <MessageSquare size={18} />
            <span>Nuova conversazione</span>
          </button>
          
          <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-300 text-sm transition-colors">
            <Image size={18} className="text-slate-400" />
            <span>Immagini</span>
          </button>

          <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-300 text-sm transition-colors">
            <Terminal size={18} className="text-slate-400" />
            <span>Hacker Mode</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Cronologia</div>
          <div className="space-y-1">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300 truncate cursor-pointer hover:bg-slate-900">
              Voglio trasformare te in un apk per android
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-800">
          <button 
            onClick={onClearHistory}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-sm transition-colors"
          >
            <Trash2 size={16} />
            <span>Svuota cronologia</span>
          </button>
        </div>
      </div>
    </div>
  );
};
