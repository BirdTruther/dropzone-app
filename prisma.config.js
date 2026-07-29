'use strict';
// Pre-compiled version of prisma.config.ts for use in the Docker runner stage.
// prisma.config.ts (TypeScript) is not compiled into the runner, so Prisma 7
// cannot load it at runtime. This plain-JS equivalent is copied into the image
// and passed to `prisma migrate deploy --config ./prisma.config.js`.
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
