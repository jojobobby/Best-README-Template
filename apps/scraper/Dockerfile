# Stage 1: Base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/scraper/package.json ./apps/scraper/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma/ ./packages/db/prisma/
RUN pnpm install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/scraper/node_modules ./apps/scraper/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @applybot/db generate
RUN pnpm --filter @applybot/shared build
RUN pnpm --filter @applybot/scraper build

# Stage 4: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 nodejs && adduser -S -u 1000 applybot -G nodejs

WORKDIR /app

COPY --from=builder --chown=applybot:nodejs /app/apps/scraper/dist ./apps/scraper/dist
COPY --from=builder --chown=applybot:nodejs /app/apps/scraper/package.json ./apps/scraper/
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/db/package.json ./packages/db/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=applybot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=applybot:nodejs /app/package.json ./
COPY --from=builder --chown=applybot:nodejs /app/pnpm-workspace.yaml ./

USER applybot

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/scraper/dist/index.js"]
