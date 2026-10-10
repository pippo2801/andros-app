import { strFromU8, unzipSync } from 'fflate';
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

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseCsv(text: string, name: string): ArchivedConversation[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return parsePlainText(text, name);
  const headers = rows[0].map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findColumn = (patterns: RegExp[]) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  const promptIndex = findColumn([/^(prompt|question|userprompt|userquery|query|input|usertext)$/]);
  const responseIndex = findColumn([/^(response|answer|assistantresponse|output|reply|copilotresponse)$/]);
  const titleIndex = findColumn([/^(title|conversationtitle|chatname|topic)$/]);
  const dateIndex = findColumn([/^(date|timestamp|createdat|time)$/]);
  const output: ArchivedConversation[] = [];
  rows.slice(1).forEach((values, index) => {
    const prompt = promptIndex >= 0 ? (values[promptIndex] || '').trim() : '';
    const response = responseIndex >= 0 ? (values[responseIndex] || '').trim() : '';
    const otherText = values.filter((value, column) => column !== dateIndex && column !== titleIndex).map((value) => value.trim()).filter(Boolean);
    const messages: ArchivedMessage[] = [];
    if (prompt) messages.push({ role: 'user', content: prompt.slice(0, MAX_MESSAGE_LENGTH) });
    if (response) messages.push({ role: 'assistant', content: response.slice(0, MAX_MESSAGE_LENGTH) });
    if (!messages.length && otherText.length) messages.push({ role: 'user', content: otherText.join('\n').slice(0, MAX_MESSAGE_LENGTH) });
    if (!messages.length) return;
    output.push({
      id: `csv-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      title: (titleIndex >= 0 ? values[titleIndex] : '')?.trim() || `Attività importata ${index + 1}`,
      source: /copilot|microsoft/i.test(name) ? 'Microsoft Copilot CSV' : 'CSV importato',
      importedAt: dateIndex >= 0 && values[dateIndex] ? (Date.parse(values[dateIndex]) || Date.now()) : Date.now(),
      messages,
    });
  });
  return output.length ? output : parsePlainText(text, name);
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
  if (lower.endsWith('.csv')) return parseCsv(content, name);
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.html') || lower.endsWith('.htm')) {
    const withoutHtml = lower.endsWith('.html') || lower.endsWith('.htm')
      ? content.replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, '\\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \\t]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n')
      : content;
    return parsePlainText(withoutHtml, name);
  }
  throw new Error('Formato non supportato. Usa ZIP, JSON, TXT, MD, HTML o CSV.');
}

export async function parseArchiveUpload(file: File): Promise<ArchivedConversation[]> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.zip')) return parseArchiveFile(file.name, await file.text());
  if (file.size > 100 * 1024 * 1024) throw new Error('L’archivio ZIP supera il limite di 100 MB.');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('Archivio ZIP non valido o danneggiato.');
  }
  const entries = Object.entries(files).filter(([path]) => !path.startsWith('__MACOSX/') && !path.endsWith('/'));
  const chatJson = entries.filter(([path]) => /(^|\\/)conversations(?:_\\d+)?\\.json$/i.test(path));
  const conversations: ArchivedConversation[] = [];
  for (const [path, bytes] of chatJson) {
    try {
      conversations.push(...parseArchiveFile(path.split('/').pop() || path, strFromU8(bytes)));
    } catch {
      // Continue reading other recognized files in the same archive.
    }
  }
  if (conversations.length) return conversations;
  const likelyHtml = entries.filter(([path]) => /gemini|myactivity|copilot|chat/i.test(path) && /\\.html?$/i.test(path));
  for (const [path, bytes] of likelyHtml.slice(0, 50)) {
    const imported = parseArchiveFile(path.split('/').pop() || path, strFromU8(bytes));
    if (imported.length) conversations.push(...imported);
  }
  if (conversations.length) return conversations;
  throw new Error('Non ho trovato conversazioni riconoscibili nello ZIP. Per ChatGPT cerca conversations.json; per Gemini esporta i dati da Google Takeout e seleziona Gemini.');
}

