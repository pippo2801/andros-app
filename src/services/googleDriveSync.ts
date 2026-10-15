import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { GenericOAuth2 } from '@capacitor-community/generic-oauth2';

export interface GoogleSession {
  accessToken: string;
  email: string;
  displayName: string;
}

export interface AndrosSyncSnapshot {
  schema: 3;
  updatedAt: number;
  archive: unknown[];
  rules: unknown[];
  sessions: unknown[];
  deletedSessions: Array<{ id: string; deletedAt: number }>;
}

const APP_DATA_FILENAME = 'andros-os-sync-v1.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_FILES = 'https://www.googleapis.com/upload/drive/v3/files';

async function request(url: string, token: string, method = 'GET', data?: string, contentType = 'application/json'): Promise<any> {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Sessione Google scaduta o non valida. Accedi di nuovo prima di sincronizzare.');
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (data !== undefined) headers['Content-Type'] = contentType;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url, method, headers, data, connectTimeout: 12000, readTimeout: 30000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Google Drive ha risposto con HTTP ${response.status}.`);
    }
    return response.data;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: data, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La richiesta a Google Drive è scaduta dopo 30 secondi. Controlla la connessione e riprova.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Google Drive ha risposto con HTTP ${response.status}.`);
  if (response.status === 204) return null;
  const responseType = response.headers.get('content-type') || '';
  return responseType.includes('application/json') ? response.json() : response.text();
}

export async function signInWithGoogle(clientId: string): Promise<GoogleSession> {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new Error('Inserisci il Client ID OAuth di Google.');
  }
  const normalizedId = clientId.trim();
  if (!normalizedId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Inserisci il Client ID OAuth di Google completo (…apps.googleusercontent.com).');
  }
  if (!Capacitor.isNativePlatform()) {
    throw new Error('L’accesso Google è predisposto per l’APK Android. Per il browser serve un client OAuth Web e un redirect autorizzato.');
  }
  const options = {
    appId: normalizedId,
    authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    accessTokenEndpoint: 'https://oauth2.googleapis.com/token',
    responseType: 'code',
    pkceEnabled: true,
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
    resourceUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    logsEnabled: false,
    additionalParameters: { access_type: 'online', include_granted_scopes: 'true' },
    android: {
      appId: normalizedId,
      authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      accessTokenEndpoint: 'https://oauth2.googleapis.com/token',
      responseType: 'code',
      pkceEnabled: true,
      redirectUrl: 'com.andros.app://oauth/',
      scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
      resourceUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
      handleResultOnNewIntent: true,
      logsEnabled: false,
      additionalParameters: { access_type: 'online', include_granted_scopes: 'true' },
    },
  };
  const result = await GenericOAuth2.authenticate(options);
  const accessToken = typeof result?.access_token === 'string' ? result.access_token : '';
  if (!accessToken) throw new Error('Google non ha restituito un token di accesso. Controlla il Client ID e la configurazione OAuth.');
  const email = typeof result?.email === 'string' ? result.email : '';
  const displayName = typeof result?.name === 'string' ? result.name : email;
  return { accessToken, email, displayName };
}

function recordTimestamp(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const item = value as Record<string, unknown>;
  for (const key of ['updatedAt', 'updated_at', 'importedAt', 'createdAt', 'created_at', 'timestamp']) {
    const timestamp = item[key];
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

/** Merge by ID; newer timestamp wins, with local data winning ties or missing timestamps. */
function mergeById(local: unknown[], remote: unknown[], label: string): unknown[] {
  const map = new Map<string, { value: unknown; timestamp: number }>();
  for (const [source, values] of [['remote', remote], ['local', local]] as const) {
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Sincronizzazione interrotta: elemento non valido in ${label}. Nessun backup è stato sovrascritto.`);
      }
      const item = value as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id.trim() || item.id !== item.id.trim()) {
        throw new Error(`Sincronizzazione interrotta: un elemento di ${label} non ha un ID valido. Nessun backup è stato sovrascritto.`);
      }
      // Validate the fields consumed by the app before including remote records
      // in a new backup. Otherwise the UI could silently discard them after upload.
      const validMessages = (messages: unknown): boolean =>
        Array.isArray(messages) && messages.every((message) =>
          Boolean(message && typeof message === 'object' && !Array.isArray(message) &&
            ((message as Record<string, unknown>).role === 'user' ||
             (message as Record<string, unknown>).role === 'assistant') &&
            typeof (message as Record<string, unknown>).content === 'string'));
      let validRecord = true;
      if (label === 'chat') {
        validRecord = typeof item.title === 'string' && validMessages(item.messages) &&
          typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) &&
          typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) &&
          typeof item.pinned === 'boolean';
      } else if (label === 'archivio') {
        validRecord = typeof item.title === 'string' && typeof item.source === 'string' &&
          typeof item.importedAt === 'number' && Number.isFinite(item.importedAt) &&
          Array.isArray(item.messages) &&
          item.messages.every((message) => Boolean(message && typeof message === 'object' &&
            !Array.isArray(message) &&
            ((message as Record<string, unknown>).role === 'user' ||
             (message as Record<string, unknown>).role === 'assistant') &&
            typeof (message as Record<string, unknown>).content === 'string'));
      } else if (label === 'regole') {
        validRecord = typeof item.text === 'string' &&
          typeof item.createdAt === 'number' && Number.isFinite(item.createdAt);
      }
      if (!validRecord) {
        throw new Error(`Sincronizzazione interrotta: un elemento di ${label} non è completo o valido. Il backup remoto non è stato sovrascritto.`);
      }
      const timestamp = recordTimestamp(value);
      const previous = map.get(item.id);
      if (!previous || timestamp > previous.timestamp || (source === 'local' && timestamp === previous.timestamp)) {
        map.set(item.id, { value, timestamp });
      }
    }
  }
  return [...map.values()].map((entry) => entry.value);
}

export async function syncAndrosSnapshot(token: string, local: AndrosSyncSnapshot): Promise<AndrosSyncSnapshot> {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Sessione Google scaduta o token mancante. Accedi di nuovo prima di sincronizzare.');
  }
  if (!local || local.schema !== 3 || !Array.isArray(local.archive) || !Array.isArray(local.rules) ||
      !Array.isArray(local.sessions) || !Array.isArray(local.deletedSessions)) {
    throw new Error('I dati locali da sincronizzare non hanno un formato valido. Nessun backup remoto è stato modificato.');
  }
  const query = new URLSearchParams({
    spaces: 'drive',
    q: `name='${APP_DATA_FILENAME}' and trashed=false`,
    fields: 'files(id,name,modifiedTime,version)',
    pageSize: '100',
  });
  // Follow every Drive results page before deciding whether a backup is unique.
  // Looking only at page one could miss duplicate files and update the wrong backup.
  const matchingFiles: Array<{ id: string; name: string; modifiedTime?: string; version?: string }> = [];
  let pageToken: string | undefined;
  const seenPageTokens = new Set<string>();
  do {
    if (pageToken) {
      if (seenPageTokens.has(pageToken) || seenPageTokens.size >= 1000) {
        throw new Error('Google Drive ha restituito pagine ripetute o troppe pagine. La sincronizzazione è stata interrotta in sicurezza.');
      }
      seenPageTokens.add(pageToken);
      query.set('pageToken', pageToken);
    }
    const listed = await request(`${DRIVE_FILES}?${query.toString()}`, token);
    if (!Array.isArray(listed?.files)) {
      throw new Error('Google Drive ha restituito un elenco di backup non valido. La sincronizzazione è stata interrotta.');
    }
    matchingFiles.push(...listed.files.filter((file: unknown): file is { id: string; name: string; modifiedTime?: string; version?: string } =>
      Boolean(file && typeof file === 'object' && !Array.isArray(file) &&
        (file as Record<string, unknown>).name === APP_DATA_FILENAME &&
        typeof (file as Record<string, unknown>).id === 'string' &&
        Boolean(((file as Record<string, unknown>).id as string).trim()))));
    pageToken = typeof listed.nextPageToken === 'string' && listed.nextPageToken
      ? listed.nextPageToken
      : undefined;
  } while (pageToken);
  if (matchingFiles.length > 1) {
    throw new Error('Sono presenti più backup Andros con lo stesso nome su Google Drive. Per sicurezza la sincronizzazione è stata interrotta: conserva una copia, rinomina o elimina i duplicati e riprova.');
  }
  const existing = matchingFiles[0];
  let remote: { archive: unknown[]; rules: unknown[]; sessions: unknown[]; deletedSessions: Array<{ id: string; deletedAt: number }> } | null = null;
  if (existing?.id) {
    // Do not overwrite an existing backup if it cannot be read or validated.
    // A silent fallback to local-only data could erase valid remote records.
    let downloaded: unknown;
    try {
      downloaded = await request(`${DRIVE_FILES}/${encodeURIComponent(existing.id)}?alt=media`, token);
    } catch (cause) {
      throw new Error(cause instanceof Error
        ? `Impossibile leggere il backup Google Drive; nessun dato remoto è stato sovrascritto. ${cause.message}`
        : 'Impossibile leggere il backup Google Drive; nessun dato remoto è stato sovrascritto.');
    }

    let parsed: any;
    try {
      parsed = typeof downloaded === 'string' ? JSON.parse(downloaded) : downloaded;
    } catch {
      throw new Error('Il backup Google Drive contiene JSON non valido. Per sicurezza non è stato sovrascritto.');
    }

    // Read schema 1 backups as well as schema 2; old backups simply have no sessions.
    if (!parsed || ![1, 2, 3].includes(parsed.schema) ||
        !Array.isArray(parsed.archive) || !Array.isArray(parsed.rules) ||
        (parsed.sessions !== undefined && !Array.isArray(parsed.sessions)) ||
        (parsed.deletedSessions !== undefined && !Array.isArray(parsed.deletedSessions))) {
      throw new Error('Il backup Google Drive ha un formato non riconosciuto. Per sicurezza non è stato sovrascritto.');
    }
    remote = {
      archive: parsed.archive,
      rules: parsed.rules,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      deletedSessions: Array.isArray(parsed.deletedSessions) ? parsed.deletedSessions : [],
    };
  }

  const deletedMap = new Map<string, { id: string; deletedAt: number }>();
  for (const tombstone of [...(remote?.deletedSessions ?? []), ...(local.deletedSessions ?? [])]) {
    if (!tombstone || typeof tombstone.id !== 'string' || !tombstone.id.trim() ||
        typeof tombstone.deletedAt !== 'number' || !Number.isFinite(tombstone.deletedAt)) {
      throw new Error('Sincronizzazione interrotta: registro delle chat eliminate non valido. Il backup remoto non è stato sovrascritto.');
    }
    const id = tombstone.id.trim();
    const previous = deletedMap.get(id);
    if (!previous || tombstone.deletedAt > previous.deletedAt) deletedMap.set(id, { id, deletedAt: tombstone.deletedAt });
  }
  const deletedSessions = [...deletedMap.values()];
  const mergedSessions = mergeById(local.sessions, remote?.sessions ?? [], 'chat');
  // A deletion is authoritative for that ID. Do not resurrect it because another
  // device has a skewed clock or continued editing an older copy after deletion.
  const sessions = mergedSessions.filter((session) => {
    const item = session as Record<string, unknown>;
    return !deletedMap.has(item.id as string);
  });

  const merged: AndrosSyncSnapshot = {
    schema: 3,
    updatedAt: Date.now(),
    archive: mergeById(local.archive, remote?.archive ?? [], 'archivio'),
    rules: mergeById(local.rules, remote?.rules ?? [], 'regole'),
    sessions,
    deletedSessions,
  };
  const body = JSON.stringify(merged);
  if (existing?.id) {
    // Optimistic concurrency check: don't overwrite if another device changed
    // the backup while this device was downloading and merging it.
    const latest = await request(
      `${DRIVE_FILES}/${encodeURIComponent(existing.id)}?fields=id,modifiedTime,version`,
      token,
    );
    if (!latest || latest.id !== existing.id ||
        (existing.version !== undefined && String(latest.version) !== String(existing.version)) ||
        (existing.modifiedTime !== undefined && latest.modifiedTime !== existing.modifiedTime)) {
      throw new Error('Un altro dispositivo ha modificato il backup durante la sincronizzazione. Nessun aggiornamento è stato inviato: premi Sincronizza di nuovo per unire i dati più recenti.');
    }
    await request(`${UPLOAD_FILES}/${encodeURIComponent(existing.id)}?uploadType=media`, token, 'PATCH', body);
  } else {
    const boundary = `andros_${Date.now()}_boundary`;
    const metadata = JSON.stringify({ name: APP_DATA_FILENAME, mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${boundary}--`;
    await request(`${UPLOAD_FILES}?uploadType=multipart&fields=id,name`, token, 'POST', multipart, `multipart/related; boundary=${boundary}`);
  }
  return merged;
}
