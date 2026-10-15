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
      const parsed: unknown = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Formato configurazione Ollama non valido.');
      }
      const values = parsed as Partial<OllamaConfig>;
      const endpoint = typeof values.endpoint === 'string' && values.endpoint.trim()
        ? values.endpoint.trim().replace(/\/+$/, '')
        : DEFAULT_CONFIG.endpoint;
      const model = typeof values.model === 'string' && values.model.trim()
        ? values.model.trim()
        : DEFAULT_CONFIG.model;
      if (model.length > 200 || /\\s/.test(model)) return { ...DEFAULT_CONFIG };
      let parsedEndpoint: URL;
      try {
        parsedEndpoint = new URL(endpoint);
      } catch {
        return { ...DEFAULT_CONFIG };
      }
      if ((parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') ||
          !parsedEndpoint.hostname || parsedEndpoint.username || parsedEndpoint.password ||
          parsedEndpoint.search || parsedEndpoint.hash) {
        return { ...DEFAULT_CONFIG };
      }
      return { endpoint, model };
    }
  } catch (error) {
    console.warn('Impossibile leggere la configurazione di Andros:', error);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveOllamaConfig(config: OllamaConfig): OllamaConfig {
  if (!config || typeof config !== 'object' ||
      typeof config.endpoint !== 'string' || typeof config.model !== 'string') {
    throw new Error('La configurazione Ollama deve contenere un indirizzo e un nome modello testuali.');
  }
  const normalized = {
    endpoint: config.endpoint.trim().replace(/\/+$/, ''),
    model: config.model.trim(),
  };
  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(normalized.endpoint);
  } catch {
    throw new Error('Inserisci un indirizzo Ollama valido, ad esempio http://127.0.0.1:11434.');
  }
  if ((parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') ||
      !parsedEndpoint.hostname || parsedEndpoint.username || parsedEndpoint.password ||
      parsedEndpoint.search || parsedEndpoint.hash) {
    throw new Error('L’indirizzo Ollama deve usare HTTP o HTTPS, avere un host valido e non contenere credenziali, query o frammenti.');
  }
  if (!normalized.model) throw new Error('Inserisci il nome del modello Ollama.');
  if (normalized.model.length > 200 || /\\s/.test(normalized.model)) {
    throw new Error('Il nome del modello Ollama non è valido. Usa il nome restituito da /api/tags, senza spazi e con massimo 200 caratteri.');
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Richiesta scaduta dopo ${Math.round(timeoutMs / 1000)} secondi.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

  const response = await fetchWithTimeout(url, { method: 'GET' }, 12000);
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

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, 120000);
  if (!response.ok) throw new Error(`Il server ha risposto con HTTP ${response.status}.`);
  return response.json();
}

export async function checkOllamaConnection(): Promise<string[]> {
  const { endpoint } = getOllamaConfig();
  const data = await getJson(`${endpoint}/api/tags`);
  if (!data || typeof data !== 'object' || !Array.isArray(data.models)) return [];
  return data.models
    .filter((model: unknown): model is { name: string } =>
      Boolean(model && typeof model === 'object' && !Array.isArray(model) &&
        typeof (model as Record<string, unknown>).name === 'string' &&
        Boolean(((model as Record<string, unknown>).name as string).trim())))
    .map((model: { name: string }) => model.name.trim());
}

export async function sendToOllama(
  messages: ChatMessageData[],
  modelOverride?: string,
  approvedRules: string[] = [],
): Promise<string> {
  if (!Array.isArray(messages) || !messages.every((message) =>
    message && typeof message === 'object' && !Array.isArray(message) &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string')) {
    throw new Error('La cronologia contiene messaggi non validi. Controlla la conversazione e riprova.');
  }
  if (!messages.some((message) => message.role === 'user' && message.content.trim())) {
    throw new Error('Scrivi un messaggio prima di inviare la richiesta a Ollama.');
  }
  if (!Array.isArray(approvedRules) || !approvedRules.every((rule) => typeof rule === 'string')) {
    throw new Error('Le regole permanenti non hanno un formato valido. Controllale nelle impostazioni.');
  }
  const config = getOllamaConfig();
  if (modelOverride !== undefined && typeof modelOverride !== 'string') {
    throw new Error('Il modello selezionato non è valido. Controlla le impostazioni.');
  }
  const model = modelOverride?.trim() || config.model;
  if (!model) throw new Error('Seleziona un modello Ollama nelle impostazioni.');
  if (model.length > 200 || /\\s/.test(model)) throw new Error('Il nome del modello Ollama non è valido.');

  try {
    const systemMessage = approvedRules.length
      ? [{
          role: 'system',
          content: 'Regole permanenti approvate dall’utente. Rispettale quando sono pertinenti:\n' +
            approvedRules.map((rule) => `- ${rule}`).join('\n'),
        }]
      : [];
    const data = await postJson(`${config.endpoint}/api/chat`, {
      model,
      messages: [...systemMessage, ...messages],
      stream: false,
    });
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Ollama ha risposto, ma non ha restituito testo.');
    }
    return content;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Errore di rete o risposta non riconosciuta.';
    throw new Error(
      `Non riesco a raggiungere Ollama (${config.endpoint}). ${detail} Controlla che Ollama sia avviato, che l’indirizzo sia corretto e che il modello “${model}” sia installato.`,
    );
  }
}
