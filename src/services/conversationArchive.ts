export interface ArchivedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ArchivedConversation {
  id: string;
  title: string;
  source: string;
  importedAt: number;
  messages: ArchivedMessage[];
}

const STORAGE_KEY = 'andros.archive.conversations.v1';
const MAX_CONVERSATIONS = 300;
const MAX_MESSAGE_LENGTH = 40_000;

function textFromContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if (typeof item.text === 'string') return item.text;
    if (Array.isArray(item.parts)) return textFromContent(item.parts);
    if (typeof item.content === 'string') return item.content;
  }
  return '';
}

function normalizeRole(value: unknown): 'user' | 'assistant' | null {
  if (typeof value !== 'string') return null;
  const role = value.toLowerCase();
  if (['user', 'human', 'prompt'].includes(role)) return 'user';
  if (['assistant', 'model', 'bot', 'chatgpt'].includes(role)) return 'assistant';
  return null;
}

function parseChatGptConversation(item: Record<string, unknown>, index: number): ArchivedConversation | null {
  const mapping = item.mapping;
  if (!mapping || typeof mapping !== 'object') return null;
  const nodes = Object.values(mapping as Record<string, unknown>)
    .filter((node): node is Record<string, unknown> => Boolean(node && typeof node === 'object'))
    .map((node) => node.message)
    .filter((message): message is Record<string, unknown> => Boolean(message && typeof message === 'object'))
    .sort((a, b) => Number(a.create_time || 0) - Number(b.create_time || 0));
  const messages: ArchivedMessage[] = [];
  for (const message of nodes) {
    const author = message.author && typeof message.author === 'object'
      ? (message.author as Record<string, unknown>).role
      : undefined;
    const role = normalizeRole(author);
    const content = textFromContent(message.content && typeof message.content === 'object'
      ? (message.content as Record<string, unknown>).parts ?? message.content
      : message.content).trim();
    if (role && content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH), timestamp: Number(message.create_time || 0) * 1000 || undefined });
  }
  if (!messages.length) return null;
  return {
    id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Conversazione importata ${index + 1}`,
    source: 'ChatGPT / JSON',
    importedAt: Date.now(),
    messages,
  };
}

function parseGenericJson(value: unknown, sourceName: string): ArchivedConversation[] {
  const root = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const output: ArchivedConversation[] = [];
  root.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const chatGpt = parseChatGptConversation(item, index);
    if (chatGpt) {
      output.push(chatGpt);
      return;
    }
    const entries = Array.isArray(item.messages) ? item.messages : Array.isArray(item.turns) ? item.turns : [];
    const messages: ArchivedMessage[] = [];
    for (const rawMessage of entries) {
      if (!rawMessage || typeof rawMessage !== 'object') continue;
      const msg = rawMessage as Record<string, unknown>;
      const role = normalizeRole(msg.role ?? msg.author ?? msg.sender);
      const content = textFromContent(msg.content ?? msg.text ?? msg.parts).trim();
      if (role && content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
    }
    if (messages.length) {
      output.push({
        id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        title: typeof item.title === 'string' ? item.title : typeof item.name === 'string' ? item.name : `Conversazione importata ${index + 1}`,
        source: sourceName,
        importedAt: Date.now(),
        messages,
      });
    }
  });
  return output;
}

function parsePlainText(text: string, name: string): ArchivedConversation[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const messages: ArchivedMessage[] = [];
  const blocks = cleaned.split(/\n(?=(?:You|User|Human|Assistant|ChatGPT|Gemini|Copilot)\s*[:：])/i);
  for (const block of blocks) {
    const match = block.match(/^(You|User|Human|Assistant|ChatGPT|Gemini|Copilot)\s*[:：]\s*([\s\S]*)$/i);
    if (!match) continue;
    const role = normalizeRole(match[1]);
    const content = match[2].trim();
    if (role && content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }
  if (!messages.length) messages.push({ role: 'user', content: cleaned.slice(0, MAX_MESSAGE_LENGTH) });
  return [{
    id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: name.replace(/\.[^.]+$/, '') || 'Testo importato',
    source: 'Testo importato',
    importedAt: Date.now(),
    messages,
  }];
}

export function parseArchiveFile(name: string, content: string): ArchivedConversation[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) {
    try {
      return parseGenericJson(JSON.parse(content), 'JSON importato');
    } catch {
      throw new Error('Il file JSON non è valido o non può essere letto.');
    }
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.csv')) {
    const withoutHtml = lower.endsWith('.html') || lower.endsWith('.htm')
      ? content.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')
      : content;
    return parsePlainText(withoutHtml, name);
  }
  throw new Error('Formato non supportato. Usa JSON, TXT, MD, HTML o CSV. Per gli archivi ZIP, estrai prima conversations.json.');
}

export function loadArchivedConversations(): ArchivedConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ArchivedConversation =>
      item && typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages));
  } catch {
    return [];
  }
}

export function saveArchivedConversations(conversations: ArchivedConversation[]): void {
  const bounded = conversations.slice(-MAX_CONVERSATIONS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    throw new Error('Memoria locale piena. Esporta o elimina alcune conversazioni e riprova.');
  }
}

export function searchArchivedConversations(conversations: ArchivedConversation[], query: string): Array<{
  conversation: ArchivedConversation;
  message: ArchivedMessage;
}> {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const matches: Array<{ conversation: ArchivedConversation; message: ArchivedMessage }> = [];
  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      const haystack = `${conversation.title} ${message.content} ${conversation.source}`.toLocaleLowerCase();
      if (terms.every((term) => haystack.includes(term))) matches.push({ conversation, message });
    }
  }
  return matches.slice(0, 100);
}

export function exportArchivedConversations(conversations: ArchivedConversation[]): string {
  return JSON.stringify({ app: 'ANDROS OS', version: 1, exportedAt: new Date().toISOString(), conversations }, null, 2);
}
