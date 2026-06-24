#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile

if ! NO_STRIP=1 pnpm tauri build --bundles appimage,deb; then
  echo "AppImage bundling failed on this host; falling back to the .deb bundle."
  pnpm tauri build --bundles deb
fi

find src-tauri/target/release/bundle -type f \( -name '*.AppImage' -o -name '*.deb' \) -print
