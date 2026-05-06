# Dropzone App

A private group link-sharing web app. Share links with friends and couples, get rich previews, react to posts.

## Stack
- **Next.js 14** (App Router)
- **PostgreSQL** (via Docker)
- **Prisma ORM**
- **NextAuth.js** (credentials auth)
- **open-graph-scraper** (link previews)
- **Docker Compose** (app + database)

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
