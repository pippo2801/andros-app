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
  const response = await fetch(url, { method, headers, body: data });
  if (!response.ok) throw new Error(`Google Drive ha risposto con HTTP ${response.status}.`);
  if (response.status === 204) return null;
  return response.json();
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
    scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
    resourceUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    logsEnabled: false,
    additionalParameters: { access_type: 'online', include_granted_scopes: 'true' },
    android: {
      appId: normalizedId,
      authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      accessTokenEndpoint: 'https://oauth2.googleapis.com/token',
      responseType: 'code',
      pkceEnabled: true,
      redirectUrl: 'com.andros.app:/',
      scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
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
    spaces: 'appDataFolder',
    q: `name='${APP_DATA_FILENAME}' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '100',
  });
  const listed = await request(`${DRIVE_FILES}?${query.toString()}`, token);
  const existing = Array.isArray(listed?.files) ? listed.files.find((file: any) => file.name === APP_DATA_FILENAME) : undefined;
  let remote: AndrosSyncSnapshot | null = null;
  if (existing?.id) {
    try {
      const downloaded = await request(`${DRIVE_FILES}/${encodeURIComponent(existing.id)}?alt=media`, token);
      const parsed = typeof downloaded === 'string' ? JSON.parse(downloaded) : downloaded;
      if (parsed?.schema === 1) remote = parsed as AndrosSyncSnapshot;
    } catch {
      // A malformed remote backup is never allowed to replace local data.
    }
  }

  const mergeById = (left: unknown[], right: unknown[]): unknown[] => {
    const map = new Map<string, unknown>();
    for (const value of [...left, ...right]) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      if (typeof item.id !== 'string') continue;
      map.set(item.id, value);
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
    const metadata = JSON.stringify({ name: APP_DATA_FILENAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${boundary}--`;
    await request(`${UPLOAD_FILES}?uploadType=multipart&fields=id,name`, token, 'POST', multipart, `multipart/related; boundary=${boundary}`);
  }
  return merged;
}
