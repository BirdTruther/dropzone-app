FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate Prisma client from schema before building
RUN npx prisma generate && npm run build

# Build JxrDecApp/JxrEncApp from jxrlib source so ImageMagick can decode JXR files.
# The Makefile defines CFLAGS with = (not ?=), so command-line CFLAGS overrides it
# entirely. We must supply the full original CFLAGS plus -fpermissive so GCC 15
# doesn't reject the C89-era implicit pointer casts as hard errors.
# Binaries are output to /jxrlib/build/ (not /jxrlib/JxrDecApp/ etc.)
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

# Install Python + pip + yt-dlp (always latest) + ffmpeg for video processing
# Install imagemagick for image conversion (JXR support via JxrDecApp below)
RUN apk add --no-cache python3 py3-pip ffmpeg imagemagick \
  && pip3 install --break-system-packages --no-cache-dir --upgrade yt-dlp

# Copy JxrDecApp/JxrEncApp binaries built from source (required by ImageMagick for JXR)
COPY --from=jxrlib /usr/local/bin/JxrDecApp /usr/local/bin/JxrDecApp
COPY --from=jxrlib /usr/local/bin/JxrEncApp /usr/local/bin/JxrEncApp

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
