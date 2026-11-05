# Zecky Lock it changelog

What changed in each version, in plain words. Newest first.

## 0.0.19, build 18 (November 5, 2026)
- Zcash network upgrade NU7: until Zecky's Zcash engine is updated for it,
  releasing and locking in are paused with a clear message. Your Zcash is
  safe, and receiving keeps working.
- Blocks now come every 25 seconds: waiting times for new Zcash are
  shorter and shown correctly.
- Addresses are called shielded and transparent, the standard Zcash words,
  each with a short explanation.
- A dropped connection to the Zcash server while syncing shows a calm
  message that clears by itself.
- Lock more is calmer at the bottom: the switch to the transparent
  address has its own quiet line.

## 0.0.19 (October 27, 2026)
- Security key: add a FIDO2 key such as a YubiKey under Keys to the lock
  ④. Each release then asks a tap of the key, and the tap sends it. Add a
  backup key; removing a key asks a key; lost keys can be removed after 48
  hours. Optionally, the key also guards the recovery phrase.
- Keys to the lock is now a numbered overview of all four keys.
- Tor with your own node: Zecky now talks to Rock it directly, also with
  Tor on, because a Tor connection could not reach it and releases got
  stuck. With a public server, a failed Tor release is tried again at once.
- Safety fixes from our own security audit and an independent re-check:
  nothing is released while Tor is wanted but not connected; the screen is
  hidden while it is recorded or mirrored; a 12- or 18-word phrase gets a
  warning on restore; payment requests with several recipients are
  refused; no price request until you choose a currency; wallet files stay
  out of backups; only a Rock it node added from its QR code counts as
  your own; the Zcash engine is checked against the official build.

## 0.0.18 (October 22, 2026)
- A new look, the same as Lock it on the Mac: a golden lock on a fine
  guilloché medallion, a ring that fills towards your next milestone, and
  how long your Zcash has been locked.
- Opening the lock asks "Really open the lock?" with a tick and a short
  wait, then Face ID or your code. The open lock shows Release Zcash and
  closes again by itself.
- Keys to the lock (Settings › Security): choose Face ID or a Zecky code,
  when Zecky asks (now also when opening Zecky with Face ID), and the wait
  before the lock opens. Making it easier asks that it is you first. The
  "app code" is now called the Zecky code.
- Lock more (was Receive): the Z in the QR code, the address in groups of
  four, fits the screen without scrolling.
- Release (was Send): a receipt with the total released and what stays
  locked; the lock closes when it is done.
- Activity: a summary, filters and payments by month.
- Settings and How Zecky works: cards, and short chapters that open and
  close.
- The value in your currency shows as "≈" under the balance.
- Syncing shows a percentage while catching up, and a Scan button adds your
  Rock it server from its QR code.
- Security: the viewing key now always asks for Face ID or your code, and
  choosing a new Zecky code asks first.
- Zcash that arrives on your public address shows as "waiting outside the
  lock" with one tap to lock it in, and messages say when it is done.
- Every screen in the new style, with the same buttons everywhere, and the
  lock's words: release instead of send.

## 0.0.17 (October 15, 2026)
- The wallet birthday block is shown above your 24 words, when you create a
  wallet and under Security, so it goes on your paper too. Restoring with it
  takes minutes.
- The restore screen accepts the block number with commas, dots or spaces.

## 0.0.16 (October 15, 2026)
- The status line says "Connecting…" while the wallet starts.

## 0.0.15 (October 15, 2026)
- No double payments when the connection drops. A payment that could not be
  delivered is saved and sent automatically once you are back online; the
  app says so and does not offer to send it again.
- Sending without an internet connection is refused before anything is
  created.
- The status light turns red within seconds when you are offline, or when
  your Rock it node cannot be reached on mobile data.
- Activity shows "Waiting to send…" with the time you sent it.
- The balance shows "available in a few minutes" for money that is still
  confirming.

## 0.0.14 (October 15, 2026)
- Payments to one of your own addresses show as "To yourself", with only the
  network fee as cost.

## 0.0.13 (October 15, 2026)
- Erasing the wallet asks for Face ID or the iPhone passcode when no app code
  is set.

## 0.0.12 (October 15, 2026)
- Deleting Zecky now removes the wallet from the phone, including the
  recovery phrase.
- Erase wallet also resets every setting, including your servers.
- Wallet files are now really left out of iCloud and computer backups.

## 0.0.10 (October 15, 2026)
- Showing the recovery phrase asks for Face ID or the iPhone passcode when no
  app code is set.

## 0.0.9 (October 15, 2026)
- A home node is only reached without encryption on a real private address.

## 0.0.8 (October 15, 2026)
- The balance stays on screen while offline and while syncing.

## 0.0.7 (October 13, 2026)
- Use your own Rock it home node, save servers under a name, and see the sync
  status.

## 0.0.6 (October 12, 2026)
- The app is called Zecky Lock it. The list of your receive addresses is kept
  in secure storage, out of backups.

## 0.0.5 (October 12, 2026)
- First Zecky release.

## 0.0.4 (October 11, 2026)
- After creating a wallet, Zecky checks three of your words against your
  paper. Safer phrase creation. Protection against known wallet attacks.

## 0.0.3 (October 11, 2026)
- A "How it works" page, notes on payments, tap to copy, and the complete
  list of your addresses.
- Security: wallet files out of backups, erase wallet, a cover in the app
  switcher, and an app-code lockout that changing the clock cannot skip.

## 0.0.2 (October 11, 2026)
- The first version for testing on an iPhone: send and receive, a 4-digit app
  code, amounts in your currency, contacts, payment requests, server choice,
  optional Tor, restore by date and export of your history.
