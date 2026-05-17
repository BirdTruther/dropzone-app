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

FROM node:20-alpine AS runner
WORKDIR /app

# Install Python + pip + yt-dlp + ffmpeg for Facebook video downloads
RUN apk add --no-cache python3 py3-pip ffmpeg \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
