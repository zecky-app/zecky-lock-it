import React, { useState } from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';
import { Icon, IconName } from '../../components/Icon';
import { about } from '../../lib/about';
import { fonts, makeStyles, space, useColors } from '../../theme';

// What people can expect from Zecky, in principles rather than features.
// Short chapters that open and close, so it reads as a guide, not a book.
//
// RULE FOR EVERY FUTURE CHANGE: if a change affects how keys, funds, privacy
// or stored data work, re-read this page and update it in the same change.
// Each statement below must stay true of the app as shipped.
const CHAPTERS: {
  title: string;
  summary: string;
  icon: IconName;
  /** Numbered, gold: the keys to the lock, before the points. */
  keys?: { title: string; text: string }[];
  /** The essentials: short, one idea each. */
  points: string[];
  /** The fine print, folded under "More detail". */
  more?: string[];
}[] = [
  {
    title: 'The lock',
    summary: 'A place to keep Zcash, not to spend it.',
    icon: 'lock',
    points: [
      'Receiving is always one tap. Opening the lock to send takes a deliberate moment.',
      'The open lock closes again after sending, after two minutes, or when you leave Zecky.',
      'The ring around the lock fills towards your next milestone, from 1 week to 5 years.',
    ],
    more: [
      '“Locked for N days” counts from your first payment in, and starts over if the lock was ever emptied.',
      'Milestones are worked out on this phone from your own payments.',
    ],
  },
  {
    title: 'Receive and send',
    summary: 'Waiting times, fees and what can’t be undone.',
    icon: 'arrowDown',
    points: [
      'New Zcash shows in your balance right away, and can be sent after about 4 minutes (10 blocks).',
      'Each payment pays a small network fee, shown before you confirm. Zecky adds no fee of its own. Tick “Include the network fee” to take it out of the amount instead.',
      'A payment can’t be reversed or cancelled. Check the address before you send.',
    ],
    more: [
      'Since the NU7 upgrade (November 2026) a block comes every 25 seconds. Your own change after sending can be used after 3 blocks, about 1 minute. Send shows what can be used now, and when the rest will be.',
      'While Zecky starts, syncs or is offline, it shows the last confirmed balance. The status at the bottom says so.',
      'A payment of 5,000 zats or less costs more in fees to use than it is worth. It shows in Activity but isn’t counted in your balance.',
      'Sending to a transparent address is public: its amount and destination.',
    ],
  },
  {
    title: 'Your 24 words',
    summary: 'They are your Zcash. Keep them on paper.',
    icon: 'eyeOff',
    points: [
      'Your Zcash is controlled by 24 words, made on this phone and never sent anywhere.',
      'Whoever has the 24 words has the Zcash. Lose both the words and this phone, and it is gone for good.',
      'Nobody else has a copy, so nobody can recover them for you.',
    ],
    more: [
      'The words come from the phone’s secure random generator, checked and mixed with a second source. If that generator isn’t working, Zecky won’t create a wallet.',
      'The phrase is kept in the phone’s secure storage.',
      'Zecky asks for three of the words to check your paper. Until you do, Security and the main screen remind you.',
      'All keys, proofs and payments are made by the official Zcash core (librustzcash), the same code other Zcash wallets use. Zecky’s own code only connects to it. The engine build is public, and the app checks it against fixed checksums.',
    ],
  },
  {
    title: 'Keys to the lock',
    summary: 'Up to four checks before Zcash leaves. You choose.',
    icon: 'person',
    keys: [
      {
        title: 'Opening Zecky',
        text: 'Face ID, the iPhone passcode or your 4-digit Zecky code, each time Zecky opens.',
      },
      {
        title: 'Opening the lock',
        text: 'The same check once more, before the lock opens.',
      },
      {
        title: 'Really open the lock?',
        text: 'A question and a 10, 5 or 3-second wait, for when someone is rushing you.',
      },
      {
        title: 'Security key',
        text: 'A key such as a YubiKey, tapped against your iPhone. The tap sends the payment.',
      },
    ],
    points: [
      'Set them in Settings › Security › Keys to the lock.',
      'Showing the 24 words or the viewing key, and erasing the wallet, always ask.',
    ],
    more: [
      'Making any of this easier, or choosing a new Zecky code, first asks that it’s you.',
      'A security key is checked on this phone against the key Zecky saved when you added it. Nothing goes over the internet, nothing about you is stored on the key, and Zecky does not show in the key’s own list of logins.',
      'Adding another key, removing one or switching off its other uses first asks one of your keys. Add a backup key and keep it in another place.',
      'Lost all your keys? Remove them after 48 hours, counted on both the Zcash network and the phone’s clock; tapping a key cancels it. Restoring from your 24 words never asks a key.',
      'You can also have a key asked before the 24 words are shown. Then losing every key and your paper means the Zcash is gone.',
      'The key guards sending from this phone. Whoever has your 24 words can still move the Zcash with another wallet, so keep the paper safe.',
      'The Zecky code is a screen lock, not encryption, and a forgotten code can’t be reset. Without an iPhone passcode or a Zecky code there is nothing to ask, so the 24 words are not protected.',
    ],
  },
  {
    title: 'Private by default',
    summary: 'Amounts, senders and addresses stay hidden.',
    icon: 'eye',
    points: [
      'Receive gives you a shielded address: amount, sender and receiver are encrypted on the blockchain.',
      'A shielded address is safe to share. Once it is paid, a fresh one appears, so payments can’t be linked.',
      'The transparent address is only for senders that can’t pay a shielded one. Its payments are public until you lock them in.',
    ],
    more: [
      'All your addresses lead to this same lock.',
      'A viewing key shows everything in this wallet but can’t spend. Sharing it can’t be undone.',
      'Zcash keeps funds in pools. Settings › About shows yours: Ironwood, where new Zcash locks in since NU6.3 (July 2026); Orchard, which Zcash can only leave since then; Sapling; and the public Transparent pool. The oldest pool, Sprout, is closed to new Zcash and not used by Zecky.',
    ],
  },
  {
    title: 'What others can see',
    summary: 'The server, the price and Tor.',
    icon: 'globe',
    points: [
      'Zecky reads the blockchain through a server. It sees your internet address, never your balance or addresses, and it can’t move your Zcash.',
      'Tor (Settings › Network) hides your internet address when you send and when Zecky looks things up.',
      'Your own node (Rock it) gives the most privacy.',
    ],
    more: [
      'Pick another server, or your own, under Network. Saved servers and their names stay on this phone.',
      'Public servers always use an encrypted connection. Your own node on a home-network address stays inside your home network, or is encrypted by Tailscale. Only the Tailscale name (…ts.net) from your Rock it code also proves the node is yours: a home-network address or a Tailscale number cannot be checked, so use those at home only. The status line names them.',
      'Whether you are online comes from iOS itself. Only with Rock it on mobile data does Zecky ask your node every 15 seconds whether it answers.',
      'With Tor on, sending, looking up your payments, chain checks and the price go through Tor. Downloading blocks stays direct. While Tor is still connecting or could not connect, Zecky sends and locks in nothing. If one Tor connection fails, a payment is tried again at once through a fresh one.',
      'With your own node, Zecky talks to it directly, also with Tor on: the node is yours, and a Tor connection could not reach a home or Tailscale address. A …ts.net address typed by hand is not counted as your node, so Tor stays on for it. The price still goes through Tor. Your node passes payments on to the Zcash network from your home connection.',
      'Zecky asks a price service only after you choose a currency under Display. Without Tor that service sees your internet address, never your balance or addresses. Choose None for no price requests.',
    ],
  },
  {
    title: 'On this phone',
    summary: 'Where your data lives.',
    icon: 'settings',
    points: [
      'Your 24 words, code, contacts and history stay on this iPhone, left out of iCloud and computer backups.',
      'Erase wallet (Settings › Security) removes everything from this phone. Your 24 words bring it back.',
    ],
    more: [
      'The recovery phrase, the Zecky code, your security keys’ public keys, your contacts, your receive addresses and your last known balance are in the phone’s secure storage, on this device only.',
      'Your history is kept in a database on this phone. For a payment that isn’t confirmed yet, the time it was sent is kept until it is.',
      'Only Apple’s own keyboard works inside Zecky, so a keyboard from another app can’t record what you type.',
      'Notes on payments show as plain text, and a note with a link gets a warning.',
      'iOS keeps an app’s secure storage after the app is deleted, so a new install of Zecky first removes what an earlier one left, the recovery phrase included. Erase wallet removes it without deleting the app, and resets every setting, servers included.',
    ],
  },
  {
    title: 'What Zecky never does',
    summary: 'No account, no tracking.',
    icon: 'info',
    points: [
      'No account, no email address, no sign-up.',
      'No analytics, tracking or advertising.',
      'It never asks for your 24 words, except when you restore a wallet yourself.',
      'It can’t freeze, reverse or recover payments, and neither can anyone else.',
    ],
  },
  {
    title: 'Where it stands',
    summary: 'Early software.',
    icon: 'info',
    points: [
      `This is version ${about.appVersion}, early software without an independent security review yet.`,
      'Keep amounts in it that you can afford to lose, and keep your 24 words on paper.',
    ],
  },
];

export function HowItWorksPage() {
  const styles = useStyles();
  const colors = useColors();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState<Set<string>>(new Set());
  const toggleMore = (title: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
    );
    setMoreOpen(prev => new Set(prev).add(title));
  };
  const toggle = (title: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
    );
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <>
      {CHAPTERS.map(chapter => {
        const isOpen = open.has(chapter.title);
        return (
          <View key={chapter.title} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => toggle(chapter.title)}
              style={({ pressed }) => [styles.head, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Icon name={chapter.icon} size={16} color={colors.gold} />
              </View>
              <View style={styles.headText}>
                <Text style={styles.title}>{chapter.title}</Text>
                <Text style={styles.summary}>{chapter.summary}</Text>
              </View>
              <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>
                ›
              </Text>
            </Pressable>
            {isOpen && (
              <View style={styles.body}>
                {chapter.keys?.map((key, k) => (
                  <View key={key.title} style={styles.key}>
                    <View style={styles.keyNumber}>
                      <Text style={styles.keyNumberText}>{k + 1}</Text>
                    </View>
                    <View style={styles.keyText}>
                      <Text style={styles.keyTitle}>{key.title}</Text>
                      <Text style={styles.text}>{key.text}</Text>
                    </View>
                  </View>
                ))}
                {chapter.points.map(point => (
                  <View key={point} style={styles.point}>
                    <View style={styles.bullet} />
                    <Text style={styles.text}>{point}</Text>
                  </View>
                ))}
                {chapter.more != null &&
                  (moreOpen.has(chapter.title) ? (
                    <View style={styles.more}>
                      {chapter.more.map(point => (
                        <View key={point} style={styles.point}>
                          <View style={[styles.bullet, styles.bulletQuiet]} />
                          <Text style={[styles.text, styles.textQuiet]}>
                            {point}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => toggleMore(chapter.title)}
                      style={styles.moreLink}
                    >
                      <Text style={styles.moreLinkText}>More detail ›</Text>
                    </Pressable>
                  ))}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

const useStyles = makeStyles(colors => ({
  // An engraved brass plate per chapter, as on Lock more and Release.
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '38',
    marginTop: space.sm + 2,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: space.md,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headText: { flex: 1 },
  title: { fontFamily: fonts.serifMedium, fontSize: 18, color: colors.text },
  summary: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  chevron: {
    fontFamily: fonts.sans,
    fontSize: 22,
    color: colors.goldDim,
    marginLeft: space.sm,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  body: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 4,
  },
  point: { flexDirection: 'row', marginTop: space.sm },
  more: {
    marginTop: space.sm,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
  },
  moreLink: { marginTop: space.md, alignSelf: 'flex-start' },
  moreLinkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.gold,
  },
  bulletQuiet: { backgroundColor: colors.goldDim },
  textQuiet: { fontSize: 13, lineHeight: 20 },
  key: {
    flexDirection: 'row',
    marginTop: space.sm + 2,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + '40',
    backgroundColor: colors.ink,
  },
  keyNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  keyNumberText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.gold,
  },
  keyText: { flex: 1 },
  keyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 8,
    marginRight: 12,
  },
  text: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
}));
