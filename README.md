# dropzone

A private group link-sharing web app. Share links, videos, and images with friends — get rich previews, react to posts, comment on drops, and keep your feed alive indefinitely.

---

## Table of Contents

- [Stack](#stack)
- [Features](#features)
- [Admin Panel](#admin-panel)
- [Deployment](#deployment)
  - [Cosmos Cloud (Recommended)](#cosmos-cloud-recommended)
  - [Docker Compose (Generic)](#docker-compose-generic)
  - [Development Build from Source](#development-build-from-source)
- [How Updates Work](#how-updates-work)
- [Configuration](#configuration)
- [Storage & Uploads](#storage--uploads)
- [Facebook Video Embeds](#facebook-video-embeds)
- [JPEG XR / Windows HDR Screenshots](#jpeg-xr--windows-hdr-screenshots)
- [Share Links & Discord / iMessage Embeds](#share-links--discord--imessage-embeds)
- [Push Notifications](#push-notifications)
- [Notification Badge Sync](#notification-badge-sync)
- [Comments](#comments)
- [Folder Structure](#folder-structure)
- [License](#license)
- [AI Disclosure](#ai-disclosure)

---

## Stack

- **Next.js 14** (App Router, standalone output)
- **PostgreSQL** (via Docker)
- **Prisma ORM**
- **NextAuth.js** (credentials auth)
- **open-graph-scraper** (link previews)
- **web-push** (push notifications via VAPID)
- **yt-dlp + ffmpeg** (Facebook video downloads + JPEG XR image conversion)
- **Docker Compose** (app + database)

---

## Features

- 🔗 Link sharing with rich OG previews
- 🎥 Video & image uploads (100MB max per file, 20GB total)
- 📦 GIF support
- 🖼️ JPEG XR support — Windows HDR screenshots (`.jxr`) are automatically converted to PNG on upload
- ♾️ Uploads kept indefinitely — no expiry
- 🔗 Share links — generate a public preview URL for any post that embeds in Discord and iMessage
- ❤️ Emoji reactions on posts
- 💬 Threaded comments with delete support
- 👥 Private invite-only groups
- 🚪 Leave a group anytime — ownership hands off automatically, or the group is removed if you're the last one in it
- 📱 PWA — installable on iOS and Android
- 🔔 Push notifications — alerts for new drops and reactions even when the app is closed
- 🌙 Dark mode
- 📹 Facebook video embeds — Reels and videos download and play natively in the feed
- 🔴 Live notification badge — syncs immediately when notifications are read

---

## Admin Panel

Accessible at `/admin` by any user with `isSiteAdmin = true`.

### User Management
- View all registered users with post and group counts
- **Promote / demote** users to site admin
- **Force reset password** — set a new password for any user directly from the panel (no email required)
- **Delete user** — removes the account along with all their posts and group memberships

### Content Management
- View all posts across every group
- **Delete any post** site-wide

### Password Self-Service
- Users can change their own password at `/profile/change-password` (requires current password)
- Locked-out users are directed to open a Discord support ticket via the **Forgot password?** link on the login screen

---

## Deployment

### Cosmos Cloud (Recommended)

Dropzone is designed to run under [Cosmos Cloud](https://cosmos-cloud.io) with automatic updates. The `docker-compose.cosmos.yml` in this repo is the canonical deployment file for this setup.

#### 1. Prerequisites
- Cosmos Cloud installed and running
- The host uploads directory created:
  ```bash
  mkdir -p /DATA/AppData/dropzone/dropzone-app/uploads
  ```

#### 2. Configure Environment

Create `/DATA/AppData/dropzone/dropzone-app/.env` based on `.env.example`:

```bash
cp .env.example /DATA/AppData/dropzone/dropzone-app/.env
# Edit the file with your real values
```

> ⚠️ Set `NEXTAUTH_URL` to your full `https://` domain (e.g. `https://link.yourserver.com`). Discord and iMessage require HTTPS for image embeds.

#### 3. Generate VAPID Keys (push notifications)

```bash
npx web-push generate-vapid-keys
```

Add the output to your `.env`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_MAILTO=mailto:you@example.com
```

> Push notifications are optional — the rest of the app works normally without them.

#### 4. Add to Cosmos

In the Cosmos dashboard, add a new app using `docker-compose.cosmos.yml` from this repo. Cosmos will:
- Pull `ghcr.io/birdtruther/dropzone-app:latest` from GitHub Container Registry
- Start the app and database containers
- Apply database migrations automatically on first boot
- Check for image updates on its 6-hour cycle and restart the container when a new build is published (`cosmos-auto-update: true`)

---

### Docker Compose (Generic)

For self-hosting without Cosmos, use `docker-compose.yml`.

#### 1. Clone & configure

```bash
git clone https://github.com/BirdTruther/dropzone-app.git
cd dropzone-app
cp .env.example .env
# Edit .env with your values
```

#### 2. Create uploads directory

```bash
mkdir -p uploads
```

This folder is bind-mounted into the container at `/app/public/uploads` and persists across all restarts and rebuilds.

#### 3. Create the database volume

`docker-compose.yml` uses an external named volume for PostgreSQL data. Create it once before first start:

```bash
docker volume create dropzone-app_pg_data
```

> ⚠️ This volume holds your database. Never delete it, or you lose all users, groups, and posts.

#### 4. Run

```bash
docker compose up -d
```

Docker pulls the latest image from `ghcr.io/birdtruther/dropzone-app:latest`, runs database migrations automatically, and starts the app on port `8742`.

---

### Development Build from Source

To build the image locally instead of pulling from GHCR:

```bash
git clone https://github.com/BirdTruther/dropzone-app.git
cd dropzone-app
cp .env.example .env
docker compose up --build -d
```

---

## How Updates Work

Every push to `main` that changes application code triggers a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that builds and publishes a fresh image to `ghcr.io/birdtruther/dropzone-app:latest`.

### Cosmos Cloud
No manual action needed. Cosmos detects the new image digest on its 6-hour check cycle and automatically pulls and restarts the container.

### Generic Docker Compose

```bash
docker compose pull app
docker compose up -d
```

The container runs database migrations (`prisma migrate deploy`) on every startup via `docker-entrypoint.sh`, so any schema changes are applied before the app serves traffic.

---

## Configuration

All configuration is handled via environment variables. Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ | Full `https://` domain (e.g. `https://link.yourserver.com`) |
| `NEXTAUTH_SECRET` | ✅ | Random secret — run `openssl rand -base64 32` |
| `INTERNAL_API_SECRET` | ✅ | Secret for internal API calls — run `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_HOSTNAME` | ✅ | Bare hostname without protocol (e.g. `link.yourserver.com`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key for push notifications |
| `VAPID_MAILTO` | Optional | Contact email for push notifications (e.g. `mailto:you@example.com`) |
| `CLEANUP_SECRET` | Optional | Required only to use `GET /api/cleanup?secret=...` — a manual/cron endpoint that deletes posts past their `expiresAt`. The route refuses all requests until this is set; run `openssl rand -hex 24` |

> Generate VAPID keys with: `npx web-push generate-vapid-keys`

---

## Storage & Uploads

All uploaded files and downloaded Facebook videos are stored in a host directory bind-mounted into the container at `/app/public/uploads`.

### Cosmos Cloud deployment
- **Host path:** `/DATA/AppData/dropzone/dropzone-app/uploads`
- Persists across all image updates, container restarts, and Cosmos-triggered pulls

### Generic Docker Compose deployment
- **Host path:** `./uploads/` (relative to the project root, next to `docker-compose.yml`)
- Persists across all restarts and rebuilds

### Limits & naming
- **Max per file:** 100MB
- **Total storage:** 20GB
- Facebook videos are cached as `fb_<url-hash>.mp4`
- User uploads use their original filename with a unique prefix

### Backup
Back up the uploads directory to preserve all stored media. The PostgreSQL data lives in the `pg_data` Docker volume.

> ⚠️ Never run `docker compose down -v` — the `-v` flag removes the `pg_data` volume and **deletes your database**.

---

## Facebook Video Embeds

Dropzone downloads and serves Facebook videos natively using `yt-dlp` and `ffmpeg`, both pre-installed in the Docker image.

- Paste any Facebook video URL — `/videos/`, `/reel/`, `/share/r/`, `/share/v/`, or `fb.watch` links all work
- A **"Load Facebook video"** card is shown — the download only starts when the user taps it
- Videos are re-encoded to **H.264 + AAC** for guaranteed playback in all browsers
- Once downloaded, videos are cached in the uploads directory and served instantly to all subsequent viewers
- Partial or corrupt downloads are automatically detected and cleaned up
- Videos that require a Facebook login will show a clear error message

> ⚠️ Only **fully public** Facebook videos can be downloaded. Videos behind a login wall, set to Friends Only, or from private groups will fail with an explanatory message.

---

## JPEG XR / Windows HDR Screenshots

Windows saves HDR screenshots as `.jxr` (JPEG XR) files. Dropzone converts them automatically on upload.

- `.jxr` files are detected by their file extension on upload
- Conversion is a two-step pipeline:
  1. `JxrDecApp` (compiled from [jxrlib](https://github.com/4creators/jxrlib) in the Dockerfile) decodes the raw JPEG XR file into an intermediate TIFF
  2. `magick` (ImageMagick) flattens the TIFF to PNG
- The converted PNG is stored and served like any other uploaded image — the original `.jxr` and the intermediate TIFF are discarded
- ffmpeg is **not** used for this — Alpine's ffmpeg build has no JPEG XR decoder. `JxrDecApp` and ImageMagick are both pre-installed in the Docker image
- Conversion logic lives in `src/app/api/groups/[id]/upload/route.ts`

---

## Share Links & Discord / iMessage Embeds

Share links generate a public, token-gated preview URL for any post. No login is required to view or embed the preview.

### How embeds work
- `generateMetadata` in `src/app/share/[token]/page.tsx` produces `og:image` and `og:video` tags pointing to the **public media proxy** at `/api/share/[token]/media`
- The media proxy validates the share token and streams the file with `Cache-Control: public, max-age=86400` — no session cookie required
- This allows Discord's unfurler and iMessage's scraper (both unauthenticated bots) to fetch the image/video directly

### Why `/api/uploads/` is NOT used in OG tags
The main uploads route requires an active session and returns `Cache-Control: private`. Bots receive `401 Unauthorized` and the embed is blank. OG tag URLs must always point to the public share proxy.

### Discord cache busting
Discord caches embed previews per URL. Re-pasting the URL forces a fresh scrape. Appending a query param (e.g. `?v=2`) also busts the cache.

---

## Push Notifications

Dropzone supports Web Push notifications via the [Web Push Protocol](https://www.rfc-editor.org/rfc/rfc8030) and VAPID authentication.

- Users opt in per-device from **Profile → Notifications**
- Notifications fire when someone drops a link in a shared group or reacts to your post
- Works on desktop (Chrome, Firefox, Edge) and Android Chrome
- iOS 16.4+ supports push notifications for installed PWAs (added to home screen)
- Expired or revoked subscriptions are automatically cleaned up

---

## Notification Badge Sync

The header notification badge uses a `BroadcastChannel` (named `notifications`) to stay in sync with the notifications page in real time.

- `src/app/notifications/page.tsx` posts a `{ type: 'read' }` message after any successful PATCH
- `src/components/Header.tsx` listens on the same channel and re-fetches `/api/notifications` on receipt
- The badge updates immediately without waiting for the next 15-second poll cycle

---

## Comments

Each post has a collapsible comment thread accessible via the 💬 button.

- **Post a comment** — type and hit Enter (Shift+Enter for newlines)
- **Delete a comment** — available to the comment author, the post author, and group admins/owners
- **Notifications** — post authors receive an in-app notification when someone comments on their drop
- Comments display relative timestamps (e.g. "2 hours ago") with a full date on hover

---

## Folder Structure

```
uploads/                        # Host bind mount — all stored media (survives rebuilds)
src/
  app/
    (auth)/login/               # Login + forgot password pages
    admin/                      # Admin panel (users & posts)
    groups/                     # Groups list + group feed
    notifications/              # Notifications page (read/mark all read)
    profile/                    # Profile, password, notifications settings
    api/
      posts/[id]/
        comments/               # GET + POST comments on a post
        comments/[commentId]/   # DELETE a comment
      push/subscribe/           # Save / remove push subscriptions
      fetch-facebook/           # yt-dlp download + ffprobe validation endpoint
      uploads/[filename]/       # Serve uploaded files (auth-gated, session required)
      storage/                  # GET storage usage stats
      notifications/            # GET + PATCH notifications (read state)
      share/[token]/
        media/                  # Public token-gated proxy for images/videos (used in OG tags)
        video/                  # Public token-gated proxy for Facebook-downloaded videos
    share/[token]/              # Public share preview page (OG/Twitter cards)
    forgot-password/            # Lockout help page
  components/
    CommentThread.tsx           # Collapsible comment thread component
    Header.tsx                  # App header with notification badge (BroadcastChannel sync)
    PostEmbed.tsx               # Embed router (YouTube/TikTok/Spotify/Facebook/Twitter/Twitch)
    PushNotificationToggle.tsx  # Enable/disable push per device
    UploadedVideo.tsx           # Video upload progress + playback component
  lib/
    embed.ts                    # URL → embed type detection
    timeAgo.ts                  # Relative timestamp utility
    notifications.ts            # createNotification() — saves to DB + fires push
    sendPush.ts                 # web-push wrapper, auto-cleans expired subs
    storage.ts                  # Upload size tracking and limits
prisma/
  schema.prisma                 # Database schema
.github/
  workflows/
    docker-publish.yml          # CI/CD — builds and pushes to ghcr.io on code changes to main
docker-compose.yml              # Generic Docker Compose (pulls pre-built image from ghcr.io)
docker-compose.cosmos.yml       # Cosmos Cloud deployment (auto-update enabled)
docker-entrypoint.sh            # Runs database migrations on startup, then starts the server
Dockerfile                      # Multi-stage build (deps → builder → jxrlib → runner)
```

---

## License

This project is licensed under the [Business Source License 1.1](./LICENSE).

- Free for personal and non-commercial self-hosting
- Commercial use requires a separate license from the author
- Automatically converts to MIT on **May 6, 2030**

© 2026 Christopher DeHart (BirdTruther)

---

## AI Disclosure

The concept, product direction, naming, and the Dropzone logo are mine (**BirdTruther**). I wrote an initial baseline version of the app myself, but it didn't work — from there, essentially all of the actual codebase (architecture, API routes, database schema, debugging, and ongoing feature work) has been built with AI doing the backend work:

- Early development: **Perplexity AI**, using its Claude (Sonnet) access
- Current development: **Claude Code**, Anthropic's CLI agent

This disclosure is provided in the spirit of transparency as AI-assisted development becomes more common.
