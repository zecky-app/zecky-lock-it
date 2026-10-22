import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { Tools } from 'react-native-zcash';
import Svg, { Line } from 'react-native-svg';
import { Button } from '../components/Button';
import {
  BrassButton,
  SheetCorner,
  SheetHeader,
  ZeckyLock,
  useCardStyle,
} from '../components/lock';
import { Confirming } from '../components/Confirming';
import { Icon } from '../components/Icon';
import { NETWORK } from '../config';
import type { Currency } from '../config';
import { addContact, contactName, useContacts } from '../lib/contacts';
import { isPaymentSaved } from '../lib/errors';
import { parseScanned } from '../lib/paymentUri';
import { waitingPayments } from '../lib/sentLog';
import { isOwnAddress } from '../lib/transactions';
import { slowestWaiting, waitingText } from '../lib/confirmations';
import { fiatEditable, fiatToZatoshi, formatFiat } from '../lib/price';
import {
  Unit,
  confirmingZatoshi,
  formatDisplay,
  formatExact,
  formatZec,
  isTransparentAddress,
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
  const card = useCardStyle();
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [max, setMax] = useState(false);
  // The private note stays out of the way until asked for.
  const [noteOpen, setNoteOpen] = useState(false);
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
      setNoteOpen(false);
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
    if (toAddress === '') return setError('Enter the address to release to.');
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

  // On "Released", the open lock closes again after a moment.
  const [closedAgain, setClosedAgain] = useState(false);
  useEffect(() => {
    if (step.name !== 'sent' && step.name !== 'saved') {
      setClosedAgain(false);
      return;
    }
    const t = setTimeout(() => setClosedAgain(true), 600);
    return () => clearTimeout(t);
  }, [step.name]);

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
        <SheetCorner />
        {step.name === 'form' && (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <SheetHeader
                title="Release Zcash"
                subtitle="Taken out of the lock. Everything else stays locked."
              />
              {waiting > 0 && (
                <Text style={[styles.error, styles.noTop]}>
                  {waiting === 1
                    ? 'A release from this phone is still waiting to go out.'
                    : `${waiting} releases from this phone are still waiting to go out.`}{' '}
                  It goes out by itself once the network can be reached. Check
                  Activity before releasing again.
                </Text>
              )}

              <View style={[card, styles.formCard]}>
                {/* To */}
                <View style={styles.fieldHead}>
                  <Text style={styles.fieldLabel}>TO</Text>
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
                      style={styles.iconButton}
                    >
                      <Icon name="person" size={18} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Scan a QR code"
                      hitSlop={10}
                      onPress={() => {
                        setError(null);
                        setStep({ name: 'scan' });
                      }}
                      style={styles.iconButton}
                    >
                      <Icon name="scan" size={18} />
                    </Pressable>
                  </View>
                </View>
                <TextInput
                  style={styles.toInput}
                  value={address}
                  onChangeText={setAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  placeholder="Zcash address"
                  placeholderTextColor={colors.goldDim}
                  selectionColor={colors.gold}
                />
                {contactName(contacts, address) != null && (
                  <Text style={styles.contactLine}>
                    ✓ {contactName(contacts, address)}
                  </Text>
                )}
                {transparent && (
                  <Text style={styles.warnLine}>
                    Transparent address: the amount and both addresses will be
                    public.
                  </Text>
                )}

                <View style={styles.rule} />

                {/* Amount */}
                <View style={styles.fieldHead}>
                  <Text style={styles.fieldLabel}>AMOUNT</Text>
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
                          <Text
                            style={[styles.unitOption, on && styles.unitOn]}
                          >
                            {option === 'fiat' ? currency : option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <TextInput
                  style={styles.amountInput}
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
                <View style={styles.amountFoot}>
                  <Text style={styles.hint}>
                    {max
                      ? 'Everything; the fee comes out of it.'
                      : fiat != null && parseTyped(amount) != null
                      ? `≈ ${formatExact(parseTyped(amount) ?? '0', unit)}`
                      : `${formatExact(wallet.spendableZatoshi, unit)}${approx(
                          wallet.spendableZatoshi,
                        )} available`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: max }}
                    hitSlop={10}
                    onPress={() => {
                      setAmount('');
                      setMax(!max);
                    }}
                    style={[styles.maxChip, max && styles.maxChipOn]}
                  >
                    <Text style={[styles.maxLabel, max && styles.maxLabelOn]}>
                      Max
                    </Text>
                  </Pressable>
                </View>
                {confirming !== '0' && (
                  <Confirming
                    text={`${formatExact(confirming, unit)} ${waitingText(
                      slowestWaiting(wallet.transactions, wallet.networkHeight),
                    )}`}
                  />
                )}

                {!transparent && (noteOpen || memo !== '') && (
                  <>
                    <View style={styles.rule} />
                    <Text style={styles.fieldLabel}>PRIVATE NOTE</Text>
                    <TextInput
                      style={styles.noteInput}
                      value={memo}
                      onChangeText={setMemo}
                      multiline
                      maxLength={500}
                      autoFocus={memo === ''}
                      placeholder="Only the receiver can read this"
                      placeholderTextColor={colors.goldDim}
                      selectionColor={colors.gold}
                    />
                  </>
                )}
              </View>

              {!transparent && !noteOpen && memo === '' && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setNoteOpen(true)}
                  style={styles.addNote}
                >
                  <Text style={styles.addNoteText}>+ Add a private note</Text>
                </Pressable>
              )}

              {error != null && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <BrassButton
              label="Review"
              icon="arrowUp"
              onPress={review}
              busy={busy}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.quietButton}
            >
              <Text style={styles.quietText}>Cancel</Text>
            </Pressable>
          </>
        )}

        {step.name === 'contacts' && (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <SheetHeader title="Contacts" />
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
              variant="back"
              onPress={() => {
                setError(null);
                setStep({ name: 'form' });
              }}
            />
          </>
        )}

        {step.name === 'scan' && (
          <>
            <SheetHeader
              title="Scan address"
              subtitle="Point the camera at a Zcash QR code."
            />
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
              variant="back"
              onPress={() => setStep({ name: 'form' })}
            />
          </>
        )}

        {step.name === 'review' && (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <SheetHeader
                title="Check before releasing"
                subtitle="Nothing has left the lock yet. A released payment cannot be reversed."
              />

              <View style={[card, styles.receipt]}>
                <ReceiptRow
                  label="To"
                  value={
                    isOwnAddress(step.review.toAddress)
                      ? 'Yourself'
                      : contactName(contacts, step.review.toAddress) ??
                        'New address'
                  }
                  strong
                />
                <Text style={styles.receiptAddress} selectable>
                  {grouped(step.review.toAddress)}
                </Text>
                <ReceiptRow
                  label={
                    isOwnAddress(step.review.toAddress)
                      ? 'Arrives at your address'
                      : 'They receive'
                  }
                  value={formatExact(step.review.zatoshi, unit)}
                  strong
                />
                <ReceiptRow
                  label="Network fee"
                  value={formatExact(step.review.fee, unit)}
                />
                <View style={styles.receiptRule} />
                <ReceiptRow
                  label="Total released"
                  value={formatExact(reviewTotal(step.review), unit)}
                  strong
                />
                <ReceiptRow
                  label="Stays locked"
                  value={formatExact(
                    remaining(wallet.totalZatoshi, step.review),
                    unit,
                  )}
                  accent
                />
                {currency != null && price != null && (
                  <Text style={styles.receiptSub}>
                    Total ≈{' '}
                    {formatFiat(reviewTotal(step.review), price, currency)}
                  </Text>
                )}
                {step.review.memo !== '' && (
                  <>
                    <View style={styles.receiptRule} />
                    <Text style={styles.receiptLabel}>Private note</Text>
                    <Text style={styles.receiptNote} selectable>
                      {step.review.memo}
                    </Text>
                  </>
                )}
              </View>

              {waiting > 0 && (
                <Text style={styles.error}>
                  A release from this phone is still waiting to go out. Check
                  Activity first, so you do not pay twice.
                </Text>
              )}
              {error != null && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <BrassButton
              label={`Release ${formatExact(step.review.zatoshi, unit)}`}
              icon="arrowUp"
              onPress={() => send(step.review)}
              busy={busy}
            />
            <View style={styles.gap} />
            <Button
              label="Change"
              variant="back"
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
            <SheetHeader
              title="Release saved"
              subtitle="Made, but not delivered yet."
            />
            <View style={styles.center}>
              <View style={styles.doneLock}>
                <ZeckyLock open={!closedAgain} size={120} />
              </View>
              <Text style={[styles.error, styles.centerText]}>
                {step.message}
              </Text>
              <Text style={[styles.body, styles.centerText]}>
                Activity shows it as “Waiting to release”. Do not release it
                again. You can close this screen.
              </Text>
            </View>
            <Button label="Done" onPress={onClose} />
          </>
        )}

        {step.name === 'sent' && (
          <>
            <SheetHeader title="Released" subtitle="The lock closes again." />
            <View style={styles.center}>
              <View style={styles.doneLock}>
                <ZeckyLock open={!closedAgain} size={120} />
              </View>
              <Text style={[styles.body, styles.centerText]}>
                It shows as confirmed once it is in a block, usually within a
                few minutes. The rest stays locked.
              </Text>
              <Text style={[styles.hint, styles.centerText]} selectable>
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

/** "u1ab cdef …": groups of four, easier to compare by eye. */
function grouped(address: string): string {
  return (address.match(/.{1,4}/g) ?? []).join(' ');
}

/** A receipt line: label, a dotted leader, and the value on the right. */
function ReceiptRow(props: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptRowLabel}>{props.label}</Text>
      <View style={styles.leader}>
        <Svg width="100%" height={2}>
          <Line
            x1="0"
            y1="1"
            x2="100%"
            y2="1"
            stroke={colors.textMuted}
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <Text
        selectable
        style={[
          styles.receiptValue,
          props.strong && styles.receiptStrong,
          props.accent && styles.receiptAccent,
        ]}
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
  scroll: { paddingBottom: space.lg, paddingTop: space.sm },
  center: { flex: 1, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  noTop: { marginTop: 0, marginBottom: space.md },
  formCard: { paddingVertical: space.md },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  fieldLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  toInput: {
    fontFamily: 'Menlo',
    fontSize: 14,
    color: colors.text,
    paddingVertical: space.sm,
  },
  contactLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ok,
  },
  warnLine: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.danger,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: space.md,
  },
  // A fixed height: iOS sizes a text field once, sometimes before the
  // serif font is ready, and then clips the top of the large digits.
  amountInput: {
    fontFamily: fonts.serifMedium,
    fontSize: 40,
    color: colors.text,
    height: 62,
    paddingTop: 6,
    paddingBottom: 0,
    fontVariant: ['tabular-nums'],
  },
  amountFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maxChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold + '77',
    marginLeft: space.sm,
  },
  maxChipOn: { backgroundColor: colors.gold + '22', borderColor: colors.gold },
  noteInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    minHeight: 44,
    paddingTop: space.sm,
    textAlignVertical: 'top',
  },
  addNote: { alignSelf: 'flex-start', marginTop: space.md, padding: 4 },
  addNoteText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
  },
  quietButton: { alignSelf: 'center', paddingVertical: space.sm + 4 },
  quietText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
  doneLock: { alignItems: 'center', marginBottom: space.lg },
  receipt: { paddingVertical: space.sm + 4 },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 7,
  },
  receiptRowLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  leader: { flex: 1, marginHorizontal: space.sm, marginBottom: 4 },
  receiptValue: { fontFamily: fonts.sans, fontSize: 14, color: colors.text },
  receiptStrong: { fontFamily: fonts.sansSemiBold },
  receiptAccent: { fontFamily: fonts.sansSemiBold, color: colors.gold },
  receiptAddress: {
    fontFamily: 'Menlo',
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
    marginBottom: 6,
  },
  receiptRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: space.sm,
  },
  receiptSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  receiptLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  receiptNote: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginTop: 4,
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
    borderColor: colors.gold + '55',
    overflow: 'hidden',
  },
  unitOption: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unitOn: { backgroundColor: colors.gold + '22', color: colors.gold },
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
  maxLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.gold,
  },
  maxLabelOn: { color: colors.gold },
  multiline: { minHeight: 84, textAlignVertical: 'top', lineHeight: 22 },
  hint: {
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.xs,
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
