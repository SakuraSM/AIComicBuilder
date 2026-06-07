FROM node:20.20.1-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install ffmpeg with libass for subtitle burn-in, and fonts for CJK subtitles
RUN apk add --no-cache ffmpeg font-noto-cjk

# --- Dependencies ---
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM deps AS builder
COPY . .
RUN pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="postgres://postgres:postgres@postgres:5432/aicomic"
ENV AUTH_COOKIE_NAME="ai_comic_session"
ENV SESSION_TTL_DAYS="30"
ENV STORAGE_DRIVER="local"
ENV UPLOAD_DIR="/app/uploads"

CMD ["node", "server.js"]
