import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { sentEntry } from '../lib/sentLog';
import { isPending, txKind } from '../lib/transactions';
import { formatWithUnit, Unit } from '../lib/zec';
import { fonts, makeStyles, space } from '../theme';

const TITLES = {
  received: 'Received',
  sent: 'Sent',
  self: 'To yourself',
  shielded: 'Shielded',
};

function when(tx: Transaction): string {
  if (tx.isExpired) return 'Expired, not sent';
  if (isPending(tx) || tx.blockTimeInSeconds <= 0) {
    const sent = sentEntry(tx.rawTransactionId);
    if (sent == null) return 'Confirming…';
    const time = new Date(sent.at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${sent.waiting ? 'Waiting to send' : 'Confirming'}… · sent ${time}`;
  }
  return new Date(tx.blockTimeInSeconds * 1000).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  tx: Transaction;
  unit: Unit;
  /** Discreet mode: cover the amount. */
  hidden: boolean;
  onPress: () => void;
}

export function TransactionRow({ tx, unit, hidden, onPress }: Props) {
  const styles = useStyles();
  const kind = txKind(tx);
  const memo = tx.memos.find(m => m.trim() !== '');
  const sign =
    kind === 'received' ? '+' : kind === 'sent' || kind === 'self' ? '−' : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        (tx.isExpired || pressed) && styles.faded,
      ]}
    >
      <View style={styles.main}>
        <Text style={styles.title}>{TITLES[kind]}</Text>
        <Text style={styles.sub}>{when(tx)}</Text>
        {memo != null && (
          <Text style={styles.memo} numberOfLines={2}>
            {memo.trim()}
          </Text>
        )}
      </View>
      <Text style={[styles.amount, kind === 'received' && styles.amountIn]}>
        {hidden ? '••••' : `${sign}${formatWithUnit(tx.value, unit)}`}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  faded: { opacity: 0.5 },
  main: { flex: 1, paddingRight: space.md },
  title: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.text },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  memo: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.xs,
  },
  amount: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  amountIn: { color: colors.ok },
}));
