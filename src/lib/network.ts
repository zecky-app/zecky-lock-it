import { useEffect, useState } from 'react';
import { AppState, NativeModules } from 'react-native';
import { Tools } from 'react-native-zcash';
import type { Server } from './server';

// Whether the phone has any network connection, as iOS itself reports it
// (added to the Zcash library by patches/react-native-zcash+*.patch). This
// sends nothing anywhere. When the check is missing or fails, assume online
// and let the wallet's own errors speak.
export async function isOnline(): Promise<boolean> {
  const native = NativeModules.RNZcash;
  if (typeof native?.isOnline !== 'function') return true;
  try {
    return (await native.isOnline()) !== false;
  } catch {
    return true;
  }
}

/** Whether the phone is on Wi-Fi or a cable (not only mobile data). */
export async function onLocalNetwork(): Promise<boolean> {
  const native = NativeModules.RNZcash;
  if (typeof native?.canReachLocal !== 'function') return true;
  try {
    return (await native.canReachLocal()) !== false;
  } catch {
    return true;
  }
}

const PROBE_TIMEOUT_MS = 3000;

/** Asks a server for the chain height, giving up after a few seconds. */
export async function serverAnswers(server: Server): Promise<boolean> {
  const timeout = new Promise<number>(resolve =>
    setTimeout(() => resolve(0), PROBE_TIMEOUT_MS),
  );
  try {
    const height = await Promise.race([
      Tools.getBirthdayHeight(server.host, server.port),
      timeout,
    ]);
    return height > 0;
  } catch {
    return false;
  }
}

/**
 * Whether a home node (Rock it) can be reached now. On Wi-Fi the wallet's
 * own sync says enough. On mobile data the node is only reachable through a
 * VPN such as Tailscale, so the node itself is asked.
 */
export async function canReachHomeNode(server: Server): Promise<boolean> {
  if (await onLocalNetwork()) return true;
  return serverAnswers(server);
}

const POLL_MS = 3000;
const PROBE_EVERY_MS = 15000;

/**
 * For a home node on mobile data: whether the node answers, checked every
 * 15 seconds. Always true when not on a home node or when on Wi-Fi.
 */
export function useHomeNodeReachable(
  server: Server,
  homeNode: boolean,
  network: NetworkState,
): boolean {
  const [reachable, setReachable] = useState(true);
  const needed = homeNode && network.online && !network.local;
  useEffect(() => {
    if (!needed) {
      setReachable(true);
      return;
    }
    let alive = true;
    const probe = () => {
      if (AppState.currentState !== 'active') return;
      serverAnswers(server).then(ok => {
        if (alive) setReachable(ok);
      });
    };
    probe();
    const timer = setInterval(probe, PROBE_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [needed, server]);
  return reachable;
}

export interface NetworkState {
  online: boolean;
  /** On Wi-Fi or a cable, not only mobile data. */
  local: boolean;
}

/** Follows the connection while the app is in front. */
export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    online: true,
    local: true,
  });
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (AppState.currentState !== 'active') return;
      Promise.all([isOnline(), onLocalNetwork()]).then(([online, local]) => {
        if (alive) {
          setState(prev =>
            prev.online === online && prev.local === local
              ? prev
              : { online, local },
          );
        }
      });
    };
    check();
    const timer = setInterval(check, POLL_MS);
    const listener = AppState.addEventListener('change', check);
    return () => {
      alive = false;
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return state;
}
