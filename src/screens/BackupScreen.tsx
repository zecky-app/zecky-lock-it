import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BirthdayNote } from '../components/BirthdayNote';
import { Button } from '../components/Button';
import { PhraseGrid } from '../components/PhraseGrid';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  mnemonic: string;
  birthdayHeight: number;
  onConfirm: () => void;
  busy: boolean;
}

export function BackupScreen({
  mnemonic,
  birthdayHeight,
  onConfirm,
  busy,
}: Props) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Your recovery phrase</Text>
        <Text style={styles.body}>
          Write these 24 words down, in order, on paper, with the birthday block
          shown above them. Anyone who has them can take your funds, and without
          them a lost phone means lost funds. Zecky cannot recover them for you.
        </Text>
        <BirthdayNote height={birthdayHeight} />
        <PhraseGrid mnemonic={mnemonic} />
      </ScrollView>
      <Button label="I've written it down" onPress={onConfirm} busy={busy} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg },
  scroll: { paddingBottom: space.lg },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, color: colors.text },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
}));
