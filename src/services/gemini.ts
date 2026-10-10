import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ChatMessageData } from './ollama';

const GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiApiKey(): string {
  try {
    return sessionStorage.getItem('andros.gemini.api-key.session') || '';
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    if (key.trim()) sessionStorage.setItem('andros.gemini.api-key.session', key.trim());
    else sessionStorage.removeItem('andros.gemini.api-key.session');
  } catch {
    throw new Error('Il browser non consente di conservare la chiave nella sessione corrente.');
  }
}

export async function sendToGemini(
  messages: ChatMessageData[],
  apiKey: string,
  approvedRules: string[] = [],
): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new Error('Configura una chiave Gemini API gratuita in Google AI Studio oppure usa Ollama.');
  const contents = messages
    .filter((message, index) => index > 0 || message.role !== 'assistant')
    .reduce<Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>>((items, message) => {
      const role = message.role === 'assistant' ? 'model' as const : 'user' as const;
      const previous = items[items.length - 1];
      if (previous?.role === role) previous.parts[0].text += '\\n\\n' + message.content;
      else items.push({ role, parts: [{ text: message.content }] });
      return items;
    }, []);
  const body: Record<string, unknown> = { contents, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } };
  if (approvedRules.length) {
    body.systemInstruction = {
      parts: [{ text: 'Regole permanenti approvate dall’utente. Rispettale quando pertinenti:\n' + approvedRules.map((rule) => `- ${rule}`).join('\n') }],
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    let result: any;
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url,
        headers: { 'Content-Type': 'application/json' },
        data: body,
        connectTimeout: 15000,
        readTimeout: 120000,
      });
      if (response.status < 200 || response.status >= 300) {
        const detail = response.data?.error?.message || `HTTP ${response.status}`;
        throw new Error(detail);
      }
      result = response.data;
    } else {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || `HTTP ${response.status}`);
    }
    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
    if (!text) throw new Error('Gemini non ha restituito testo. La richiesta potrebbe essere stata bloccata o non avere una risposta disponibile.');
    return text;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API non disponibile: ${detail}. Puoi riprovare oppure disattivare Gemini e usare Ollama.`);
  }
}
