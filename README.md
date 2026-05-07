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
- 🎬 Video & image uploads (100MB max per file, 20GB total)
- ♾️ Uploads kept indefinitely — no expiry
- ❤️ Emoji reactions on posts
- 👥 Private invite-only groups
- 🗑️ Authors can delete their own posts
- 📱 PWA — installable on iOS and Android
- 🌙 Dark mode

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
    (auth)/login/       # Login page
    groups/             # Groups list + group feed
    api/                # API routes
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
