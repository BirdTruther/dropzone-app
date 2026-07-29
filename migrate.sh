#!/bin/sh
# Run this to manually trigger migrations against the live database.
# Usage: bash migrate.sh
# Run from the directory containing this file on your Cosmos host.

echo "Running database migrations..."
docker run --rm \
  --network dropzone-app_default \
  -e DATABASE_URL=postgresql://dropzone:dropzone_pass@dropzone-db:5432/dropzone \
  -v "$(pwd)/prisma:/app/prisma" \
  node:20-alpine \
  sh -c "cd /app && npm install --save-dev prisma@7 && ./node_modules/.bin/prisma migrate deploy"
echo "Done!"
