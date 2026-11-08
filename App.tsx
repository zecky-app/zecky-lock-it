import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Tools } from 'react-native-zcash';
import { asksAt, useAskWhen } from './src/lib/askWhen';
import { describeError } from './src/lib/errors';
import { clearIfFreshInstall } from './src/lib/freshInstall';
import { resetAllSettings } from './src/lib/resetSettings';
import { getServer } from './src/lib/server';
import { BackupScreen } from './src/screens/BackupScreen';
import { ConfirmPhraseScreen } from './src/screens/ConfirmPhraseScreen';
import { loadPhraseState, setPhraseUnconfirmed } from './src/lib/phraseCheck';
import { loadPinState, usePinEnabled } from './src/lib/pin';
import { loadSentLog } from './src/lib/sentLog';
import { loadServers } from './src/lib/server';
import { loadSecurityKeyState } from './src/lib/securityKey';
import { HomeScreen } from './src/screens/HomeScreen';
import { LockScreen } from './src/screens/LockScreen';
import { RestoreScreen } from './src/screens/RestoreScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { makeStyles, useIsDark } from './src/theme';
import { NETWORK } from './src/config';
import { ErrorScreen } from './src/screens/ErrorScreen';
import {
  createMnemonic,
  dropFirstStartSeed,
  guardIfPossible,
  hasOldWallet,
  legacyWalletKeys,
  loadWalletKeys,
  migrateOldWallet,
  saveWallet,
  seedPresent,
  stashFirstStartSeed,
  StoredWallet,
  WalletKeys,
} from './src/wallet/seed';

type Stage =
  | { name: 'loading' }
  | { name: 'welcome' }
  /** The wallet could not be read at start: retry, never Welcome (C-02). */
  | { name: 'error'; message: string }
  | { name: 'restore' }
  | { name: 'backup'; wallet: StoredWallet }
  | { name: 'confirm'; wallet: StoredWallet }
  | { name: 'home'; wallet: WalletKeys; isNew: boolean };

const SPLASH_MS = 2000;

/** The viewing key for a phrase, from the Zcash engine. */
const deriveUfvk = (mnemonic: string) =>
  Tools.deriveViewingKey(mnemonic, NETWORK);

/**
 * The wallet's keys for syncing. An install from before build 20 first
 * moves its phrase into the Secure Enclave (one Face ID); if that is
 * cancelled, this session uses the old item and the move is tried again at
 * the next start.
 */
async function loadKeys(): Promise<WalletKeys | null> {
  const keys = await loadWalletKeys();
  if (keys != null) {
    // An interrupted move left the unguarded copy behind: finish it (one
    // Face ID), or keep going with what is there.
    if (await hasOldWallet()) {
      try {
        return await migrateOldWallet(deriveUfvk, keys);
      } catch {
        return keys;
      }
    }
    const guarded = await guardIfPossible(keys).catch(() => keys);
    // Audit C-01: iOS removes the guarded item when the iPhone passcode is
    // turned off. Say so, instead of a cancelled-looking Face ID at Send.
    if (!(await seedPresent())) return { ...guarded, seedMissing: true };
    return guarded;
  }
  if (!(await hasOldWallet())) return null;
  try {
    return await migrateOldWallet(deriveUfvk);
  } catch {
    return legacyWalletKeys(deriveUfvk);
  }
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function App() {
  const styles = useStyles();
  const dark = useIsDark();
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinEnabled = usePinEnabled();
  const [locked, setLocked] = useState(true);
  // Keys to the lock: whether opening Zecky asks for the Zecky code, or
  // else Face ID / the iPhone passcode.
  useAskWhen();
  const askAtStart = asksAt('start', pinEnabled);
  const askAtStartRef = useRef(askAtStart);
  askAtStartRef.current = askAtStart;

  // After Erase wallet, settings go back to defaults once the wallet screen
  // has closed (changing the server while it runs would restart the wallet).
  const [resetPending, setResetPending] = useState(false);
  useEffect(() => {
    if (resetPending && stage.name === 'welcome') {
      resetAllSettings();
      setResetPending(false);
    }
  }, [resetPending, stage.name]);

  // Startup: show the opening screen for at least two seconds while the
  // wallet and the app-code setting are read from the Keychain. On the first
  // start after an install, leftovers from an earlier install go first.
  // Anything that cannot be read lands on an error screen with Retry: never
  // on Welcome, where Create or Restore could replace the wallet (C-02), and
  // never with the Zecky code counted as "not set" (C-05).
  const start = useCallback((splash: boolean) => {
    setStage({ name: 'loading' });
    const minimum = new Promise<void>(resolve =>
      setTimeout(resolve, splash ? SPLASH_MS : 0),
    );
    clearIfFreshInstall()
      .catch(() => false)
      .then(() =>
        Promise.all([
          loadKeys(),
          loadPinState(),
          minimum,
          loadPhraseState(),
          loadSecurityKeyState().catch(() => null),
          loadSentLog(),
          loadServers(),
        ]),
      )
      .then(([wallet, hasPin]) => {
        setLocked(asksAt('start', hasPin));
        setStage(
          wallet == null
            ? { name: 'welcome' }
            : { name: 'home', wallet, isNew: false },
        );
      })
      .catch(e => {
        setLocked(true);
        setStage({ name: 'error', message: describe(e) });
      });
  }, []);
  useEffect(() => start(true), [start]);

  // Lock again whenever the app is sent to the background.
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background' && askAtStartRef.current) setLocked(true);
    });
    return () => listener.remove();
  }, []);
  const showLock = askAtStart && locked && stage.name === 'home';

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // A new wallet only needs to scan from the current chain tip.
      const birthdayHeight = await Tools.getBirthdayHeight(
        getServer().host,
        getServer().port,
      );
      setStage({
        name: 'backup',
        wallet: { mnemonic: createMnemonic(), birthdayHeight },
      });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const adopt = useCallback(async (wallet: StoredWallet, isNew: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const keys = await saveWallet(wallet, await deriveUfvk(wallet.mnemonic));
      // The engine needs the phrase once to set up the account. It is
      // handed over once, outside React state (C-04); every later start
      // syncs with the viewing key only.
      stashFirstStartSeed(wallet.mnemonic);
      setStage({ name: 'home', wallet: keys, isNew });
    } catch (e) {
      dropFirstStartSeed();
      setError(describe(e));
      setStage({ name: 'welcome' });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.root}>
        {stage.name === 'loading' && <SplashScreen />}
        {stage.name === 'error' && (
          <ErrorScreen message={stage.message} onRetry={() => start(false)} />
        )}
        {stage.name === 'welcome' && (
          <WelcomeScreen
            onCreate={create}
            onRestore={() => {
              setError(null);
              setStage({ name: 'restore' });
            }}
            busy={busy}
            error={error}
          />
        )}
        {stage.name === 'backup' && (
          <BackupScreen
            mnemonic={stage.wallet.mnemonic}
            birthdayHeight={stage.wallet.birthdayHeight}
            onConfirm={() =>
              setStage({ name: 'confirm', wallet: stage.wallet })
            }
            busy={busy}
          />
        )}
        {stage.name === 'confirm' && (
          <ConfirmPhraseScreen
            mnemonic={stage.wallet.mnemonic}
            onPassed={() => {
              setPhraseUnconfirmed(false);
              adopt(stage.wallet, true);
            }}
            onLater={() => {
              setPhraseUnconfirmed(true);
              adopt(stage.wallet, true);
            }}
            onBack={() => setStage({ name: 'backup', wallet: stage.wallet })}
            busy={busy}
          />
        )}
        {stage.name === 'restore' && (
          <RestoreScreen
            onRestore={wallet => adopt(wallet, false)}
            onBack={() => setStage({ name: 'welcome' })}
            busy={busy}
          />
        )}
        {stage.name === 'home' && (
          <HomeScreen
            wallet={stage.wallet}
            isNew={stage.isNew}
            locked={showLock}
            onErased={() => {
              setError(null);
              setLocked(false);
              setResetPending(true);
              setStage({ name: 'welcome' });
            }}
          />
        )}
        {showLock && (
          <LockScreen withCode={pinEnabled} onUnlock={() => setLocked(false)} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.ink },
}));

export default App;
