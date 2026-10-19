import React from 'react';
import { Text, View } from 'react-native';
import { fonts, makeStyles } from '../theme';

/** The recovery phrase as a numbered two-column grid. */
export function PhraseGrid({ mnemonic }: { mnemonic: string }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {mnemonic.split(' ').map((word, i) => (
        <View key={i} style={styles.cell}>
          <View style={styles.box}>
            <Text style={styles.index}>{i + 1}</Text>
            <Text style={styles.word}>{word}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  // The number sits inside the same box as the word, so nothing can cover it.
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inkRaised,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  index: {
    width: 26,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  word: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.text,
  },
}));
