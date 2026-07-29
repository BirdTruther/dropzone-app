#!/bin/sh
set -e

echo "Running database migrations..."
# Use the local Prisma CLI directly rather than npx so the minimal Alpine
# runner image does not need a global prisma install or network access.
./node_modules/.bin/prisma db push --skip-generate

echo "Starting server..."
exec node server.js
