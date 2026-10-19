import React from 'react';
import { Text, View } from 'react-native';
import { about } from '../../lib/about';
import { fonts, makeStyles, space } from '../../theme';

// What people can expect from Zecky, in principles rather than features.
//
// RULE FOR EVERY FUTURE CHANGE: if a change affects how keys, funds, privacy
// or stored data work, re-read this page and update it in the same change.
// Each statement below must stay true of the app as shipped.
const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Your keys, your coins',
    points: [
      'Zecky is a self-custody wallet. Your funds are controlled by a recovery phrase of 24 words, created on this phone.',
      'The 24 words are made from random numbers supplied by this phone’s secure generator, checked and mixed with a second source. If that generator is not working, Zecky refuses to create a wallet.',
      'The phrase is kept in this phone’s secure storage and is never sent anywhere. Nobody else holds a copy, so nobody can recover it for you. After you write the words down, Zecky asks for three of them to check your paper. You can leave that for later, and Security will show it as not confirmed until you do. Once the wallet holds funds, the main screen shows a small reminder too.',
      'Whoever has the 24 words has the funds. If you lose both the words and this phone, the funds are gone for good.',
    ],
  },
  {
    title: 'Private by default',
    points: [
      'Zecky receives on shielded addresses, where the amount, the sender and the receiver are encrypted on the blockchain.',
      'Receive shows an address that has never been used. Once it has been paid, a new one is prepared. All of them lead to this same wallet.',
      'There is also a public address, for senders who cannot pay a shielded one. Payments to it are visible to everyone until you shield them into your private balance.',
      'A viewing key lets someone see everything in this wallet without being able to spend. Sharing it cannot be undone.',
    ],
  },
  {
    title: 'What others can see',
    points: [
      'To read the blockchain, Zecky talks to a Zcash server. That server can see your internet address and that a wallet is syncing. It cannot see your balance or your shielded addresses, and it cannot move your funds.',
      'You can pick another server, or use your own, under Network. Servers you save there, with the names you give them, are kept only on this phone.',
      'Public servers are always reached over an encrypted connection. Your own node (Rock it) on a private address is reached without that layer: on your home network the connection stays inside your home network, and through Tailscale it is encrypted by Tailscale.',
      'Whether the phone has a connection at all comes from iOS itself, without any request. Only when Rock it is selected and the phone is on mobile data does Zecky ask your own node every 15 seconds whether it answers, since it can then only be reached through Tailscale.',
      'With Tor switched on, sending payments, looking up your own payments, chain checks and the price go through Tor, which hides your internet address. Downloading blocks stays direct.',
      'The value in your currency needs a price. Without Tor it comes from a public price service, which sees your internet address but never your balance or addresses. Choose None under Display to make no price requests.',
      'When you pay a public address, that payment’s amount and destination are public.',
    ],
  },
  {
    title: 'Balances, fees and waiting',
    points: [
      'While Zecky starts, syncs or is offline, it shows the last balance it confirmed, under the status line that says so. The balance updates once the wallet is synced.',
      'Money you receive needs a few confirmations before it can be spent. Until then it counts in your balance, with a lower amount shown as available.',
      'Every payment pays a small fee to the Zcash network, shown before you confirm. Zecky adds no fee of its own.',
      'A sent payment cannot be reversed or cancelled.',
      'A payment of 5,000 zats or less costs more in fees to spend than it is worth. It appears in your activity but is not counted in your balance.',
    ],
  },
  {
    title: 'What is kept on this phone',
    points: [
      'The recovery phrase, the app code, your contacts, the list of your receive addresses and your last known balance are in the phone’s secure storage, on this device only.',
      'Your payment history is kept in a database on this phone and is left out of iCloud and computer backups. For a payment that is not confirmed yet, the app settings also keep when it was sent from this phone, until it is confirmed.',
      'The app code guards opening Zecky, viewing the recovery phrase and erasing the wallet. It is a screen lock, not encryption, and a forgotten code cannot be reset. Without an app code, viewing the recovery phrase and erasing the wallet ask for Face ID or the iPhone passcode. On an iPhone without a passcode, the phrase is not protected.',
      'Only Apple’s own keyboard works inside Zecky, so a keyboard from another app cannot record what you type. Notes on payments are shown as plain text, and a note with a link gets a warning.',
      'iOS keeps an app’s secure storage after the app is deleted. So when Zecky is installed again, it first removes anything an earlier install left there, including the recovery phrase: deleting Zecky removes the wallet. To remove it without deleting the app, use Erase wallet under Security. That also resets every setting, including your servers.',
    ],
  },
  {
    title: 'What Zecky never does',
    points: [
      'No account, no email address, no sign-up.',
      'No analytics, tracking or advertising.',
      'It never asks for your recovery phrase, except on the restore screen when you choose to restore a wallet yourself. The check after creating a wallet only asks you to pick three of the words.',
      'It cannot freeze, reverse or recover payments, and neither can anyone on its behalf.',
    ],
  },
  {
    title: 'Where it stands',
    points: [
      `This is version ${about.appVersion}, early software that has not had an independent security review. Keep amounts in it that you can afford to lose, and keep your 24 words on paper.`,
    ],
  },
];

export function HowItWorksPage() {
  const styles = useStyles();
  return (
    <>
      {SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.points.map(point => (
            <View key={point} style={styles.point}>
              <View style={styles.bullet} />
              <Text style={styles.text}>{point}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const useStyles = makeStyles(colors => ({
  section: { marginTop: space.lg },
  heading: {
    fontFamily: fonts.serifMedium,
    fontSize: 21,
    color: colors.text,
    marginBottom: space.sm,
  },
  point: { flexDirection: 'row', marginTop: space.sm },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 9,
    marginRight: space.md,
  },
  text: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
  },
}));
