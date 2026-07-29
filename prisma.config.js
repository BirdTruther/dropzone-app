// prisma.config.js - Prisma 7 config for migrate deploy at runtime
// Written as plain JS so it runs in the runner stage without a TS compiler.
// PrismaPg reads DATABASE_URL from env at the time migrate deploy is called.
'use strict';
const { PrismaPg } = require('@prisma/adapter-pg');
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  earlyAccess: true,
  migrate: {
    adapter: () => {
      const connectionString = process.env.DATABASE_URL;
      return new PrismaPg({ connectionString });
    },
  },
});
