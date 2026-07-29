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

# Install Python + pip + yt-dlp (always latest) + ffmpeg for video processing.
# Install imagemagick + imagemagick-tiff for image conversion.
# imagemagick-tiff adds the TIFF codec module that the base imagemagick package
# omits on Alpine. Xbox/Windows 11 HDR game screenshots (.jxr) are TIFF
# containers with JXR-compressed pixel data; magick needs libtiff to open them.
RUN apk add --no-cache python3 py3-pip ffmpeg imagemagick imagemagick-tiff \
  && pip3 install --break-system-packages --no-cache-dir --upgrade yt-dlp

# Copy JxrDecApp/JxrEncApp binaries built from source (required by ImageMagick for JXR)
COPY --from=jxrlib /usr/local/bin/JxrDecApp /usr/local/bin/JxrDecApp
COPY --from=jxrlib /usr/local/bin/JxrEncApp /usr/local/bin/JxrEncApp

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy the full node_modules from the builder stage.
# Prisma v6 introduced @prisma/config which pulls in 'effect' -> 'fast-check'
# and potentially more transitive deps at CLI runtime. Copying individual
# packages one by one every time a new dep appears in the chain is
# unsustainable. The full node_modules ensures 'node node_modules/prisma/build/index.js'
# in the entrypoint always has everything it needs, regardless of Prisma version.
# The standalone Next.js bundle already contains all app runtime deps separately,
# so this only adds the Prisma CLI dependency tree used during migration.
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p public/uploads

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000

CMD ["sh", "docker-entrypoint.sh"]
