import React, { useEffect, useRef, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { SheetCorner, SheetHeader } from '../components/lock';
import { Icon, IconName } from '../components/Icon';
import { BirthdayNote } from '../components/BirthdayNote';
import { PhraseGrid } from '../components/PhraseGrid';
import { PinPad } from '../components/PinPad';
import { CURRENCIES, Currency, NETWORK } from '../config';
import { about } from '../lib/about';
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
import { loadWallet } from '../wallet/seed';
import { useContacts } from '../lib/contacts';
import { eraseWallet } from '../lib/erase';
import { PhraseCheck } from '../components/PhraseCheck';
import { PhraseConfirmed } from '../components/PhraseConfirmed';
import { setPhraseUnconfirmed, usePhraseUnconfirmed } from '../lib/phraseCheck';
import { serverLabel, useServer } from '../lib/server';
import { TorStatus, useTorWanted } from '../lib/tor';
import { ContactsPage } from './settings/ContactsPage';
import { HowItWorksPage } from './settings/HowItWorksPage';
import { ServerPage } from './settings/ServerPage';
import { Tools } from 'react-native-zcash';

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
  /** Open straight on this page instead of the menu. */
  startOn?: 'server' | 'phrase';
  onClose: () => void;
}

type Page =
  | 'menu'
  | 'about'
  | 'display'
  | 'security'
  | 'keys'
  | 'phrase'
  | 'viewkey'
  | 'erase'
  | 'how'
  | 'contacts'
  | 'server';

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

const THEME_LABELS = { dark: 'Dark', light: 'Light', auto: 'Auto' } as const;

const TITLES: Record<Page, string> = {
  menu: 'Settings',
  about: 'About',
  display: 'Display',
  security: 'Security',
  keys: 'Keys to the lock',
  phrase: 'Recovery phrase',
  viewkey: 'Viewing key',
  erase: 'Erase wallet',
  how: 'How Zecky works',
  contacts: 'Contacts',
  server: 'Network',
};

const SUBTITLES: Record<Page, string> = {
  menu: 'Make Zecky Lock it yours.',
  about: 'Versions and details of this install.',
  display: 'How amounts and colors look.',
  security: 'Who can open Zecky and the lock.',
  keys: 'Everything that lets you in or opens the lock, in one place.',
  phrase: 'The 24 words that restore your Zcash on any phone.',
  viewkey: 'See-only access, for an accountant or a watch-only device.',
  erase: 'Remove the wallet from this iPhone.',
  how: 'What happens with your Zcash, keys and data.',
  contacts: 'Addresses you release to often.',
  server: 'How Zecky reaches the Zcash network.',
};

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

function Line(props: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{props.label}</Text>
      <Text style={styles.lineValue} selectable>
        {props.value}
      </Text>
    </View>
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
  startOn,
  walletAddress,
  onErased,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [page, setPage] = useState<Page>('menu');

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
      const stored = await loadWallet();
      if (stored == null) throw new Error('No wallet found on this phone.');
      setPhraseError(null);
      setViewKey(await Tools.deriveViewingKey(stored.mnemonic, NETWORK));
    } catch (e) {
      setPhraseError(e instanceof Error ? e.message : String(e));
    }
  };

  const reveal = async () => {
    try {
      const stored = await loadWallet();
      if (stored == null) throw new Error('No wallet found on this phone.');
      setPhraseError(null);
      setPhrase(stored.mnemonic);
    } catch (e) {
      setPhraseError(e instanceof Error ? e.message : String(e));
    }
  };

  // Without an app code, the iPhone's own Face ID or passcode guards the
  // words. Cancelling leaves them hidden.
  const revealWithDeviceCheck = async () => {
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
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SheetCorner />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <SheetHeader title={TITLES[page]} subtitle={SUBTITLES[page]} />

          {page === 'menu' && (
            <>
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
                  icon="eye"
                  label="How Zecky works"
                  value=""
                  onPress={() => setPage('how')}
                />
                <MenuRow
                  icon="info"
                  label="About"
                  value={`Version ${about.appVersion}`}
                  onPress={() => setPage('about')}
                  last
                />
              </View>
            </>
          )}

          {page === 'about' && (
            <>
              <View style={styles.card}>
                <Line
                  label="Zecky Lock it"
                  value={`Version ${about.appVersion}`}
                />
                <Line label="Zcash engine" value={about.zcashEngine} />
                <Line label="Network" value={NETWORK} />
                <Line label="Server" value={serverLabel(server)} />
                <Line
                  label="Wallet birthday"
                  value={`Block ${birthdayHeight.toLocaleString('en-US')}`}
                />
                <Line label="System" value={about.system} />
                <Line label="React Native" value={about.reactNative} />
              </View>

              <Text style={styles.section}>Your Zcash by pool</Text>
              <View style={styles.card}>
                {POOLS.map((pool, i) => {
                  const b = pools?.[pool.key];
                  const total = b?.total ?? '0';
                  const confirming =
                    b != null && BigInt(b.available) < BigInt(b.total);
                  return (
                    <View
                      key={pool.key}
                      style={[
                        styles.line,
                        i < POOLS.length - 1 && styles.divider,
                      ]}
                    >
                      <View style={styles.lineText}>
                        <Text style={styles.lineLabel}>{pool.name}</Text>
                        <Text style={styles.lineHint}>{pool.about}</Text>
                      </View>
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
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.info}>
                Together they make up your balance. New Zcash locks into
                Ironwood. The oldest pool, Sprout, is closed to new Zcash and is
                not used by Zecky.
              </Text>
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
                        style={[styles.unitOption, u === unit && styles.unitOn]}
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
                    ? 'Tor is on, so the price is fetched through Tor by the Zcash engine and no price service sees your internet address. That source only offers USD, so USD is shown whatever is chosen here. Choose None to make no price requests at all.'
                    : 'Shows your balance in this currency on the main screen. The price comes from CoinGecko; your balance and addresses are never sent. Choose None to make no price requests at all.'}
                </Text>
              </View>
            </>
          )}

          {page === 'how' && <HowItWorksPage />}
          {page === 'contacts' && <ContactsPage />}
          {page === 'server' && <ServerPage tor={tor} />}

          {page === 'security' && (
            <>
              <View style={styles.card}>
                <MenuRow
                  icon="lock"
                  label="Keys to the lock"
                  value={pinEnabled ? 'Zecky code' : 'Face ID'}
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

              <Text style={styles.section}>Ask when</Text>
              <View style={styles.card}>
                <View style={[styles.line, styles.divider]}>
                  <Text style={[styles.lineLabel, styles.menuLabel]}>
                    Opening Zecky
                  </Text>
                  <Switch
                    value={askStart}
                    onValueChange={next =>
                      needsOwner({ kind: 'ask', from: askStart, to: next })
                        ? whenOwner(() => setAskAt('start', next))
                        : setAskAt('start', next)
                    }
                    trackColor={{ true: colors.gold, false: colors.line }}
                    ios_backgroundColor={colors.line}
                  />
                </View>
                <View style={[styles.line, styles.divider]}>
                  <Text style={[styles.lineLabel, styles.menuLabel]}>
                    Opening the lock
                  </Text>
                  <Switch
                    value={askOpenLock}
                    onValueChange={next =>
                      needsOwner({ kind: 'ask', from: askOpenLock, to: next })
                        ? whenOwner(() => setAskAt('openLock', next))
                        : setAskAt('openLock', next)
                    }
                    trackColor={{ true: colors.gold, false: colors.line }}
                    ios_backgroundColor={colors.line}
                  />
                </View>
                <View style={[styles.line, styles.divider]}>
                  <Text style={[styles.lineLabel, styles.menuLabel]}>
                    Showing the recovery phrase
                  </Text>
                  <Text style={styles.lineValue}>Always</Text>
                </View>
                <View style={[styles.line, styles.divider]}>
                  <Text style={[styles.lineLabel, styles.menuLabel]}>
                    Showing the viewing key
                  </Text>
                  <Text style={styles.lineValue}>Always</Text>
                </View>
                <View style={styles.line}>
                  <Text style={[styles.lineLabel, styles.menuLabel]}>
                    Erasing the wallet
                  </Text>
                  <Text style={styles.lineValue}>Always</Text>
                </View>
              </View>

              <Text style={styles.section}>Really open the lock?</Text>
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
                Your funds are not destroyed. They stay on the Zcash blockchain
                and can be restored on any phone with the 24 words. Without the
                24 words they are lost for good, so check that you have them on
                paper before you continue.
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
                A viewing key gives read-only access to this wallet. Whoever has
                it can see your balance and every payment in and out, past and
                future, but cannot spend anything.
              </Text>
              <Text style={styles.warning}>
                It cannot be taken back once shared. Give it only to someone or
                something that should see everything, such as your own
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
                            You have not confirmed these words yet. Compare them
                            with your paper, then confirm.
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
              } else setPage('menu');
            }}
          />
        )}
      </View>
    </Modal>
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
  section: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: space.lg,
    marginBottom: -space.xs,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    marginTop: space.md,
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
  poolSub: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.gold,
    marginTop: 2,
  },
  check: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.gold },
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
