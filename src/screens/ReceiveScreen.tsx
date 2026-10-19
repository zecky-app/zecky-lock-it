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
  const { width } = useWindowDimensions();
  const qrSize = Math.min(width - space.lg * 2, 280);
  const [mode, setMode] = useState<Mode>('private');
  const [listOpen, setListOpen] = useState(false);
  /** Generated private addresses, newest first (without the default). */
  const [generated, setGenerated] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  // The address is shown shortened; tapping it shows all of it.
  const [full, setFull] = useState(false);
  // Tapping the QR code or the address copies it, with a short confirmation.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  // Optional: ask for a specific amount. The QR code then carries it, so
  // the sender's wallet fills it in.
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
    setFull(false);
  }, [visible, mode, selected]);
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
        {listOpen ? (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <Text style={styles.title}>Your private addresses</Text>
              <Text style={styles.body}>
                The number shows how many payments each address has received.
                Tap one to show it.
              </Text>
              <View style={styles.card}>
                {all.map(a => (
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
              variant="quiet"
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
              <Text style={styles.title}>Receive ZEC</Text>

              <View style={styles.modes}>
                {(['private', 'public'] as const).map(m => (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: m === mode }}
                    onPress={() => setMode(m)}
                    style={[styles.mode, m === mode && styles.modeOn]}
                  >
                    <Text
                      style={[
                        styles.modeLabel,
                        m === mode && styles.modeLabelOn,
                      ]}
                    >
                      {m === 'private' ? 'Private' : 'Public'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.body, mode === 'public' && styles.warning]}>
                {mode === 'private'
                  ? 'This address has never been used. A new one is prepared once it has been paid. Earlier addresses keep working.'
                  : 'Public address. Anyone can see payments to it and what it holds. Use it only when the sender cannot pay a private address, then shield the funds.'}
              </Text>

              <View style={styles.center}>
                {address == null ? (
                  <Text style={styles.body}>Preparing your address…</Text>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Copy address"
                      onPress={() => copy(address)}
                    >
                      <QrCode
                        value={
                          requested == null
                            ? address
                            : buildPaymentUri(address, requested)
                        }
                        size={qrSize}
                      />
                    </Pressable>
                    {requested != null && (
                      <Text style={styles.requestLine}>
                        Requesting {formatExact(requested, unit)}
                      </Text>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Copy address"
                      accessibilityHint="Press and hold to show the full address"
                      hitSlop={10}
                      onPress={() => copy(address)}
                      onLongPress={() => setFull(!full)}
                    >
                      <Text
                        style={[styles.address, !full && styles.addressShort]}
                      >
                        {full ? address : shortenAddress(address, 12)}
                      </Text>
                    </Pressable>
                    <Text style={[styles.copied, !copied && styles.invisible]}>
                      {requested == null
                        ? 'Address copied'
                        : 'Payment request copied'}
                    </Text>
                    {mode === 'private' && (
                      <Text style={styles.usedLine}>
                        Used ({used(address)})
                      </Text>
                    )}
                  </>
                )}
              </View>

              {requesting ? (
                <View style={styles.requestBox}>
                  <TextInput
                    style={styles.input}
                    value={requestText}
                    onChangeText={setRequestText}
                    keyboardType={unit === 'ZEC' ? 'decimal-pad' : 'number-pad'}
                    placeholder={`Amount in ${unit}`}
                    placeholderTextColor={colors.goldDim}
                    selectionColor={colors.gold}
                    autoFocus
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => {
                      setRequesting(false);
                      setRequestText('');
                    }}
                    style={styles.link}
                  >
                    <Text style={styles.linkLabel}>Remove amount</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setRequesting(true)}
                  style={styles.link}
                >
                  <Text style={styles.linkLabel}>Request an amount</Text>
                </Pressable>
              )}
              {mode === 'private' && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setListOpen(true)}
                  style={styles.link}
                >
                  <Text style={styles.linkLabel}>
                    All addresses ({all.length})
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            <Button
              label="Share or copy address"
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
            <View style={styles.gap} />
            <Button label="Done" onPress={onClose} variant="quiet" />
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
  modes: {
    flexDirection: 'row',
    marginTop: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  mode: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeOn: { backgroundColor: colors.gold },
  modeLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  modeLabelOn: { color: colors.onGold },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.md,
  },
  warning: { color: colors.danger },
  center: { alignItems: 'center', marginTop: space.lg },
  address: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.md,
  },
  addressShort: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.3,
  },
  requestLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.gold,
    marginTop: space.md,
  },
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
  copied: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ok,
    marginTop: space.xs,
  },
  invisible: { opacity: 0 },
  usedLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
    marginTop: space.sm,
  },
  link: { alignSelf: 'center', marginTop: space.md },
  linkLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.gold },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    paddingHorizontal: space.md,
    marginTop: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.5 },
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
