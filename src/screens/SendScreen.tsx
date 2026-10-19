import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { Tools } from 'react-native-zcash';
import { Button } from '../components/Button';
import { Confirming } from '../components/Confirming';
import { Icon } from '../components/Icon';
import { NETWORK } from '../config';
import type { Currency } from '../config';
import { addContact, contactName, useContacts } from '../lib/contacts';
import { isPaymentSaved } from '../lib/errors';
import { parseScanned } from '../lib/paymentUri';
import { waitingPayments } from '../lib/sentLog';
import { fiatEditable, fiatToZatoshi, formatFiat } from '../lib/price';
import {
  Unit,
  confirmingZatoshi,
  formatDisplay,
  formatExact,
  formatZec,
  isTransparentAddress,
  otherUnit,
  parseAmount,
  shortenAddress,
  toEditable,
} from '../lib/zec';
import { fonts, makeStyles, space, useColors } from '../theme';
import type { Wallet } from '../wallet/useSynchronizer';

interface Props {
  visible: boolean;
  wallet: Wallet;
  /** Display unit, shared with the home screen. */
  unit: Unit;
  onToggleUnit: () => void;
  /** Chosen fiat currency and its current price per ZEC, when known. */
  currency: Currency | null;
  price: number | undefined;
  /** A payment was broadcast: its id and the amount the receiver gets. */
  onSent: (txId: string, zatoshi: string) => void;
  onClose: () => void;
}

interface Review {
  toAddress: string;
  zatoshi: string;
  memo: string;
  fee: string;
  proposalBase64: string;
}

type Step =
  | { name: 'form' }
  | { name: 'scan' }
  | { name: 'contacts' }
  | { name: 'review'; review: Review }
  | { name: 'sent'; txId: string }
  | { name: 'saved'; message: string };

export function SendScreen({
  visible,
  wallet,
  unit,
  onToggleUnit,
  currency,
  price,
  onSent,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [max, setMax] = useState(false);
  const [fiatMode, setFiatMode] = useState(false);
  const contacts = useContacts();
  const confirming = confirmingZatoshi(wallet);
  const [newName, setNewName] = useState('');
  const saveContact = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await Tools.isValidAddress(address.trim(), NETWORK))) {
        setError('That is not a valid Zcash address.');
        return;
      }
      await addContact(newName, address);
      setStep({ name: 'form' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start clean every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setStep({ name: 'form' });
      setAddress('');
      setAmount('');
      setMemo('');
      setMax(false);
      setFiatMode(false);
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const transparent = isTransparentAddress(address);

  // Typing in fiat needs both a chosen currency and a price to convert at.
  const fiat =
    fiatMode && currency != null && price != null ? { currency, price } : null;
  const parseTyped = (text: string) =>
    fiat != null ? fiatToZatoshi(text, fiat.price) : parseAmount(text, unit);
  const approx = (zatoshi: string) =>
    currency != null && price != null
      ? ` · ≈ ${formatFiat(zatoshi, price, currency)}`
      : '';

  // In Max mode the field shows the whole spendable balance in the chosen
  // unit, e.g. "100,000" zats, "0.001" ZEC or "4.12" in fiat.
  const maxText =
    fiat != null
      ? fiatEditable(wallet.spendableZatoshi, fiat.price)
      : unit === 'ZEC'
      ? formatZec(wallet.spendableZatoshi, 3).replace(/,/g, '')
      : formatDisplay(wallet.spendableZatoshi, 'zats');

  const onScanned = (text: string) => {
    // The camera can report the same code several times in a row.
    if (step.name !== 'scan') return;
    const scanned = parseScanned(text);
    if (scanned == null) {
      setError('That code is not a Zcash address.');
    } else {
      setError(null);
      setAddress(scanned.address);
      if (scanned.zatoshi != null) {
        setMax(false);
        setAmount(toEditable(scanned.zatoshi, unit));
      }
    }
    setStep({ name: 'form' });
  };

  // Switch what the amount is typed in, converting what is already there.
  const chooseInput = (target: Unit | 'fiat') => {
    const typed = parseTyped(amount);
    if (target === 'fiat') {
      if (price == null) return;
      if (typed != null) setAmount(fiatEditable(typed, price));
      setFiatMode(true);
      return;
    }
    if (typed != null) setAmount(toEditable(typed, target));
    setFiatMode(false);
    if (target !== unit) onToggleUnit();
  };

  const review = async () => {
    const toAddress = address.trim();
    const typed = max ? null : parseTyped(amount);
    if (toAddress === '') return setError('Enter the address to send to.');
    if (!max && typed == null) {
      return setError(
        fiat != null
          ? `Enter an amount in ${fiat.currency}, for example 5.00.`
          : unit === 'ZEC'
          ? 'Enter an amount in ZEC, for example 0.025.'
          : 'Enter a whole number of zats, for example 250,000.',
      );
    }
    if (typed != null && BigInt(typed) > BigInt(wallet.spendableZatoshi)) {
      return setError(
        `You have ${formatExact(
          wallet.spendableZatoshi,
          unit,
        )} available to send.`,
      );
    }
    setBusy(true);
    setError(null);
    try {
      if (!(await Tools.isValidAddress(toAddress, NETWORK))) {
        setError('That is not a valid Zcash address.');
        return;
      }
      const cleanMemo = transparent ? '' : memo.trim();
      const memoOrNone = cleanMemo === '' ? undefined : cleanMemo;
      let zatoshi: string;
      let proposal;
      if (typed == null) {
        ({ proposal, zatoshi } = await wallet.proposeMax({
          toAddress,
          memo: memoOrNone,
        }));
      } else {
        zatoshi = typed;
        proposal = await wallet.proposeTransfer({
          zatoshi,
          toAddress,
          memo: memoOrNone,
        });
      }
      setStep({
        name: 'review',
        review: {
          toAddress,
          zatoshi,
          memo: cleanMemo,
          fee: proposal.totalFee,
          proposalBase64: proposal.proposalBase64,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async (r: Review) => {
    setBusy(true);
    setError(null);
    try {
      const txId = await wallet.sendProposal(r.proposalBase64);
      setStep({ name: 'sent', txId });
      onSent(txId, r.zatoshi);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Created but not delivered: leave the review screen, so there is no
      // "Send now" left to tap a second time.
      if (isPaymentSaved(e)) setStep({ name: 'saved', message });
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const waiting = waitingPayments(wallet.transactions).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={busy ? undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step.name === 'form' && (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Send ZEC</Text>
              {waiting > 0 && (
                <Text style={styles.error}>
                  {waiting === 1
                    ? 'A payment from this phone is still waiting to be sent.'
                    : `${waiting} payments from this phone are still waiting to be sent.`}{' '}
                  It goes out automatically once the network can be reached.
                  Check Activity before sending again.
                </Text>
              )}

              <View style={styles.labelRow}>
                <Text style={[styles.label, styles.labelInRow]}>To</Text>
                <View style={styles.toActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Contacts"
                    hitSlop={10}
                    onPress={() => {
                      setError(null);
                      setNewName('');
                      setStep({ name: 'contacts' });
                    }}
                    style={styles.scanButton}
                  >
                    <Icon name="person" size={18} />
                    <Text style={styles.scanLabel}>Contacts</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Scan a QR code"
                    hitSlop={10}
                    onPress={() => {
                      setError(null);
                      setStep({ name: 'scan' });
                    }}
                    style={styles.scanButton}
                  >
                    <Icon name="scan" size={18} />
                    <Text style={styles.scanLabel}>Scan</Text>
                  </Pressable>
                </View>
              </View>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={address}
                onChangeText={setAddress}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                placeholder="Zcash address"
                placeholderTextColor={colors.goldDim}
                selectionColor={colors.gold}
              />
              {contactName(contacts, address) != null && (
                <Text style={styles.hint}>
                  Contact: {contactName(contacts, address)}
                </Text>
              )}
              {transparent && (
                <Text style={styles.hint}>
                  This is a transparent address. The amount and both addresses
                  will be publicly visible.
                </Text>
              )}

              <View style={styles.labelRow}>
                <Text style={[styles.label, styles.labelInRow]}>Amount</Text>
                <View style={styles.unitSwitch}>
                  {(
                    [
                      'ZEC',
                      'zats',
                      ...(currency != null && price != null
                        ? (['fiat'] as const)
                        : []),
                    ] as const
                  ).map(option => {
                    const on =
                      option === 'fiat'
                        ? fiat != null
                        : fiat == null && option === unit;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => chooseInput(option)}
                      >
                        <Text style={[styles.unitOption, on && styles.unitOn]}>
                          {option === 'fiat' ? currency : option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={max ? maxText : amount}
                  onChangeText={text => {
                    setMax(false);
                    setAmount(text);
                  }}
                  keyboardType={
                    fiat != null || unit === 'ZEC'
                      ? 'decimal-pad'
                      : 'number-pad'
                  }
                  placeholder={
                    fiat != null ? '0.00' : unit === 'ZEC' ? '0.000' : '0'
                  }
                  placeholderTextColor={colors.goldDim}
                  selectionColor={colors.gold}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: max }}
                  onPress={() => {
                    setAmount('');
                    setMax(!max);
                  }}
                  style={[styles.maxButton, max && styles.maxButtonOn]}
                >
                  <Text style={[styles.maxLabel, max && styles.maxLabelOn]}>
                    Max
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>
                {max
                  ? 'Sending everything. The network fee comes out of this amount.'
                  : fiat != null && parseTyped(amount) != null
                  ? `≈ ${formatExact(parseTyped(amount) ?? '0', unit)}`
                  : `${formatExact(wallet.spendableZatoshi, unit)}${approx(
                      wallet.spendableZatoshi,
                    )} available`}
              </Text>
              {confirming !== '0' && (
                <Confirming
                  text={`${formatExact(
                    confirming,
                    unit,
                  )} available in a few minutes`}
                />
              )}

              {!transparent && (
                <>
                  <Text style={styles.label}>Private note (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={memo}
                    onChangeText={setMemo}
                    multiline
                    maxLength={500}
                    placeholder="Only the receiver can read this"
                    placeholderTextColor={colors.goldDim}
                    selectionColor={colors.gold}
                  />
                </>
              )}

              {error != null && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <Button label="Review" onPress={review} busy={busy} />
            <View style={styles.gap} />
            <Button label="Cancel" onPress={onClose} variant="quiet" />
          </>
        )}

        {step.name === 'contacts' && (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Contacts</Text>
              {contacts.length === 0 ? (
                <Text style={styles.body}>
                  No contacts yet. Type or scan an address on the send screen
                  and save it here, or add contacts in Settings.
                </Text>
              ) : (
                <View style={styles.card}>
                  {contacts.map(contact => (
                    <Pressable
                      key={contact.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setAddress(contact.address);
                        setStep({ name: 'form' });
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.rowValue}>{contact.name}</Text>
                      <Text style={styles.rowSub}>
                        {shortenAddress(contact.address, 10)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {address.trim() !== '' &&
                contactName(contacts, address) == null && (
                  <>
                    <Text style={styles.label}>
                      Save {shortenAddress(address.trim(), 8)} as a contact
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={newName}
                      onChangeText={setNewName}
                      placeholder="Name"
                      placeholderTextColor={colors.goldDim}
                      selectionColor={colors.gold}
                    />
                    <View style={styles.gap} />
                    <Button
                      label="Save contact"
                      variant="quiet"
                      busy={busy}
                      disabled={newName.trim() === ''}
                      onPress={saveContact}
                    />
                  </>
                )}
              {error != null && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <Button
              label="Back"
              variant="quiet"
              onPress={() => {
                setError(null);
                setStep({ name: 'form' });
              }}
            />
          </>
        )}

        {step.name === 'scan' && (
          <>
            <Text style={styles.title}>Scan address</Text>
            <Text style={styles.body}>
              Point the camera at a Zcash QR code.
            </Text>
            <View style={styles.cameraFrame}>
              <Camera
                style={styles.camera}
                scanBarcode
                showFrame={false}
                onReadCode={event =>
                  onScanned(event.nativeEvent.codeStringValue)
                }
              />
            </View>
            <Text style={styles.hint}>
              The camera only works on a real phone, not in the simulator.
            </Text>
            <View style={styles.gap} />
            <Button
              label="Cancel"
              variant="quiet"
              onPress={() => setStep({ name: 'form' })}
            />
          </>
        )}

        {step.name === 'review' && (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <Text style={styles.title}>Check the details</Text>
              <Text style={styles.body}>
                A sent payment cannot be reversed.
              </Text>

              <View style={styles.card}>
                <Row
                  label="To"
                  value={step.review.toAddress}
                  sub={
                    contactName(contacts, step.review.toAddress) ?? undefined
                  }
                  small
                />
                <Row
                  label="Amount"
                  value={formatExact(step.review.zatoshi, unit)}
                  sub={
                    formatExact(step.review.zatoshi, otherUnit(unit)) +
                    approx(step.review.zatoshi)
                  }
                />
                <Row
                  label="Network fee"
                  value={formatExact(step.review.fee, unit)}
                  sub={formatExact(step.review.fee, otherUnit(unit))}
                />
                <Row
                  label="Total leaving your wallet"
                  value={formatExact(reviewTotal(step.review), unit)}
                  sub={
                    formatExact(reviewTotal(step.review), otherUnit(unit)) +
                    approx(reviewTotal(step.review))
                  }
                  strong
                />
                <Row
                  label="Balance after sending"
                  value={formatExact(
                    remaining(wallet.totalZatoshi, step.review),
                    unit,
                  )}
                />
                {step.review.memo !== '' && (
                  <Row label="Private note" value={step.review.memo} small />
                )}
              </View>

              {waiting > 0 && (
                <Text style={styles.error}>
                  A payment from this phone is still waiting to be sent. Check
                  Activity first, so you do not pay twice.
                </Text>
              )}
              {error != null && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <Button
              label="Send now"
              onPress={() => send(step.review)}
              busy={busy}
            />
            <View style={styles.gap} />
            <Button
              label="Back"
              variant="quiet"
              disabled={busy}
              onPress={() => {
                setError(null);
                setStep({ name: 'form' });
              }}
            />
          </>
        )}

        {step.name === 'saved' && (
          <>
            <View style={styles.center}>
              <Text style={styles.title}>Payment saved</Text>
              <Text style={styles.error}>{step.message}</Text>
              <Text style={styles.body}>
                Activity shows it as “Waiting to send”. You can close this
                screen.
              </Text>
            </View>
            <Button label="Done" onPress={onClose} />
          </>
        )}

        {step.name === 'sent' && (
          <>
            <View style={styles.center}>
              <Text style={styles.title}>Sent</Text>
              <Text style={styles.body}>
                Your payment is on its way. It can take a few minutes to
                confirm.
              </Text>
              <Text style={styles.hint} selectable>
                Transaction {shortenAddress(step.txId, 12)}
              </Text>
            </View>
            <Button label="Done" onPress={onClose} />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function reviewTotal(r: Review): string {
  return (BigInt(r.zatoshi) + BigInt(r.fee)).toString();
}

function remaining(totalZatoshi: string, r: Review): string {
  const left = BigInt(totalZatoshi) - BigInt(reviewTotal(r));
  return (left > 0n ? left : 0n).toString();
}

function Row(props: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
  strong?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Text
        selectable
        style={[
          styles.rowValue,
          props.small && styles.rowSmall,
          props.strong && styles.rowStrong,
        ]}
      >
        {props.value}
      </Text>
      {props.sub != null && <Text style={styles.rowSub}>{props.sub}</Text>}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, backgroundColor: colors.ink, padding: space.lg },
  scroll: { paddingBottom: space.lg },
  center: { flex: 1, justifyContent: 'center' },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 30,
    color: colors.text,
    marginTop: space.md,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  labelInRow: { marginTop: 0, marginBottom: 0 },
  unitSwitch: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  unitOption: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unitOn: { backgroundColor: colors.gold, color: colors.onGold },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: space.md,
  },
  toActions: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.5 },
  scanLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
    marginLeft: 6,
  },
  cameraFrame: {
    flex: 1,
    marginTop: space.lg,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: { flex: 1 },
  amountRow: { flexDirection: 'row' },
  amountInput: { flex: 1 },
  maxButton: {
    marginLeft: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    justifyContent: 'center',
  },
  maxButtonOn: { backgroundColor: colors.gold },
  maxLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.gold,
  },
  maxLabelOn: { color: colors.onGold },
  multiline: { minHeight: 84, textAlignVertical: 'top', lineHeight: 22 },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    marginTop: space.lg,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    paddingHorizontal: space.md,
    marginTop: space.lg,
  },
  row: { paddingVertical: space.md },
  rowLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  rowValue: {
    fontFamily: fonts.sans,
    fontSize: 17,
    color: colors.text,
    marginTop: space.xs,
  },
  rowSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowSmall: { fontSize: 14, lineHeight: 21 },
  rowStrong: { fontFamily: fonts.sansSemiBold, color: colors.gold },
  gap: { height: space.sm },
}));
