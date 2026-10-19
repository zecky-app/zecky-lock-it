import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Confirming } from '../components/Confirming';
import { Icon } from '../components/Icon';
import { Toast, ToastMessage } from '../components/Toast';
import { TransactionRow } from '../components/TransactionRow';
import type { Currency } from '../config';
import { formatFiat, usePrices } from '../lib/price';
import {
  loadCurrency,
  loadHidden,
  loadUnit,
  saveCurrency,
  saveHidden,
  saveUnit,
} from '../lib/settings';
import { isHomeNode, useServer } from '../lib/server';
import { txKind } from '../lib/transactions';
import { useHomeNodeReachable, useNetwork } from '../lib/network';
import { useTorWanted } from '../lib/tor';
import {
  Unit,
  confirmingZatoshi,
  formatDisplay,
  formatExact,
} from '../lib/zec';
import {
  fonts,
  makeStyles,
  setThemeMode,
  space,
  useColors,
  useIsDark,
} from '../theme';
import type { StoredWallet } from '../wallet/seed';
import { SyncStatus, useSynchronizer } from '../wallet/useSynchronizer';
import { ActivityScreen } from './ActivityScreen';
import { ReceiveScreen } from './ReceiveScreen';
import { SendScreen } from './SendScreen';
import { SettingsScreen } from './SettingsScreen';
import { usePhraseUnconfirmed } from '../lib/phraseCheck';
import { TransactionScreen } from './TransactionScreen';

interface Props {
  wallet: StoredWallet;
  isNew: boolean;
  /** The app-code screen is covering the app: close any open sheet. */
  locked: boolean;
  /** The wallet was erased from this phone in Settings. */
  onErased: () => void;
}

const HIDDEN_AMOUNT = '••••••';

const TOR_LABELS = {
  off: 'off',
  starting: 'connecting',
  on: 'on',
  failed: 'could not connect',
  unavailable: 'not available',
} as const;

/** How many payments the main screen shows before "See all". */
const RECENT_COUNT = 3;

/**
 * The line above the balance. On your own node (Rock it) it says so, while
 * syncing and once synced.
 */
function statusLine(
  status: SyncStatus,
  progress: number,
  rockIt = false,
): string {
  switch (status) {
    case 'STARTING':
      return rockIt ? 'Connecting… · Rock it' : 'Connecting…';
    case 'SYNCING':
      return `Syncing ${Math.floor(progress)}%${rockIt ? ' · Rock it' : ''}`;
    case 'SYNCED':
      return rockIt ? 'Zecky Lock it (Rock it)' : 'Zecky Lock it';
    case 'DISCONNECTED':
      return rockIt ? 'Rock it not reachable' : 'Offline';
    case 'STOPPED':
      return 'Stopped';
  }
}

export function HomeScreen({ wallet, isNew, locked, onErased }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const state = useSynchronizer(wallet, isNew);
  const network = useNetwork();
  const server = useServer();
  const rockIt = isHomeNode(server);
  const nodeReachable = useHomeNodeReachable(server, rockIt, network);
  // Offline, or Rock it on mobile data without an answer from the node.
  const cutOff = !network.online || (rockIt && !nodeReachable);
  const synced = state.status === 'SYNCED' && !cutOff;
  const confirming = confirmingZatoshi(state);
  const [receiving, setReceiving] = useState(false);
  const [sending, setSending] = useState(false);
  const [unit, setUnit] = useState<Unit>(loadUnit);
  const [hidden, setHidden] = useState<boolean>(loadHidden);
  const dark = useIsDark();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsStart, setSettingsStart] = useState<
    'server' | 'phrase' | undefined
  >();
  const [activityOpen, setActivityOpen] = useState(false);
  const phraseUnconfirmed = usePhraseUnconfirmed();
  const [currency, setCurrency] = useState<Currency | null>(loadCurrency);
  // With Tor switched on, the price comes through Tor from the Zcash
  // engine, which only knows USD. It never falls back to a direct request.
  const torWanted = useTorWanted();
  const shownCurrency: Currency | null =
    currency == null ? null : torWanted ? 'USD' : currency;
  const prices = usePrices(
    shownCurrency != null,
    !torWanted ? 'direct' : state.tor === 'on' ? 'tor' : 'none',
  );
  const price = shownCurrency == null ? undefined : prices?.[shownCurrency];
  const chooseCurrency = (next: Currency | null) => {
    setCurrency(next);
    saveCurrency(next);
  };
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  // Looked up by id so the sheet updates when the payment confirms.
  const openTx =
    state.transactions.find(tx => tx.rawTransactionId === openTxId) ?? null;

  const toggleUnit = () => {
    const next: Unit = unit === 'ZEC' ? 'zats' : 'ZEC';
    setUnit(next);
    saveUnit(next);
  };

  // --- "Payment received" and "Payment sent" messages ---
  // Payments already in the wallet when it finishes syncing are history,
  // not news: only what arrives after that gets a message.
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [queued, setQueued] = useState<(ToastMessage & { txId: string })[]>([]);
  const toastTx = useRef<string | null>(null);
  const known = useRef<Set<string>>(new Set());
  const caughtUp = useRef(false);
  const announced = useRef<Set<string>>(new Set());

  const amountText = (zatoshi: string) =>
    hidden ? 'Amount hidden' : formatExact(zatoshi, unit);
  const amountRef = useRef(amountText);
  amountRef.current = amountText;

  useEffect(() => {
    const fresh = state.transactions.filter(
      tx => !known.current.has(tx.rawTransactionId),
    );
    fresh.forEach(tx => known.current.add(tx.rawTransactionId));
    if (!caughtUp.current) {
      if (synced) caughtUp.current = true;
      return;
    }
    const news = fresh
      .filter(
        tx =>
          txKind(tx) === 'received' &&
          !tx.isExpired &&
          !announced.current.has(tx.rawTransactionId),
      )
      .map(tx => ({
        key: tx.rawTransactionId,
        txId: tx.rawTransactionId,
        kind: 'received' as const,
        title: 'Payment received',
        detail: amountRef.current(tx.value),
      }));
    news.forEach(n => announced.current.add(n.txId));
    if (news.length > 0) setQueued(q => [...q, ...news]);
  }, [state.transactions, synced]);

  const announceSent = (txId: string, zatoshi: string) => {
    announced.current.add(txId);
    known.current.add(txId);
    setQueued(q => [
      ...q,
      {
        key: txId,
        txId,
        kind: 'sent',
        title: 'Payment sent',
        detail: amountRef.current(zatoshi),
      },
    ]);
  };

  // Show the next message once no sheet is covering the main screen.
  const sheetOpen =
    receiving || sending || settingsOpen || activityOpen || openTxId != null;
  useEffect(() => {
    if (toast == null && !sheetOpen && !locked && queued.length > 0) {
      const [next, ...rest] = queued;
      toastTx.current = next.txId;
      setToast(next);
      setQueued(rest);
    }
  }, [toast, sheetOpen, locked, queued]);

  // Sheets sit above everything else, so they must close for the lock
  // screen to cover the app.
  useEffect(() => {
    if (locked) {
      setReceiving(false);
      setSending(false);
      setSettingsOpen(false);
      setActivityOpen(false);
      setOpenTxId(null);
    }
  }, [locked]);

  const toggleHidden = () => {
    setHidden(!hidden);
    saveHidden(!hidden);
  };

  const [shielding, setShielding] = useState(false);
  const [shieldNote, setShieldNote] = useState<string | null>(null);
  const shield = async () => {
    setShielding(true);
    setShieldNote(null);
    try {
      await state.shieldFunds();
      setShieldNote('Shielding started. It can take a few minutes to confirm.');
    } catch (e) {
      setShieldNote(
        `Shielding failed. ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setShielding(false);
    }
  };

  // Sized by hand: long zats amounts must shrink to stay on one line.
  const balanceText = hidden
    ? HIDDEN_AMOUNT
    : formatDisplay(state.totalZatoshi, unit);
  const balanceSize =
    balanceText.length <= 8
      ? 56
      : balanceText.length <= 11
      ? 42
      : balanceText.length <= 14
      ? 34
      : 26;

  const header = (
    <View>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            synced && styles.dotOk,
            (cutOff || state.status === 'DISCONNECTED') && styles.dotDanger,
          ]}
        />
        <Text style={styles.status}>
          {!network.online
            ? 'No internet connection'
            : cutOff
            ? 'Rock it not reachable: not on home Wi-Fi or Tailscale'
            : statusLine(state.status, state.scanProgress, rockIt)}
        </Text>
        {torWanted && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tor: ${
              TOR_LABELS[state.tor]
            }. Open network settings`}
            hitSlop={12}
            onPress={() => {
              setSettingsStart('server');
              setSettingsOpen(true);
            }}
            style={state.tor === 'starting' && styles.torStarting}
          >
            <Icon
              name="onion"
              size={20}
              color={
                state.tor === 'on' || state.tor === 'starting'
                  ? colors.gold
                  : colors.danger
              }
            />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={toggleUnit}
        accessibilityRole="button"
        accessibilityHint="Switches between ZEC and zats"
        style={styles.balanceBlock}
      >
        <View style={styles.captionRow}>
          <Text style={styles.caption}>Balance</Text>
          <View style={styles.captionIcons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                dark ? 'Switch to light theme' : 'Switch to dark theme'
              }
              hitSlop={12}
              onPress={() => setThemeMode(dark ? 'light' : 'dark')}
              style={styles.captionIcon}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
              hitSlop={12}
              onPress={toggleHidden}
            >
              <Icon name={hidden ? 'eyeOff' : 'eye'} />
            </Pressable>
          </View>
        </View>
        {shownCurrency != null && price != null && (
          <Text style={styles.fiat}>
            {hidden
              ? HIDDEN_AMOUNT
              : formatFiat(state.totalZatoshi, price, shownCurrency)}
          </Text>
        )}
        <View style={styles.balanceRow}>
          <Text style={[styles.balance, { fontSize: balanceSize }]}>
            {balanceText}
          </Text>
          <Text style={styles.unit}> {unit}</Text>
        </View>
        {confirming !== '0' && (
          <Confirming
            text={
              hidden
                ? 'Part of your balance is available in a few minutes'
                : `${formatExact(confirming, unit)} available in a few minutes`
            }
          />
        )}
        {!hidden && (
          <Text style={styles.note}>
            Tap to show in {unit === 'ZEC' ? 'zats' : 'ZEC'}
          </Text>
        )}
      </Pressable>

      {state.error != null && <Text style={styles.error}>{state.error}</Text>}

      {phraseUnconfirmed && BigInt(state.totalZatoshi) > 0n && (
        <View style={styles.publicCard}>
          <Text style={styles.publicTitle}>
            Your recovery phrase isn’t confirmed yet
          </Text>
          <Text style={styles.note}>
            Check your paper copy now, while you still have this phone.
          </Text>
          <View style={styles.publicAction}>
            <Button
              label="Confirm"
              variant="quiet"
              onPress={() => {
                setSettingsStart('phrase');
                setSettingsOpen(true);
              }}
            />
          </View>
        </View>
      )}

      {BigInt(state.transparentZatoshi) > 0n && (
        <View style={styles.publicCard}>
          <Text style={styles.publicTitle}>
            {hidden
              ? 'You have funds on your public address'
              : `${formatExact(
                  state.transparentZatoshi,
                  unit,
                )} on your public address`}
          </Text>
          <Text style={styles.note}>
            These are visible to everyone. Shielding moves them into your
            private balance, for a small network fee.
          </Text>
          {shieldNote != null && <Text style={styles.note}>{shieldNote}</Text>}
          <View style={styles.publicAction}>
            <Button
              label="Shield now"
              variant="quiet"
              busy={shielding}
              disabled={!synced}
              onPress={shield}
            />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Receive" onPress={() => setReceiving(true)} />
        </View>
        <View style={styles.action}>
          <Button
            label="Send"
            variant="quiet"
            disabled={!synced}
            onPress={() => setSending(true)}
          />
        </View>
      </View>
      {!synced && (
        <Text style={styles.note}>
          Sending unlocks once the wallet is up to date.
        </Text>
      )}

      <Text style={[styles.caption, styles.historyTitle]}>Recent activity</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={state.transactions.slice(0, RECENT_COUNT)}
        keyExtractor={tx => tx.rawTransactionId}
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            unit={unit}
            hidden={hidden}
            onPress={() => setOpenTxId(item.rawTransactionId)}
          />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          state.transactions.length > RECENT_COUNT ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setActivityOpen(true)}
              style={styles.seeAll}
            >
              <Text style={styles.link}>See all activity</Text>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {synced
              ? 'No payments yet. Tap Receive to get your address.'
              : 'Payments appear here as the wallet syncs.'}
          </Text>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => {
            setSettingsStart(undefined);
            setSettingsOpen(true);
          }}
          style={styles.bottomItem}
        >
          <Icon name="settings" color={colors.textMuted} />
          <Text style={styles.bottomLabel}>Settings</Text>
        </Pressable>
      </View>

      <Toast
        message={toast}
        onPress={() => {
          const id = toastTx.current;
          setToast(null);
          if (id != null && known.current.has(id)) setOpenTxId(id);
        }}
        onDone={() => setToast(null)}
      />

      <ReceiveScreen
        visible={receiving}
        wallet={state}
        unit={unit}
        onClose={() => setReceiving(false)}
      />
      <TransactionScreen tx={openTx} onClose={() => setOpenTxId(null)} />
      <SettingsScreen
        visible={settingsOpen}
        startOn={settingsStart}
        unit={unit}
        onToggleUnit={toggleUnit}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        currency={currency}
        onChooseCurrency={chooseCurrency}
        birthdayHeight={wallet.birthdayHeight}
        tor={state.tor}
        walletAddress={state.address}
        onErased={onErased}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsStart(undefined);
        }}
      />
      <ActivityScreen
        visible={activityOpen}
        transactions={state.transactions}
        unit={unit}
        hidden={hidden}
        onClose={() => setActivityOpen(false)}
      />
      <SendScreen
        visible={sending}
        wallet={state}
        unit={unit}
        onToggleUnit={toggleUnit}
        currency={shownCurrency}
        price={price}
        onSent={announceSent}
        onClose={() => setSending(false)}
      />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1 },
  list: { padding: space.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginRight: space.sm,
  },
  dotOk: { backgroundColor: colors.ok },
  dotDanger: { backgroundColor: colors.danger },
  status: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  link: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold },
  publicCard: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.lg,
  },
  publicTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  publicAction: { marginTop: space.md },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  bottomItem: { alignItems: 'center', paddingHorizontal: space.md },
  bottomLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  seeAll: { alignSelf: 'center', paddingVertical: space.md },
  torStarting: { opacity: 0.45 },
  captionIcons: { flexDirection: 'row', alignItems: 'center' },
  captionIcon: { marginRight: space.md },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceBlock: { marginTop: space.xl, marginBottom: space.xl },
  caption: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  fiat: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.gold,
    marginTop: space.sm,
    fontVariant: ['tabular-nums'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: space.xs,
  },
  balance: {
    fontFamily: fonts.serifMedium,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: fonts.serif, fontSize: 24, color: colors.gold },
  note: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: space.xs,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.danger,
    marginBottom: space.md,
  },
  actions: { flexDirection: 'row', marginHorizontal: -space.xs },
  action: { flex: 1, marginHorizontal: space.xs },
  historyTitle: { marginTop: space.xl, marginBottom: space.xs },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.md,
  },
}));
