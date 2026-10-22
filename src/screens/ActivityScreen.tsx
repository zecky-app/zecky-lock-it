import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  Share,
  Text,
  View,
} from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { Button } from '../components/Button';
import { TransactionRow } from '../components/TransactionRow';
import {
  SheetCorner,
  SheetHeader,
  ZeckyLock,
  useCardStyle,
} from '../components/lock';
import { txKind } from '../lib/transactions';
import { transactionsToCsv } from '../lib/export';
import { formatWithUnit, Unit } from '../lib/zec';
import { fonts, makeStyles, space, useColors } from '../theme';
import { shareTransactionId, TransactionDetails } from './TransactionScreen';

interface Props {
  visible: boolean;
  transactions: Transaction[];
  unit: Unit;
  hidden: boolean;
  onClose: () => void;
}

const FILTERS = ['All', 'Locked', 'Released'] as const;
type Filter = (typeof FILTERS)[number];

/** "OCTOBER 2026", or WAITING for payments not in a block yet. */
function monthOf(tx: Transaction): string {
  if (tx.minedHeight <= 0 || tx.blockTimeInSeconds <= 0) return 'WAITING';
  return new Date(tx.blockTimeInSeconds * 1000)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

/**
 * The full history, as on the Mac: a summary, filters and the payments by
 * month, with each payment's details one tap away.
 */
export function ActivityScreen({
  visible,
  transactions,
  unit,
  hidden,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const card = useCardStyle();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  useEffect(() => {
    if (visible) {
      setOpenId(null);
      setFilter('All');
    }
  }, [visible]);

  const { lockedIn, released } = useMemo(() => {
    let inSum = 0n;
    let outSum = 0n;
    for (const tx of transactions) {
      if (tx.minedHeight <= 0 || tx.isExpired) continue;
      const kind = txKind(tx);
      if (kind === 'received') inSum += BigInt(tx.value || '0');
      else if (kind === 'sent') outSum += BigInt(tx.value || '0');
    }
    return { lockedIn: inSum, released: outSum };
  }, [transactions]);

  // Waiting payments first (the list already comes newest first).
  const sections = useMemo(() => {
    const chosen = transactions.filter(tx => {
      const kind = txKind(tx);
      if (filter === 'Locked') return kind === 'received';
      if (filter === 'Released') return kind === 'sent' || kind === 'self';
      return true;
    });
    const out: { title: string; data: Transaction[] }[] = [];
    for (const tx of chosen) {
      const title = monthOf(tx);
      const last = out[out.length - 1];
      if (last != null && last.title === title) last.data.push(tx);
      else out.push({ title, data: [tx] });
    }
    return out;
  }, [transactions, filter]);
  // Looked up by id so the page updates when the payment confirms.
  const open = transactions.find(tx => tx.rawTransactionId === openId) ?? null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SheetCorner />
        {open != null ? (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <TransactionDetails tx={open} />
            </ScrollView>
            <Button
              label="Share or copy transaction ID"
              variant="quiet"
              onPress={() => shareTransactionId(open)}
            />
            <View style={styles.gap} />
            <Button
              label="Back"
              variant="back"
              onPress={() => setOpenId(null)}
            />
          </>
        ) : (
          <>
            <SheetHeader
              title="Activity"
              subtitle="Every time you locked more or released."
            />
            {transactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <ZeckyLock open={false} size={90} />
                <Text style={styles.emptyTitle}>Nothing locked yet</Text>
                <Text style={styles.empty}>
                  When Zcash arrives at your Lock more address, it shows up
                  here.
                </Text>
              </View>
            ) : (
              <>
                <View style={[card, styles.summary]}>
                  <Stat
                    label="LOCKED IN"
                    value={
                      hidden
                        ? '••••'
                        : `${lockedIn > 0n ? '+' : ''}${formatWithUnit(
                            lockedIn.toString(),
                            unit,
                          )}`
                    }
                    color={lockedIn > 0n ? colors.ok : colors.textMuted}
                  />
                  <View style={styles.statLine} />
                  <Stat
                    label="RELEASED"
                    value={
                      hidden
                        ? '••••'
                        : `${released > 0n ? '−' : ''}${formatWithUnit(
                            released.toString(),
                            unit,
                          )}`
                    }
                    color={released > 0n ? colors.gold : colors.textMuted}
                  />
                  <View style={styles.statLine} />
                  <Stat
                    label="ENTRIES"
                    value={String(transactions.length)}
                    color={colors.text}
                  />
                </View>
                <View style={styles.chips}>
                  {FILTERS.map(f => (
                    <Pressable
                      key={f}
                      accessibilityRole="button"
                      accessibilityState={{ selected: f === filter }}
                      onPress={() => setFilter(f)}
                      style={[styles.chip, f === filter && styles.chipOn]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          f === filter && styles.chipLabelOn,
                        ]}
                      >
                        {f}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <SectionList
                  style={styles.list}
                  sections={sections}
                  keyExtractor={tx => tx.rawTransactionId}
                  stickySectionHeadersEnabled={false}
                  renderSectionHeader={({ section }) => (
                    <Text style={styles.month}>{section.title}</Text>
                  )}
                  renderItem={({ item, index, section }) => (
                    <View
                      style={[
                        styles.cardPart,
                        index === 0 && styles.cardTop,
                        index === section.data.length - 1 && styles.cardBottom,
                      ]}
                    >
                      <TransactionRow
                        tx={item}
                        unit={unit}
                        hidden={hidden}
                        divider={index > 0}
                        onPress={() => setOpenId(item.rawTransactionId)}
                      />
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={[styles.empty, styles.centerText]}>
                      Nothing here yet.
                    </Text>
                  }
                  showsVerticalScrollIndicator={false}
                />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() =>
                    Share.share({ message: transactionsToCsv(transactions) })
                  }
                  style={styles.export}
                >
                  <Text style={styles.exportText}>Export history</Text>
                </Pressable>
              </>
            )}
            <Button label="Done" variant="back" onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
  );
}

function Stat(props: { label: string; value: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{props.label}</Text>
      <Text
        style={[styles.statValue, { color: props.color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {props.value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  // Sheets reach under the home indicator: the bottom buttons sit higher,
  // clear of the swipe area and easy to reach with a thumb.
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    padding: space.lg,
    paddingBottom: space.xl + space.sm,
    overflow: 'hidden',
  },
  scroll: { paddingBottom: space.lg },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statLine: { width: 1, height: 34, backgroundColor: colors.line },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.gold + '22', borderColor: colors.gold },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  chipLabelOn: { color: colors.gold },
  list: { flex: 1, marginTop: space.sm, marginBottom: space.sm },
  month: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  cardPart: {
    backgroundColor: colors.inkRaised,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
  },
  cardTop: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardBottom: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 20,
    color: colors.text,
    marginTop: space.md,
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
  },
  centerText: { textAlign: 'center' },
  export: { alignSelf: 'center', paddingVertical: space.sm, marginBottom: 4 },
  exportText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
  },
  gap: { height: space.sm },
}));
