#!/usr/bin/env bash
# Puts the Zecky engine (libzcashlc, the official Zcash core built for NU7)
# into react-native-zcash, replacing the engine that ships inside that
# package. Runs after every npm install (see package.json "postinstall").
#
# The files come from a public release of zecky-app/zecky-engine and are
# refused unless their SHA-256 matches the pins below. To update the engine,
# follow docs/ENGINE.md; never change a pin without checking the build.
set -euo pipefail

RELEASE="https://github.com/zecky-app/zecky-engine/releases/download/v4.0.0-zecky.3"
ZIP_SHA256="8b33f971f3a6d17fa19948aae9bdd4c0c67ab40edf36cdb96009a35d8e512772"
HEADER_SHA256="1d9cada2baa1c0f3c7f8035422e1feecd9f0bd696ce7b07ea686313d2844a2dc"
DEVICE_SHA256="71893f22b2c103c778d6e6e880877137a218d1b3c87a4bce430be8b7910bbed4"
# Audit C-42: the simulator slice is pinned too.
SIM_SHA256="00f6a525f5cbb3ba9af098a062fe8fc3f922dfdce1a3501e1ccc5788417ba5eb"
SIM_LIB="ios-arm64_x86_64-simulator/libzcashlc.a"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/node_modules/react-native-zcash/ios"

sha256() { shasum -a 256 "$1" | cut -d ' ' -f 1; }

if [[ ! -d "$DEST" ]]; then
  echo "fetch-engine: react-native-zcash is not installed; nothing to do." >&2
  exit 0
fi

# Already in place: nothing to download.
if [[ -f "$DEST/libzcashlc.xcframework/ios-arm64/libzcashlc.a" ]] &&
  [[ "$(sha256 "$DEST/libzcashlc.xcframework/ios-arm64/libzcashlc.a")" == "$DEVICE_SHA256" ]] &&
  [[ -f "$DEST/libzcashlc.xcframework/$SIM_LIB" ]] &&
  [[ "$(sha256 "$DEST/libzcashlc.xcframework/$SIM_LIB")" == "$SIM_SHA256" ]] &&
  [[ "$(sha256 "$DEST/zcashlc.h")" == "$HEADER_SHA256" ]]; then
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -fsSL --retry 3 -o "$WORK/engine.zip" "$RELEASE/libzcashlc.xcframework.zip"
curl -fsSL --retry 3 -o "$WORK/zcashlc.h" "$RELEASE/zcashlc.h"

if [[ "$(sha256 "$WORK/engine.zip")" != "$ZIP_SHA256" ]]; then
  echo "fetch-engine: the engine download does not match its checksum. Refused." >&2
  exit 1
fi
if [[ "$(sha256 "$WORK/zcashlc.h")" != "$HEADER_SHA256" ]]; then
  echo "fetch-engine: the engine header does not match its checksum. Refused." >&2
  exit 1
fi

mkdir "$WORK/libzcashlc.xcframework"
unzip -q "$WORK/engine.zip" -d "$WORK/libzcashlc.xcframework"
if [[ "$(sha256 "$WORK/libzcashlc.xcframework/ios-arm64/libzcashlc.a")" != "$DEVICE_SHA256" ]] ||
  [[ "$(sha256 "$WORK/libzcashlc.xcframework/$SIM_LIB")" != "$SIM_SHA256" ]]; then
  echo "fetch-engine: the unpacked engine does not match its checksum. Refused." >&2
  exit 1
fi

rm -rf "$DEST/libzcashlc.xcframework"
mv "$WORK/libzcashlc.xcframework" "$DEST/libzcashlc.xcframework"
cp "$WORK/zcashlc.h" "$DEST/zcashlc.h"
echo "fetch-engine: Zecky engine v4.0.0-zecky.3 installed."
