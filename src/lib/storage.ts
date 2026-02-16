// Encrypted storage for sensitive data (auth tokens)

import { SyncHistoryEntry, ExtensionSettings, DEFAULT_SETTINGS } from '../shared/messages';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  SYNC_HISTORY: 'syncHistory',
  SETTINGS: 'settings',
  ENCRYPTION_KEY: 'encryptionKey',
} as const;

interface AuthToken {
  sessionCookies: string;
  username: string;
  expiresAt: number;
}

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTION_KEY);

  if (stored[STORAGE_KEYS.ENCRYPTION_KEY]) {
    const keyData = Uint8Array.from(atob(stored[STORAGE_KEYS.ENCRYPTION_KEY]), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  const exported = await crypto.subtle.exportKey('raw', key);
  const keyString = btoa(String.fromCharCode(...new Uint8Array(exported)));
  await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTION_KEY]: keyString });

  return key;
}

async function encrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

  return new TextDecoder().decode(decrypted);
}

// Auth token storage
export async function saveAuthToken(token: AuthToken): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(token));
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: encrypted });
}

export async function getAuthToken(): Promise<AuthToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
  if (!stored[STORAGE_KEYS.AUTH_TOKEN]) return null;

  try {
    const decrypted = await decrypt(stored[STORAGE_KEYS.AUTH_TOKEN]);
    const token = JSON.parse(decrypted) as AuthToken;

    // Check if expired
    if (token.expiresAt < Date.now()) {
      await clearAuthToken();
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.AUTH_TOKEN);
}

// Sync history storage
export async function getSyncHistory(): Promise<SyncHistoryEntry[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SYNC_HISTORY);
  return stored[STORAGE_KEYS.SYNC_HISTORY] || [];
}

export async function addSyncHistoryEntry(entry: SyncHistoryEntry): Promise<void> {
  const history = await getSyncHistory();
  history.unshift(entry);
  // Keep only last 50 entries
  const trimmed = history.slice(0, 50);
  await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_HISTORY]: trimmed });
}

export async function clearSyncHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_HISTORY]: [] });
}

// Settings storage
export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEYS.SETTINGS] };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: { ...current, ...settings } });
}
