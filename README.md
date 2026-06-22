# Better-VC

A lightweight, **native** Discord alternative for Arch Linux / CachyOS — built on
Tauri (Rust) instead of Electron. Text chat, media sharing, synchronized YouTube
co-watching, and (later) voice/video over LiveKit.

> Status: **Phase 1 complete** — UI/UX shell + theme + project foundation.

## Tech stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn-style primitives (Lucide icons) |
| Auth / DB / Realtime | Supabase |
| Media storage | Cloudflare R2 (S3 API) |
| Voice / video (Phase 5) | LiveKit (Hostinger KVM2) |

Design system: **"Carbon & Rust"** — deep-black carbon surfaces (`#131313`) with a
rust-orange primary (`#ff7043`), Inter + JetBrains Mono. Dark mode only.

## Prerequisites (Arch / CachyOS)

```bash
# Node + pnpm + Rust toolchain
sudo pacman -S nodejs pnpm rustup webkit2gtk-4.1 libsoup3 base-devel \
  gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly
rustup default stable
```

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in Supabase / R2 / LiveKit values

pnpm dev                  # frontend only (browser) at http://localhost:1420
pnpm tauri:dev            # native window (recommended)

pnpm build                # typecheck + production web build
pnpm tauri:build          # native bundle (AppImage / deb)
```

## Project layout

```
src/
  components/
    ui/        # primitives: Button, Input, Avatar (Carbon & Rust styled)
    layout/    # Sidebar, AppLayout (3-column shell)
    chat/      # TopBar, MessageList, MessageInput, ChatArea
    cowatch/   # CoWatchPanel (synchronized YouTube — Phase 4)
  pages/       # AuthPage, ChatPage, FriendsPage
  lib/         # env, supabase client, R2 storage stub, utils, mock data
  store/       # Zustand UI store
  types/       # Supabase schema mirror (database.ts)
src-tauri/     # Rust native backend (window, tray/frameless land in Phase 6)
stitch_oxide_discord_client/  # original Stitch HTML/PNG design source
```

## Roadmap

- **Phase 1 — UI/UX shell + theme** ✅
- **Phase 2 — Supabase Auth + Realtime chat** ✅
- **Phase 3 — Cloudflare R2 media uploads** ✅
- **Phase 4** — Co-watch (Supabase Realtime Broadcast sync)
- **Phase 5** — LiveKit voice / video / screen share
- **Phase 6** — Tauri system integration (tray, frameless) + AUR/AppImage build

## Media uploads (Phase 3)

Uploads use a presigned-URL flow so the R2 secret never reaches the client:
the `upload-url` Edge Function verifies the user's JWT and returns a short-lived
presigned PUT URL; the app uploads the file straight to R2.

One-time setup with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# R2 credentials live only on the server (never in VITE_ vars)
supabase secrets set \
  R2_ACCESS_KEY_ID=<key> \
  R2_SECRET_ACCESS_KEY=<secret> \
  R2_BUCKET_NAME=better-vc \
  R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
  R2_PUBLIC_URL=https://pub-<id>.r2.dev

supabase functions deploy upload-url
```

R2 bucket needs a CORS rule allowing `PUT`/`GET` from `http://localhost:1420`
and `tauri://localhost` (see the Cloudflare R2 bucket settings).

## Security note (Phase 3)

The R2 **secret** access key must never ship in a `VITE_` variable — everything
`VITE_*` is readable in the built client. Uploads will go through a Supabase Edge
Function that hands back a short-lived presigned URL, keeping the secret
server-side. The `VITE_R2_*` secret keys in `.env.example` are for local
prototyping only and are git-ignored.

## Friends, servers, and voice setup

The current UI uses real Supabase friend requests, server memberships, text
channels, and voice channels. After pulling these changes, run the complete
[`supabase/schema.sql`](supabase/schema.sql) once in Supabase Dashboard → SQL
Editor. The script is idempotent and creates the required RPCs and Realtime
publications.

Voice rooms also require the token function to be deployed after changes:

```bash
supabase functions deploy livekit-token --no-verify-jwt
```

The function validates the user's session and server/friend membership before
issuing a LiveKit room token. `VITE_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` must already point to the same LiveKit server.
