import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Tools } from 'react-native-zcash';
import { describeError } from './src/lib/errors';
import { clearIfFreshInstall } from './src/lib/freshInstall';
import { resetAllSettings } from './src/lib/resetSettings';
import { getServer } from './src/lib/server';
import { BackupScreen } from './src/screens/BackupScreen';
import { ConfirmPhraseScreen } from './src/screens/ConfirmPhraseScreen';
import { loadPhraseState, setPhraseUnconfirmed } from './src/lib/phraseCheck';
import { loadPinState, usePinEnabled } from './src/lib/pin';
import { HomeScreen } from './src/screens/HomeScreen';
import { LockScreen } from './src/screens/LockScreen';
import { RestoreScreen } from './src/screens/RestoreScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { makeStyles, useIsDark } from './src/theme';
import {
  createMnemonic,
  loadWallet,
  saveWallet,
  StoredWallet,
} from './src/wallet/seed';

type Stage =
  | { name: 'loading' }
  | { name: 'welcome' }
  | { name: 'restore' }
  | { name: 'backup'; wallet: StoredWallet }
  | { name: 'confirm'; wallet: StoredWallet }
  | { name: 'home'; wallet: StoredWallet; isNew: boolean };

const SPLASH_MS = 2000;

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
  useEffect(() => {
    const minimum = new Promise<void>(resolve =>
      setTimeout(resolve, SPLASH_MS),
    );
    clearIfFreshInstall()
      .catch(() => false)
      .then(() =>
        Promise.all([
          loadWallet(),
          loadPinState().catch(() => false),
          minimum,
          loadPhraseState(),
        ]),
      )
      .then(([wallet, hasPin]) => {
        setLocked(hasPin);
        setStage(
          wallet == null
            ? { name: 'welcome' }
            : { name: 'home', wallet, isNew: false },
        );
      })
      .catch(e => {
        setError(describe(e));
        setLocked(false);
        setStage({ name: 'welcome' });
      });
  }, []);

  // Lock again whenever the app is sent to the background.
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') setLocked(true);
    });
    return () => listener.remove();
  }, []);
  const showLock = pinEnabled && locked && stage.name === 'home';

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
      await saveWallet(wallet);
      setStage({ name: 'home', wallet, isNew });
    } catch (e) {
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
        {showLock && <LockScreen onUnlock={() => setLocked(false)} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.ink },
}));

export default App;
