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

**Receive and send**
- [ ] Receive from another wallet ("available in a few minutes", then spendable after about 10 blocks)
- [ ] Try to spend before it is spendable (clear message, nothing sent)
- [ ] Send to another wallet (review screen totals match; confirmed in Activity)
- [ ] Send to your own address ("To yourself", only the fee)
- [ ] Send max (nothing left behind except what the fee needs)

**Connection**
- [ ] Airplane mode and Wi-Fi off (red "No internet connection" within seconds; send refused, nothing created)
- [ ] Turn Wi-Fi off right after confirming a send ("Payment saved" screen with only Done; warning on the next send; confirmed after reconnecting)
- [ ] Rock it on Wi-Fi (green); on mobile data without Tailscale (red, send refused); with Tailscale and the 100.x address (green)

**Recovery phrase and erase**
- [ ] Show recovery phrase without app code (Face ID; cancel keeps it hidden; birthday tile above the words)
- [ ] Show recovery phrase with app code (asks for the code)
- [ ] Erase wallet (Face ID first; welcome screen; theme, unit and servers back to defaults)
- [ ] Restore with the birthday block (balance, history and receive address as before)
- [ ] Restore by month (same result)
- [ ] Wrong phrase on restore (refused with a clear message)
- [ ] Delete the app and install again (welcome screen, nothing left)

**Last**
- [ ] How it works still matches what the app does
- [ ] Note the result in the changelog and on the build list
