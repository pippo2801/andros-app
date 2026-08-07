import React, { useState } from 'react';
import { Menu, Send, Sparkles } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ChatMessage } from '../components/ChatMessage';
import { sendToOllama, ChatMessageData } from '../services/ollama';

export default function Index() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([
    { role: 'assistant', content: 'Ciao! Sono Andros, il tuo assistente offline potenziato da Ollama. Come posso aiutarti?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessageData = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const responseText = await sendToOllama(updatedMessages);
      setMessages([...updatedMessages, { role: 'assistant', content: responseText }]);
    } catch (err: any) {
      setMessages([...updatedMessages, { role: 'assistant', content: `Errore: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center space-x-2">
          <Sparkles size={18} className="text-blue-400" />
          <span className="font-semibold text-sm tracking-wide">ANDROS AI</span>
        </div>
        <div className="w-9" /> {/* Spaziatore per centrare il titolo */}
      </header>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onNewChat={() => setMessages([{ role: 'assistant', content: 'Nuova conversazione avviata. Dimmi pure!' }])}
        onClearHistory={() => setMessages([])}
      />

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <ChatMessage key={index} content={msg.content} role={msg.role} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl rounded-bl-sm text-slate-400 text-sm animate-pulse">
              Andros sta elaborando...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 backdrop-blur">
        <form onSubmit={handleSend} className="flex items-center space-x-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio ad Andros..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-600/20 hover:opacity-95 disabled:opacity-50 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
