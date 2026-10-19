import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  onCreate: () => void;
  onRestore: () => void;
  busy: boolean;
  error: string | null;
}

export function WelcomeScreen({ onCreate, onRestore, busy, error }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>Zecky Lock it</Text>
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
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg, justifyContent: 'flex-end' },
  hero: { flex: 1, justifyContent: 'center' },
  wordmark: { fontFamily: fonts.serifMedium, fontSize: 52, color: colors.gold },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 25,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  gap: { height: space.sm },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.danger,
    marginBottom: space.md,
  },
}));
