import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ZeckyLock } from '../components/lock';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  message: string;
  onRetry: () => void;
}

/**
 * Shown when the wallet on this iPhone could not be read at start (audit
 * C-02). It offers only Retry: never Create or Restore, which would replace
 * the wallet that is still here.
 */
export function ErrorScreen({ message, onRetry }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <ZeckyLock open={false} size={132} />
        <Text style={styles.title}>Zecky could not open your wallet</Text>
        <Text style={styles.body}>
          Your Zcash is not affected. Nothing on this iPhone was changed. Try
          again; if it keeps happening, close Zecky completely and open it
          again.
        </Text>
        <Text style={styles.detail}>{message}</Text>
      </View>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg, justifyContent: 'flex-end' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.text,
    marginTop: space.lg,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: space.md,
    textAlign: 'center',
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: space.md,
    textAlign: 'center',
  },
}));
