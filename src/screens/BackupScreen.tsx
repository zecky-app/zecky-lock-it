import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BirthdayNote } from '../components/BirthdayNote';
import { Button } from '../components/Button';
import { PhraseGrid } from '../components/PhraseGrid';
import { SheetCorner, SheetHeader } from '../components/lock';
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
      <SheetCorner />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SheetHeader
          title="Your recovery phrase"
          subtitle="The 24 words are the key to your lock. Write them on paper, in order, with the birthday block."
        />
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Anyone who has these words can take your Zcash. Without them, a lost
            phone means lost Zcash. Zecky cannot recover them for you.
          </Text>
        </View>
        <BirthdayNote height={birthdayHeight} />
        <PhraseGrid mnemonic={mnemonic} />
      </ScrollView>
      <Button label="I've written it down" onPress={onConfirm} busy={busy} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg, overflow: 'hidden' },
  scroll: { paddingBottom: space.lg, paddingTop: space.sm },
  warning: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger + '66',
    backgroundColor: colors.danger + '12',
    padding: space.md,
    marginBottom: space.md,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text,
  },
}));
