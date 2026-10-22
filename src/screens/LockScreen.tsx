import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { PinPad } from '../components/PinPad';
import { BrassButton, ZeckyLock } from '../components/lock';
import { confirmOwner } from '../lib/deviceAuth';
import { secondsUntilRetry, verifyPin } from '../lib/pin';
import { fonts, makeStyles, space } from '../theme';

function waitText(seconds: number): string {
  return seconds >= 60
    ? `Too many wrong codes. Try again in ${Math.ceil(seconds / 60)} min.`
    : `Too many wrong codes. Try again in ${seconds} s.`;
}

interface Props {
  /** A Zecky code is set: ask for it. Otherwise Face ID or the passcode. */
  withCode: boolean;
  onUnlock: () => void;
}

/** Covers the whole app until it is clear the owner is opening it. */
export function LockScreen({ withCode, onUnlock }: Props) {
  return withCode ? (
    <CodeLock onUnlock={onUnlock} />
  ) : (
    <DeviceLock onUnlock={onUnlock} />
  );
}

function CodeLock({ onUnlock }: { onUnlock: () => void }) {
  const styles = useStyles();
  const [wrong, setWrong] = useState(false);
  const [wait, setWait] = useState(secondsUntilRetry());

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait(secondsUntilRetry()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const check = useCallback(
    async (pin: string) => {
      if (await verifyPin(pin)) {
        onUnlock();
      } else {
        setWrong(true);
        setWait(secondsUntilRetry());
      }
    },
    [onUnlock],
  );

  return (
    <View style={styles.cover}>
      <ZeckyLock open={false} size={96} />
      <View style={[styles.wordmark, styles.wordmarkSmall]}>
        <Text style={styles.brand}>ZECKY</Text>
        <Text style={styles.product}>Lock it</Text>
      </View>
      <PinPad
        title="Enter your code"
        message={
          wait > 0 ? waitText(wait) : wrong ? 'Wrong code. Try again.' : null
        }
        disabled={wait > 0}
        onComplete={check}
      />
    </View>
  );
}

/** Face ID or the iPhone passcode, asked straight away when Zecky opens. */
function DeviceLock({ onUnlock }: { onUnlock: () => void }) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setBusy(true);
    const result = await confirmOwner('Open Zecky Lock it');
    asking.current = false;
    setBusy(false);
    // Without a passcode on the iPhone there is nothing to ask.
    if (result !== 'cancelled') onUnlock();
  }, [onUnlock]);

  // Ask as soon as the cover shows, and again when Zecky comes back from
  // the background with the cover still up. (The Face ID sheet itself only
  // makes Zecky inactive, so cancelling it does not ask again.)
  useEffect(() => {
    ask();
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', next => {
      if (previous === 'background' && next === 'active') ask();
      previous = next;
    });
    return () => sub.remove();
  }, [ask]);

  return (
    <View style={styles.cover}>
      <ZeckyLock open={false} size={150} />
      <View style={styles.wordmark}>
        <Text style={styles.brand}>ZECKY</Text>
        <Text style={styles.product}>Lock it</Text>
      </View>
      <View style={styles.button}>
        <BrassButton label="Unlock" busy={busy} onPress={ask} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { flexDirection: 'row', alignItems: 'baseline', marginTop: 22 },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    letterSpacing: 6,
    color: colors.gold,
  },
  product: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textMuted,
    marginLeft: 6,
  },
  button: { width: 220, marginTop: space.xl },
  wordmarkSmall: { marginTop: 14, marginBottom: space.lg },
}));
