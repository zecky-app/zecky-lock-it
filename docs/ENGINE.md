# The Zcash engine in Zecky Lock it

Zecky does not build its own cryptography. Keys, proofs and signatures come
from the Zcash team's engine, packaged by Edge in `react-native-zcash`.

| Part | Version | Source |
| --- | --- | --- |
| react-native-zcash | 0.13.5 (pinned) | npm, EdgeApp/react-native-zcash, plus our patch in `patches/` |
| Swift SDK (ZCashLightClientKit, vendored Swift sources) | 2.7.0-rc.4 | zcash/zcash-swift-wallet-sdk |
| Rust engine (libzcashlc.xcframework) | from SDK 2.7.0-rc.4 | release download `libzcashlc.xcframework.zip`, sha256 `c012c2b682191f027c1874ecde84adeeaef26dbb3e827dd5f29deb0eb8af0ef2` |

## Verified 27 Oct 2026 (self-audit D1)

The upstream zip was downloaded, its checksum matched the one in the SDK's
`Package.swift`, and its iPhone and simulator binaries are byte for byte the
same as the ones in react-native-zcash 0.13.5:

| Binary | sha256 |
| --- | --- |
| ios-arm64/libzcashlc.a | `1bbc8057add6e5bdac863fa380759e582ffcb4a505ba292ddfd97aede929e5ed` |
| ios-arm64_x86_64-simulator/libzcashlc.a | `3ac75d4704fc7bd9564c757e3b92f755c52307e2413993878df7e9bfb7ff9c1c` |

`__tests__/engineBinary.test.ts` fails if either binary changes.

## When updating react-native-zcash

1. Read its changelog for the new Swift SDK version.
2. Download that SDK release's `libzcashlc.xcframework.zip`; check its sha256
   against the release's `Package.swift`.
3. Unzip it and compare the iPhone and simulator binaries with the ones in
   the new package (`shasum -a 256`).
4. Only when they match: update the table above and the test.
