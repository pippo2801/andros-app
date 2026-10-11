import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CONFIG_KEY = 'andros.ollama.config.v1';

export type LocalAiRuntime = 'ollama' | 'llama.cpp';

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  endpoint: string;
  model: string;
  runtime: LocalAiRuntime;
}

const DEFAULT_CONFIG: OllamaConfig = {
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5-coder:7b',
  runtime: 'ollama',
};

export function getOllamaConfig(): OllamaConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<OllamaConfig>;
      const runtime: LocalAiRuntime = parsed.runtime === 'llama.cpp' ? 'llama.cpp' : 'ollama';
      return {
        endpoint: (parsed.endpoint || (runtime === 'llama.cpp' ? 'http://127.0.0.1:8080' : DEFAULT_CONFIG.endpoint)).trim().replace(/\/+$/, ''),
        model: (parsed.model || (runtime === 'llama.cpp' ? 'local-model' : DEFAULT_CONFIG.model)).trim(),
        runtime,
      };
    }
  } catch (error) {
    console.warn('Impossibile leggere la configurazione di Andros:', error);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveOllamaConfig(config: OllamaConfig): OllamaConfig {
  const runtime: LocalAiRuntime = config.runtime === 'llama.cpp' ? 'llama.cpp' : 'ollama';
  const normalized: OllamaConfig = {
    endpoint: config.endpoint.trim().replace(/\/+$/, ''),
    model: config.model.trim(),
    runtime,
  };
  if (!/^https?:\/\//i.test(normalized.endpoint)) {
    throw new Error('L’indirizzo deve iniziare con http:// oppure https://.');
  }
  if (!normalized.model) throw new Error('Inserisci il nome del modello locale.');
  try {
    const url = new URL(normalized.endpoint);
    if (url.username || url.password) {
      throw new Error('Non inserire credenziali nell’indirizzo del server locale.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('credenziali')) throw error;
    throw new Error('Indirizzo del server non valido.');
  }
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
      readTimeout: 180000,
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
  const config = getOllamaConfig();
  if (config.runtime === 'llama.cpp') {
    const data = await getJson(`${config.endpoint}/v1/models`);
    return Array.isArray(data?.data)
      ? data.data.map((model: { id?: string }) => model.id).filter(Boolean)
      : [];
  }
  const data = await getJson(`${config.endpoint}/api/tags`);
  return Array.isArray(data?.models)
    ? data.models.map((model: { name?: string }) => model.name).filter(Boolean)
    : [];
}

function extractMessageContent(data: any, runtime: LocalAiRuntime): string {
  const content = runtime === 'llama.cpp'
    ? data?.choices?.[0]?.message?.content
    : data?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

export async function sendToOllama(
  messages: ChatMessageData[],
  modelOverride?: string,
  approvedRules: string[] = [],
): Promise<string> {
  const config = getOllamaConfig();
  const model = modelOverride?.trim() || config.model;

  try {
    const systemMessage = approvedRules.length
      ? [{
          role: 'system',
          content: 'Regole permanenti approvate dall’utente. Rispettale quando sono pertinenti:\n' +
            approvedRules.map((rule) => `- ${rule}`).join('\n'),
        }]
      : [];
    const conversation = [...systemMessage, ...messages];
    const url = config.runtime === 'llama.cpp'
      ? `${config.endpoint}/v1/chat/completions`
      : `${config.endpoint}/api/chat`;
    const payload = config.runtime === 'llama.cpp'
      ? { model, messages: conversation, stream: false }
      : { model, messages: conversation, stream: false };
    const data = await postJson(url, payload);
    const content = extractMessageContent(data, config.runtime);
    if (!content) {
      throw new Error('Il motore locale ha risposto, ma non ha restituito testo.');
    }
    return content;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const engine = config.runtime === 'llama.cpp' ? 'llama.cpp' : 'Ollama';
    throw new Error(
      `Non riesco a raggiungere ${engine} (${config.endpoint}). ${detail} Controlla che il motore sia avviato e che il modello “${model}” sia disponibile. Andros non passa automaticamente a un servizio cloud.`,
    );
  }
}
