#!/bin/sh
# Run this once after first deployment to create database tables
# Usage: bash migrate.sh

echo "Running database migrations..."
sudo docker run --rm \
  --network dropzone-app_default \
  -e DATABASE_URL=postgresql://dropzone:dropzone_pass@dropzone-db:5432/dropzone \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/prisma.config.ts:/app/prisma.config.ts \
  node:20-alpine \
  sh -c "cd /app && npm install prisma@7.8.0 && ./node_modules/.bin/prisma migrate deploy"
echo "Migrations complete!"
