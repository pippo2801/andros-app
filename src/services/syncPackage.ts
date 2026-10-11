import type { ChatMessageData } from './ollama';
import type { ArchivedConversation } from './conversationArchive';
import { loadArchivedConversations, saveArchivedConversations } from './conversationArchive';

const HISTORY_KEY = 'andros.chat.history.v1';
const RULES_KEY = 'andros.memory.rules.v1';
const ARCHIVE_KEY = 'andros.archive.conversations.v1';
const MAX_PACKAGE_BYTES = 15 * 1024 * 1024;

export interface SyncRule {
  id: string;
  text: string;
  createdAt: number;
}

export interface AndrosSyncPackage {
  app: 'ANDROS OS';
  kind: 'andros-manual-sync';
  version: 1;
  exportedAt: string;
  sourcePlatform?: string;
  currentConversation: ChatMessageData[];
  rules: SyncRule[];
  conversations: ArchivedConversation[];
}

export interface SyncImportResult {
  rulesAdded: number;
  conversationsAdded: number;
  currentConversationArchived: boolean;
}

function readArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function validMessages(value: unknown): value is ChatMessageData[] {
  return Array.isArray(value) && value.length <= 10000 && value.every((item) =>
    item && (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' && item.content.length <= 40000);
}

function validRules(value: unknown): value is SyncRule[] {
  return Array.isArray(value) && value.length <= 5000 && value.every((item) =>
    item && typeof item.id === 'string' && typeof item.text === 'string' &&
    item.text.trim().length > 0 && item.text.length <= 500 &&
    typeof item.createdAt === 'number');
}

function validConversations(value: unknown): value is ArchivedConversation[] {
  return Array.isArray(value) && value.length <= 300 && value.every((item) =>
    item && typeof item.id === 'string' && typeof item.title === 'string' &&
    typeof item.source === 'string' && typeof item.importedAt === 'number' &&
    validMessages(item.messages));
}

function conversationFingerprint(conversation: ArchivedConversation): string {
  const first = conversation.messages[0]?.content || '';
  const last = conversation.messages[conversation.messages.length - 1]?.content || '';
  return [conversation.title.trim().toLocaleLowerCase(), conversation.messages.length, first, last].join('|');
}

export function createSyncPackage(
  currentConversation: ChatMessageData[],
  rules: SyncRule[],
): AndrosSyncPackage {
  return {
    app: 'ANDROS OS',
    kind: 'andros-manual-sync',
    version: 1,
    exportedAt: new Date().toISOString(),
    sourcePlatform: 'android',
    currentConversation: currentConversation.filter((m) =>
      (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'),
    rules: rules.filter((r) => typeof r.text === 'string' && r.text.trim()),
    conversations: loadArchivedConversations(),
  };
}

export function parseSyncPackage(raw: string): AndrosSyncPackage {
  if (raw.length > MAX_PACKAGE_BYTES) throw new Error('Il pacchetto supera il limite di 15 MB.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Il file non contiene JSON valido.');
  }
  if (!value || typeof value !== 'object') throw new Error('Formato pacchetto non riconosciuto.');
  const pack = value as Partial<AndrosSyncPackage>;
  if (pack.app !== 'ANDROS OS' || pack.kind !== 'andros-manual-sync' || pack.version !== 1) {
    throw new Error('Questo non è un pacchetto di sincronizzazione Andros supportato.');
  }
  if (!validMessages(pack.currentConversation) || !validRules(pack.rules) || !validConversations(pack.conversations)) {
    throw new Error('Il pacchetto contiene dati mancanti o non validi. Nessun dato è stato modificato.');
  }
  return pack as AndrosSyncPackage;
}

export function importAndMergeSyncPackage(pack: AndrosSyncPackage): SyncImportResult {
  const existingHistory = readArray<ChatMessageData>(HISTORY_KEY);
  const existingRules = readArray<SyncRule>(RULES_KEY);
  const existingConversations = loadArchivedConversations();

  const ruleKeys = new Set(existingRules.map((r) => r.text.trim().toLocaleLowerCase()));
  const newRules = pack.rules.filter((r) => {
    const key = r.text.trim().toLocaleLowerCase();
    if (ruleKeys.has(key)) return false;
    ruleKeys.add(key);
    return true;
  });
  const conversationKeys = new Set(existingConversations.map(conversationFingerprint));
  const incoming = [...pack.conversations];
  let currentConversationArchived = false;
  if (pack.currentConversation.some((m) => m.role === 'user' && m.content.trim())) {
    incoming.push({
      id: `sync-current-${Date.now()}`,
      title: 'Conversazione corrente importata',
      source: 'Sincronizzazione manuale Andros',
      importedAt: Date.now(),
      messages: pack.currentConversation,
    });
    currentConversationArchived = true;
  }
  const newConversations = incoming.filter((conversation) => {
    const key = conversationFingerprint(conversation);
    if (conversationKeys.has(key)) return false;
    conversationKeys.add(key);
    return true;
  });

  // Snapshot all affected keys and roll back if any write fails.
  const keys = [HISTORY_KEY, RULES_KEY, ARCHIVE_KEY];
  const snapshot = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existingHistory));
    localStorage.setItem(RULES_KEY, JSON.stringify([...existingRules, ...newRules].slice(-5000)));
    saveArchivedConversations([...existingConversations, ...newConversations]);
  } catch (error) {
    for (const [key, value] of snapshot) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch { /* best-effort rollback if storage is exhausted */ }
    }
    throw error instanceof Error ? error : new Error('Importazione non riuscita.');
  }

  return {
    rulesAdded: newRules.length,
    conversationsAdded: newConversations.length,
    currentConversationArchived,
  };
}
