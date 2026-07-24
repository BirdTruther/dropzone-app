#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --skip-generate

echo "Starting server..."
exec node server.js
