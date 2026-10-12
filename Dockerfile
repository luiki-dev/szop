# Szop's container image: the API and the built SPA in one image (ADR 0008,
# decision 12; details in ADR 0028).

# One pin for every stage. Dependabot bumps the digest; Node's major changes
# on purpose, with .nvmrc and engines (audit m13).
FROM node:24-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66 AS base
WORKDIR /app
# pnpm through Corepack, at the version of packageManager in package.json.
# Only the shims: pnpm itself is downloaded in the manifests stage.
RUN corepack enable

# The workspace manifests, enough for pnpm to install, so a source change
# does not invalidate the install layers.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/
RUN corepack install

# The SPA: every dependency, then the production build, whose first-screen
# budget check runs here too (NFR-3).
FROM manifests AS build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @szop/web build

# The API's production dependencies. pnpm links @szop/shared to
# packages/shared, outside node_modules, where Node strips its types; a copy
# inside node_modules would stop the API from starting (OP-084).
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter "@szop/api..."

# What runs: no pnpm, no development dependencies, no tests. Files stay owned
# by root, so the node user cannot change its own code.
FROM base
ENV NODE_ENV=production
ENV WEB_ROOT=/app/apps/web/dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY apps/api/package.json ./apps/api/
COPY apps/api/src ./apps/api/src
# The migrations, with meta/_journal.json, which every start reads (OP-078).
COPY apps/api/drizzle ./apps/api/drizzle
# The RDS certificate authorities, for the pool's TLS from PH-12 (OP-017).
COPY apps/api/certs ./apps/api/certs
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
WORKDIR /app/apps/api
EXPOSE 3000
# Node strips the types itself (ADR 0023, decision 1) and handles SIGTERM.
CMD ["node", "src/server.ts"]
