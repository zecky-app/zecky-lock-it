import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';
import { Server, nodeKind } from './server';

// Whether the user wants Tor. Off by default: it is slower and some
// networks block it.
const KEY = 'zecky.tor';

/**
 * What the wallet is actually doing right now. 'ownNode': Tor is wanted,
 * but the server is the owner's own node (Rock it), so the wallet talks to
 * it directly. Tor hides the internet address from the server, and here
 * the server is yours; a Tor exit could not reach a home or Tailscale
 * address anyway (self-audit N6).
 */
export type TorStatus =
  | 'off'
  | 'starting'
  | 'on'
  | 'failed'
  | 'unavailable'
  | 'ownNode';

/** Whether the wallet itself should run over Tor with this server. */
export function torForServer(wanted: boolean, server: Server): boolean {
  return wanted && nodeKind(server) == null;
}

function load(): boolean {
  try {
    if (Platform.OS === 'ios') {
      const stored = Settings.get(KEY);
      return stored === true || stored === 1;
    }
  } catch {
    // Fall through to off.
  }
  return false;
}

let wanted: boolean | null = null;
const listeners = new Set<() => void>();

export function getTorWanted(): boolean {
  return (wanted ??= load());
}

export function setTorWanted(next: boolean): void {
  wanted = next;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: next });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the default (off), for Erase wallet. */
export function resetTor(): void {
  wanted = false;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: false });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

export function useTorWanted(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getTorWanted);
}

/**
 * With Tor wanted, a release or lock-in may only be built once Tor is
 * connected. When Tor cannot start, the engine stays on a direct
 * connection, so going ahead would tie the phone's internet address to the
 * release. Same rule as the price: no direct fallback behind your back.
 */
export function torBlocksRelease(
  torWanted: boolean,
  status: TorStatus,
): boolean {
  return torWanted && status !== 'on' && status !== 'ownNode';
}
