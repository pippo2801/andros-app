const BACKUP_FORMAT = 'andros-local-backup';
const BACKUP_VERSION = 1;

const BACKUP_KEYS = [
  'andros.chat.sessions.v1',
  'andros.chat.history.v1',
  'andros.chat.drafts.v1',
  'andros.memory.rules.v1',
  'andros.ai.mode.v1',
  'andros.ollama.config.v1',
  'andros.archive.conversations.v1',
] as const;

type BackupKey = (typeof BACKUP_KEYS)[number];

interface LocalBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  entries: Record<BackupKey, string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(value: string, key: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Il backup contiene dati JSON non validi per ${key}.`);
  }
}

function validateEntry(key: BackupKey, raw: string | null): void {
  if (raw === null) return;
  const value = parseJson(raw, key);

  if (key === 'andros.chat.sessions.v1') {
    if (!isRecord(value) || !Array.isArray(value.sessions) || typeof value.activeId !== 'string') {
      throw new Error('La cronologia delle chat nel backup non è valida.');
    }
    if (value.sessions.length > 300) throw new Error('Il backup contiene più di 300 conversazioni.');
    const ids = new Set<string>();
    let pinned = 0;
    for (const item of value.sessions) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.title !== 'string' || !item.title.trim() ||
        !Array.isArray(item.messages) || !Number.isFinite(item.createdAt) ||
        !Number.isFinite(item.updatedAt) || typeof item.pinned !== 'boolean') {
        throw new Error('Il backup contiene una conversazione non valida.');
      }
      if (ids.has(item.id)) throw new Error('Il backup contiene identificativi di chat duplicati.');
      ids.add(item.id);
      if (item.pinned) pinned += 1;
      if (!item.messages.every((message) => isRecord(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string')) {
        throw new Error('Il backup contiene messaggi non validi.');
      }
    }
    if (pinned > 30) throw new Error('Il backup contiene più di 30 chat fissate.');
  } else if (key === 'andros.chat.history.v1') {
    if (!Array.isArray(value) || !value.every((message) => isRecord(message) &&
      (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')) {
      throw new Error('La cronologia precedente nel backup non è valida.');
    }
  } else if (key === 'andros.chat.drafts.v1') {
    if (!isRecord(value) || !Object.values(value).every((draft) => typeof draft === 'string')) {
      throw new Error('Le bozze nel backup non sono valide.');
    }
  } else if (key === 'andros.memory.rules.v1') {
    if (!Array.isArray(value) || value.length > 100 || !value.every((rule) => isRecord(rule) &&
      typeof rule.id === 'string' && typeof rule.text === 'string' && rule.text.length <= 2000 &&
      typeof rule.createdAt === 'number' && Number.isFinite(rule.createdAt))) {
      throw new Error('Le regole di memoria nel backup non sono valide.');
    }
  } else if (key === 'andros.ai.mode.v1') {
    if (value !== 'auto' && value !== 'ollama' && value !== 'gemini') {
      throw new Error('La modalità AI nel backup non è riconosciuta.');
    }
  } else if (key === 'andros.ollama.config.v1') {
    if (!isRecord(value) || typeof value.endpoint !== 'string' || typeof value.model !== 'string') {
      throw new Error('La configurazione Ollama nel backup non è valida.');
    }
  } else if (key === 'andros.archive.conversations.v1' && !Array.isArray(value)) {
    throw new Error('L’archivio nel backup non è valido.');
  }
}

export function createLocalBackup(): Blob {
  const entries = Object.fromEntries(
    BACKUP_KEYS.map((key) => [key, localStorage.getItem(key)]),
  ) as Record<BackupKey, string | null>;
  const backup: LocalBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    entries,
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
}

export function restoreLocalBackup(raw: string): void {
  const parsed: unknown = parseJson(raw, 'backup');
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION ||
    !isRecord(parsed.entries)) {
    throw new Error('File non riconosciuto: scegli un backup locale Andros compatibile.');
  }

  const entries = parsed.entries;
  for (const key of Object.keys(entries)) {
    if (!(BACKUP_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Il backup contiene una chiave non consentita: ${key}.`);
    }
  }

  const normalized = {} as Record<BackupKey, string | null>;
  for (const key of BACKUP_KEYS) {
    const entry = entries[key];
    if (entry !== undefined && entry !== null && typeof entry !== 'string') {
      throw new Error(`Formato non valido per ${key}.`);
    }
    normalized[key] = entry === undefined ? null : entry;
    validateEntry(key, normalized[key]);
  }

  const previous = Object.fromEntries(BACKUP_KEYS.map((key) => [key, localStorage.getItem(key)])) as Record<BackupKey, string | null>;
  try {
    for (const key of BACKUP_KEYS) {
      const value = normalized[key];
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const key of BACKUP_KEYS) {
      try {
        const value = previous[key];
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Best-effort rollback if browser storage is full or unavailable.
      }
    }
    throw new Error(error instanceof Error
      ? `Ripristino non completato; ho provato a ripristinare i dati precedenti. ${error.message}`
      : 'Ripristino non completato; ho provato a ripristinare i dati precedenti.');
  }
}
