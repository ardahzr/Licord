$ErrorActionPreference = "Stop"

pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis

Get-ChildItem -Recurse src-tauri/target/release/bundle/nsis -Filter "*setup*.exe" | Select-Object -ExpandProperty FullName
