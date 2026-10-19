import React from 'react';
import { Modal, ScrollView, Share, Text, View } from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { Button } from '../components/Button';
import { sentEntry } from '../lib/sentLog';
import { isDust, isPending, txKind } from '../lib/transactions';
import { formatDisplay, formatZec } from '../lib/zec';
import { fonts, makeStyles, space } from '../theme';
import { hasLink } from '../lib/memo';

interface Props {
  /** The transaction to show, or null to keep the sheet closed. */
  tx: Transaction | null;
  onClose: () => void;
}

const TITLES = {
  received: 'Payment received',
  sent: 'Payment sent',
  self: 'Sent to yourself',
  shielded: 'Funds shielded',
};

function status(tx: Transaction): string {
  if (tx.isExpired) return 'Expired. This payment was never sent.';
  if (isPending(tx)) {
    return sentEntry(tx.rawTransactionId)?.waiting
      ? 'Not delivered to the network yet. Zecky sends it automatically as soon as there is a connection. Do not send it again.'
      : 'Confirming…';
  }
  return `Confirmed in block ${tx.minedHeight.toLocaleString('en-US')}`;
}

function fullDate(tx: Transaction): string | null {
  if (tx.blockTimeInSeconds <= 0) return null;
  return new Date(tx.blockTimeInSeconds * 1000).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Exact amount in both units, e.g. "0.0105 ZEC" over "1,050,000 zats". */
function Amount({ zatoshi }: { zatoshi: string }) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.value}>{formatZec(zatoshi, 3)} ZEC</Text>
      <Text style={styles.sub}>{formatDisplay(zatoshi, 'zats')} zats</Text>
    </>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      {props.children}
    </View>
  );
}

/** Everything known about one payment. Used in a sheet and in Activity. */
export function TransactionDetails({ tx }: { tx: Transaction }) {
  const styles = useStyles();
  const memos = tx.memos.filter(m => m.trim() !== '');
  const date = fullDate(tx);
  const self = txKind(tx) === 'self';
  const sent = sentEntry(tx.rawTransactionId);
  const sentAt =
    sent == null
      ? null
      : new Date(sent.at).toLocaleString(undefined, {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });
  const expiry = (tx as Transaction & { expiryHeight?: number }).expiryHeight;
  return (
    <>
      <Text style={styles.title}>{TITLES[txKind(tx)]}</Text>
      <Text style={styles.status}>{status(tx)}</Text>
      {isDust(tx) && (
        <Text style={styles.status}>
          Not counted in your balance: this payment is too small to be worth
          spending, because the network fee to use it is higher than its value.
        </Text>
      )}

      {self && (
        <Text style={styles.status}>
          This went to one of your own addresses. Only the network fee left your
          wallet.
        </Text>
      )}

      <View style={styles.card}>
        {!self && (
          <Field label="Amount">
            <Amount zatoshi={tx.value} />
          </Field>
        )}
        {tx.fee != null && (
          <Field label="Network fee">
            <Amount zatoshi={tx.fee} />
          </Field>
        )}
        {date == null && sentAt != null && (
          <Field label="Sent from this phone">
            <Text style={styles.value}>{sentAt}</Text>
          </Field>
        )}
        {isPending(tx) && expiry != null && (
          <Field label="Cancelled if not confirmed by">
            <Text style={styles.value}>
              Block {expiry.toLocaleString('en-US')}. Nothing leaves your wallet
              then.
            </Text>
          </Field>
        )}
        {date != null && (
          <Field label="Date">
            <Text style={styles.value}>{date}</Text>
          </Field>
        )}
        {tx.toAddress != null && tx.toAddress !== '' && (
          <Field label={self ? 'Sent to (your own address)' : 'Sent to'}>
            <Text style={styles.mono} selectable>
              {tx.toAddress}
            </Text>
          </Field>
        )}
        {memos.map((memo, i) => (
          <Field key={i} label="Private note">
            <Text style={styles.value} selectable>
              {memo.trim()}
            </Text>
            {hasLink(memo) && (
              <Text style={styles.linkNote}>
                This note contains a link. Zecky never sends messages, and
                anyone can write a note. Treat links in notes as suspicious.
              </Text>
            )}
          </Field>
        ))}
        <Field label="Transaction ID">
          <Text style={styles.mono} selectable>
            {tx.rawTransactionId}
          </Text>
        </Field>
      </View>
    </>
  );
}

export function shareTransactionId(tx: Transaction) {
  Share.share({ message: tx.rawTransactionId });
}

export function TransactionScreen({ tx, onClose }: Props) {
  const styles = useStyles();
  return (
    <Modal
      visible={tx != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {tx != null && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <TransactionDetails tx={tx} />
          </ScrollView>
        )}
        <Button
          label="Share or copy transaction ID"
          variant="quiet"
          onPress={() => {
            if (tx != null) shareTransactionId(tx);
          }}
        />
        <View style={styles.gap} />
        <Button label="Done" onPress={onClose} />
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
  status: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    paddingHorizontal: space.md,
    marginTop: space.lg,
  },
  field: { paddingVertical: space.md },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: space.xs,
  },
  value: { fontFamily: fonts.sans, fontSize: 17, color: colors.text },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  mono: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  gap: { height: space.sm },
  linkNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.sm,
  },
}));
