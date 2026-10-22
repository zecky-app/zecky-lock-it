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
  points: string[];
}[] = [
  {
    title: 'The lock',
    summary: 'For keeping Zcash, not spending it.',
    icon: 'lock',
    points: [
      'Locking more is always one tap. Opening the lock takes a deliberate moment.',
      '“Locked for N days” counts from your first payment in, and starts over if the lock was ever emptied.',
      'Milestones, from 1 week to 5 years, are worked out on this phone from your own payments.',
      'An open lock closes after a release, after two minutes, or when you leave Zecky.',
    ],
  },
  {
    title: 'Keys to the lock',
    summary: 'One, two or three keys: you choose.',
    icon: 'person',
    keys: [
      {
        title: 'Opening Zecky',
        text: 'Face ID or the iPhone passcode, or your 4-digit Zecky code, each time Zecky opens.',
      },
      {
        title: 'Really open the lock?',
        text: 'A question with a tick and a 10, 5 or 3-second wait: a pause for when someone is rushing you.',
      },
      {
        title: 'It’s you',
        text: 'Face ID, the passcode or the Zecky code once more, before the lock opens.',
      },
    ],
    points: [
      'Set them in Settings › Security › Keys to the lock. Use all three, or fewer.',
      'Showing the recovery phrase or the viewing key and erasing the wallet always ask, whatever you choose.',
      'Making any of this easier, or choosing a new Zecky code, first asks that it’s you.',
      'The Zecky code is a screen lock, not encryption, and a forgotten code can’t be reset. Without an iPhone passcode or a Zecky code there is nothing to ask, so the phrase is not protected.',
    ],
  },
  {
    title: 'Your keys, your Zcash',
    summary: '24 words, made and kept on this phone.',
    icon: 'eyeOff',
    points: [
      'Your Zcash is controlled by a recovery phrase of 24 words, created on this phone.',
      'The words come from the phone’s secure random generator, checked and mixed with a second source. If that generator isn’t working, Zecky won’t create a wallet.',
      'The phrase stays in the phone’s secure storage and is never sent anywhere. Nobody else has a copy, so nobody can recover it for you.',
      'Zecky asks for three of the words to check your paper. Until you do, Security and the main screen remind you.',
      'Whoever has the 24 words has the Zcash. Lose both the words and this phone, and it is gone for good.',
    ],
  },
  {
    title: 'Private by default',
    summary: 'Amounts, senders and addresses stay hidden.',
    icon: 'eye',
    points: [
      'Lock more uses shielded addresses: the amount, the sender and the receiver are encrypted on the blockchain.',
      'Each address is shown until it is paid; then a fresh one appears, so payments can’t be linked. All of them lead to this same lock.',
      'The public address is for senders who can’t pay a shielded one. Its payments are visible to everyone until you shield them.',
      'A viewing key shows everything in this wallet but can’t spend. Sharing it can’t be undone.',
      'Zcash keeps funds in pools. Settings › About shows yours: Ironwood, where new Zcash locks in since NU6.3 (July 2026); Orchard, which Zcash can only leave since then; Sapling; and the public Transparent pool. The oldest pool, Sprout, is closed to new Zcash and not used by Zecky.',
    ],
  },
  {
    title: 'What others can see',
    summary: 'The server, the price and Tor.',
    icon: 'globe',
    points: [
      'Zecky reads the blockchain through a Zcash server. It sees your internet address and that a wallet is syncing, never your balance or shielded addresses, and it can’t move your Zcash.',
      'Pick another server, or your own, under Network. Saved servers and their names stay on this phone.',
      'Public servers always use an encrypted connection. Your own node (Rock it) on a private address stays inside your home network, or is encrypted by Tailscale.',
      'Whether you are online comes from iOS itself. Only with Rock it on mobile data does Zecky ask your node every 15 seconds whether it answers.',
      'With Tor on, releases, looking up your payments, chain checks and the price go through Tor, which hides your internet address. Downloading blocks stays direct.',
      'Without Tor, the price comes from a public price service that sees your internet address, never your balance or addresses. Choose None under Display for no price requests.',
      'A release to a public address is public: its amount and destination.',
    ],
  },
  {
    title: 'Balances, fees and waiting',
    summary: 'What you see while things settle.',
    icon: 'arrowDown',
    points: [
      'While Zecky starts, syncs or is offline, it shows the last confirmed balance. The status at the bottom says so.',
      'New Zcash needs 10 confirmations, about 12 minutes, before it can be used; your own change after a release needs 3, about 4 minutes. It counts in your balance right away, with a note until it is usable. Release shows what can be used now.',
      'Each release pays a small network fee, shown on the receipt before you confirm. Zecky adds no fee of its own.',
      'A release can’t be reversed or cancelled.',
      'A payment of 5,000 zats or less costs more in fees to use than it is worth. It shows in Activity but isn’t counted in your balance.',
    ],
  },
  {
    title: 'What is kept on this phone',
    summary: 'Where your data lives.',
    icon: 'settings',
    points: [
      'The recovery phrase, the Zecky code, your contacts, your receive addresses and your last known balance are in the phone’s secure storage, on this device only.',
      'Your history is kept in a database on this phone, left out of iCloud and computer backups. For a release that isn’t confirmed yet, the time it was sent is kept until it is.',
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
      'It never asks for your 24 words, except on the restore screen when you restore a wallet yourself. The check after creating a wallet only asks you to pick three.',
      'It can’t freeze, reverse or recover payments, and neither can anyone on its behalf.',
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
      <Text style={styles.intro}>Tap a chapter to open it.</Text>
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
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

const useStyles = makeStyles(colors => ({
  intro: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
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
    lineHeight: 21,
    color: colors.textMuted,
  },
}));
