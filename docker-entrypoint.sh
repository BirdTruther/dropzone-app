#!/bin/sh
set -e

echo "Running database migrations..."
# Invoke Prisma directly via node rather than the .bin shim.
# The .bin/prisma file is copied as a plain script (not a symlink) in the
# runner stage, so its internal __dirname-based WASM asset resolution points
# to node_modules/.bin/ instead of node_modules/prisma/build/, causing:
#   ENOENT: no such file or directory, open '.../.bin/prisma_schema_build_bg.wasm'
# Calling node directly against the real entry point avoids this entirely.
# Use migrate deploy (not db push) because committed migrations exist.
#
# Prisma 7: prisma.config.ts is TypeScript and not compiled into the runner
# stage, so prisma migrate deploy cannot read datasource.url from it.
# Passing --url directly uses the DATABASE_URL env var from the container.
node node_modules/prisma/build/index.js migrate deploy --url "$DATABASE_URL"

echo "Starting server..."
exec node server.js
