# Changelog

## v0.91 — May 26, 2026

### Share Links
- Images and videos shared via a Dropzone link now embed properly in Discord and iMessage
- Previously, shared images and videos would show a blank or broken preview when pasted into Discord or iMessage — this is now fixed
- All existing share links are fixed automatically — no need to re-share anything
- **Note:** If you already pasted a link into Discord before today, you may need to re-paste it to see the updated preview (Discord caches old previews)

### Image Uploads
- Fixed Windows HDR screenshots (.jxr files) failing to upload — these now convert correctly

---

## v0.90 — May 24, 2026

### Notifications
- Notification badge in the header now decreases immediately when you mark an individual notification as read — no longer requires "Mark all read" to clear the count
- Notification badge stays in sync across the app in real time

### Bug Fixes
- Fixed uploaded video progress bar and spinner using the wrong brand color

---

## v0.89.0 — May 17, 2026

### Facebook Video Embeds
- Facebook video links now embed directly in the feed via server-side `yt-dlp` download
- Supports all Facebook video URL formats: `/videos/`, `/reel/`, `/share/r/`, `/share/v/`, `fb.watch` short links
- **Click-to-load** — videos do not auto-download on page load; a "Load Facebook video" card is shown until the user taps it
- Download states: idle → loading spinner → native video player (or error fallback with retry)
- Videos are downloaded once and cached — subsequent views by any user are instant with no re-download
- ffmpeg re-encodes all output to **H.264 + AAC** for guaranteed browser-native playback (no plugins required)
- `-movflags +faststart` applied so video begins playing before the full file is served
- `ffprobe` validates every downloaded file is a real playable video before caching it
- Partial or corrupt cached files (under 100 KB or failing ffprobe) are automatically deleted and re-attempted
- Login-walled videos show a clear "This video requires a Facebook login" message instead of a generic error
- Fallback "View on Facebook ↗" link card shown on any unrecoverable error, with a ↻ Retry button
- `yt-dlp` and `ffmpeg` installed in the Docker runner stage via `apk`

### Storage & Persistence
- Uploaded files (manual uploads + Facebook videos) now persist across container restarts and rebuilds
- Switched from Docker named volume to a **host bind mount** (`./uploads`) so files live at a real path on the host
- Facebook videos and all user uploads survive `docker compose down` and `updatedropzone` without re-downloading
- `./uploads/` directory on the host serves as the single source of truth for all stored media

### Build Fixes
- Added `npx prisma generate` to the Dockerfile builder stage — fixes `PrismaClient` type errors when new models are added to `schema.prisma` without a rebuild
- `yt-dlp` command switched from shell string join to `execFileAsync` with an args array — fixes argument quoting issues that previously prevented ffmpeg post-processing from running

## v0.85.0 — May 12, 2026
- Added notification preferences — per-type Push and In-App toggles in Profile → Notifications
- Notification types: New drop, Reaction, Comment, Mention — each independently controllable
- Toggles save instantly with a subtle ✓ confirmation; opt-out model (all on by default for existing users)
- Added @mention support in comments — type @ to open a member autocomplete dropdown
- Mentions render as highlighted @name chips in submitted comments
- Mentioned users receive a dedicated `mention` notification (respects their mention prefs)
- Mentions are validated server-side — only actual group members can be mentioned
- Self-mentions silently ignored
- Added GET /api/user endpoint to load notification prefs
- Added GET /api/groups/[id]/members endpoint for mention autocomplete

## v0.8.0 — May 11, 2026
- Added comments on posts — each post now has a collapsible 💬 comment thread
- Comment authors, post authors, and group admins/owners can delete any comment
- Post authors receive an in-app notification when someone comments on their drop
- Comments display relative timestamps (e.g. "2 hours ago") with full date on hover via `<time>` element
- Extracted shared `timeAgo` utility (`src/lib/timeAgo.ts`) used across posts and comments
- Comment input supports Enter to send and Shift+Enter for newlines
- Optimistic UI — comment appears instantly while the request is in flight

## v0.7.0 — May 10, 2026
- Added Web Push notifications — users are now notified about new drops and reactions even when the app is closed
- Push opt-in toggle added to Profile → Notifications tab
- Push subscriptions stored per-device in the database (PushSubscription model)
- Notifications automatically trigger a push via VAPID/web-push when created
- Expired or revoked push subscriptions are automatically cleaned up (410 Gone handling)
- VAPID key placeholders added to `.env.example` with setup instructions
- Push notifications work on desktop browsers and Android Chrome; iOS 16.4+ supported when installed as PWA

## v0.6.0 — May 7, 2026
- Added share link feature — generate a public, tokenized share URL for any post
- Share links load a clean public preview page with the image, video, author info, and note
- Images and videos embedded via Open Graph meta tags — links embed natively in Discord
- Share page includes a "Join dropzone to see more →" CTA linking back to the app
- Share tokens are stored in the database and support optional expiry (currently indefinite)

## v0.5.0 — May 7, 2026
- Removed 7-day upload expiry — files are now kept indefinitely
- Added PWA support with `manifest.json` for install-to-home-screen
- Added full icon set (favicon, apple-touch-icon, android-chrome) using custom dropzone logo
- Updated header: lowercase 'dropzone' branding with new logo replacing paperclip icon
- Added `apple-mobile-web-app-capable` and `theme-color` meta tags for clean iOS standalone mode
- Added `updatedropzone` server script for one-command deployments
- Fixed mobile responsiveness verified on iPhone 17

## v0.4.0 — May 6, 2026
- Added profile picture avatars beside usernames in posts
- Improved TikTok embeds — clean player, no white background, no suggested videos
- Fixed TikTok short links (vm.tiktok.com) failing to load

## v0.3.0 — May 6, 2026
- TikTok videos now embed directly in the feed
- Added fallback link card when embed fails
- Support for vm.tiktok.com, vt.tiktok.com, and m.tiktok.com short links

## v0.2.0 — May 5, 2026
- Added file upload support (images and videos)
- Posts now show expiry countdown for uploaded files
- Added delete button on your own posts
- Reaction counts now display inline on emoji buttons

## v0.1.0 — May 4, 2026
- Initial launch of Dropzone
- Group creation and invite system
- Link dropping with Open Graph preview cards
- Embeds for YouTube, Spotify, Twitter/X, Twitch, Facebook
- Emoji reactions on posts
- Auto-refresh feed every 15 seconds
