import React, { useEffect, useRef, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
  Linking,
} from 'react-native';
import { Button } from '../components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RoomHeader,
  SheetCorner,
  SheetHeader,
  ZeckyLock,
} from '../components/lock';
import { Icon, IconName } from '../components/Icon';
import { BirthdayNote } from '../components/BirthdayNote';
import { PhraseGrid } from '../components/PhraseGrid';
import { PinPad } from '../components/PinPad';
import { CURRENCIES, Currency, NETWORK, PRIVACY_URL } from '../config';
import { about } from '../lib/about';
import { NU7_HEIGHT, blockSeconds } from '../lib/upgrades';
import { recommendedIosUpdate } from '../lib/iosVersion';
import {
  clearPin,
  secondsUntilRetry,
  setPin,
  usePinEnabled,
  verifyPin,
} from '../lib/pin';
import { confirmOwner } from '../lib/deviceAuth';
import { asksAt, setAskAt, useAskWhen } from '../lib/askWhen';
import { needsOwner } from '../lib/lockRules';
import { PHRASE_KEY_MIN_KEYS, removalEndsAt } from '../lib/keyRules';
import {
  SecurityKeyError,
  addSecurityKey,
  cancelKeyRemoval,
  checkSecurityKey,
  finishKeyRemovalIfDue,
  loadSecurityKeyState,
  removeSecurityKey,
  securityKeysSupported,
  setPhraseNeedsKey,
  startKeyRemoval,
  useSecurityKeys,
} from '../lib/securityKey';
import {
  OPEN_WAITS,
  OpenWait,
  setOpenWait,
  useOpenWait,
} from '../lib/openWait';
import { formatExact } from '../lib/zec';
import type { Unit } from '../lib/zec';
import { POOLS, PoolBalances } from '../lib/pools';
import {
  THEME_MODES,
  fonts,
  makeStyles,
  setThemeMode,
  space,
  useColors,
  useThemeMode,
} from '../theme';
import { loadWalletKeys, readSeed, seedPresent } from '../wallet/seed';
import { useContacts } from '../lib/contacts';
import { eraseWallet } from '../lib/erase';
import { PhraseCheck } from '../components/PhraseCheck';
import { PhraseConfirmed } from '../components/PhraseConfirmed';
import { setPhraseUnconfirmed, usePhraseUnconfirmed } from '../lib/phraseCheck';
import { useServer } from '../lib/server';
import { TorStatus, useTorWanted } from '../lib/tor';
import { ContactsPage } from './settings/ContactsPage';
import { AcknowledgementsPage } from './settings/AcknowledgementsPage';
import { HowItWorksPage } from './settings/HowItWorksPage';
import { ServerPage } from './settings/ServerPage';

interface Props {
  visible: boolean;
  unit: Unit;
  onToggleUnit: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  /** Fiat currency for the balance, or null for none. */
  currency: Currency | null;
  onChooseCurrency: (currency: Currency | null) => void;
  birthdayHeight: number;
  /** Current Tor state of the running wallet. */
  tor: TorStatus;
  /** Per pool, for Settings › About. */
  pools: PoolBalances | null;
  /** The wallet's default address, to clear its saved address list. */
  walletAddress: string | null;
  /** Called after the wallet has been erased from this phone. */
  onErased: () => void;
  /** Latest block height while fully synced (0 otherwise), for the 48-hour key removal. */
  networkHeight: number;
  /** Open straight on this page instead of the menu. */
  startOn?:
    | 'server'
    | 'phrase'
    | 'display'
    | 'seckey'
    | 'keys'
    | 'how'
    | 'security';
  onClose: () => void;
}

type Page =
  | 'menu'
  | 'about'
  | 'display'
  | 'security'
  | 'keys'
  | 'openwait'
  | 'seckey'
  | 'phrase'
  | 'viewkey'
  | 'erase'
  | 'how'
  | 'contacts'
  | 'server'
  | 'acknowledgements';

/** A code entry in progress, and what it is for. */
type PinFlow =
  | { kind: 'set'; first?: string }
  | { kind: 'change'; verified: boolean; first?: string }
  | { kind: 'off' }
  | { kind: 'reveal' }
  | { kind: 'revealKey' }
  | { kind: 'erase' }
  | { kind: 'confirm' };

const WAIT_LABELS: Record<OpenWait, string> = {
  10: 'Ask, then wait 10 seconds',
  5: 'Ask, then wait 5 seconds',
  3: 'Ask, then wait 3 seconds',
  0: 'Don’t ask',
};

const WAIT_SHORT: Record<OpenWait, string> = {
  10: 'Wait 10 s',
  5: 'Wait 5 s',
  3: 'Wait 3 s',
  0: 'Off',
};

const usDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const usDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const THEME_LABELS = { dark: 'Dark', light: 'Light', auto: 'Auto' } as const;

const TITLES: Record<Page, string> = {
  menu: 'Settings',
  about: 'About',
  acknowledgements: 'Acknowledgements',
  display: 'Display',
  security: 'Security',
  keys: 'Keys to the lock',
  openwait: 'Really open the lock?',
  seckey: 'Security key',
  phrase: 'Recovery phrase',
  viewkey: 'Viewing key',
  erase: 'Erase wallet',
  how: 'How Zecky works',
  contacts: 'Contacts',
  server: 'Network',
};

const SUBTITLES: Record<Page, string> = {
  menu: '',
  about: 'This install of Zecky Lock it.',
  acknowledgements: 'The open-source software inside Zecky.',
  display: 'How amounts and colors look.',
  security: 'Who can open Zecky and the lock.',
  keys: 'Everything that lets you in or opens the lock.',
  openwait: 'A question and a short wait, for when someone is rushing you.',
  seckey: 'A key you tap against your iPhone before sending.',
  phrase: 'The 24 words that restore your Zcash on any phone.',
  viewkey: 'See-only access, for an accountant or a watch-only device.',
  erase: 'Remove the wallet from this iPhone.',
  how: 'Your Zcash, keys and data, chapter by chapter.',
  contacts: 'Addresses you send to often.',
  server: 'The server Zecky reads the blockchain from.',
};

/** How fast blocks come, and when NU7 arrives while it is still ahead. */
function chainLine(height: number): string {
  if (height >= NU7_HEIGHT) return 'A block every 25 seconds, since NU7';
  const minutes = Math.round(
    ((NU7_HEIGHT - height) * blockSeconds(height)) / 60,
  );
  const when =
    minutes < 90
      ? `about ${Math.max(1, minutes)} minutes`
      : `about ${Math.round(minutes / 60)} hours`;
  return `A block every 75 seconds · NU7 in ${when}`;
}

function MenuRow(props: {
  label: string;
  value: string;
  onPress: () => void;
  icon?: IconName;
  /** Last row of its card: no divider underneath. */
  last?: boolean;
  /** Erase and the like: red. */
  danger?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.line,
        styles.menuLine,
        props.last !== true && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {props.icon != null && (
        <View style={[styles.menuIcon, props.danger && styles.menuIconDanger]}>
          <Icon
            name={props.icon}
            size={16}
            color={props.danger ? colors.danger : colors.gold}
          />
        </View>
      )}
      <Text
        style={[
          styles.lineLabel,
          styles.menuLabel,
          props.danger && styles.dangerLabel,
        ]}
      >
        {props.label}
      </Text>
      <Text style={styles.lineValue} numberOfLines={1}>
        {props.value}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function Line(props: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.line, props.last !== true && styles.divider]}>
      <Text style={styles.lineLabel}>{props.label}</Text>
      <Text style={styles.lineValue} selectable>
        {props.value}
      </Text>
    </View>
  );
}

/** One of the numbered keys on the Keys to the lock overview. */
function KeyRow(props: {
  number: number;
  label: string;
  hint: string;
  last?: boolean;
  /** A switch, or else a value with › that opens its page. */
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  value?: string;
  onPress?: () => void;
  /** One line on what this key is for, behind a small ⓘ. */
  info?: string;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [infoOpen, setInfoOpen] = useState(false);
  const content = (
    <>
      <View style={styles.keyNumber}>
        <Text style={styles.keyNumberText}>{props.number}</Text>
      </View>
      <View style={styles.lineText}>
        <View style={styles.keyTitleRow}>
          <Text style={styles.lineLabel}>{props.label}</Text>
          {props.info != null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`What ${props.label} is for`}
              accessibilityState={{ expanded: infoOpen }}
              hitSlop={10}
              onPress={() => setInfoOpen(o => !o)}
              style={styles.infoButton}
            >
              <Icon name="info" size={15} color={colors.goldDim} />
            </Pressable>
          )}
        </View>
        <Text style={styles.lineHint}>{props.hint}</Text>
        {infoOpen && props.info != null && (
          <Text style={styles.keyInfo}>{props.info}</Text>
        )}
      </View>
      {props.toggle != null ? (
        <Switch
          accessibilityLabel={props.label}
          value={props.toggle.value}
          onValueChange={props.toggle.onChange}
          trackColor={{ true: colors.gold, false: colors.line }}
          ios_backgroundColor={colors.line}
        />
      ) : (
        <>
          <Text style={styles.keyValue} numberOfLines={1}>
            {props.value}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </>
      )}
    </>
  );
  const style = [styles.line, props.last !== true && styles.divider];
  if (props.toggle != null) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function SettingsScreen({
  visible,
  unit,
  onToggleUnit,
  hidden,
  onToggleHidden,
  currency,
  onChooseCurrency,
  birthdayHeight,
  tor,
  pools,
  networkHeight,
  startOn,
  walletAddress,
  onErased,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('menu');
  const [detailsOpen, setDetailsOpen] = useState(false);
  // About: Ironwood on one line; the older pools open under it.
  const [poolsOpen, setPoolsOpen] = useState(false);
  const otherPools = POOLS.filter(p => p.key !== 'ironwood').reduce(
    (sum, p) => sum + BigInt(pools?.[p.key]?.total ?? '0'),
    0n,
  );

  const [phrase, setPhrase] = useState<string | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  // Set when the words were shown on an iPhone without a passcode.
  const [noPasscode, setNoPasscode] = useState(false);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const phraseUnconfirmed = usePhraseUnconfirmed();
  const [checking, setChecking] = useState(false);
  const [confirmedNow, setConfirmedNow] = useState(false);
  // Erasing takes two deliberate steps: unlock (code, if set), then confirm.
  const [eraseArmed, setEraseArmed] = useState(false);
  const [erasing, setErasing] = useState(false);
  useEffect(() => {
    setEraseArmed(false);
  }, [page, visible]);
  const erase = async () => {
    setErasing(true);
    try {
      await eraseWallet(walletAddress);
      onErased();
    } catch (e) {
      setPhraseError(e instanceof Error ? e.message : String(e));
      setErasing(false);
    }
  };

  // Always start at the menu.
  useEffect(() => {
    if (visible) setPage(startOn ?? 'menu');
  }, [visible, startOn]);
  // Self-audit K1: whether the Secure Enclave guards the phrase (it cannot
  // without an iPhone passcode), and whether iOS has the DarkSword fixes.
  const [phraseGuarded, setPhraseGuarded] = useState<boolean | null>(null);
  // Audit C-01: iOS removes the guarded phrase when the passcode is turned
  // off. Checked without a prompt.
  const [phraseGone, setPhraseGone] = useState(false);
  useEffect(() => {
    if (!visible) return;
    loadWalletKeys()
      .then(keys => setPhraseGuarded(keys?.guarded ?? null))
      .catch(() => setPhraseGuarded(null));
    seedPresent()
      .then(present => setPhraseGone(!present))
      .catch(() => setPhraseGone(false));
  }, [visible]);
  const iosUpdate =
    Platform.OS === 'ios'
      ? recommendedIosUpdate(String(Platform.Version))
      : null;

  // The words are only on screen while this page is open and the app is
  // in front: leaving the page, closing the sheet or switching apps
  // clears them.
  useEffect(() => {
    if (page !== 'phrase' || !visible) {
      setPhrase(null);
      setNoPasscode(false);
      setChecking(false);
      setConfirmedNow(false);
      setPhraseError(null);
    }
    if (page !== 'viewkey' || !visible) setViewKey(null);
  }, [page, visible]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        setPhrase(null);
        setNoPasscode(false);
        setChecking(false);
        setConfirmedNow(false);
        setViewKey(null);
      }
    });
    return () => listener.remove();
  }, []);

  const pinEnabled = usePinEnabled();
  const openWait = useOpenWait();
  useAskWhen();
  const askStart = asksAt('start', pinEnabled);
  const askOpenLock = asksAt('openLock', pinEnabled);
  // Making Zecky easier to open (fewer checks, a shorter wait) first asks
  // that it is the owner: the Zecky code, or else Face ID / the passcode.
  const pendingChange = useRef<(() => void) | null>(null);
  const whenOwner = async (change: () => void) => {
    if (pinEnabled) {
      pendingChange.current = change;
      setFlow({ kind: 'confirm' });
      return;
    }
    const result = await confirmOwner('Change Keys to the lock');
    if (result !== 'cancelled') change();
  };
  const [hasPasscode, setHasPasscode] = useState(true);
  useEffect(() => {
    if (page === 'keys') {
      Keychain.isPasscodeAuthAvailable()
        .then(setHasPasscode)
        .catch(() => setHasPasscode(true));
    }
  }, [page]);
  // --- Security keys ---
  const keysState = useSecurityKeys();
  const keyCount = keysState.keys.length;
  const [keysSupported, setKeysSupported] = useState(true);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [phraseWarn, setPhraseWarn] = useState(false);
  useEffect(() => {
    setKeyMessage(null);
    setPhraseWarn(false);
    if (page === 'seckey') {
      securityKeysSupported().then(setKeysSupported);
    }
  }, [page, visible]);
  useEffect(() => {
    if ((page === 'keys' || page === 'seckey') && networkHeight > 0) {
      finishKeyRemovalIfDue(networkHeight).catch(() => false);
    }
  }, [page, networkHeight]);
  /** Runs a key action and turns its outcome into a short line. */
  const keyAction = async (action: () => Promise<unknown>, done: string) => {
    setKeyMessage(null);
    setKeyBusy(true);
    try {
      await action();
      setKeyMessage({ text: done, error: false });
    } catch (e) {
      if (e instanceof SecurityKeyError && e.reason === 'cancelled') return;
      setKeyMessage({
        text: e instanceof Error ? e.message : String(e),
        error: true,
      });
    } finally {
      setKeyBusy(false);
    }
  };
  const removalEnd =
    keysState.removal != null ? removalEndsAt(keysState.removal) : null;

  const themeMode = useThemeMode();
  const server = useServer();
  const torWanted = useTorWanted();
  const contacts = useContacts();
  const [flow, setFlow] = useState<PinFlow | null>(null);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  useEffect(() => {
    setFlow(null);
    setPinMessage(null);
  }, [page, visible]);

  const padTitle =
    flow == null
      ? ''
      : flow.kind === 'set' || (flow.kind === 'change' && flow.verified)
      ? flow.first == null
        ? 'Choose a 4-digit code'
        : 'Repeat the code'
      : flow.kind === 'change'
      ? 'Enter your current code'
      : 'Enter your code';

  const checkCurrent = async (pin: string): Promise<boolean> => {
    if (await verifyPin(pin)) return true;
    const wait = secondsUntilRetry();
    setPinMessage(
      wait > 0
        ? `Too many wrong codes. Try again in ${
            wait >= 60 ? `${Math.ceil(wait / 60)} min` : `${wait} s`
          }.`
        : 'Wrong code. Try again.',
    );
    return false;
  };

  const onPin = async (pin: string) => {
    if (flow == null) return;
    setPinMessage(null);
    try {
      if (flow.kind === 'off') {
        if (await checkCurrent(pin)) {
          await clearPin();
          setFlow(null);
        }
      } else if (flow.kind === 'confirm') {
        if (await checkCurrent(pin)) {
          setFlow(null);
          pendingChange.current?.();
          pendingChange.current = null;
        }
      } else if (flow.kind === 'erase') {
        if (await checkCurrent(pin)) {
          setFlow(null);
          setEraseArmed(true);
        }
      } else if (flow.kind === 'reveal' || flow.kind === 'revealKey') {
        if (await checkCurrent(pin)) {
          setFlow(null);
          await (flow.kind === 'reveal' ? reveal() : revealKey());
        }
      } else if (flow.kind === 'change' && !flow.verified) {
        if (await checkCurrent(pin))
          setFlow({ kind: 'change', verified: true });
      } else if (flow.first == null) {
        setFlow({ ...flow, first: pin });
      } else if (flow.first === pin) {
        await setPin(pin);
        setFlow(null);
      } else {
        setPinMessage('The codes did not match. Start again.');
        setFlow({ ...flow, first: undefined });
      }
    } catch (e) {
      setPinMessage(e instanceof Error ? e.message : String(e));
    }
  };

  // Without a Zecky code, Face ID or the passcode guards the viewing key,
  // as it does the recovery phrase.
  const revealKeyWithDeviceCheck = async () => {
    const result = await confirmOwner('Show viewing key');
    if (result !== 'cancelled') await revealKey();
  };

  const revealKey = async () => {
    try {
      const keys = await loadWalletKeys();
      if (keys == null) throw new Error('No wallet found on this phone.');
      setPhraseError(null);
      setViewKey(keys.ufvk);
    } catch (e) {
      setPhraseError(e instanceof Error ? e.message : String(e));
    }
  };

  const reveal = async () => {
    // With "Also ask the key" on, the words also need a tap of a key. Read
    // fresh, and show nothing when the setting cannot be read (re-check R2).
    let needsKey: boolean;
    try {
      needsKey = (await loadSecurityKeyState()).phraseNeedsKey;
    } catch (e) {
      setPhraseError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (needsKey) {
      try {
        await checkSecurityKey();
      } catch (e) {
        if (!(e instanceof SecurityKeyError && e.reason === 'cancelled')) {
          setPhraseError(e instanceof Error ? e.message : String(e));
        }
        return;
      }
    }
    // Self-audit K1: the Secure Enclave releases the words only after Face
    // ID or the passcode. Cancelling leaves them hidden.
    let words: string;
    try {
      words = await readSeed('Show recovery phrase');
    } catch {
      return;
    }
    setPhraseError(null);
    setPhrase(words);
  };

  // Without an app code, the iPhone's own Face ID or passcode guards the
  // words. Cancelling leaves them hidden.
  const revealWithDeviceCheck = async () => {
    // A guarded phrase is its own Face ID check: no second prompt.
    const keys = await loadWalletKeys().catch(() => null);
    if (keys?.guarded === true) {
      setNoPasscode(false);
      await reveal();
      return;
    }
    const result = await confirmOwner('Show recovery phrase');
    if (result === 'cancelled') return;
    setNoPasscode(result === 'no-passcode');
    await reveal();
  };

  // Without an app code, erasing also asks for Face ID or the iPhone
  // passcode first. On an iPhone without a passcode the two-step confirm
  // stays the only guard.
  const armEraseWithDeviceCheck = async () => {
    const result = await confirmOwner('Erase wallet');
    if (result !== 'cancelled') setEraseArmed(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.safe,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.container}>
          {page !== 'menu' && <SheetCorner />}
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {page === 'menu' ? (
              <RoomHeader open={false} compact title="Settings" />
            ) : (
              <SheetHeader title={TITLES[page]} subtitle={SUBTITLES[page]} />
            )}

            {page === 'menu' && (
              <>
                <View style={[styles.card, styles.chain]}>
                  <Text style={styles.chainLabel}>ZCASH NETWORK</Text>
                  <Text style={styles.chainBlock}>
                    {networkHeight > 0
                      ? `Block ${networkHeight.toLocaleString('en-US')}`
                      : 'Catching up…'}
                  </Text>
                  {networkHeight > 0 && (
                    <Text style={styles.chainSub}>
                      {chainLine(networkHeight)}
                    </Text>
                  )}
                </View>
                <View style={styles.card}>
                  <MenuRow
                    icon="globe"
                    label="Network"
                    value={tor === 'on' ? `${server.host}, Tor` : server.host}
                    onPress={() => setPage('server')}
                  />
                  <MenuRow
                    icon="sun"
                    label="Display"
                    value={[
                      THEME_LABELS[themeMode],
                      unit,
                      currency == null ? null : torWanted ? 'USD' : currency,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    onPress={() => setPage('display')}
                  />
                  <MenuRow
                    icon="lock"
                    label="Security"
                    value={pinEnabled ? 'Zecky code' : 'Face ID'}
                    onPress={() => setPage('security')}
                  />
                  <MenuRow
                    icon="person"
                    label="Contacts"
                    value={contacts.length === 0 ? '' : String(contacts.length)}
                    onPress={() => setPage('contacts')}
                    last
                  />
                </View>
                <View style={styles.card}>
                  <MenuRow
                    icon="info"
                    label="About"
                    value=""
                    onPress={() => setPage('about')}
                    last
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setPage('how')}
                  style={styles.disclosure}
                >
                  <Text style={styles.disclosureText}>How Zecky works ›</Text>
                </Pressable>
              </>
            )}

            {page === 'about' && (
              <>
                <View style={styles.card}>
                  <Line
                    label="Zecky Lock it"
                    value={`Version ${about.appVersion}`}
                  />
                  <Line label="Zcash engine" value={about.engine} />
                  <Line
                    label="Wallet birthday"
                    value={`Block ${birthdayHeight.toLocaleString('en-US')}`}
                    last
                  />
                </View>
                <Text style={styles.section}>Your Zcash by pool</Text>
                <View style={styles.card}>
                  {POOLS.filter(
                    pool => pool.key === 'ironwood' || poolsOpen,
                  ).map((pool, i, shown) => {
                    const b = pools?.[pool.key];
                    const total = b?.total ?? '0';
                    const confirming =
                      b != null && BigInt(b.available) < BigInt(b.total);
                    const main = pool.key === 'ironwood';
                    const amount = (
                      <View style={styles.poolValue}>
                        <Text style={styles.poolAmount}>
                          {pools == null
                            ? '…'
                            : hidden
                            ? '••••'
                            : formatExact(total, unit)}
                        </Text>
                        {confirming && !hidden && (
                          <Text style={styles.poolSub}>
                            {formatExact(b.available, unit)} usable now
                          </Text>
                        )}
                        {main && !poolsOpen && otherPools > 0n && !hidden && (
                          <Text style={styles.poolOther}>
                            + {formatExact(otherPools.toString(), unit)} in
                            other pools
                          </Text>
                        )}
                      </View>
                    );
                    const rowStyle = [
                      styles.line,
                      i < shown.length - 1 && styles.divider,
                    ];
                    if (main) {
                      return (
                        <Pressable
                          key={pool.key}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: poolsOpen }}
                          accessibilityHint="Shows the other pools"
                          onPress={() => setPoolsOpen(o => !o)}
                          style={rowStyle}
                        >
                          <Text style={styles.lineLabel}>
                            {pool.name}{' '}
                            <Text style={styles.poolChevron}>
                              {poolsOpen ? '‹' : '›'}
                            </Text>
                          </Text>
                          {amount}
                        </Pressable>
                      );
                    }
                    // The older pools, greyed out. Transparent is marked
                    // red: anyone can see what is in it.
                    return (
                      <View
                        key={pool.key}
                        style={[
                          rowStyle,
                          pool.key === 'transparent' && styles.poolExposed,
                        ]}
                      >
                        <Text style={[styles.lineLabel, styles.poolQuiet]}>
                          {pool.name}
                        </Text>
                        <View style={styles.poolQuiet}>{amount}</View>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.quiet}>New Zcash locks into Ironwood.</Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                  hitSlop={8}
                  onPress={() => setDetailsOpen(o => !o)}
                  style={styles.disclosure}
                >
                  <Text style={styles.disclosureText}>
                    Technical details {detailsOpen ? '‹' : '›'}
                  </Text>
                </Pressable>
                {detailsOpen && (
                  <View style={styles.card}>
                    <Line label="Network" value={NETWORK} />
                    <Line
                      label="react-native-zcash"
                      value={about.zcashEngine}
                    />
                    <Line label="System" value={about.system} />
                    <Line label="React Native" value={about.reactNative} last />
                  </View>
                )}
                {detailsOpen && (
                  <View style={styles.smallLinks}>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityHint="Opens in Safari"
                      hitSlop={8}
                      onPress={() =>
                        Linking.openURL(PRIVACY_URL).catch(() => {})
                      }
                    >
                      <Text style={styles.smallLink}>Privacy policy</Text>
                    </Pressable>
                    <Text style={styles.smallDot}>·</Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setPage('acknowledgements')}
                    >
                      <Text style={styles.smallLink}>Acknowledgements</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}

            {page === 'display' && (
              <>
                <View style={styles.card}>
                  <View style={styles.line}>
                    <Text style={styles.lineLabel}>Theme</Text>
                    <View style={styles.unitSwitch}>
                      {THEME_MODES.map(m => (
                        <Pressable
                          key={m}
                          accessibilityRole="button"
                          accessibilityState={{ selected: m === themeMode }}
                          onPress={() => setThemeMode(m)}
                        >
                          <Text
                            style={[
                              styles.unitOption,
                              m === themeMode && styles.unitOn,
                            ]}
                          >
                            {THEME_LABELS[m]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.line}>
                    <Text style={styles.lineLabel}>Show amounts in</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Amounts in ${unit}. Tap to switch`}
                      onPress={onToggleUnit}
                      style={styles.unitSwitch}
                    >
                      {(['ZEC', 'zats'] as const).map(u => (
                        <Text
                          key={u}
                          style={[
                            styles.unitOption,
                            u === unit && styles.unitOn,
                          ]}
                        >
                          {u}
                        </Text>
                      ))}
                    </Pressable>
                  </View>
                  <View style={styles.line}>
                    <View style={styles.lineText}>
                      <Text style={styles.lineLabel}>Hide amounts</Text>
                      <Text style={styles.lineHint}>
                        Covers your balance and payment amounts on the main
                        screen.
                      </Text>
                    </View>
                    <Switch
                      value={hidden}
                      onValueChange={onToggleHidden}
                      trackColor={{ true: colors.gold, false: colors.line }}
                      ios_backgroundColor={colors.line}
                    />
                  </View>
                </View>
                <Text style={styles.section}>Currency conversion</Text>
                <View style={styles.card}>
                  <View style={styles.chips}>
                    {([...CURRENCIES, null] as const).map(c => {
                      const on = c === currency;
                      return (
                        <Pressable
                          key={c ?? 'none'}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => onChooseCurrency(c)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text
                            style={[styles.chipLabel, on && styles.chipLabelOn]}
                          >
                            {c ?? 'None'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.currencyHint}>
                    {torWanted
                      ? 'With Tor on, the price comes through Tor in USD only. None makes no price requests.'
                      : 'Price from CoinGecko. Nothing about your wallet is sent. None makes no price requests.'}
                  </Text>
                </View>
              </>
            )}

            {page === 'how' && <HowItWorksPage />}
            {page === 'acknowledgements' && <AcknowledgementsPage />}
            {page === 'contacts' && <ContactsPage />}
            {page === 'server' && <ServerPage tor={tor} />}

            {page === 'security' && (
              <>
                {phraseGone && (
                  <Text style={[styles.warning, styles.noTop]}>
                    Your recovery phrase is no longer on this iPhone. iOS
                    removes it when the iPhone passcode is turned off. Your
                    Zcash is safe as long as you have your 24 words on paper:
                    erase this wallet and restore from them. Until then Zecky
                    can show your balance but cannot send or lock in.
                  </Text>
                )}
                {phraseGuarded === false && !phraseGone && (
                  <Text style={[styles.warning, styles.noTop]}>
                    This iPhone has no passcode, so the Secure Enclave cannot
                    guard your recovery phrase. Set a passcode in the iPhone’s
                    Settings; Zecky then moves the phrase there at the next
                    start.
                  </Text>
                )}
                {iosUpdate != null && (
                  <Text style={styles.quietNote}>
                    This iPhone runs iOS {String(Platform.Version)}. Updating to
                    iOS {iosUpdate} or later (Settings › General › Software
                    Update) closes the DarkSword attack on iPhones.
                  </Text>
                )}
                <View style={styles.card}>
                  <MenuRow
                    icon="lock"
                    label="Keys to the lock"
                    value={
                      (pinEnabled ? 'Zecky code' : 'Face ID') +
                      (keyCount > 0 ? ' + key' : '')
                    }
                    onPress={() => setPage('keys')}
                  />
                  <MenuRow
                    icon="eyeOff"
                    label="Recovery phrase"
                    value={phraseUnconfirmed ? 'Not confirmed' : 'View'}
                    onPress={() => setPage('phrase')}
                  />
                  <MenuRow
                    icon="eye"
                    label="Viewing key"
                    value="View"
                    onPress={() => setPage('viewkey')}
                    last
                  />
                </View>
                <View style={[styles.card, styles.dangerCard]}>
                  <MenuRow
                    icon="info"
                    label="Erase wallet"
                    value=""
                    onPress={() => setPage('erase')}
                    danger
                    last
                  />
                </View>
              </>
            )}

            {page === 'keys' && flow == null && (
              <>
                <Text style={styles.info}>
                  Making it easier always asks that it is you first.
                </Text>

                <Text style={styles.section}>Your keys, in order</Text>
                <View style={styles.card}>
                  <KeyRow
                    number={1}
                    info="Asked each time Zecky opens, so someone holding your unlocked iPhone can't look inside."
                    label="Opening Zecky"
                    hint={
                      askStart ? 'Asks that it is you' : 'Opens straight away'
                    }
                    toggle={{
                      value: askStart,
                      onChange: next =>
                        needsOwner({ kind: 'ask', from: askStart, to: next })
                          ? whenOwner(() => setAskAt('start', next))
                          : setAskAt('start', next),
                    }}
                  />
                  <KeyRow
                    number={2}
                    info="Asked again before the lock opens, so nobody can send just because Zecky is open."
                    label="Opening the lock"
                    hint={
                      askOpenLock
                        ? 'Asks that it is you'
                        : 'No check that it is you'
                    }
                    toggle={{
                      value: askOpenLock,
                      onChange: next =>
                        needsOwner({ kind: 'ask', from: askOpenLock, to: next })
                          ? whenOwner(() => setAskAt('openLock', next))
                          : setAskAt('openLock', next),
                    }}
                  />
                  <KeyRow
                    number={3}
                    info="A question and a short pause before the lock opens: time to say no when someone is rushing you."
                    label="Really open the lock?"
                    hint="A question and a short wait"
                    value={WAIT_SHORT[openWait]}
                    onPress={() => setPage('openwait')}
                  />
                  <KeyRow
                    number={4}
                    info="A physical key you tap against your iPhone. Tapping it confirms the payment; without it, nothing leaves."
                    label="Security key"
                    hint="Tapped before sending"
                    value={
                      keysState.removal != null
                        ? 'Removing'
                        : keyCount === 0
                        ? 'Not added'
                        : keyCount === 1
                        ? '1 key'
                        : `${keyCount} keys`
                    }
                    onPress={() => setPage('seckey')}
                    last
                  />
                </View>
                {openWait === 0 && !askOpenLock && (
                  <Text style={styles.info}>
                    Right now one tap opens the lock.
                  </Text>
                )}

                <Text style={styles.section}>Check it’s you with</Text>
                <View style={styles.card}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !pinEnabled }}
                    onPress={() => pinEnabled && setFlow({ kind: 'off' })}
                    style={({ pressed }) => [
                      styles.line,
                      styles.divider,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.lineText}>
                      <Text style={styles.lineLabel}>
                        Face ID or iPhone passcode
                      </Text>
                      <Text style={styles.lineHint}>
                        The iPhone’s own lock. Nothing extra to remember.
                      </Text>
                    </View>
                    {!pinEnabled && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: pinEnabled }}
                    onPress={() =>
                      // A new code could later switch every check off, so
                      // choosing one first asks Face ID or the passcode.
                      !pinEnabled &&
                      needsOwner({ kind: 'newCode' }) &&
                      whenOwner(() => setFlow({ kind: 'set' }))
                    }
                    style={({ pressed }) => [
                      styles.line,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.lineText}>
                      <Text style={styles.lineLabel}>Zecky code</Text>
                      <Text style={styles.lineHint}>
                        4 digits, only for Zecky. A forgotten code cannot be
                        reset: you would restore from the 24 words.
                      </Text>
                    </View>
                    {pinEnabled && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                </View>
                {pinEnabled && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => setFlow({ kind: 'change', verified: false })}
                    style={styles.inlineLink}
                  >
                    <Text style={styles.inlineLinkText}>Change code</Text>
                  </Pressable>
                )}
                {!pinEnabled && !hasPasscode && (
                  <Text style={styles.warning}>
                    This iPhone has no passcode, so there is nothing to ask. Set
                    one in the iPhone’s Settings, or choose a Zecky code.
                  </Text>
                )}

                <Text style={styles.info}>
                  Always asked: showing the recovery phrase, showing the viewing
                  key and erasing the wallet.
                  {keysState.phraseNeedsKey
                    ? ' The recovery phrase also asks your security key.'
                    : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setPage('how')}
                  style={styles.disclosure}
                >
                  <Text style={styles.disclosureText}>How the keys work ›</Text>
                </Pressable>
              </>
            )}

            {page === 'openwait' && flow == null && (
              <>
                <View style={styles.card}>
                  {OPEN_WAITS.map((w, i) => (
                    <Pressable
                      key={w}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: w === openWait }}
                      onPress={() =>
                        needsOwner({ kind: 'wait', from: openWait, to: w })
                          ? whenOwner(() => setOpenWait(w))
                          : setOpenWait(w)
                      }
                      style={({ pressed }) => [
                        styles.line,
                        i < OPEN_WAITS.length - 1 && styles.divider,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.lineLabel}>{WAIT_LABELS[w]}</Text>
                      {w === openWait && <Text style={styles.check}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.info}>
                  The question and the short wait are there for when someone is
                  rushing you.
                  {openWait === 0 && !askOpenLock
                    ? ' Right now one tap opens the lock.'
                    : ''}
                </Text>
              </>
            )}

            {page === 'seckey' && flow == null && (
              <>
                {!keysSupported ? (
                  <Text style={styles.info}>
                    This iPhone cannot use security keys.
                  </Text>
                ) : (
                  <>
                    {keyCount === 0 && (
                      <View style={styles.empty}>
                        <ZeckyLock open={false} size={64} />
                        <Text style={styles.emptyTitle}>
                          No security key yet
                        </Text>
                        <Text style={styles.emptyText}>
                          Tap a key such as a YubiKey against the top of your
                          iPhone. From then on, sending asks that key too.
                          Nothing about you is stored on it, and nothing goes
                          over the internet.
                        </Text>
                      </View>
                    )}

                    {keysState.removal != null && removalEnd != null && (
                      <View style={[styles.card, styles.cardPad]}>
                        <Text style={styles.lineLabel}>Removing all keys</Text>
                        <Text style={styles.lineHint}>
                          After {usDateTime(removalEnd)}, once the Zcash network
                          also shows 48 hours, with Zecky on one of its public
                          servers (Settings › Network). Until then, your keys
                          are still asked.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={10}
                          disabled={keyBusy}
                          onPress={() =>
                            keyAction(cancelKeyRemoval, 'Removal cancelled ✓')
                          }
                          style={styles.inlineLink}
                        >
                          <Text style={styles.inlineLinkText}>
                            Cancel with a key
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {keyCount > 0 && (
                      <View style={styles.card}>
                        {keysState.keys.map((k, i) => (
                          <View
                            key={k.id}
                            style={[
                              styles.line,
                              i < keyCount - 1 && styles.divider,
                            ]}
                          >
                            <View style={styles.lineText}>
                              <Text style={styles.lineLabel}>
                                {k.role === 'backup'
                                  ? 'Backup key'
                                  : 'Security key'}
                              </Text>
                              <Text style={styles.lineHint}>
                                Added {usDate(k.added)}
                              </Text>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${
                                k.role === 'backup'
                                  ? 'backup key'
                                  : 'security key'
                              }`}
                              hitSlop={10}
                              disabled={keyBusy}
                              onPress={() =>
                                keyAction(
                                  () => removeSecurityKey(k.id),
                                  'Key removed ✓',
                                )
                              }
                            >
                              <Text style={styles.inlineLinkText}>Remove</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    {keyCount === 1 && keysState.removal == null && (
                      <Text style={styles.info}>
                        Add a backup key and keep it in another place. Without
                        one, a lost key means a 48-hour wait or restoring from
                        your 24 words.
                      </Text>
                    )}

                    {keyMessage != null && (
                      <Text
                        style={keyMessage.error ? styles.warning : styles.info}
                      >
                        {keyMessage.text}
                      </Text>
                    )}

                    {keysState.removal == null && (
                      <View style={styles.reveal}>
                        <Button
                          label={
                            keyCount === 0
                              ? 'Add a security key'
                              : keyCount === 1
                              ? 'Add a backup key'
                              : 'Add another key'
                          }
                          variant={keyCount < 2 ? 'primary' : 'quiet'}
                          busy={keyBusy}
                          onPress={() =>
                            keyCount === 0
                              ? whenOwner(() =>
                                  keyAction(
                                    () => addSecurityKey('main'),
                                    'Key added ✓',
                                  ),
                                )
                              : keyAction(
                                  () => addSecurityKey('backup'),
                                  'Backup key added ✓',
                                )
                          }
                        />
                        {keyCount > 0 && (
                          <Text style={[styles.lineHint, styles.centered]}>
                            First tap one of your keys, then the new one.
                          </Text>
                        )}
                      </View>
                    )}

                    {keyCount > 0 && (
                      <Button
                        label="Test key"
                        variant="quiet"
                        disabled={keyBusy}
                        onPress={() =>
                          keyAction(checkSecurityKey, 'Your key works ✓')
                        }
                      />
                    )}

                    {keyCount > 0 && !phraseWarn && (
                      <>
                        <Text style={styles.section}>Recovery phrase</Text>
                        <View style={styles.card}>
                          <View style={styles.line}>
                            <View style={styles.lineText}>
                              <Text style={styles.lineLabel}>
                                Also ask the key to show the recovery phrase
                              </Text>
                              <Text style={styles.lineHint}>
                                {keysState.phraseNeedsKey
                                  ? 'On: the words also need a key.'
                                  : keyCount < PHRASE_KEY_MIN_KEYS
                                  ? 'Needs a backup key first.'
                                  : 'Off: Face ID or your code is enough.'}
                              </Text>
                            </View>
                            <Switch
                              accessibilityLabel="Also ask the key to show the recovery phrase"
                              value={keysState.phraseNeedsKey}
                              disabled={
                                keyBusy ||
                                (!keysState.phraseNeedsKey &&
                                  keyCount < PHRASE_KEY_MIN_KEYS)
                              }
                              onValueChange={next =>
                                next
                                  ? setPhraseWarn(true)
                                  : keyAction(
                                      () => setPhraseNeedsKey(false),
                                      'The recovery phrase no longer asks a key.',
                                    )
                              }
                              trackColor={{
                                true: colors.gold,
                                false: colors.line,
                              }}
                              ios_backgroundColor={colors.line}
                            />
                          </View>
                        </View>
                      </>
                    )}

                    {phraseWarn && (
                      <View
                        style={[styles.card, styles.dangerCard, styles.cardPad]}
                      >
                        <Text style={styles.lineLabel}>
                          Keep your 24 words on paper
                        </Text>
                        <Text style={styles.lineHint}>
                          If you lose all your keys and the paper, your Zcash
                          can no longer be recovered. The 48-hour removal still
                          works while you have this iPhone.
                        </Text>
                        <View style={styles.reveal}>
                          <Button
                            label="Turn on"
                            onPress={() => {
                              setPhraseWarn(false);
                              keyAction(
                                () => setPhraseNeedsKey(true),
                                'The recovery phrase now also asks a key ✓',
                              );
                            }}
                          />
                          <Button
                            label="Cancel"
                            variant="back"
                            onPress={() => setPhraseWarn(false)}
                          />
                        </View>
                      </View>
                    )}

                    {keyCount > 0 && keysState.removal == null && (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={10}
                        disabled={keyBusy}
                        onPress={() =>
                          whenOwner(() =>
                            keyAction(
                              () => startKeyRemoval(networkHeight),
                              'Removal started. Your keys are still asked for 48 hours.',
                            ),
                          )
                        }
                        style={[styles.inlineLink, styles.lostLink]}
                      >
                        <Text style={styles.lostLinkText}>
                          Lost your keys? Remove them after 48 hours
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
              </>
            )}

            {flow != null && (
              <View style={styles.pad}>
                <PinPad
                  title={padTitle}
                  message={pinMessage}
                  onComplete={onPin}
                />
              </View>
            )}

            {page === 'erase' && flow == null && (
              <>
                <View style={[styles.card, styles.dangerCard, styles.cardPad]}>
                  <Text style={[styles.warning, styles.noTop]}>
                    This removes everything Zecky keeps on this phone: the
                    recovery phrase, the Zecky code, your contacts, the payment
                    history and every setting, including your servers.
                  </Text>
                </View>
                <Text style={styles.info}>
                  Your funds are not destroyed. They stay on the Zcash
                  blockchain and can be restored on any phone with the 24 words.
                  Without the 24 words they are lost for good, so check that you
                  have them on paper before you continue.
                </Text>
                {phraseError != null && (
                  <Text style={styles.warning}>{phraseError}</Text>
                )}
                <View style={styles.reveal}>
                  {eraseArmed ? (
                    <Button
                      label="Erase everything now"
                      variant="danger"
                      busy={erasing}
                      onPress={erase}
                    />
                  ) : (
                    <Button
                      label="Erase wallet from this phone"
                      variant="danger"
                      onPress={() =>
                        pinEnabled
                          ? setFlow({ kind: 'erase' })
                          : armEraseWithDeviceCheck()
                      }
                    />
                  )}
                </View>
              </>
            )}

            {page === 'viewkey' && flow == null && (
              <>
                <Text style={styles.info}>
                  A viewing key gives read-only access to this wallet. Whoever
                  has it can see your balance and every payment in and out, past
                  and future, but cannot spend anything.
                </Text>
                <Text style={styles.warning}>
                  It cannot be taken back once shared. Give it only to someone
                  or something that should see everything, such as your own
                  watch-only device or an accountant.
                </Text>
                {phraseError != null && (
                  <Text style={styles.warning}>{phraseError}</Text>
                )}
                {viewKey == null ? (
                  <View style={styles.reveal}>
                    <Button
                      label="Show viewing key"
                      onPress={
                        pinEnabled
                          ? () => setFlow({ kind: 'revealKey' })
                          : revealKeyWithDeviceCheck
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.reveal}>
                    <View style={styles.card}>
                      <Text style={styles.keyText} selectable>
                        {viewKey}
                      </Text>
                    </View>
                    <View style={styles.gap} />
                    <View style={styles.gap} />
                    <Button
                      label="Share or copy viewing key"
                      variant="quiet"
                      onPress={() => Share.share({ message: viewKey })}
                    />
                  </View>
                )}
              </>
            )}

            {page === 'phrase' && flow == null && (
              <>
                <Text style={styles.warning}>
                  Anyone who sees these 24 words can take all your funds. Make
                  sure nobody is watching and never type them into a website or
                  share them in a message. Zecky will never ask for them.
                </Text>
                {phraseError != null && (
                  <Text style={styles.warning}>{phraseError}</Text>
                )}
                {phrase == null ? (
                  <View style={styles.reveal}>
                    <Button
                      label="Show recovery phrase"
                      onPress={
                        pinEnabled
                          ? () => setFlow({ kind: 'reveal' })
                          : revealWithDeviceCheck
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.reveal}>
                    {confirmedNow ? (
                      <PhraseConfirmed
                        onDone={() => {
                          setConfirmedNow(false);
                          setPhrase(null);
                          setPage('security');
                        }}
                      />
                    ) : checking ? (
                      <PhraseCheck
                        mnemonic={phrase}
                        onPassed={() => {
                          setPhraseUnconfirmed(false);
                          setChecking(false);
                          setConfirmedNow(true);
                        }}
                        onShowPhrase={() => setChecking(false)}
                      />
                    ) : (
                      <>
                        {noPasscode && (
                          <Text style={styles.warning}>
                            This iPhone has no passcode, so your recovery phrase
                            is not protected. Anyone holding this phone can see
                            these words.
                          </Text>
                        )}
                        <BirthdayNote height={birthdayHeight} />
                        <PhraseGrid mnemonic={phrase} />
                        {phraseUnconfirmed && (
                          <View style={styles.reveal}>
                            <Text style={styles.warning}>
                              You have not confirmed these words yet. Compare
                              them with your paper, then confirm.
                            </Text>
                            <Button
                              label="Confirm my paper copy"
                              onPress={() => setChecking(true)}
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
          {page === 'menu' ? (
            <Button label="Done" variant="back" onPress={onClose} />
          ) : (
            <Button
              label="Back"
              variant="back"
              onPress={() => {
                if (flow != null) {
                  pendingChange.current = null;
                  setFlow(null);
                } else if (
                  page === 'phrase' ||
                  page === 'viewkey' ||
                  page === 'erase' ||
                  page === 'keys'
                ) {
                  setPage('security');
                } else if (page === 'openwait' || page === 'seckey') {
                  setPage('keys');
                } else if (page === 'acknowledgements') {
                  setPage('about');
                } else setPage('menu');
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  // Sheets reach under the home indicator: the bottom buttons sit higher,
  // clear of the swipe area and easy to reach with a thumb.
  safe: { flex: 1, backgroundColor: colors.ink },
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    overflow: 'hidden',
  },
  scroll: { paddingBottom: space.lg, paddingTop: space.sm },
  section: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: space.lg,
    marginBottom: -space.xs,
  },
  // An engraved brass plate, as on Lock more and Release.
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '38',
    paddingHorizontal: space.md,
    marginTop: space.md,
    shadowColor: colors.gold,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  chain: { alignItems: 'center', paddingVertical: space.md, marginTop: 0 },
  chainLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.gold,
  },
  chainBlock: {
    fontFamily: fonts.serifMedium,
    fontSize: 26,
    color: colors.text,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  chainSub: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  quiet: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
  },
  disclosure: { alignSelf: 'center', marginTop: space.lg, padding: 4 },
  quietNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginBottom: space.sm,
  },
  keyTitleRow: { flexDirection: 'row', alignItems: 'center' },
  infoButton: { marginLeft: 6, padding: 2 },
  keyInfo: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    marginTop: 6,
  },
  empty: { alignItems: 'center', paddingVertical: space.lg, gap: 6 },
  emptyTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 20,
    color: colors.text,
    marginTop: space.sm,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
  },
  disclosureText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
  },
  cardPad: { paddingVertical: space.md },
  dangerCard: {
    borderColor: colors.danger + '66',
    backgroundColor: colors.danger + '12',
  },
  dangerLabel: { color: colors.danger },
  noTop: { marginTop: 0 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  lineText: { flex: 1, paddingRight: space.md },
  lineLabel: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  lineHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  lineValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: space.md },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipOn: { backgroundColor: colors.gold + '22', borderColor: colors.gold },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  chipLabelOn: { color: colors.gold },
  currencyHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    paddingBottom: space.md,
  },
  pressed: { opacity: 0.5 },
  menuLine: { paddingVertical: 13 },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIconDanger: { backgroundColor: colors.danger + '1F' },
  menuLabel: { flex: 1 },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  warning: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
    marginTop: space.md,
  },
  reveal: { marginTop: space.lg },
  keyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
    paddingVertical: space.md,
  },
  info: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.md,
  },
  gap: { height: space.sm },
  pad: { marginTop: space.xl },
  poolValue: { alignItems: 'flex-end' },
  poolAmount: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  poolOther: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  poolChevron: { color: colors.goldDim },
  poolQuiet: { opacity: 0.45 },
  // A thin red line: anything in Transparent is visible to everyone.
  poolExposed: {
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
    paddingLeft: space.sm,
  },
  smallLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: space.md,
  },
  smallLink: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.goldDim },
  smallDot: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    marginHorizontal: space.sm,
  },
  poolSub: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.gold,
    marginTop: 2,
  },
  check: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.gold },
  keyNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.gold + '88',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyNumberText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.gold,
  },
  keyValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    maxWidth: 110,
    textAlign: 'right',
  },
  centered: { textAlign: 'center', marginTop: space.sm },
  lostLink: { marginTop: space.lg },
  lostLinkText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  inlineLink: { alignSelf: 'flex-start', marginTop: space.sm, padding: 4 },
  inlineLinkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
  },
  chevron: {
    fontFamily: fonts.sans,
    fontSize: 22,
    color: colors.goldDim,
    marginLeft: space.sm,
  },
  unitSwitch: {
    flexDirection: 'row',
    borderRadius: 16,
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
}));
