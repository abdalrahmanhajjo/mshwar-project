# syntax=docker/dockerfile:1
# Build from the repository root:  docker build -f apps/web/Dockerfile .
# The build needs the pnpm workspace and mshwar-brand-foundation (token generation).
FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter web...

FROM deps AS builder
# Inlined at build time; server-side calls and the /api rewrite use it.
ARG NEXT_PUBLIC_API_URL=http://api:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY mshwar-brand-foundation ./mshwar-brand-foundation
COPY apps/web ./apps/web
RUN pnpm --filter web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# The bundled npm and corepack carry every HIGH/CRITICAL advisory Trivy flags
# here (pacote, sigstore, tar, ip-address, brace-expansion, picomatch) — none
# are ours; they are not in pnpm-lock.yaml. The server is started with
# `node server.js`, so no package manager belongs in the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
