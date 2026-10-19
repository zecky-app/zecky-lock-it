import React from 'react';
import { Text, View } from 'react-native';
import { fonts, makeStyles, space } from '../theme';

/**
 * The wallet birthday block, shown above the recovery phrase so it is seen
 * first and goes on the same paper. A restore that knows it starts there and
 * finishes in minutes instead of scanning the whole chain.
 */
export function BirthdayNote({ height }: { height: number }) {
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <View style={styles.row}>
        <Text style={styles.label}>Wallet birthday</Text>
        <Text style={styles.value}>Block {height.toLocaleString('en-US')}</Text>
      </View>
      <Text style={styles.hint}>Write it on your paper with the words.</Text>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  tile: {
    backgroundColor: colors.inkRaised,
    borderRadius: 10,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  value: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
