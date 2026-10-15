import type { ChatMessageData } from './ollama';
import {
  loadArchivedConversationsForSync,
  saveArchivedConversations,
  type ArchivedConversation,
  type ArchivedMessage,
} from './conversationArchive';

export interface SyncRule {
  id: string;
  text: string;
  createdAt: number;
}

export interface SyncPackage {
  app: 'ANDROS OS';
  version: 1;
  exportedAt: string;
  currentMessages: ChatMessageData[];
  rules: SyncRule[];
  conversations: ArchivedConversation[];
}

const RULES_KEY = 'andros.memory.rules.v1';
const MAX_PACKAGE_BYTES = 15 * 1024 * 1024;
const MAX_RULES = 500;
const MAX_CONVERSATIONS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isMessage(value: unknown): value is ChatMessageData {
  return isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string';
}

function isRule(value: unknown): value is SyncRule {
  return isRecord(value) &&
    typeof value.id === 'string' && Boolean(value.id.trim()) &&
    typeof value.text === 'string' && Boolean(value.text.trim()) &&
    value.text.length <= 500 &&
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt);
}

function isArchivedMessage(value: unknown): value is ArchivedMessage {
  return isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    (value.timestamp === undefined || (typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)));
}

function isConversation(value: unknown): value is ArchivedConversation {
  return isRecord(value) &&
    typeof value.id === 'string' && Boolean(value.id.trim()) &&
    typeof value.title === 'string' && value.title.length <= 200 &&
    typeof value.source === 'string' && value.source.length <= 100 &&
    typeof value.importedAt === 'number' && Number.isFinite(value.importedAt) &&
    Array.isArray(value.messages) && value.messages.every(isArchivedMessage);
}

function validatePackage(value: unknown): asserts value is SyncPackage {
  if (!isRecord(value) || value.app !== 'ANDROS OS' || value.version !== 1 ||
      typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) ||
      !Array.isArray(value.currentMessages) || !value.currentMessages.every(isMessage) ||
      !Array.isArray(value.rules) || value.rules.length > MAX_RULES || !value.rules.every(isRule) ||
      !Array.isArray(value.conversations) || value.conversations.length > MAX_CONVERSATIONS ||
      !value.conversations.every(isConversation)) {
    throw new Error('Il pacchetto Andros non è valido o usa un formato non supportato. I dati locali non sono stati modificati.');
  }
}

export function createSyncPackage(currentMessages: ChatMessageData[], rules: SyncRule[]): SyncPackage {
  if (!Array.isArray(currentMessages) || !currentMessages.every(isMessage) ||
      !Array.isArray(rules) || rules.length > MAX_RULES || !rules.every(isRule)) {
    throw new Error('Impossibile esportare: cronologia corrente o regole permanenti non valide.');
  }
  const pack: SyncPackage = {
    app: 'ANDROS OS',
    version: 1,
    exportedAt: new Date().toISOString(),
    currentMessages: currentMessages.map((message) => ({ ...message })),
    rules: rules.map((rule) => ({ ...rule })),
    conversations: loadArchivedConversationsForSync().slice(-MAX_CONVERSATIONS),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(pack)).byteLength;
  if (bytes > MAX_PACKAGE_BYTES) {
    throw new Error('Il pacchetto supera 15 MB. Riduci l’archivio ed esporta di nuovo.');
  }
  return pack;
}

export function parseSyncPackage(raw: string): SyncPackage {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Il file del pacchetto è vuoto.');
  if (new TextEncoder().encode(raw).byteLength > MAX_PACKAGE_BYTES) {
    throw new Error('Il pacchetto supera il limite di 15 MB.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Il file del pacchetto non contiene JSON valido.');
  }
  validatePackage(parsed);
  return parsed;
}

export function importAndMergeSyncPackage(pack: SyncPackage): { rulesAdded: number; conversationsAdded: number } {
  validatePackage(pack);
  const rawRules = localStorage.getItem(RULES_KEY);
  let existingRules: SyncRule[] = [];
  if (rawRules !== null) {
    let parsedRules: unknown;
    try {
      parsedRules = JSON.parse(rawRules);
    } catch {
      throw new Error('Le regole locali sono danneggiate. Esporta una copia prima di importare il pacchetto.');
    }
    if (!Array.isArray(parsedRules) || !parsedRules.every(isRule)) {
      throw new Error('Le regole locali non sono valide. Il pacchetto non è stato importato.');
    }
    existingRules = parsedRules;
  }

  const rulesByText = new Map(existingRules.map((rule) => [rule.text.trim().toLocaleLowerCase(), rule]));
  let rulesAdded = 0;
  for (const rule of pack.rules) {
    const key = rule.text.trim().toLocaleLowerCase();
    if (!rulesByText.has(key) && existingRules.length + rulesAdded < MAX_RULES) {
      rulesByText.set(key, { ...rule, text: rule.text.trim() });
      rulesAdded++;
    }
  }
  const existingArchive = loadArchivedConversationsForSync();
  const archiveById = new Map(existingArchive.map((conversation) => [conversation.id, conversation]));
  const importedConversations: ArchivedConversation[] = pack.conversations.map((conversation) => ({ ...conversation, messages: conversation.messages.map((message) => ({ ...message })) }));
  if (pack.currentMessages.length && pack.currentMessages.some((message) => message.content.trim())) {
    importedConversations.push({
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Conversazione trasferita',
      source: 'Pacchetto Andros',
      importedAt: Date.now(),
      messages: pack.currentMessages.map((message) => ({ ...message })),
    });
  }
  let conversationsAdded = 0;
  for (const conversation of importedConversations) {
    if (!archiveById.has(conversation.id)) {
      archiveById.set(conversation.id, conversation);
      conversationsAdded++;
    }
  }

  const nextRules = [...rulesByText.values()].slice(-MAX_RULES);
  const nextArchive = [...archiveById.values()].slice(-MAX_CONVERSATIONS);
  const oldRules = rawRules;
  const oldArchive = localStorage.getItem('andros.archive.conversations.v1');
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(nextRules));
    saveArchivedConversations(nextArchive);
  } catch (error) {
    try {
      if (oldRules === null) localStorage.removeItem(RULES_KEY);
      else localStorage.setItem(RULES_KEY, oldRules);
      if (oldArchive === null) localStorage.removeItem('andros.archive.conversations.v1');
      else localStorage.setItem('andros.archive.conversations.v1', oldArchive);
    } catch (rollbackError) {
      console.error('Ripristino del salvataggio dopo importazione non riuscito:', rollbackError);
    }
    throw error instanceof Error ? error : new Error('Importazione non riuscita; nessun dato è stato intenzionalmente sostituito.');
  }
  return { rulesAdded, conversationsAdded };
}
