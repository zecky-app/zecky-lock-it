import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button } from '../components/Button';
import { QrCode } from '../components/QrCode';
import {
  BrassButton,
  SheetCorner,
  SheetHeader,
  useCardStyle,
} from '../components/lock';
import {
  loadAddresses,
  saveAddresses,
  withDefault,
  withDiscovered,
} from '../lib/addressBook';
import { buildPaymentUri } from '../lib/paymentUri';
import { formatExact, parseAmount, shortenAddress, Unit } from '../lib/zec';
import { fonts, makeStyles, space, useColors } from '../theme';
import type { Wallet } from '../wallet/useSynchronizer';

interface Props {
  visible: boolean;
  wallet: Wallet;
  /** Display unit, for typing a requested amount. */
  unit: Unit;
  onClose: () => void;
}

type Mode = 'private' | 'public';

export function ReceiveScreen({ visible, wallet, unit, onClose }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const card = useCardStyle();
  const { width, height } = useWindowDimensions();
  // Sized to the screen, so the whole sheet fits without scrolling.
  const qrSize = Math.min(
    width - space.lg * 2 - 10,
    260,
    Math.round(height * 0.3),
  );
  const [mode, setMode] = useState<Mode>('private');
  const [listOpen, setListOpen] = useState(false);
  /** Generated private addresses, newest first (without the default). */
  const [generated, setGenerated] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  // Tapping the QR code or the address copies it, with a short confirmation.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  // Optional: ask for a specific amount. The QR code then carries it, so
  // the sender's wallet fills it in.
  // Shortened to one line; press and hold shows the whole address.
  const [full, setFull] = useState(false);
  useEffect(() => setFull(false), [visible, mode, selected]);
  const [requesting, setRequesting] = useState(false);
  const [requestText, setRequestText] = useState('');
  const requested = requesting ? parseAmount(requestText, unit) : null;

  const defaultAddress = wallet.address;
  const { newShieldedAddress, addressUsage } = wallet;
  const txCount = wallet.transactions.length;

  const addNew = useCallback(
    async (current: string[]) => {
      if (defaultAddress == null) return;
      setBusy(true);
      try {
        const fresh = await newShieldedAddress();
        const next = [fresh, ...current.filter(a => a !== fresh)];
        setGenerated(next);
        saveAddresses(defaultAddress, next);
        setSelected(fresh);
      } catch {
        // Rotation unavailable: stay on what we have.
        setSelected(current[0] ?? defaultAddress);
      } finally {
        setBusy(false);
      }
    },
    [defaultAddress, newShieldedAddress],
  );

  // On opening: always land on an address that has never been used.
  useEffect(() => {
    if (!visible || defaultAddress == null) return;
    let cancelled = false;
    setMode('private');
    setListOpen(false);
    (async () => {
      const saved = await loadAddresses(defaultAddress);
      const counts = await addressUsage();
      if (cancelled) return;
      // Any address the wallet was paid on belongs in the list, even if
      // this phone never saved it (after a restore, for instance).
      const stored = withDiscovered(saved, counts, defaultAddress);
      if (stored !== saved) saveAddresses(defaultAddress, stored);
      setGenerated(stored);
      setUsage(counts);
      // Prefer an address that has never been paid (newest first, the
      // wallet's first address last). Only make a new one when all are used.
      const unused = withDefault(stored, defaultAddress).find(
        candidate => (counts[candidate] ?? 0) === 0,
      );
      if (unused == null) {
        await addNew(stored);
      } else {
        setSelected(unused);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, defaultAddress, addressUsage, addNew]);

  // Keep the counts current while the sheet is open.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    addressUsage().then(counts => {
      if (cancelled) return;
      setUsage(counts);
      if (defaultAddress == null) return;
      setGenerated(current => {
        const next = withDiscovered(current, counts, defaultAddress);
        if (next !== current) saveAddresses(defaultAddress, next);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visible, txCount, addressUsage, defaultAddress]);

  useEffect(() => {
    if (visible) {
      setRequesting(false);
      setRequestText('');
    }
  }, [visible]);

  const copy = (shown: string) => {
    Clipboard.setString(
      requested == null ? shown : buildPaymentUri(shown, requested),
    );
    setCopied(true);
  };

  const all =
    defaultAddress == null ? [] : withDefault(generated, defaultAddress);
  const used = (a: string) => usage[a] ?? 0;
  const address =
    mode === 'public'
      ? wallet.transparentAddress
      : busy
      ? null
      : selected ?? defaultAddress;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SheetCorner />
        {listOpen ? (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <SheetHeader
                title="Your private addresses"
                subtitle="The number shows how many payments each address has received. Tap one to show it."
              />
              <View style={[card, styles.listCard]}>
                {all.map((a, i) => (
                  <Pressable
                    key={a}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelected(a);
                      setMode('private');
                      setListOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && styles.rowLine,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowAddress}>
                        {shortenAddress(a, 12)}{' '}
                        <Text style={styles.rowCount}>({used(a)})</Text>
                      </Text>
                      {a === defaultAddress && (
                        <Text style={styles.rowNote}>First address</Text>
                      )}
                    </View>
                    {a === (selected ?? defaultAddress) && (
                      <Text style={styles.rowShown}>Shown</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Button
              label="Create a new address"
              busy={busy}
              onPress={async () => {
                await addNew(generated);
                setListOpen(false);
              }}
            />
            <View style={styles.gap} />
            <Button
              label="Back"
              variant="back"
              onPress={() => setListOpen(false)}
            />
          </>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <SheetHeader
                title={mode === 'private' ? 'Lock more' : 'Public address'}
                subtitle={
                  mode === 'private'
                    ? 'Send Zcash to this private address. It locks in by itself.'
                    : 'Only for senders that cannot pay a private address.'
                }
              />

              <View style={styles.middle}>
                {address == null ? (
                  <Text style={[styles.body, styles.centerText]}>
                    Preparing your address…
                  </Text>
                ) : (
                  <>
                    <View
                      style={[
                        styles.qrOuter,
                        mode === 'public' && styles.qrOuterPublic,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Copy address"
                        onPress={() => copy(address)}
                        style={[
                          styles.qrInner,
                          mode === 'public' && styles.qrInnerPublic,
                        ]}
                      >
                        <QrCode
                          value={
                            requested == null
                              ? address
                              : buildPaymentUri(address, requested)
                          }
                          size={qrSize}
                          badge
                        />
                      </Pressable>
                    </View>
                    {requested != null && (
                      <Text style={[styles.requestLine, styles.centerText]}>
                        Requesting {formatExact(requested, unit)}
                      </Text>
                    )}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Copy address"
                      accessibilityHint="Press and hold to show the full address"
                      hitSlop={8}
                      onPress={() => copy(address)}
                      onLongPress={() => setFull(f => !f)}
                      style={({ pressed }) => [
                        styles.addressTap,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.address} selectable>
                        {full ? grouped(address) : groupedShort(address)}
                      </Text>
                      <Text style={[styles.copied, !copied && styles.dimmed]}>
                        {copied
                          ? requested == null
                            ? 'Address copied ✓'
                            : 'Payment request copied ✓'
                          : 'Tap to copy'}
                      </Text>
                    </Pressable>
                    {mode === 'public' && (
                      <Text style={[styles.warning, styles.centerText]}>
                        Anyone can see payments to this address. Shield the
                        funds afterwards.
                      </Text>
                    )}
                  </>
                )}

                {requesting && (
                  <View style={styles.requestBox}>
                    <TextInput
                      style={styles.input}
                      value={requestText}
                      onChangeText={setRequestText}
                      keyboardType={
                        unit === 'ZEC' ? 'decimal-pad' : 'number-pad'
                      }
                      placeholder={`Amount in ${unit}`}
                      placeholderTextColor={colors.goldDim}
                      selectionColor={colors.gold}
                      autoFocus
                    />
                  </View>
                )}
              </View>

              <View style={styles.links}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    if (requesting) setRequestText('');
                    setRequesting(!requesting);
                  }}
                >
                  <Text style={styles.linkLabel}>
                    {requesting ? 'Remove amount' : 'Request an amount'}
                  </Text>
                </Pressable>
                {mode === 'private' && (
                  <>
                    <Text style={styles.linkDot}>·</Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setListOpen(true)}
                    >
                      <Text style={styles.linkLabel}>All addresses</Text>
                    </Pressable>
                  </>
                )}
                <Text style={styles.linkDot}>·</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() =>
                    setMode(mode === 'private' ? 'public' : 'private')
                  }
                >
                  <Text style={styles.linkLabel}>
                    {mode === 'private' ? 'Public address' : 'Private address'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            <BrassButton
              label="Share address"
              icon="arrowUp"
              disabled={address == null}
              onPress={() => {
                if (address != null) {
                  Share.share({
                    message:
                      requested == null
                        ? address
                        : buildPaymentUri(address, requested),
                  });
                }
              }}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.done}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

/** "u1ab cdef …": groups of four, easier to compare by eye. */
function grouped(address: string): string {
  return (address.match(/.{1,4}/g) ?? []).join(' ');
}

/** The first and last twelve characters, in groups of four. */
function groupedShort(address: string): string {
  if (address.length <= 28) return grouped(address);
  return `${grouped(address.slice(0, 12))} … ${grouped(address.slice(-12))}`;
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
  scroll: { flexGrow: 1, paddingBottom: space.sm },
  middle: { flexGrow: 1, justifyContent: 'center' },
  qrOuterPublic: { borderColor: colors.danger + '55' },
  qrInnerPublic: { borderColor: colors.danger + 'AA' },
  addressTap: {
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: space.md,
  },
  linkDot: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  done: { alignSelf: 'center', paddingVertical: space.sm + 4 },
  doneText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.lg,
  },
  centerText: { textAlign: 'center' },
  warning: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.danger,
    marginTop: space.sm,
  },
  qrOuter: {
    alignSelf: 'center',
    marginTop: space.md,
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold + '40',
  },
  qrInner: {
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.gold + 'CC',
    overflow: 'hidden',
  },
  requestLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.gold,
    marginTop: space.md,
  },
  address: {
    fontFamily: 'Menlo',
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
  },
  copied: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.ok,
    marginTop: 4,
    textAlign: 'center',
  },
  dimmed: { color: colors.textMuted },
  requestBox: { marginTop: space.md },
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
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  link: { alignSelf: 'center', marginTop: space.md },
  linkLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold },
  listCard: { paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowAddress: { fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  rowCount: { fontFamily: fonts.sansSemiBold, color: colors.gold },
  rowNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowShown: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.gold },
  gap: { height: space.sm },
}));
