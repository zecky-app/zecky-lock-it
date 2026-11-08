# Zecky Lock it: regression routine

Run this after every update of react-native-zcash or the Zcash SDK, after any
change to `patches/`, and before every TestFlight build. Use a wallet with a
small amount and its 24 words and birthday block on paper.

## 1. On the Mac

1. Clean install and patch: `npm run setup`
2. Dependencies: `npm run check:deps` (fails only on critical; the known build-tooling advisories are listed in CLAUDE.md, anything new is reviewed)
3. Code checks: `npx tsc --noEmit`, `npx eslint App.tsx src __tests__`, `npx jest`
4. Build to the iPhone, then confirm the install in `build.log`
5. Settings shows the new version number
6. Settings › About › Technical details has no test lines ("Install check",
   "Keychain items"); add such lines only for a TestFlight test and remove
   them again before the build is uploaded

## 2. On the iPhone

Tick each one. Expected result in brackets.

**Update and start**
- [ ] Install over the previous version (wallet, balance and history still there)
- [ ] Open after at least a few hours closed ("Connecting…", then "Syncing x%", then green)
- [ ] Go to the home screen during "Syncing x%" and come back (it carries on)

**Home and the lock**
- [ ] Startup (lock and wordmark fade in, then Home fades in; no stutter, no scrolling)
- [ ] Held line and milestone ("Locked for N days · 1 week in N days"; ring matches)
- [ ] Eye button (balance, ≈ value and Activity amounts hidden; plate still LOCKED)
- [ ] Tap the lock ("Really open the lock?"; Keep it locked does nothing; Open only after tick and countdown)
- [ ] Open the lock (Face ID or code; plate OPEN; Release Zcash and Close the lock)
- [ ] Open lock, wait two minutes / leave Zecky (lock closes; Release closes too)

**Keys to the lock**
- [ ] Face ID mode: choose Zecky code (Face ID asked first; cancel changes nothing)
- [ ] Switch a check off, pick a shorter wait (asks first); switch on (no question)
- [ ] Opening Zecky on with Face ID (lock cover, Face ID on start and after background)
- [ ] Zecky code mode: opening Zecky, opening the lock and the phrase ask for the code
- [ ] Both checks and the question off (one tap opens the lock; page says so)
- [ ] Viewing key (always asks)
- [ ] Overview shows ① Opening Zecky ② Opening the lock ③ Really open the lock? ④ Security key, with their state
- [ ] Add a security key (Face ID or code first; Apple's sheet; "Key added ✓"); Test key ("Your key works ✓")
- [ ] Add a backup key (asks the first key, then the new one); the same key twice is refused
- [ ] Remove a key (asks a key tap); closing the sheet removes nothing
- [ ] "Also ask the key to show the recovery phrase": off with one key; with two, the paper warning first; the phrase then asks a key; switching off asks a key
- [ ] Lost your keys: removal starts (owner check), Home shows "Security key removal: after …", a key tap cancels it
- [ ] zecky.app/.well-known/apple-app-site-association still served (removing it breaks security keys after an update)

**Lock more and release**
- [ ] Lock more fits without scrolling; scan the QR with the Z from another wallet (with and without a requested amount)
- [ ] Receive from another wallet (note counts down: "usable in about N minutes · x/10 confirmations", gone after 10)
- [ ] Try to spend before it is spendable (clear message, nothing sent)
- [ ] Release to another wallet (receipt totals and "Stays locked" match; lock closes; confirmed in Activity)
- [ ] With a security key: receipt says "Tapping your key sends it", button "Release … with your key"; cancel on Apple's sheet sends nothing and shows no error; a key tap releases
- [ ] With a security key: Lock it in from the public address asks no key
- [ ] Release to your own address ("Yourself" on the receipt; "To yourself", only the fee)
- [ ] Release max (nothing left behind except what the fee needs)
- [ ] Activity (summary, filters, months, details; Export history)

**Connection**
- [ ] Airplane mode and Wi-Fi off (red "No internet connection" within seconds; lock does not open, nothing created)
- [ ] Turn Wi-Fi off right after confirming a release ("Release saved" screen with only Done; warning on the next release; confirmed after reconnecting)
- [ ] Rock it on Wi-Fi (green); on mobile data without Tailscale (red, lock does not open); with Tailscale and the 100.x address (green)

**Recovery phrase and erase**
- [ ] Show recovery phrase without Zecky code (Face ID; cancel keeps it hidden; birthday tile above the words)
- [ ] Show recovery phrase with Zecky code (asks for the code)
- [ ] Erase wallet (Face ID first; welcome screen; theme, unit, servers and Keys to the lock back to defaults)
- [ ] Restore with the birthday block (balance, history and receive address as before)
- [ ] Restore by month (same result)
- [ ] Wrong phrase on restore (refused with a clear message)
- [ ] Delete the app and install again (welcome screen, nothing left)

**Network upgrades**
- [ ] While ENGINE_KNOWS_NU7 is false and the network is past NU7: Release shows the NU7 pause and Review is greyed out; Lock it in waits with the NU7 line; receiving and syncing work
- [ ] After an engine update for NU7: set ENGINE_KNOWS_NU7 to true, then a small release and a lock-in go through

**Tor**
- [ ] Tor on with Rock it (Tailscale or home): grey onion, Network says "Not needed with your own node", a release goes out straight away; the ≈ price still comes (USD, over Tor)
- [ ] Tor on with zec.rocks: gold onion, a release goes out (a failed first try is retried at once)
- [ ] Tor on while it is still connecting, or with Tor failing (red onion): Release shows "Tor is not connected yet", Review is greyed out; Lock it in waits; nothing goes out. Once Tor is on, both work.

**Privacy on the phone**
- [ ] App switcher with Home or the phrase open (cover shown, not the balance or the words)
- [ ] Start a screen recording (Control Center) with Zecky open: the lock cover with "Hidden while the screen is recorded or mirrored"; stop recording: Zecky is back
- [ ] Start a screen recording with Settings or Release open: the cover is above the sheet; with VoiceOver on, nothing behind the cover is read out
- [ ] Restore with a 12-word phrase: warning first, second tap goes ahead
- [ ] Scan a payment request with two recipients: refused with a clear message
- [ ] Fresh install: no ≈ value until "Show the value in your currency" is chosen; no price request before that
- [ ] iPhone Settings › your name › iCloud › Manage storage › Backups (Zecky's wallet data not listed as a large backup item)

**Last**
- [ ] How it works (every chapter) still matches what the app does, in dark and light
- [ ] Note the result in the changelog and on the build list
