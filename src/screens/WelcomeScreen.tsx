import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Medallion, ZeckyLock } from '../components/lock';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  onCreate: () => void;
  onRestore: () => void;
  busy: boolean;
  error: string | null;
}

/** The first screen: the lock, the name, and the two ways in. */
export function WelcomeScreen({ onCreate, onRestore, busy, error }: Props) {
  const styles = useStyles();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <View style={styles.hero}>
        <View style={styles.medallion} pointerEvents="none">
          <Medallion diameter={560} />
        </View>
        <ZeckyLock open={false} size={170} />
        <View style={styles.wordmark}>
          <Text style={styles.brand}>ZECKY</Text>
          <Text style={styles.product}>Lock it</Text>
        </View>
        <Text style={styles.tagline}>Private savings, held by you alone.</Text>
      </View>
      {error != null && <Text style={styles.error}>{error}</Text>}
      <Button label="Create a wallet" onPress={onCreate} busy={busy} />
      <View style={styles.gap} />
      <Button
        label="I already have a wallet"
        onPress={onRestore}
        variant="quiet"
        disabled={busy}
      />
    </Animated.View>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    padding: space.lg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  medallion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -space.lg,
    right: -space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { flexDirection: 'row', alignItems: 'baseline', marginTop: 28 },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    letterSpacing: 6.5,
    color: colors.gold,
  },
  product: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textMuted,
    marginLeft: 6,
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
  },
  gap: { height: space.xs },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.danger,
    marginBottom: space.md,
    textAlign: 'center',
  },
}));
