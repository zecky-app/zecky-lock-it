# Zecky Lock it: regression routine

Run this after every update of react-native-zcash or the Zcash SDK, after any
change to `patches/`, and before every TestFlight build. Use a wallet with a
small amount and its 24 words and birthday block on paper.

## 1. On the Mac

1. Clean install and patch: `npm run setup`
2. Dependencies: `npm run check:deps` (only the known `braces` advisory)
3. Code checks: `npx tsc --noEmit`, `npx eslint App.tsx src __tests__`, `npx jest`
4. Build to the iPhone, then confirm the install in `build.log`
5. Settings shows the new version number

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

**Lock more and release**
- [ ] Lock more fits without scrolling; scan the QR with the Z from another wallet (with and without a requested amount)
- [ ] Receive from another wallet (note counts down: "usable in about N minutes · x/10 confirmations", gone after 10)
- [ ] Try to spend before it is spendable (clear message, nothing sent)
- [ ] Release to another wallet (receipt totals and "Stays locked" match; lock closes; confirmed in Activity)
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

**Privacy on the phone**
- [ ] App switcher with Home or the phrase open (cover shown, not the balance or the words)
- [ ] iPhone Settings › your name › iCloud › Manage storage › Backups (Zecky's wallet data not listed as a large backup item)

**Last**
- [ ] How it works (every chapter) still matches what the app does, in dark and light
- [ ] Note the result in the changelog and on the build list
