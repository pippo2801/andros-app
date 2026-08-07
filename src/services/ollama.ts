const OLLAMA_HOST = 'http://localhost:11434';

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendToOllama(messages: ChatMessageData[], model: string = 'qwen2.5-coder:1.5b') {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Errore server Ollama: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || "Nessuna risposta ricevuta dal modello.";
  } catch (error) {
    console.error("Errore di connessione a Ollama:", error);
    throw new Error("Impossibile connettersi a Ollama. Assicurati che sia avviato in Termux (ollama serve).");
  }
}
