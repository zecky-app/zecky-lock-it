# The Zcash engine in Zecky Lock it

Zecky does not build its own cryptography. Keys, key derivation, proofs,
signatures and transaction building all come from the official Zcash core,
**librustzcash**, published by the Zcash developers. Zecky's own code only
connects to it.

Outside Zcash itself, a few well-known libraries do small, standard jobs.
None of them touches Zcash keys, proofs or transactions (audit C-39):

| Job | Done by | Where |
| --- | --- | --- |
| The 24 words from 256 bits of entropy, and their checksum (BIP 39) | `@scure/bip39` 2.4.0 | `src/wallet/seed.ts` |
| Mixing two draws of the iPhone's secure random generator (SHA-256) | `@noble/hashes` 2.4.0 | `src/wallet/entropy.ts` |
| The 24 words to the 64-byte seed (BIP 39 PBKDF2) | MnemonicSwift 2.2.4, inside the Zcash SDK | `RNZcash.swift` |
| The Zecky code hash (PBKDF2-SHA256, 10,000 rounds) | `@noble/hashes` | `src/lib/pin.ts` |
| Checking a security key's answer: parsing in Zecky, signature by Apple | `src/lib/webauthn.ts`, CryptoKit (ES256) | patch |

From the seed on, everything is librustzcash: the ZIP 32 keys, addresses,
notes, proofs and transactions. The phrase and the seed pass through
JavaScript and Swift strings, which cannot be wiped from memory; the engine
wipes the spending-key bytes it hands over (C-51).

| Part | Version | Source |
| --- | --- | --- |
| Zcash core (librustzcash crates) | NU7 releases: zcash_protocol 0.11.0, zcash_primitives 0.31.0, zcash_client_backend 0.25.0, zcash_client_sqlite 0.23.0, orchard 0.16.0, sapling-crypto 0.9.0 | crates.io, pinned with checksums in the engine's Cargo.lock |
| Engine (libzcashlc.xcframework + zcashlc.h) | Zecky engine **v4.0.0-zecky.3**, commit `6d8da89` | [zecky-app/zecky-engine](https://github.com/zecky-app/zecky-engine): the official zcash-swift-wallet-sdk 4.0.0 FFI, adapted to the NU7 crates (`git diff upstream 184d056`) |
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
| libzcashlc.xcframework.zip (release asset) | `8b33f971f3a6d17fa19948aae9bdd4c0c67ab40edf36cdb96009a35d8e512772` |
| zcashlc.h (release asset) | `1d9cada2baa1c0f3c7f8035422e1feecd9f0bd696ce7b07ea686313d2844a2dc` |
| ios-arm64/libzcashlc.a | `71893f22b2c103c778d6e6e880877137a218d1b3c87a4bce430be8b7910bbed4` |
| ios-arm64_x86_64-simulator/libzcashlc.a | `00f6a525f5cbb3ba9af098a062fe8fc3f922dfdce1a3501e1ccc5788417ba5eb` |

`__tests__/engineBinary.test.ts` fails if any of them changes, or if the
script pins a different release.

Because the engine files in `node_modules/react-native-zcash/ios` are
replaced, regenerate our patch without them, or the binaries end up in it:

```
./node_modules/.bin/patch-package react-native-zcash --exclude 'package\.json$|libzcashlc\.xcframework|zcashlc\.h$'
```

The patch changes `ios/RNZcash.m`, `ios/RNZcash.swift` and, in the vendored
Swift SDK: `setTransactionStatus` checks the engine's new `bool` result
(audit C-13), and `proposeSendMax` connects the engine's own
`zcashlc_propose_send_max_transfer` through the SDK's layers
(ZcashRustBackend, TransactionEncoder, SDKSynchronizer; audit C-15).

## History

- Until 0.0.19 build 18: the engine inside react-native-zcash 0.13.5, from
  zcash-swift-wallet-sdk 2.7.0-rc.4, checked byte for byte against the Zcash
  team's release on 27 Oct 2026 (self-audit D1). It does not know NU7, so
  build 18 pauses releases from 40 blocks before NU7.
- Build 20: the Zecky engine v4.0.0-zecky.2 (commit `3a69cb0`). The FFI changes
  were reviewed independently twice before any TestFlight build (memory
  safety, RNG, error handling; then the full diff `lockit-ffi-nu7.diff`), and
  are first in the audit scope. v4.0.0-zecky.1 was the first build, replaced
  after that review: community voting removed, every dependency at least 14
  days old, the single-use address check keeps its pace across NU7, clearer
  errors for expired and unpayable addresses. Every format of address of the
  NU7 era was tested (mainnet and testnet), and Lock it's own addresses stay
  readable by wallets on older Zcash libraries.

- Build 21: v4.0.0-zecky.3 (commit `6d8da89`, signed tag), the audit
  release: ctutils, zstd and zstd-safe on their fixed versions (audit
  C-10), built with rustc 1.99.1 from the committed Cargo.lock with the
  builder's paths kept out of the binary (C-12), spending-key bytes wiped
  before they are freed (C-51). The C interface is unchanged: `zcashlc.h`
  is byte-identical to zecky.2. Packaged as zecky.2 was: plain static
  libraries in the xcframework, the zip with fixed file dates.

## When updating the engine

1. In zecky-engine: bump the crates, `cargo test`, independent review of the
   FFI diff, rebuild on a Mac (`make ffi-all`), package, publish a release.
2. Here: update the release and checksums in `scripts/fetch-engine.sh`, this
   file and `__tests__/engineBinary.test.ts`.
3. Test on testnet, then one small mainnet send, before TestFlight.

Opening a wallet with a newer engine can migrate its database one way; an
older build cannot open it afterwards (restore from the 24 words instead).
