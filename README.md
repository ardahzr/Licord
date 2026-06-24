# Licord

Native, fast, Discord-inspired chat for Arch Linux, CachyOS, and Windows.

Licord is a lightweight community and group-chat app built with Tauri + Rust
instead of Electron. It keeps the Discord-like flow people already know:
servers, direct messages, group DMs, media sharing, voice calls, screen sharing,
and synchronized YouTube watch rooms — with a smaller native footprint.

## Why Licord?

- Native desktop app powered by Rust/Tauri, not a heavy Electron shell.
- Discord-style servers, text channels, friends, DMs, and group DMs.
- Voice rooms and private group calls with mic mute, deafen, camera, and leave controls.
- Screen sharing with selectable resolution and FPS.
- Noise and echo reduction for cleaner voice calls.
- Media uploads for images/videos/files through secure presigned upload URLs.
- Synchronized YouTube co-watch panel for channels and group DMs.
- Dark “Carbon & Rust” UI designed for Linux desktops.

## Install

### Arch Linux / CachyOS

Recommended:

```bash
yay -S licord-bin
```

Manual package install:

```bash
wget https://github.com/ardahzr/Licord/releases/download/v0.1.0/licord-bin-0.1.0-1-x86_64.pkg.tar.zst
sudo pacman -U licord-bin-0.1.0-1-x86_64.pkg.tar.zst
```

### Windows

Download the installer:

```text
https://github.com/ardahzr/Licord/releases/download/v0.1.0/Licord_0.1.0_x64-setup.exe
```

Portable build is also available:

```text
https://github.com/ardahzr/Licord/releases/download/v0.1.0/Licord_0.1.0_windows_x64_portable.zip
```

All release files are here:

```text
https://github.com/ardahzr/Licord/releases/tag/v0.1.0
```

## Backend and privacy model

Official Licord builds connect to the Licord backend for auth, realtime chat,
media, and voice-room tokens. That is expected: users who install the official
release use the same app service.

The public repository does not include private server credentials. Client apps
can contain public configuration such as:

- Supabase project URL
- Supabase publishable/anon key
- LiveKit websocket URL
- public media CDN/R2 URL

Those are not admin secrets. They must still be protected by backend rules:
Supabase Row Level Security, Edge Function authorization checks, short-lived
LiveKit tokens, and server-side R2 signing.

Never put these in the client or GitHub:

- Supabase `service_role` key
- R2 access key or secret key
- LiveKit API secret
- VPS SSH password/private key
- `.env` files
- `supabase/.temp/` local project metadata

## Development

### Prerequisites on Arch/CachyOS

```bash
sudo pacman -S --needed nodejs pnpm rustup base-devel webkit2gtk-4.1 libsoup3 \
  gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly
rustup default stable
```

### Run locally

```bash
pnpm install
cp .env.example .env

pnpm dev        # browser dev server
pnpm tauri:dev  # native desktop app
```

### Build

```bash
pnpm build
pnpm package:linux
```

Windows installer from Windows:

```powershell
pnpm install --frozen-lockfile
pnpm package:windows
```

Experimental Windows installer cross-build from Arch/CachyOS:

```bash
cargo install --locked cargo-xwin
yay -S nsis
sudo pacman -S --needed lld
pnpm package:windows:cross
```

## Self-hosting / backend setup

If you want to run your own backend instead of the official Licord service:

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql).
3. Deploy the Edge Functions:

```bash
supabase functions deploy upload-url
supabase functions deploy livekit-token --no-verify-jwt
```

4. Set server-side secrets in Supabase:

```bash
supabase secrets set \
  R2_ACCESS_KEY_ID=<key> \
  R2_SECRET_ACCESS_KEY=<secret> \
  R2_BUCKET_NAME=<bucket> \
  R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
  R2_PUBLIC_URL=https://pub-<id>.r2.dev \
  LIVEKIT_API_KEY=<key> \
  LIVEKIT_API_SECRET=<secret>
```

5. Fill `.env` with public client config:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_R2_PUBLIC_URL="https://pub-<id>.r2.dev"
VITE_R2_BUCKET_NAME="<bucket>"
VITE_R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
VITE_LIVEKIT_URL="wss://<livekit-host>"
```

## Tech stack

- Tauri v2 + Rust
- React 18 + Vite + TypeScript
- Tailwind CSS
- Supabase Auth/Postgres/Realtime/Edge Functions
- Cloudflare R2
- LiveKit

## License

MIT — see [LICENSE](LICENSE).
