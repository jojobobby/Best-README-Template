# Stage 1: Dependencies (using node for install, not playwright base — save time)
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma/ ./packages/db/prisma/
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @applybot/db generate
RUN pnpm --filter @applybot/shared build
RUN pnpm --filter @applybot/worker build

# Stage 3: Runner (Playwright base image has Chromium pre-installed)
# NOTE: Playwright image is ~1.5GB — unavoidable for headless Chrome support
FROM mcr.microsoft.com/playwright:v1.44.0-jammy AS runner
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 1001 nodejs && useradd -u 1000 -g nodejs -m applybot

WORKDIR /app

COPY --from=builder --chown=applybot:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=applybot:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/db/package.json ./packages/db/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=applybot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=applybot:nodejs /app/package.json ./
COPY --from=builder --chown=applybot:nodejs /app/pnpm-workspace.yaml ./

# Playwright browsers are pre-installed in the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

USER applybot

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/worker/dist/index.js"]
