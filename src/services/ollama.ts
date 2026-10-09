import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CONFIG_KEY = 'andros.ollama.config.v1';

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  endpoint: string;
  model: string;
}

const DEFAULT_CONFIG: OllamaConfig = {
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5-coder:7b',
};

export function getOllamaConfig(): OllamaConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<OllamaConfig>;
      return {
        endpoint: (parsed.endpoint || DEFAULT_CONFIG.endpoint).trim().replace(/\/+$/, ''),
        model: (parsed.model || DEFAULT_CONFIG.model).trim(),
      };
    }
  } catch (error) {
    console.warn('Impossibile leggere la configurazione di Andros:', error);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveOllamaConfig(config: OllamaConfig): OllamaConfig {
  const normalized = {
    endpoint: config.endpoint.trim().replace(/\/+$/, ''),
    model: config.model.trim(),
  };
  if (!/^https?:\/\//i.test(normalized.endpoint)) {
    throw new Error('L’indirizzo deve iniziare con http:// oppure https://.');
  }
  if (!normalized.model) throw new Error('Inserisci il nome del modello Ollama.');
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

async function getJson(url: string): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      connectTimeout: 7000,
      readTimeout: 12000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Il server ha risposto con HTTP ${response.status}.`);
    }
    return response.data;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Il server ha risposto con HTTP ${response.status}.`);
  return response.json();
}

async function postJson(url: string, data: unknown): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json' },
      data,
      connectTimeout: 10000,
      readTimeout: 120000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Il server ha risposto con HTTP ${response.status}.`);
    }
    return response.data;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Il server ha risposto con HTTP ${response.status}.`);
  return response.json();
}

export async function checkOllamaConnection(): Promise<string[]> {
  const { endpoint } = getOllamaConfig();
  const data = await getJson(`${endpoint}/api/tags`);
  return Array.isArray(data?.models)
    ? data.models.map((model: { name?: string }) => model.name).filter(Boolean)
    : [];
}

export async function sendToOllama(
  messages: ChatMessageData[],
  modelOverride?: string,
): Promise<string> {
  const config = getOllamaConfig();
  const model = modelOverride?.trim() || config.model;

  try {
    const data = await postJson(`${config.endpoint}/api/chat`, {
      model,
      messages,
      stream: false,
    });
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Ollama ha risposto, ma non ha restituito testo.');
    }
    return content;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Non riesco a raggiungere Ollama (${config.endpoint}). ${detail} Controlla che Ollama sia avviato, che l’indirizzo sia corretto e che il modello “${model}” sia installato.`,
    );
  }
}
