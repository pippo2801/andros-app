import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { GenericOAuth2 } from '@capacitor-community/generic-oauth2';

export interface GoogleSession {
  accessToken: string;
  email: string;
  displayName: string;
}

export interface AndrosSyncSnapshot {
  schema: 1;
  updatedAt: number;
  archive: unknown[];
  rules: unknown[];
}

const APP_DATA_FILENAME = 'andros-os-sync-v1.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_FILES = 'https://www.googleapis.com/upload/drive/v3/files';

async function request(url: string, token: string, method = 'GET', data?: string, contentType = 'application/json'): Promise<any> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (data !== undefined) headers['Content-Type'] = contentType;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data,
      connectTimeout: 12000,
      readTimeout: 30000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Google Drive ha risposto con HTTP ${response.status}.`);
    }
    return response.data;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { method, headers, body: data, signal: controller.signal });
    if (!response.ok) throw new Error(`Google Drive ha risposto con HTTP ${response.status}.`);
    if (response.status === 204) return null;
    return await response.json();
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new Error('Richiesta a Google Drive scaduta dopo 30 secondi. Controlla la connessione e riprova.');
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function signInWithGoogle(clientId: string): Promise<GoogleSession> {
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

export async function syncAndrosSnapshot(token: string, local: AndrosSyncSnapshot): Promise<AndrosSyncSnapshot> {
  const query = new URLSearchParams({
    spaces: 'drive',
    q: `name='${APP_DATA_FILENAME}' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '100',
  });
  const listed = await request(`${DRIVE_FILES}?${query.toString()}`, token);
  const existing = Array.isArray(listed?.files) ? listed.files.find((file: any) => file.name === APP_DATA_FILENAME) : undefined;
  let remote: AndrosSyncSnapshot | null = null;
  if (existing?.id) {
    let downloaded: any;
    try {
      downloaded = await request(`${DRIVE_FILES}/${encodeURIComponent(existing.id)}?alt=media`, token);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'errore sconosciuto';
      throw new Error(`Non riesco a leggere il backup esistente su Google Drive (${detail}). Per sicurezza non ho sovrascritto il file remoto.`);
    }

    let parsed: any;
    try {
      parsed = typeof downloaded === 'string' ? JSON.parse(downloaded) : downloaded;
    } catch {
      throw new Error('Il backup presente su Google Drive non è JSON valido. Per evitare perdite di dati, la sincronizzazione è stata interrotta senza sovrascriverlo.');
    }
    if (!parsed || parsed.schema !== 1 || !Array.isArray(parsed.archive) || !Array.isArray(parsed.rules)) {
      throw new Error('Il backup su Google Drive ha una struttura non riconosciuta. Per sicurezza non è stato sovrascritto.');
    }
    remote = parsed as AndrosSyncSnapshot;
  }

  const itemTimestamp = (value: Record<string, unknown>): number | null => {
    for (const key of ['updatedAt', 'importedAt', 'createdAt', 'timestamp']) {
      const candidate = value[key];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    }
    return null;
  };

  const mergeById = (localItems: unknown[], remoteItems: unknown[]): unknown[] => {
    const map = new Map<string, unknown>();
    // Seed with remote data, then reconcile local records. When timestamps exist,
    // retain the newest record; on ties or missing timestamps, prefer local data.
    for (const value of [...remoteItems, ...localItems]) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id.trim()) continue;
      const previous = map.get(item.id);
      if (!previous) {
        map.set(item.id, value);
        continue;
      }
      const previousTimestamp = itemTimestamp(previous as Record<string, unknown>);
      const candidateTimestamp = itemTimestamp(item);
      if (previousTimestamp !== null && candidateTimestamp !== null) {
        if (candidateTimestamp >= previousTimestamp) map.set(item.id, value);
      } else {
        map.set(item.id, value);
      }
    }
    return [...map.values()];
  };
  const merged: AndrosSyncSnapshot = {
    schema: 1,
    updatedAt: Date.now(),
    archive: mergeById(local.archive, remote?.archive ?? []),
    rules: mergeById(local.rules, remote?.rules ?? []),
  };
  const body = JSON.stringify(merged);
  if (existing?.id) {
    await request(`${UPLOAD_FILES}/${encodeURIComponent(existing.id)}?uploadType=media`, token, 'PATCH', body);
  } else {
    const boundary = `andros_${Date.now()}_boundary`;
    const metadata = JSON.stringify({ name: APP_DATA_FILENAME, mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${boundary}--`;
    await request(`${UPLOAD_FILES}?uploadType=multipart&fields=id,name`, token, 'POST', multipart, `multipart/related; boundary=${boundary}`);
  }
  return merged;
}
