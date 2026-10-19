import React from 'react';
import { Text, View } from 'react-native';
import { fonts, makeStyles, space } from '../theme';
import { Button } from './Button';

const TIPS: [string, string][] = [
  [
    'Keep it offline',
    'Never photograph it or type it into a phone, computer, cloud or password manager. Paper only.',
  ],
  [
    'Keep it private',
    'Zecky will never ask for your words, and nobody honest will. Anyone who asks is trying to take your funds.',
  ],
  [
    'Keep it safe',
    'Store it dry and out of sight. A second copy in another place protects against fire or loss.',
  ],
  [
    'Keep it for later',
    'With these words you can restore your funds on a new phone, in Zecky or another Zcash wallet.',
  ],
];

/** Shown once the three-word check has passed. */
export function PhraseConfirmed({
  onDone,
  busy = false,
}: {
  onDone: () => void;
  busy?: boolean;
}) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.title}>Your paper copy is right</Text>
      <Text style={styles.body}>
        From now on, those 24 words are your wallet. A few things to keep in
        mind:
      </Text>
      {TIPS.map(([title, text]) => (
        <View key={title} style={styles.tip}>
          <Text style={styles.tipTitle}>{title}</Text>
          <Text style={styles.tipText}>{text}</Text>
        </View>
      ))}
      <View style={styles.action}>
        <Button label="Done" onPress={onDone} busy={busy} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  title: { fontFamily: fonts.serifMedium, fontSize: 30, color: colors.gold },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  tip: {
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    paddingLeft: space.md,
    marginBottom: space.md,
  },
  tipTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  tipText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  action: { marginTop: space.md },
}));
