# The Zcash engine in Zecky Lock it

Zecky does not build its own cryptography. Keys, key derivation, proofs,
signatures and transaction building all come from the official Zcash core,
**librustzcash**, published by the Zcash developers. Zecky's own code only
connects to it.

| Part | Version | Source |
| --- | --- | --- |
| Zcash core (librustzcash crates) | NU7 releases: zcash_protocol 0.11.0, zcash_primitives 0.31.0, zcash_client_backend 0.25.0, zcash_client_sqlite 0.23.0, orchard 0.16.0, sapling-crypto 0.9.0 | crates.io, pinned with checksums in the engine's Cargo.lock |
| Engine (libzcashlc.xcframework + zcashlc.h) | Zecky engine **v4.0.0-zecky.2**, commit `3a69cb0` | [zecky-app/zecky-engine](https://github.com/zecky-app/zecky-engine): the official zcash-swift-wallet-sdk 4.0.0 FFI, adapted to the NU7 crates (`git diff upstream 184d056`) |
| react-native-zcash | 0.13.5 (pinned) | npm, EdgeApp/react-native-zcash, plus our patch in `patches/` |
| Swift SDK (ZCashLightClientKit, vendored Swift sources) | 2.7.0-rc.4 | zcash/zcash-swift-wallet-sdk, inside react-native-zcash |

NU7, as built into the engine: mainnet activation height 3,543,405,
consensus branch ID `0x77190AD9`, 25-second blocks (ZIP 218).

## How it gets into the app

`scripts/fetch-engine.sh` runs after every `npm install` / `npm ci`
(`postinstall`, and `npm run setup`). It downloads the engine release, refuses
it unless every checksum matches, and replaces the engine that ships inside
react-native-zcash.

| File | sha256 |
| --- | --- |
| libzcashlc.xcframework.zip (release asset) | `60c23e9f4d8c6acb7bb59fb57e935913e018888c5c8e8298c5ecca8b54180789` |
| zcashlc.h (release asset) | `1d9cada2baa1c0f3c7f8035422e1feecd9f0bd696ce7b07ea686313d2844a2dc` |
| ios-arm64/libzcashlc.a | `94c9b1feb7c35fb1a13c779fc8b78e236910145005ead405f81ae7c414a0b2cd` |
| ios-arm64_x86_64-simulator/libzcashlc.a | `91d6a1d685b0b97ad9b036af7e758c685c52b8e9cdac08fef00867bfb0ebc1d1` |

`__tests__/engineBinary.test.ts` fails if any of them changes, or if the
script pins a different release.

Because the engine files in `node_modules/react-native-zcash/ios` are
replaced, regenerate our patch without them, or the binaries end up in it:

```
./node_modules/.bin/patch-package react-native-zcash --exclude 'package\.json$|libzcashlc\.xcframework|zcashlc\.h$'
```

## History

- Until 0.0.19 build 18: the engine inside react-native-zcash 0.13.5, from
  zcash-swift-wallet-sdk 2.7.0-rc.4, checked byte for byte against the Zcash
  team's release on 27 Oct 2026 (self-audit D1). It does not know NU7, so
  build 18 pauses releases from 40 blocks before NU7.
- From the next build: the Zecky engine v4.0.0-zecky.2 above. The FFI changes
  were reviewed independently twice before any TestFlight build (memory
  safety, RNG, error handling; then the full diff `lockit-ffi-nu7.diff`), and
  are first in the audit scope. v4.0.0-zecky.1 was the first build, replaced
  after that review: community voting removed, every dependency at least 14
  days old, the single-use address check keeps its pace across NU7, clearer
  errors for expired and unpayable addresses. Every format of address of the
  NU7 era was tested (mainnet and testnet), and Lock it's own addresses stay
  readable by wallets on older Zcash libraries.

## When updating the engine

1. In zecky-engine: bump the crates, `cargo test`, independent review of the
   FFI diff, rebuild on a Mac (`make ffi-all`), package, publish a release.
2. Here: update the release and checksums in `scripts/fetch-engine.sh`, this
   file and `__tests__/engineBinary.test.ts`.
3. Test on testnet, then one small mainnet send, before TestFlight.

Opening a wallet with a newer engine can migrate its database one way; an
older build cannot open it afterwards (restore from the 24 words instead).
