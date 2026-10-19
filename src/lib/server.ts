import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';
import { LIGHTWALLETD_HOST, LIGHTWALLETD_PORT } from '../config';

/**
 * A Zcash light-wallet server (lightwalletd or Zaino). Reached over TLS,
 * except a home node on a private address (see isHomeNode).
 */
export interface Server {
  host: string;
  port: number;
}

export const DEFAULT_SERVER: Server = {
  host: LIGHTWALLETD_HOST,
  port: LIGHTWALLETD_PORT,
};

/** Public servers offered as one-tap choices. */
export const SERVER_PRESETS: { label: string; server: Server }[] = [
  { label: 'Automatic (nearest)', server: DEFAULT_SERVER },
  { label: 'Europe', server: { host: 'eu.zec.rocks', port: 443 } },
  { label: 'North America', server: { host: 'na.zec.rocks', port: 443 } },
  { label: 'South America', server: { host: 'sa.zec.rocks', port: 443 } },
  { label: 'Asia Pacific', server: { host: 'ap.zec.rocks', port: 443 } },
];

const KEY = 'zecky.server';
const SAVED_KEY = 'zecky.savedServers';

/** Longest name a saved server can have. */
export const MAX_SERVER_NAME = 32;

/**
 * Whether this server is a node on a private network: the home network
 * (10/8, 172.16/12, 192.168/16), this phone (127/8) or Tailscale (100.64/10).
 * These are reached without TLS (see isPrivateNodeHost in the react-native-zcash
 * patch, which must use the same ranges) and shown as Rock it.
 */
export function isHomeNode(server: Server): boolean {
  const parts = server.host.split('.');
  if (parts.length !== 4 || !parts.every(p => /^\d{1,3}$/.test(p))) {
    return false;
  }
  const numbers = parts.map(Number);
  if (numbers.some(n => n > 255)) return false;
  const [a, b] = numbers;
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** A server the user saved, under a name they chose. */
export interface SavedServer extends Server {
  name: string;
}

/** The name a saved server gets when the user leaves the name empty. */
export function defaultServerName(server: Server): string {
  return isHomeNode(server) ? 'Rock it' : server.host;
}

function cleanName(name: string, server: Server): string {
  const trimmed = name.trim().slice(0, MAX_SERVER_NAME);
  return trimmed.length > 0 ? trimmed : defaultServerName(server);
}

/** Reads saved servers, dropping anything malformed. */
export function parseSavedServers(raw: unknown): SavedServer[] {
  if (typeof raw !== 'string') return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const result: SavedServer[] = [];
  for (const item of list) {
    if (item == null || typeof item !== 'object') continue;
    const { name, address } = item as { name?: unknown; address?: unknown };
    if (typeof name !== 'string' || typeof address !== 'string') continue;
    const server = parseServer(address);
    if (server == null) continue;
    if (result.some(s => sameServer(s, server))) continue;
    result.push({ ...server, name: cleanName(name, server) });
  }
  return result;
}

function loadSaved(): SavedServer[] {
  try {
    if (Platform.OS === 'ios')
      return parseSavedServers(Settings.get(SAVED_KEY));
  } catch {
    // Fall through to an empty list.
  }
  return [];
}

let saved: SavedServer[] | null = null;
const savedListeners = new Set<() => void>();

function storeSaved(list: SavedServer[]): void {
  saved = list;
  try {
    if (Platform.OS === 'ios') {
      Settings.set({
        [SAVED_KEY]: JSON.stringify(
          list.map(s => ({ name: s.name, address: serverLabel(s) })),
        ),
      });
    }
  } catch {
    // Kept until the app is closed.
  }
  savedListeners.forEach(listener => listener());
}

export function getSavedServers(): SavedServer[] {
  return (saved ??= loadSaved());
}

/** Saves a server under a name, or renames it if it is already saved. */
export function saveServer(name: string, server: Server): SavedServer {
  const entry: SavedServer = {
    host: server.host,
    port: server.port,
    name: cleanName(name, server),
  };
  const list = getSavedServers();
  const index = list.findIndex(s => sameServer(s, server));
  storeSaved(
    index === -1
      ? [...list, entry]
      : list.map((s, i) => (i === index ? entry : s)),
  );
  return entry;
}

/** Removes a saved server. The server in use is not changed. */
export function forgetServer(server: Server): void {
  storeSaved(getSavedServers().filter(s => !sameServer(s, server)));
}

export function useSavedServers(): SavedServer[] {
  return useSyncExternalStore(listener => {
    savedListeners.add(listener);
    return () => savedListeners.delete(listener);
  }, getSavedServers);
}

/** The name to show for a server: its preset label or saved name, if any. */
export function serverName(server: Server): string | null {
  const preset = SERVER_PRESETS.find(p => sameServer(p.server, server));
  if (preset != null) return preset.label;
  const own = getSavedServers().find(s => sameServer(s, server));
  return own?.name ?? null;
}

export function parseServer(text: string): Server | null {
  const cleaned = text
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const match = /^([a-z0-9]([a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i.exec(
    cleaned,
  );
  if (match == null) return null;
  const port = match[3] == null ? 443 : Number(match[3]);
  if (port < 1 || port > 65535) return null;
  return { host: match[1].toLowerCase(), port };
}

export function serverLabel(server: Server): string {
  return `${server.host}:${server.port}`;
}

export function sameServer(a: Server, b: Server): boolean {
  return a.host === b.host && a.port === b.port;
}

function load(): Server {
  try {
    if (Platform.OS === 'ios') {
      const stored = Settings.get(KEY);
      if (typeof stored === 'string')
        return parseServer(stored) ?? DEFAULT_SERVER;
    }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_SERVER;
}

let current: Server | null = null;
const listeners = new Set<() => void>();

export function getServer(): Server {
  return (current ??= load());
}

export function setServer(server: Server): void {
  current = sameServer(server, DEFAULT_SERVER) ? DEFAULT_SERVER : server;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: serverLabel(current) });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the default server with no saved servers, for Erase wallet. */
export function resetServers(): void {
  current = DEFAULT_SERVER;
  saved = [];
  try {
    // Written out as values: clearing a setting with null does not reliably
    // reach the iOS settings store.
    if (Platform.OS === 'ios') {
      Settings.set({
        [KEY]: serverLabel(DEFAULT_SERVER),
        [SAVED_KEY]: JSON.stringify([]),
      });
    }
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
  savedListeners.forEach(listener => listener());
}

export function useServer(): Server {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getServer);
}
