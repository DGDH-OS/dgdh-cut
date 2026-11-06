# DGDH CUT web: production image (build context = repo root). No secrets baked in:
# build-time values below are non-secret placeholders so env validation passes; real values
# arrive at runtime (Coolify / compose env). See docs/DEPLOY.md.
FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile
COPY apps/web/ apps/web/

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-placeholder" \
    UPSTASH_REDIS_REST_URL="http://localhost:8079" \
    UPSTASH_REDIS_REST_TOKEN="build-placeholder" \
    NEXT_PUBLIC_SITE_URL="https://studio.dgdh-os.com" \
    NEXT_PUBLIC_MARBLE_API_URL="https://api.marblecms.com" \
    MARBLE_WORKSPACE_KEY="build-placeholder" \
    FREESOUND_CLIENT_ID="build-placeholder" \
    FREESOUND_API_KEY="build-placeholder"
WORKDIR /app/apps/web
RUN bun run build

FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
CMD ["bun", "apps/web/server.js"]
