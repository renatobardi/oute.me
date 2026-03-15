FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Install all dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS build
COPY packages/ui/ ./packages/ui/
COPY apps/web/ ./apps/web/
COPY turbo.json ./
RUN pnpm run build --filter=@oute/web
RUN pnpm deploy --filter=@oute/web --prod /app/deployed

# Production
FROM node:24-slim AS runtime
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/apps/web/build ./build
COPY --from=build --chown=appuser:appgroup /app/deployed/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/deployed/package.json ./

USER appuser

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "build/index.js"]
