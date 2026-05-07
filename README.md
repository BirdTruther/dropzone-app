# dropzone

A private group link-sharing web app. Share links, videos, and images with friends — get rich previews, react to posts, and keep your feed alive indefinitely.

## Stack
- **Next.js 14** (App Router, standalone output)
- **PostgreSQL** (via Docker)
- **Prisma ORM**
- **NextAuth.js** (credentials auth)
- **open-graph-scraper** (link previews)
- **Docker Compose** (app + database)

## Features
- 🔗 Link sharing with rich OG previews
- 🎥 Video & image uploads (100MB max per file, 20GB total)
- ♾️ Uploads kept indefinitely — no expiry
- 🔗 Share links — generate a public preview URL for any post that embeds in Discord
- ❤️ Emoji reactions on posts
- 👥 Private invite-only groups
- 🗑️ Authors can delete their own posts
- 📱 PWA — installable on iOS and Android
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

### 3. Run with Docker
```bash
sudo docker compose up -d
```

App runs at: `http://localhost:3000`

### 4. Run DB Migrations
```bash
sudo docker compose exec app npx prisma migrate deploy
```

## Server Management

A helper script is installed on the host server for one-command deployments:

```bash
updatedropzone
```

This pulls the latest from `main`, resets the working tree, and rebuilds the Docker containers automatically.

## Folder Structure
```
src/
  app/
    (auth)/login/       # Login + forgot password pages
    admin/              # Admin panel (users & posts)
    groups/             # Groups list + group feed
    profile/            # Profile + change password
    api/                # API routes
    share/[token]/      # Public share preview page
    forgot-password/    # Lockout help page
  components/           # Reusable UI components
  lib/                  # DB, auth, utils
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
