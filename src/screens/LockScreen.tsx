import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { PinPad } from '../components/PinPad';
import { secondsUntilRetry, verifyPin } from '../lib/pin';
import { makeStyles } from '../theme';

function waitText(seconds: number): string {
  return seconds >= 60
    ? `Too many wrong codes. Try again in ${Math.ceil(seconds / 60)} min.`
    : `Too many wrong codes. Try again in ${seconds} s.`;
}

/** Covers the whole app until the right code is entered. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
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
      <PinPad
        title="Zecky Lock it"
        message={
          wait > 0 ? waitText(wait) : wrong ? 'Wrong code. Try again.' : null
        }
        disabled={wait > 0}
        onComplete={check}
      />
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
}));
