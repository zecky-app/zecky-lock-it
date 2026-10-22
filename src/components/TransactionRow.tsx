import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { sentEntry } from '../lib/sentLog';
import { isPending, txKind } from '../lib/transactions';
import { formatWithUnit, Unit } from '../lib/zec';
import { fonts, makeStyles, space, useColors } from '../theme';
import { Icon, IconName } from './Icon';

// In the lock's words, as on the Mac.
const TITLES = {
  received: 'Locked',
  sent: 'Released',
  self: 'To yourself',
  shielded: 'Locked in from public',
};

const ICONS: Record<keyof typeof TITLES, IconName> = {
  received: 'lock',
  sent: 'lockOpen',
  self: 'lockOpen',
  shielded: 'lock',
};

function when(tx: Transaction): string {
  if (tx.isExpired) return 'Expired · never left the lock';
  if (isPending(tx) || tx.blockTimeInSeconds <= 0) {
    const sent = sentEntry(tx.rawTransactionId);
    if (sent == null) return 'Waiting for a block';
    const time = new Date(sent.at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${
      sent.waiting ? 'Waiting to release' : 'Waiting for a block'
    } · ${time}`;
  }
  const date = new Date(tx.blockTimeInSeconds * 1000);
  return `${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} · ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

interface Props {
  tx: Transaction;
  unit: Unit;
  /** Discreet mode: cover the amount. */
  hidden: boolean;
  onPress: () => void;
  /** Draw a divider above this row (not on the first row of a card). */
  divider?: boolean;
}

/** One payment in Activity: an icon, what happened and when, the amount. */
export function TransactionRow({ tx, unit, hidden, onPress, divider }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const kind = txKind(tx);
  const memo = tx.memos.find(m => m.trim() !== '');
  const waiting = isPending(tx) && !tx.isExpired;
  const tint = tx.isExpired
    ? colors.textMuted
    : kind === 'received'
    ? colors.ok
    : colors.gold;
  const sign =
    kind === 'received' ? '+' : kind === 'sent' || kind === 'self' ? '−' : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tint + '24' }]}>
        <Icon name={ICONS[kind]} size={16} color={tint} />
      </View>
      <View style={styles.main}>
        <Text style={styles.title}>{TITLES[kind]}</Text>
        <Text style={[styles.sub, waiting && styles.subWaiting]}>
          {when(tx)}
        </Text>
        {memo != null && (
          <Text style={styles.memo} numberOfLines={2}>
            {memo.trim()}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.amount,
          kind === 'received' && styles.amountIn,
          tx.isExpired && styles.amountExpired,
        ]}
      >
        {hidden ? '••••' : `${sign}${formatWithUnit(tx.value, unit)}`}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: space.sm + 2,
  },
  divider: {
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  main: { flex: 1, paddingRight: space.sm },
  title: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.text },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  subWaiting: { color: colors.gold },
  memo: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 4,
  },
  amount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  amountIn: { color: colors.ok },
  amountExpired: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
}));
