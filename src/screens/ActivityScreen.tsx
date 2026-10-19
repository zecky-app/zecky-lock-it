import React, { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, Share, Text, View } from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { Button } from '../components/Button';
import { TransactionRow } from '../components/TransactionRow';
import { transactionsToCsv } from '../lib/export';
import type { Unit } from '../lib/zec';
import { fonts, makeStyles, space } from '../theme';
import { shareTransactionId, TransactionDetails } from './TransactionScreen';

interface Props {
  visible: boolean;
  transactions: Transaction[];
  unit: Unit;
  hidden: boolean;
  onClose: () => void;
}

/** The full payment history, with each payment's details one tap away. */
export function ActivityScreen({
  visible,
  transactions,
  unit,
  hidden,
  onClose,
}: Props) {
  const styles = useStyles();
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (visible) setOpenId(null);
  }, [visible]);
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
            <Button label="Back" onPress={() => setOpenId(null)} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Activity</Text>
            <FlatList
              style={styles.list}
              data={transactions}
              keyExtractor={tx => tx.rawTransactionId}
              renderItem={({ item }) => (
                <TransactionRow
                  tx={item}
                  unit={unit}
                  hidden={hidden}
                  onPress={() => setOpenId(item.rawTransactionId)}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No payments yet.</Text>
              }
              showsVerticalScrollIndicator={false}
            />
            {transactions.length > 0 && (
              <>
                <Button
                  label="Export history"
                  variant="quiet"
                  onPress={() =>
                    Share.share({ message: transactionsToCsv(transactions) })
                  }
                />
                <View style={styles.gap} />
              </>
            )}
            <Button label="Done" onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, backgroundColor: colors.ink, padding: space.lg },
  scroll: { paddingBottom: space.lg },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 30,
    color: colors.text,
    marginTop: space.md,
  },
  list: { flex: 1, marginTop: space.md, marginBottom: space.md },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: space.md,
  },
  gap: { height: space.sm },
}));
