# Stage 1: Base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma/ ./packages/db/prisma/
RUN pnpm install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @applybot/db generate
RUN pnpm --filter @applybot/shared build
RUN pnpm --filter @applybot/api build

# Stage 4: Runner (production)
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget
RUN addgroup -g 1001 nodejs && adduser -S -u 1000 applybot -G nodejs

WORKDIR /app

COPY --from=builder --chown=applybot:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=applybot:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=applybot:nodejs /app/packages/db/package.json ./packages/db/
COPY --from=builder --chown=applybot:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=applybot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=applybot:nodejs /app/package.json ./
COPY --from=builder --chown=applybot:nodejs /app/pnpm-workspace.yaml ./

USER applybot
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
