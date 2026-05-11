# dropzone

A private group link-sharing web app. Share links, videos, and images with friends — get rich previews, react to posts, comment on drops, and keep your feed alive indefinitely.

## Stack
- **Next.js 14** (App Router, standalone output)
- **PostgreSQL** (via Docker)
- **Prisma ORM**
- **NextAuth.js** (credentials auth)
- **open-graph-scraper** (link previews)
- **web-push** (push notifications via VAPID)
- **Docker Compose** (app + database)

## Features
- 🔗 Link sharing with rich OG previews
- 🎥 Video & image uploads (100MB max per file, 20GB total)
- ♾️ Uploads kept indefinitely — no expiry
- 🔗 Share links — generate a public preview URL for any post that embeds in Discord
- ❤️ Emoji reactions on posts
- 💬 Comments on posts — threaded discussion per drop with delete support
- 👥 Private invite-only groups
- 🗑️ Authors can delete their own posts
- 📱 PWA — installable on iOS and Android
- 🔔 Push notifications — get alerted about new drops and reactions even when the app is closed
- 🌙 Dark mode

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

## Getting Started

### 1. Clone
```bash
git clone https://github.com/BirdTruther/dropzone-app.git
cd dropzone-app
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

> ⚠️ Make sure `NEXTAUTH_URL` is set to your full `https://` domain (e.g. `https://link.yourserver.com`). Discord and other platforms require HTTPS for image embeds.

### 3. Generate VAPID Keys (for push notifications)

Push notifications require a one-time key generation step:

```bash
npx web-push generate-vapid-keys
```

Add the output to your `.env`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_MAILTO=mailto:you@example.com
```

> Push notifications will be silently skipped if these keys are not set — the rest of the app works normally without them.

### 4. Run with Docker
```bash
sudo docker compose up -d
```

App runs at: `http://localhost:3000`

### 5. Sync Database Schema
```bash
sudo docker exec -it dropzone-app npx prisma db push
```

> The app uses `prisma db push` for schema sync — no migration files required. Run this once after first deploy and after any schema changes.

## Comments

Each post has a collapsible comment thread accessible via the 💬 button.

- **Post a comment** — type and hit Enter (Shift+Enter for newlines)
- **Delete a comment** — available to the comment author, the post author, and group admins/owners
- **Notifications** — post authors receive an in-app notification when someone comments on their drop
- Comments display relative timestamps (e.g. "2 hours ago") with a full date on hover

## Push Notifications

Dropzone supports Web Push notifications via the [Web Push Protocol](https://www.rfc-editor.org/rfc/rfc8030) and VAPID authentication.

- Users opt in per-device from **Profile → Notifications**
- Notifications fire when someone drops a link in a shared group or reacts to your post
- Works on desktop (Chrome, Firefox, Edge) and Android Chrome
- iOS 16.4+ supports push notifications for installed PWAs (added to home screen)
- Expired or revoked subscriptions are automatically cleaned up

## Folder Structure
```
src/
  app/
    (auth)/login/       # Login + forgot password pages
    admin/              # Admin panel (users & posts)
    groups/             # Groups list + group feed
    profile/            # Profile, password, notifications settings
    api/
      posts/[id]/
        comments/       # GET + POST comments on a post
        comments/[commentId]/  # DELETE a comment
      push/subscribe/   # Save / remove push subscriptions
    share/[token]/      # Public share preview page
    forgot-password/    # Lockout help page
  components/
    CommentThread.tsx           # Collapsible comment thread component
    PushNotificationToggle.tsx  # Enable/disable push per device
  lib/
    timeAgo.ts          # Relative timestamp utility (timeAgo, isoDate, fullDate)
    notifications.ts    # createNotification() — saves to DB + fires push
    sendPush.ts         # web-push wrapper, auto-cleans expired subs
prisma/
  schema.prisma         # Database schema
docker-compose.yml
Dockerfile
```

## License

This project is licensed under the [Business Source License 1.1](./LICENSE).

- Free for personal and non-commercial self-hosting
- Commercial use requires a separate license from the author
- Automatically converts to MIT on **May 6, 2030**

© 2026 Christopher DeHart (BirdTruther)

---

## AI Disclosure

This project was built with significant assistance from AI tools, primarily **Perplexity AI** (powered by Claude). AI was used throughout development for:

- Architecting and writing the majority of the codebase
- Designing API routes, database schema, and component logic
- Debugging and iterating on features
- Writing configuration files (Dockerfile, docker-compose, Prisma schema)

The ideas, product direction, and decisions behind Dropzone are original and owned by Christopher DeHart. AI served as a development tool, not a co-author of the concept.

This disclosure is provided in the spirit of transparency as AI-assisted development becomes more common.
