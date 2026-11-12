# Zecky Lock it changelog

What changed in each version, in plain words. Newest first.

## 0.0.19 (24), November 12, 2026
- Fewer traces of the build Mac inside the app: the C libraries (BoringSSL
  and others) no longer carry the builder's folder paths in their error
  messages. The Swift libraries still do; that follows in a next build.
- "Before you start": one quiet screen before creating or restoring a
  wallet (and once for wallets that already exist), with four points about
  the 24 words, final payments, testing and keys, links to the terms and
  privacy policy, and I understand. It comes back only when the terms
  version changes. Only the accepted version and the day are kept, on this
  phone; Erase wallet keeps them. Settings › About gains Terms and Privacy
  policy rows (opened in Safari); the privacy link moved there from
  Technical details.
- A new or restored wallet starts scanning near its birthday again. The
  bundled chain checkpoints ended at block 3,500,000, so a wallet made
  today scanned about 51,000 blocks it did not need. They now reach
  3,550,000 on mainnet and 4,590,000 on testnet: the same files as Zecky
  engine 4.0.0-zecky.5, fetched with the Zcash SDK's own tool and checked
  against an independent node.

## 0.0.19 (23), November 8, 2026
- Home: tap "Locked for …" for a new page with the ring, highlights of
  the current holding (since when, received since then, the stacking pace
  per day, week or month, payments in, the largest payment in, and the
  longest earlier stretch when it was longer) and the milestones, each with its own name: Locked (1 week), Sealed,
  Bolted, Steady, Anchored, Rooted, Unshaken, Hardened, Vaulted, Fortified,
  Bedrock, Keeper (1 to 11 months), Guardian (1 year), Sentinel, Stronghold
  and Legend (4 years), then Legend with its years. It shows the last one
  reached and the next two; a tap shows the whole path to Legend. The first time the page opens on a
  milestone day, that milestone lights up softly once with one line; no
  notifications or pop-ups. Amounts follow the eye (hidden stays hidden).
  Worked out on the phone from the history; only which milestone moment
  was shown is remembered, and Erase wallet clears it.
- Home: the line under the balance is now one line, "Locked since today",
  "Locked for 2 days", "for 3 weeks", "for 4 months", "for 1 year": the
  largest whole unit only, and no date ("1 week on Nov 12" was read as an
  unlock date). With an empty lock there is no line. The count starts at the
  first payment in after the lock was last empty; sends and later payments
  in never reset it, internal moves (locking in, the Ironwood move) count as
  nothing. It is worked out from the history alone, so it survives a
  restore; after a restore it waits until the first sync is done, and when
  the history does not reach back to the start (restored from a later
  date) the line says "Locked on this iPhone" instead of a count that is
  too short. A send's fee was taken twice in that sum, so a send that left
  about one fee could make the count restart; now it is counted once.
- Milestones are now 1 week, every month of the first year, 1 year, then
  every year (100 days and the 5-year end are gone). On a milestone day only, the ring is full and
  glows softly; no notifications, badges or pop-ups. Open the lock says
  "locked for" in the same words.
- Contacts: Scan QR code under the address, so a contact can be added from
  their Receive code. Only the address is kept (an amount in the code is
  ignored), and Add still checks it with the Zcash engine.
- Sync details: the ring now counts every block since the wallet birthday,
  so after a night closed it starts near the top (for example 99.6%) and
  moves to 100% instead of jumping from 0. It shows one decimal, glides
  between readings (not with Reduce Motion), only says 100% when the wallet
  is up to date, and the line under it says how many new blocks are left.
- Independent audit (Nov 6), key storage: if the iPhone passcode is turned
  off, iOS removes the guarded phrase; Zecky now says so on the main screen
  and under Security instead of a cancelled-looking Face ID at Send, and
  explains it in How Zecky works. The phrase is never rewritten in place
  (a copy stays until the new item is read back), creating or restoring
  refuses while a wallet is on the phone, a wallet that cannot be read at
  start gets a Try again screen instead of Welcome, the Zecky code never
  counts as "not set" when it cannot be read, and the phrase is dropped
  from memory right after the first start. The security keys' synced
  height is kept in its own item, and a missing key record blocks sending.
  "Later" on the phrase check now says what it means.
- Audit, sending: the wallet itself refuses a release unless the lock is
  open, so no screen can skip the Zecky code or the wait. A scanned payment
  request always fills in ZEC and starts fresh (no old note or fee choice).
  "1,500" ZEC and "1.5" zats are refused instead of read as 1.5 and 15. TEX
  addresses get the transparent warning and no note. A home-node address with
  leading zeros ("010.0.0.1") is no longer treated as private.
- Audit, smaller fixes: a private note is measured in bytes, as the network
  counts it, so emoji and accents can no longer pass the field and then
  fail; a second tap on Release or Lock in while one runs is refused before
  Face ID; a typed restore block that does not exist yet is refused; texts
  about the security key tap, "Lost my keys", undelivered payments (only
  while Zecky is open) and transparent addresses now say exactly what
  happens.
- Activity: payments that expired get their own EXPIRED group instead of
  sitting under WAITING.
- Audit, privacy: the chosen and saved servers (a home node or Tailscale
  name among them) and the sent-payment log are kept in the Keychain on
  this iPhone only, no longer in the app settings that go into backups;
  the price request carries no cookies and no app name; the balance is only
  remembered once Zecky has fully caught up; the Tor status says plainly
  that blocks are still downloaded directly; a security key's answer from
  another site is refused; the install script also checks the simulator
  engine.
- Settings › About links to the privacy policy (zecky.app/privacy); it
  opens in Safari only when tapped.
- Tests: every check a release passes is now tested branch by branch, and
  the phrase is checked to be stored only in its own Keychain items.
- Zecky code: each attempt is counted before it is checked, only one check
  runs at a time, and the wait after repeated misses grows to an hour.
- If the wallet cannot start (for example Face ID was cancelled), Home
  offers Try again instead of waiting for a restart.
- Unknown engine errors start with a plain sentence. Fixed: with Rock it
  out of reach, sending said "Cannot reach the Zcash network" instead of
  naming Rock it.
- Sync details: tap the status line on the main screen. A gold ring with
  the progress, the network's block and the wallet's, how far behind with a
  rough time to go, the wallet birthday, a bar of what is checked and what
  is still to check, the server and connection, and the last few problems
  (kept in memory only while Zecky is open).
- Start: no more "No internet connection" for the first seconds after
  opening Zecky. Until iOS has reported the connection the screen simply
  waits (sending still counts that moment as offline).
- About: Ironwood on one line; tap it for the older pools, greyed out, with
  Transparent marked red. Privacy policy and Acknowledgements sit small
  under Technical details, which no longer repeats the engine version.
- Restore: with no date and no block, Zecky first says the scan starts in
  2018 and can take hours, and asks for the year; tap again to scan it all.
- Settings › About › Acknowledgements lists the open-source software in the
  app with its licences, offline (`node scripts/notices.js` regenerates it
  and THIRD_PARTY_NOTICES.md after any dependency change).
- Activity: an expired payment has Send again, which fills in its address
  and note and goes through the lock as usual.
- If a newer engine writes the viewing key differently, Zecky stores the
  new one, so the phrase is not asked again at every start.
- The Sapling parameters are part of the app: nothing is downloaded from
  download.z.cash before the first release, with or without Tor. The
  wallet files get the "complete unless open" protection, a restored
  wallet starts in the SDK's restore mode, and the app asks the engine
  itself whether it knows NU7 before it sends.
- Max asks the Zcash engine for the whole spendable balance in one go,
  fee included, and the receipt shows the exact amount the engine sends.
- A payment request (QR) that Zecky cannot fully honour (a required
  parameter it does not know, an unreadable or repeated amount) is refused
  with the reason instead of being half filled in.
- Audit, engine connection (needs the next Mac build): no system logging
  from the SDK or the engine; with Tor on, Tor is up before the first sync
  instead of after it; the check that the wallet data belongs to this
  phrase runs before anything is synced; a failed payment-status write is
  no longer silent; a proposal error, a bad proposal or a lock-in failure
  can no longer hang or crash the app, and lock-in failures say why;
  sending treats the phone as offline until iOS has reported a connection.
- Audit, privacy and keys: the list of this phone's own payments moved from
  the app settings (which are in iCloud backups) to the Keychain, this
  device only. "Lost my keys" only finishes on one of Zecky's public
  servers, so a server of one's own cannot shorten the 48 hours. How Zecky
  works now says that saved servers are part of backups and that a scanned
  Tailscale code is trusted as your own Rock it.
- Your recovery phrase is now guarded by the iPhone's Secure Enclave: iOS
  releases it only after Face ID or your passcode, when you send, lock in
  or show it. Syncing uses only the viewing key. The first time you open
  this build, Zecky moves the phrase there (one Face ID). This protects it
  against attacks that copy the iPhone's Keychain files, such as DarkSword.
- Settings › Security says so quietly when the iPhone's iOS is older than
  the release that fixed DarkSword, or when there is no passcode.
- A short tour the first time Zecky opens: Receive, tap the lock to send,
  choose your keys. Skip it any time; replay it from How Zecky works.
- Keys to the lock: a small ⓘ on each key explains in one line what it is
  for.
- Calm empty states: Activity, Send and Security key say what to do first.
- How Zecky works is a quiet link at the bottom of Settings and under
  Keys to the lock.
- Receive: a larger QR code in the same card, on paper color, with the
  standard quiet margin around it.
- The main screen shows a payment on its way calmly: "Receiving +0.0099
  ZEC" or "Sending −0.001 ZEC", with the details one tap away.

## 0.0.19, build 19 (November 6, 2026)
- Ready for NU7: Zecky's Zcash engine is updated to the official Zcash core
  for NU7, so sending and locking in work again.
- The first time you open this version, Zecky updates its wallet data for
  the new engine. Your 24 words and your Zcash are unaffected.
- Receive, Send and Settings open in the lock's own room: the same
  dark background, a small Zecky lock on top, engraved brass plates.
- Settings shows the current block of the Zcash network and how fast blocks
  come. About names the Zcash engine and the current block; the technical
  details fold away. Network is shorter: the explanation and adding a
  server fold away until you need them.
- Send: while the keypad is open the lock steps aside, so the fields stay
  in view; Check before sending, Sent and Payment saved are in the same
  style, with the value in your currency under Total sent.
- Send: tick "Include the network fee in this amount" and the total that
  leaves the lock is exactly what you typed; the receiver gets it minus
  the fee.
- Plain words: Receive and Send (were Lock more and Release), Received
  and Sent in Activity. The lock stays in the look.
- The main screen is calmer: just "Up to date" at the bottom, the next
  milestone as a date (1 week on Nov 12), no "usable in about …
  minutes" note, and no theme switch (it is under Settings › Display).
- Each value shows in one place: the server under Network, the current
  block on the Settings menu, the version under About.
  Send still shows what can be used now, and when the rest will be.

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
