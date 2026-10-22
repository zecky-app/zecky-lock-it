import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Confirming } from '../components/Confirming';
import { Icon } from '../components/Icon';
import { Toast, ToastMessage } from '../components/Toast';
import {
  BrassButton,
  Medallion,
  LockInPrompt,
  MilestoneRing,
  OpenLockPrompt,
  ZeckyLock,
} from '../components/lock';
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
import { daysSince, lockedSince } from '../lib/lockedSince';
import { nextMilestone } from '../lib/milestones';
import { slowestWaiting, waitingText } from '../lib/confirmations';
import { confirmOwner } from '../lib/deviceAuth';
import { usePinEnabled } from '../lib/pin';
import { useOpenWait } from '../lib/openWait';
import { asksAt, useAskWhen } from '../lib/askWhen';
import { tapLockStep } from '../lib/lockRules';
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

/**
 * The status line at the bottom. On your own node (Rock it) it says so,
 * while syncing and once synced.
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
      return rockIt ? 'Up to date · Rock it' : 'Up to date';
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
  // The engine stops updating its status after the first full sync, but
  // keeps reporting progress. Progress below 100% means it is catching up
  // again (for example after a long time in the background).
  // The same goes for the start: the engine can report progress before
  // its first status, for example while a restored wallet scans its past.
  const catchingUp =
    (state.status === 'SYNCED' || state.status === 'STARTING') &&
    state.scanProgress > 0 &&
    state.scanProgress < 100;
  const shownStatus = catchingUp ? 'SYNCING' : state.status;
  const synced = shownStatus === 'SYNCED' && !cutOff;
  const confirming = confirmingZatoshi(state);
  const waiting = slowestWaiting(state.transactions, state.networkHeight);
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

  // --- "Locked in" and "Released" messages ---
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

  // Zcash that arrives on the public address is not locked in yet. The
  // engine does not say which address a payment came in on, so a rise of
  // the public balance at the same moment marks it as arrived outside.
  const transparentRef = useRef(BigInt(state.transparentZatoshi));
  const outsideGain = useRef(0n);
  useEffect(() => {
    const now = BigInt(state.transparentZatoshi);
    if (now > transparentRef.current) {
      outsideGain.current += now - transparentRef.current;
    }
    transparentRef.current = now;
  }, [state.transparentZatoshi]);

  // A shielding ("lock it in") is news twice: when it starts, and when it
  // is in a block.
  const shieldingWaiting = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = state.transactions.filter(
      tx => !known.current.has(tx.rawTransactionId),
    );
    fresh.forEach(tx => known.current.add(tx.rawTransactionId));
    // Shieldings that were waiting and are now in a block.
    const lockedIn = state.transactions.filter(
      tx =>
        tx.isShielding &&
        tx.minedHeight > 0 &&
        shieldingWaiting.current.has(tx.rawTransactionId),
    );
    lockedIn.forEach(tx =>
      shieldingWaiting.current.delete(tx.rawTransactionId),
    );
    state.transactions
      .filter(tx => tx.isShielding && tx.minedHeight <= 0 && !tx.isExpired)
      .forEach(tx => shieldingWaiting.current.add(tx.rawTransactionId));
    if (!caughtUp.current) {
      if (synced) caughtUp.current = true;
      return;
    }
    const received = fresh.filter(
      tx =>
        txKind(tx) === 'received' &&
        !tx.isExpired &&
        !announced.current.has(tx.rawTransactionId),
    );
    received.forEach(tx => announced.current.add(tx.rawTransactionId));
    const done = lockedIn.map(tx => ({
      key: `${tx.rawTransactionId}-in`,
      txId: tx.rawTransactionId,
      kind: 'received' as const,
      title: 'Locked in ✓',
      detail: 'Your public Zcash is private now',
    }));
    if (done.length > 0) setQueued(q => [...q, ...done]);
    if (received.length === 0) return;
    // Give the balance a moment to arrive, then decide inside or outside.
    setTimeout(() => {
      const news = received.map(tx => {
        const value = BigInt(tx.value || '0');
        const outsideLock = outsideGain.current >= value && value > 0n;
        if (outsideLock) outsideGain.current -= value;
        return {
          key: tx.rawTransactionId,
          txId: tx.rawTransactionId,
          kind: 'received' as const,
          title: outsideLock ? 'Arrived outside the lock' : 'Locked in',
          detail: outsideLock
            ? `${amountRef.current(tx.value)} · tap Lock it in on Home`
            : amountRef.current(tx.value),
        };
      });
      setQueued(q => [...q, ...news]);
    }, 2000);
    // Not cancelled on the next update: these payments are already marked
    // as announced, so their message must still go out.
    return undefined;
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
        title: 'Released',
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

  // Zcash on the public address is not locked yet: one quiet line on
  // Home, and a card that locks it in (shields it).
  const [lockInOpen, setLockInOpen] = useState(false);
  const [shielding, setShielding] = useState(false);
  const [shieldStarted, setShieldStarted] = useState(false);
  const [shieldNote, setShieldNote] = useState<string | null>(null);
  const outside = BigInt(state.transparentZatoshi) > 0n;
  // A lock-in (shielding) that is not in a block yet.
  const lockingIn = state.transactions.some(
    tx => tx.isShielding && tx.minedHeight <= 0 && !tx.isExpired,
  );
  useEffect(() => {
    if (!outside) {
      setShieldStarted(false);
      setShieldNote(null);
    }
  }, [outside]);
  const shield = async () => {
    setShielding(true);
    setShieldNote(null);
    try {
      await state.shieldFunds();
      setShieldStarted(true);
      setShieldNote('Locking in. It can take a few minutes to confirm.');
      setLockInOpen(false);
      setQueued(q => [
        ...q,
        {
          key: `shield-${Date.now()}`,
          txId: '',
          kind: 'sent',
          title: 'Locking in…',
          detail: 'Usually a few minutes. Home says when it is done.',
        },
      ]);
    } catch (e) {
      setShieldNote(
        `Locking in did not work. ${
          e instanceof Error ? e.message : String(e)
        }`,
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
      ? 54
      : balanceText.length <= 11
      ? 44
      : balanceText.length <= 14
      ? 34
      : 28;

  // --- The lock, as on the Mac ---
  // The lock takes the room that is left above the balance and buttons, so
  // the home screen fits without scrolling on every iPhone. The screen
  // fades in once that room is measured, so nothing jumps at startup.
  const [area, setArea] = useState(0);
  const below =
    270 +
    (confirming !== '0' ? 28 : 0) +
    (outside || lockingIn ? 24 : 0) +
    (phraseUnconfirmed && BigInt(state.totalZatoshi) > 0n ? 24 : 0);
  const heroScale =
    area === 0 ? 1 : Math.min(1, Math.max(0.5, (area - below) / 396));
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (area > 0) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }
  }, [area > 0, fade]); // eslint-disable-line react-hooks/exhaustive-deps
  const [asking, setAsking] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const since = lockedSince(state.transactions);
  const heldDays = since == null ? null : daysSince(since);
  const milestone = nextMilestone(heldDays ?? 0);
  // The plate always shows the lock's state; the value in your currency is
  // an estimate that moves with the price, so it sits under the balance.
  const plateText = lockOpen ? 'OPEN' : 'LOCKED';
  const fiatLine =
    shownCurrency != null && price != null
      ? hidden
        ? '≈ ••••'
        : `≈ ${formatFiat(state.totalZatoshi, price, shownCurrency)}`
      : null;
  const heldLine =
    since == null || heldDays == null
      ? BigInt(state.totalZatoshi) > 0n
        ? 'Locked on this iPhone'
        : 'Nothing locked yet. Tap Lock more to begin.'
      : heldDays === 0
      ? 'Locked since today'
      : `Locked for ${heldDays} ${heldDays === 1 ? 'day' : 'days'}`;
  // One quiet line: how long, and the next milestone the ring is filling to.
  const milestoneText =
    since != null && milestone != null
      ? `${milestone.name} in ${milestone.inDays} ${
          milestone.inDays === 1 ? 'day' : 'days'
        }`
      : null;
  // Home only mentions a payment while it waits for a block; the rest of
  // the history is in Activity.
  const last = state.transactions.find(tx => {
    const kind = txKind(tx);
    return (
      !tx.isExpired &&
      tx.minedHeight <= 0 &&
      (kind === 'received' || kind === 'sent')
    );
  });
  const lastLine = (() => {
    if (last == null) return null;
    const lockedIn = txKind(last) === 'received';
    const what = lockedIn ? 'Locking in' : 'Releasing';
    const when =
      last.minedHeight > 0 && last.blockTimeInSeconds > 0
        ? new Date(last.blockTimeInSeconds * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'waiting for a block';
    if (hidden) return `${what} · ${when}`;
    return `${what} ${lockedIn ? '+' : '−'}${formatExact(
      last.value,
      unit,
    )} · ${when}`;
  })();

  // Tapping the lock asks "Really open the lock?" first. Once the owner
  // checks out, the lock opens on this screen and Release Zcash appears.
  // It closes again after Send, with Close the lock, after two minutes,
  // or when Zecky goes to the background.
  const [openNote, setOpenNote] = useState(false);
  useEffect(() => {
    if (!openNote) return;
    const t = setTimeout(() => setOpenNote(false), 4000);
    return () => clearTimeout(t);
  }, [openNote]);
  const openWait = useOpenWait();
  const pinEnabled = usePinEnabled();
  useAskWhen();
  const checkOnOpen = asksAt('openLock', pinEnabled);
  const tapLock = async () => {
    switch (
      tapLockStep({
        lockOpen,
        synced,
        wait: openWait,
        check: checkOnOpen,
        codeSet: pinEnabled,
      })
    ) {
      case 'release':
        setSending(true);
        break;
      case 'notReady':
        setOpenNote(true);
        break;
      case 'openNow':
        // Both switched off in Keys to the lock: one tap opens it.
        setLockOpen(true);
        break;
      case 'deviceCheck': {
        // The question is switched off: straight to Face ID or the passcode.
        const result = await confirmOwner('Open the lock');
        if (result !== 'cancelled') setLockOpen(true);
        break;
      }
      case 'ask':
        setAsking(true);
    }
  };
  const openLock = () => {
    setAsking(false);
    setLockOpen(true);
  };
  const closeLock = () => {
    setSending(false);
    setLockOpen(false);
  };
  useEffect(() => {
    if (locked) {
      setAsking(false);
      setLockOpen(false);
    }
  }, [locked]);
  useEffect(() => {
    if (!lockOpen) return;
    // While Release is open the two-minute timer waits, but leaving Zecky
    // still closes Release and the lock.
    const t = sending ? null : setTimeout(() => setLockOpen(false), 120_000);
    const sub = AppState.addEventListener('change', next => {
      if (sending ? next === 'background' : next !== 'active') {
        setSending(false);
        setLockOpen(false);
      }
    });
    return () => {
      if (t != null) clearTimeout(t);
      sub.remove();
    };
  }, [lockOpen, sending]);

  const statusText = !network.online
    ? 'No internet connection'
    : cutOff
    ? 'Rock it not reachable: not on home Wi-Fi or Tailscale'
    : statusLine(shownStatus, state.scanProgress, rockIt);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.wordmark}>
          <Text style={styles.brand}>ZECKY</Text>
          <Text style={styles.product}>Lock it</Text>
        </View>
        <View style={styles.topIcons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              dark ? 'Switch to light theme' : 'Switch to dark theme'
            }
            hitSlop={10}
            onPress={() => setThemeMode(dark ? 'light' : 'dark')}
            style={styles.topIcon}
          >
            <Icon name={dark ? 'sun' : 'moon'} color={colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
            hitSlop={10}
            onPress={toggleHidden}
            style={styles.topIcon}
          >
            <Icon name={hidden ? 'eyeOff' : 'eye'} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onLayout={e => setArea(e.nativeEvent.layout.height)}
        style={{ opacity: fade }}
      >
        <View style={styles.spaceAbove} />
        <View style={[styles.hero, { height: Math.round(396 * heroScale) }]}>
          <View style={styles.heroLayer} pointerEvents="none">
            <Medallion diameter={Math.round(700 * heroScale)} />
          </View>
          <View
            style={[styles.heroLayer, since == null && styles.ringWaiting]}
            pointerEvents="none"
          >
            <MilestoneRing
              progress={milestone?.progress ?? 0}
              diameter={Math.round(364 * heroScale)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              lockOpen ? 'The Zecky lock, opened' : 'The Zecky lock, locked'
            }
            accessibilityHint={
              lockOpen
                ? 'Opens Release Zcash'
                : 'Asks whether you really want to open the lock'
            }
            onPress={tapLock}
            style={styles.lockButton}
          >
            <ZeckyLock
              open={lockOpen}
              size={Math.round(244 * heroScale)}
              plateText={plateText}
            />
          </Pressable>
        </View>
        {openNote && (
          <Text style={[styles.note, styles.center]}>
            The lock opens once the wallet is up to date.
          </Text>
        )}

        <Pressable
          onPress={() => !hidden && toggleUnit()}
          accessibilityRole="button"
          accessibilityHint={
            hidden ? undefined : 'Switches between ZEC and zats'
          }
          style={styles.balanceRow}
        >
          <Text
            style={[styles.balance, { fontSize: balanceSize }]}
            numberOfLines={1}
          >
            {balanceText}
          </Text>
          <Text style={styles.unit}> {unit}</Text>
        </Pressable>
        {fiatLine != null && (
          <Text style={[styles.fiat, styles.center]}>{fiatLine}</Text>
        )}

        <Text style={[styles.held, styles.center]}>
          {heldLine}
          {milestoneText != null && (
            <Text style={styles.milestone}> · {milestoneText}</Text>
          )}
        </Text>
        {(outside || lockingIn) && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={
              lockingIn ? 'Opens Activity' : 'Explains it and locks it in'
            }
            hitSlop={8}
            onPress={() =>
              lockingIn ? setActivityOpen(true) : setLockInOpen(true)
            }
            style={styles.needRow}
          >
            <Text style={styles.needText}>
              {lockingIn || (shieldStarted && outside)
                ? 'Locking in… usually a few minutes'
                : `${
                    hidden
                      ? 'Zcash'
                      : `+${formatExact(state.transparentZatoshi, unit)}`
                  } waiting outside the lock · Lock it in ›`}
            </Text>
          </Pressable>
        )}
        {phraseUnconfirmed && BigInt(state.totalZatoshi) > 0n && (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setSettingsStart('phrase');
              setSettingsOpen(true);
            }}
            style={styles.needRow}
          >
            <Text style={styles.needText}>
              Recovery phrase not confirmed yet ›
            </Text>
          </Pressable>
        )}
        {confirming !== '0' && (
          <View style={styles.centerRow}>
            <Confirming
              text={
                hidden
                  ? `Part of your balance is ${waitingText(waiting)}`
                  : `${formatExact(confirming, unit)} ${waitingText(waiting)}`
              }
            />
          </View>
        )}

        {lockOpen ? (
          <>
            <View style={styles.brass}>
              <BrassButton
                label="Release Zcash"
                icon="arrowUp"
                onPress={() => setSending(true)}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={closeLock}
              style={styles.closeRow}
            >
              <Text style={styles.closeText}>Close the lock</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.brass}>
            <BrassButton label="Lock more" onPress={() => setReceiving(true)} />
          </View>
        )}

        {lastLine != null && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens Activity"
            hitSlop={10}
            onPress={() => setActivityOpen(true)}
            style={styles.lastRow}
          >
            <Text style={styles.lastText}>{lastLine} ›</Text>
          </Pressable>
        )}

        {state.error != null && (
          <Text style={[styles.error, styles.center]}>{state.error}</Text>
        )}

        <View style={styles.spaceBelow} />
      </Animated.ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              synced && styles.dotOk,
              (cutOff || state.status === 'DISCONNECTED') && styles.dotDanger,
            ]}
          />
          <Text style={styles.status} numberOfLines={2}>
            {statusText}
            <Text style={styles.statusSep}> · </Text>
            Shielded
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
              style={[
                styles.tor,
                state.tor === 'starting' && styles.torStarting,
              ]}
            >
              <Icon
                name="onion"
                size={18}
                color={
                  state.tor === 'on' || state.tor === 'starting'
                    ? colors.gold
                    : colors.danger
                }
              />
            </Pressable>
          )}
        </View>
        <View style={styles.links}>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setActivityOpen(true)}
          >
            <Text style={styles.linkText}>Activity</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              setSettingsStart(undefined);
              setSettingsOpen(true);
            }}
            style={styles.linkGap}
          >
            <Text style={styles.linkText}>Settings</Text>
          </Pressable>
        </View>
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
        pools={state.pools}
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
        onClose={closeLock}
      />
      <LockInPrompt
        visible={lockInOpen && !locked}
        amountText={hidden ? null : formatExact(state.transparentZatoshi, unit)}
        ready={synced}
        busy={shielding}
        note={shieldNote}
        onLockIn={shield}
        onClose={() => setLockInOpen(false)}
      />
      <OpenLockPrompt
        visible={asking}
        days={heldDays}
        onOpen={openLock}
        onKeep={() => setAsking(false)}
        wait={openWait}
        check={checkOnOpen}
      />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    zIndex: 1,
  },
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 5.5,
    color: colors.gold,
  },
  product: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textMuted,
    marginLeft: 6,
  },
  topIcons: {
    position: 'absolute',
    right: space.md,
    top: space.sm - 6,
    flexDirection: 'row',
  },
  topIcon: { padding: 6, marginLeft: 4 },
  // Centred on the screen, a little below the middle.
  // A little more room above than below: the lock sits just under the
  // middle of the screen.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  spaceAbove: { flexGrow: 1.6 },
  spaceBelow: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  heroLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -space.lg,
    right: -space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWaiting: { opacity: 0.5 },
  lockButton: { marginTop: 10 },
  center: { textAlign: 'center' },
  centerRow: { alignItems: 'center' },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  balance: {
    fontFamily: fonts.serifMedium,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  unit: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textMuted },
  held: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: space.sm + 2,
  },
  fiat: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  milestone: { fontFamily: fonts.sansMedium, color: colors.gold },
  brass: { alignSelf: 'center', width: 230, marginTop: space.lg },
  needRow: { alignSelf: 'center', marginTop: space.sm, paddingVertical: 2 },
  needText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
  },
  closeRow: { alignSelf: 'center', marginTop: space.md, paddingVertical: 4 },
  closeText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold },
  lastRow: { alignSelf: 'center', marginTop: space.md, paddingVertical: 4 },
  lastText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
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
    marginTop: space.md,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: space.sm + 2,
    paddingHorizontal: space.md + 4,
  },
  statusRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
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
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  statusSep: { opacity: 0.6 },
  tor: { marginLeft: space.sm },
  torStarting: { opacity: 0.45 },
  links: { flexDirection: 'row', marginLeft: space.md },
  linkGap: { marginLeft: space.md + 4 },
  linkText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
}));
