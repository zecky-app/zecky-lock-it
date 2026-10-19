# Zecky Lock it

Self-custody Zcash wallet for iPhone, just for holding. In testing (TestFlight, invite only).
Part of Zecky: Lock it, Pocket and [Rock it](https://github.com/zecky-app/rock-it). See [zecky.app](https://zecky.app).

The keys stay on the phone. Zecky runs no servers of its own and collects no accounts or analytics.

React Native 0.87, light client via `react-native-zcash` (the Electric Coin
Company SDKs).

## First run (Mac, iOS simulator)

    npm install
    npx react-native-asset          # links the fonts in assets/fonts
    cd ios && bundle install && bundle exec pod install && cd ..
    npm run ios

## Layout

- `App.tsx` – welcome → recovery phrase → home flow
- `src/theme.ts` – colors and fonts
- `src/config.ts` – network and lightwalletd server
- `src/wallet/seed.ts` – recovery phrase creation and Keychain storage
- `src/wallet/useSynchronizer.ts` – runs the light client, exposes balance and sync state
- `src/screens/` – screens

## Rules for changes

- **Keep "How Zecky works" true.** The page in Settings
  (`src/screens/settings/HowItWorksPage.tsx`) tells users what to expect. Any
  change that affects keys, funds, privacy, network requests or what is
  stored on the phone must re-read that page and update it in the same
  change. Cosmetic changes do not need to touch it.
- The Zcash library is patched (`patches/`). After changing the patch, run
  `rm -rf node_modules/react-native-zcash && npm install`.
- Do not accept Xcode's "recommended settings": User Script Sandboxing must
  stay off or the build fails.

## Security

Found a problem? Please email hello@zecky.app before posting it publicly.
See `docs/THREAT_MODEL.md` for what the wallet protects against.

## License

MIT, see `LICENSE`. The fonts in `assets/fonts` (Inter, Newsreader) are under
the SIL Open Font License. The Zcash light-client SDKs are by the Electric
Coin Company.
