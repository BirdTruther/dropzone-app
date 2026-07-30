FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy DATABASE_URL so prisma generate can validate the schema at build time.
# The real value is injected at container runtime via the compose environment.
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL
RUN node node_modules/prisma/build/index.js generate && npm run build

FROM node:20-alpine AS jxrlib
RUN apk add --no-cache git gcc g++ make musl-dev \
  && git clone --depth 1 https://github.com/4creators/jxrlib.git /jxrlib \
  && cd /jxrlib \
  && make -j$(nproc) \
       CFLAGS="-I. -Icommon/include -Iimage/sys -D__ANSI__ -DDISABLE_PERF_MEASUREMENT -w -O -fpermissive" \
  && cp /jxrlib/build/JxrDecApp /usr/local/bin/JxrDecApp \
  && cp /jxrlib/build/JxrEncApp /usr/local/bin/JxrEncApp \
  && chmod +x /usr/local/bin/JxrDecApp /usr/local/bin/JxrEncApp

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg imagemagick imagemagick-tiff openssl \
  && pip3 install --break-system-packages --no-cache-dir --upgrade yt-dlp

COPY --from=jxrlib /usr/local/bin/JxrDecApp /usr/local/bin/JxrDecApp
COPY --from=jxrlib /usr/local/bin/JxrEncApp /usr/local/bin/JxrEncApp

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md

RUN mkdir -p public/uploads

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000

CMD ["sh", "docker-entrypoint.sh"]
