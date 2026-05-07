# Changelog

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
