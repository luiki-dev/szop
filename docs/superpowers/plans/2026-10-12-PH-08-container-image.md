# PH-08 Container Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** one container image holds the API and the built SPA, runs as the non-root `node` user with a read-only root filesystem, and starts next to PostgreSQL through a Compose profile; `pnpm check:image` proves it locally, and a `docker` job in CI builds it with BuildKit's cache and runs the same check on every code PR.

**Architecture:** a three-stage `Dockerfile` on one pinned `base` (`node:24-trixie-slim@sha256:…` with Corepack): `build` installs the workspace and runs the web build, `prod-deps` installs the API's production dependencies with pnpm's symlinks, and the final stage copies those outputs and the API's runtime files, then runs `node src/server.ts` as `node` from `/app/apps/api`. An `app` service in `compose.yaml` under the `app` profile runs the image; `scripts/check-image.sh` starts it with `--wait`, checks the user and that `/` serves HTML, and prints the logs on failure. CI adds a `docker` job; Dependabot adds the `docker` ecosystem.

**Tech Stack:** Docker 29 with BuildKit (buildx 0.35 locally), `node:24-trixie-slim` (Node 24.21.0, Corepack 0.36.0, Debian 13), pnpm 12.8.1, PostgreSQL 18.6 from `compose.yaml`, bash, GitHub Actions with `docker/setup-buildx-action` v4.4.1 and `docker/build-push-action` v7.4.0.

**Spec:** `docs/superpowers/specs/2026-10-12-PH-08-container-image-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked, and what is not](#facts-checked-and-what-is-not)
- [Task 1: The image](#task-1-the-image)
- [Task 2: Running and checking it](#task-2-running-and-checking-it)
- [Task 3: The docker job in CI](#task-3-the-docker-job-in-ci)
- [Task 4: Dependabot's docker entry](#task-4-dependabots-docker-entry)
- [Task 5: The guides](#task-5-the-guides)
- [Task 6: The records](#task-6-the-records)
- [After tasks 1–6: open the PR](#after-tasks-16-open-the-pr)

## Global Constraints

- Branch `feat/ph-08-container-image`, holding the spec and plan commits; never commit to `main`; no worktree (`CLAUDE.md`, git workflow). Before any `git switch`, run `git status -sb`: another session may own the checkout.
- **After each task:** once it is committed (and, when executed subagent-driven, its review has passed), `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **The base image, exactly:** `node:24-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`, the multi-platform index digest (linux/amd64 and linux/arm64), written **once**, in the `base` stage. Every other stage is `FROM base` or `FROM manifests` (spec, decision 7).
- **No `# syntax=` line** in the Dockerfile: Docker 29's built-in Dockerfile frontend supports `RUN --mount=type=cache`, and a `# syntax=docker/dockerfile:1` line would pull an unpinned frontend image on every build.
- **The image's tag is `szop:local`**, locally and in CI. **The host port is 8080** (`127.0.0.1:8080:3000`); the container listens on 3000.
- **What the image sets, exactly:** `NODE_ENV=production` and `WEB_ROOT=/app/apps/web/dist`. Nothing else; every other setting comes from Compose (spec, decision 9).
- **The API's code is not changed.** The only change under `apps/api` besides the new `certs/` folder is moving `@szop/shared` from `devDependencies` to `dependencies` (spec, decision 8).
- **No `pnpm install` on the CI runner in the `docker` job**, and no `id-token` permission ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **Actions pinned by full commit SHA with the version in a comment:** `docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1`, `docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0` (both over a week old), and the checkout pin already in `ci.yml`.
- **`allowBuilds` is the owner's decision:** if `pnpm install` stops with `ERR_PNPM_IGNORED_BUILDS`, stop and show the owner the message ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18). Moving a workspace package is not expected to trigger it.
- **Docker must be running** (Docker Desktop with WSL integration), and **PostgreSQL** (`docker compose up -d --wait`) with `apps/api/.env` present, for `pnpm test` and `pnpm test:e2e`.
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test`; from Task 2 on, also `pnpm check:image`. The pre-commit hook formats staged files.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list in `commitlint.config.js` (read it before committing): code here is `build` or `ci`, without a scope; docs are `docs`, `docs(adr)` or `docs(roadmap)`. **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch prompt), not the orchestrating model:
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines, kept in sync; an ADR that refines or completes another is noted in three places.
- **GitHub first** for open points and the phase's issue ([ADR 0027](../../decisions/0027-open-points-on-github.md)): the issues are the only home of the open points; there is no register to mirror. Inside issue bodies, a phase or open point is written `PH-09 (#38)`, every other link points at the file on `main` ([project tracking](../../development/project-tracking.md#links-inside-issue-bodies)).
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its check in the owning task.

1. **`pnpm check:image` while `pnpm dev` or `pnpm start` runs on port 3000:** the check must still pass, since the image publishes on 8080 and talks to the same PostgreSQL. Check: Task 2, step 6.
2. **`pnpm check:image` with PostgreSQL stopped:** Compose starts it through `depends_on` and the check passes; afterwards PostgreSQL is still running and no `app` container is left (`docker compose ps -a`). Check: Task 2, step 5.
3. **A failed check leaves nothing behind and says why:** after a failure, the `app` container is removed, the app's logs were printed, and the exit code is 1. Check: Task 2, step 7.
4. **Secrets in the build context:** `apps/api/.env` (with the local password) must not reach the image, while `.env.example` files may. Check: Task 1, step 7.
5. **The API imports `@szop/shared` one day:** the image must resolve it through the symlink, not through a copy. Check: Task 1, step 8.

## Facts checked, and what is not

Checked on 2026-10-12 with throwaway containers outside the repository's build (the repository mounted read-only into `node:24-trixie-slim`):

- **The digest:** `node:24-trixie-slim` and `node:24.21.0-trixie-slim` both resolve to the index `sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`, created 2026-10-06, with linux/amd64 and linux/arm64 manifests. It holds Node v24.21.0 (meets `engines` `>=24.12 <25`) and Corepack 0.36.0; the `node` user is uid 1000. It is six days old, one short of Dependabot's seven-day cooldown; Dependabot's first `docker` PR moves it on anyway.
- **Corepack and pnpm 12:** after `corepack enable`, the first `pnpm` call downloads "the pnpm 12.8.1 binary for linux-x64" from `packageManager`, without a prompt in a non-interactive build. `corepack install` in the `manifests` stage downloads it once for both install stages.
- **The store:** as root, `pnpm store path` is `/root/.local/share/pnpm/store/v11`; the cache mount's target is `/root/.local/share/pnpm/store`.
- **`pnpm install --prod --frozen-lockfile --filter "@szop/api..."`** with only the manifests copied installs 86 packages into `node_modules/.pnpm`, with symlinks in `apps/api/node_modules`. **With `@szop/shared` still a development dependency, `apps/api/node_modules/@szop` does not exist** (spec, decision 8). With it moved to `dependencies` (and the lockfile updated to match), `apps/api/node_modules/@szop/shared -> ../../../../packages/shared`, and **`packages/shared/node_modules/zod` exists** as a symlink into `node_modules/.pnpm`, so the final stage copies `packages/shared/node_modules` too.
- **`--frozen-lockfile` refuses** a `package.json` that the lockfile does not reflect, so the lockfile must be updated with the move (Task 1, step 1).
- **`docker/setup-buildx-action` v4.4.1** (2026-09-16) is `f87e5991a6d7451dcb8d9637bfbc97413f497069`; **`docker/build-push-action` v7.4.0** (2026-09-15) is `c3c9e263c25d99ce0380d002d59b67737d91b0dc`.

**Not checked; each is a step below that runs the thing first:**

- The full build, `vite build` inside it with the test files left out of the context, and the image's size: Task 1, step 6.
- Whether Node needs the root `package.json` at run time (expected not: `apps/api/package.json` and `packages/shared/package.json` each say `"type": "module"`): Task 2, step 4.
- The healthcheck's `node -e fetch` and the read-only root filesystem: Task 2, step 4.
- The `docker` job on GitHub's runner, the cache and the job's time, cold and warm: only once the PR is open ([After tasks 1–6](#after-tasks-16-open-the-pr)).

---

### Task 1: The image

**Files:**
- Modify: `apps/api/package.json` (move `@szop/shared`), `pnpm-lock.yaml` (by `pnpm install`)
- Create: `apps/api/certs/rds-global-bundle.pem`, `.dockerignore`, `Dockerfile`

**Interfaces:**
- Consumes: the workspace as it is: `apps/api/src/server.ts`, `apps/api/drizzle/` with `meta/_journal.json`, `apps/web`'s `build` script (`vite build`, writing `apps/web/dist`).
- Produces: `docker build -t szop:local .` builds an image that runs `node src/server.ts` as `node` from `/app/apps/api`, with `WEB_ROOT=/app/apps/web/dist`. Task 2 runs it; Task 3 builds it in CI with the same context.

- [x] **Step 1: Move `@szop/shared` to the API's `dependencies`**

In `apps/api/package.json`, delete `"@szop/shared": "workspace:*",` from `devDependencies` and add it to `dependencies` in alphabetical order:

```json
  "dependencies": {
    "@fastify/helmet": "^13.1.2",
    "@fastify/static": "^10.1.5",
    "@szop/shared": "workspace:*",
    "drizzle-orm": "^0.45.3",
```

Then refresh the lockfile and check that only the API's importer changed:

```bash
pnpm install
git diff --stat pnpm-lock.yaml
git diff pnpm-lock.yaml
```

Expected: `pnpm install` succeeds; the lockfile diff moves `'@szop/shared'` from `devDependencies` to `dependencies` under `importers: apps/api` and nothing else.

- [x] **Step 2: The RDS certificate bundle**

```bash
mkdir -p apps/api/certs
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o apps/api/certs/rds-global-bundle.pem
grep -c 'BEGIN CERTIFICATE' apps/api/certs/rds-global-bundle.pem
sha256sum apps/api/certs/rds-global-bundle.pem
openssl crl2pkcs7 -nocrl -certfile apps/api/certs/rds-global-bundle.pem | openssl pkcs7 -print_certs -noout | grep -c '^subject='
```

Expected: a count of certificates (around 100) and the same number of subjects; note the count, the SHA-256 and today's date for ADR 0028 (Task 6). Every subject names `Amazon RDS`; if it is not a PEM file of certificates, stop and report. Do not edit the file: `.gitattributes` stores it with LF endings, and Prettier does not format `.pem` files.

- [x] **Step 3: The build context**

Create `.dockerignore`:

```
# What the image never needs (ADR 0028). Keeping it out also keeps the build
# context small and the COPY . . layer stable.

# Version control, editors and Claude Code
.git
.github
.claude
.superpowers
.husky
.vscode

# Installed and built on the host; the image installs and builds its own
**/node_modules
**/dist
coverage
e2e/playwright-report
e2e/test-results

# Local settings with passwords; the examples are harmless
**/.env
**/.env.*
!**/.env.example

# Docs and tests: not run in the image
docs
**/*.test.ts
**/*.test.tsx
apps/api/src/test
```

- [x] **Step 4: The Dockerfile**

Create `Dockerfile`:

```dockerfile
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
```

- [x] **Step 5: Build it**

```bash
docker build -t szop:local .
```

Expected: the build passes; the `build` stage's log shows `first-screen JavaScript: … KB Brotli of 200.0 KB`. If `pnpm install --frozen-lockfile` fails on the lockfile, step 1 was not completed. If `vite build` fails because a test file is missing from the context, the web app imports one outside a test: stop and report.

- [x] **Step 6: Look inside the image**

```bash
docker image ls szop:local --format '{{.Size}}'
docker run --rm --entrypoint sh szop:local -c '
  id; pwd; echo "WEB_ROOT=$WEB_ROOT NODE_ENV=$NODE_ENV"
  ls -la /app /app/apps /app/apps/api /app/apps/api/drizzle/meta /app/apps/web/dist
  ls -la /app/apps/api/node_modules/@szop
  find /app -path /app/node_modules -prune -o \( -name "*.test.ts" -o -name "*.test.tsx" -o -name ".env" -o -name "*.tsx" \) -print
  ls /app/apps/web 2>&1; ls /app/e2e 2>&1
  ls /root/.local/share/pnpm 2>&1; ls /root/.cache/node/corepack 2>&1
  test -w /app/apps/api/src && echo "WRITABLE (wrong)" || echo "read-only to node"
  ls -la /app/apps/api/certs'
```

Expected: `uid=1000(node)`; `/app/apps/api`; `WEB_ROOT=/app/apps/web/dist NODE_ENV=production`; `drizzle/meta/_journal.json` present; `index.html` and `assets/` in `dist`; `shared -> ../../../../packages/shared`; the `find` prints nothing; `/app/apps/web` holds only `dist`; `/app/e2e` does not exist; no pnpm store and no Corepack cache; `read-only to node`; the bundle present. Note the size for the PR description.

- [x] **Step 7: No secrets in the image** (Review Focus 4)

```bash
test -f apps/api/.env && echo "apps/api/.env exists locally"
docker run --rm --entrypoint sh szop:local -c 'find / -xdev \( -name ".env" -o -name ".env.*" \) 2>/dev/null; echo done'
docker history --no-trunc szop:local | grep -i -E 'password|secret' || echo "no secrets in the history"
```

Expected: the local `.env` exists, yet `find` prints only `done` (an `.env.example` would be harmless, but none is copied to the final stage), and the history has no secret.

- [x] **Step 8: The symlinked workspace resolves** (Review Focus 5)

```bash
docker run --rm --entrypoint node szop:local --input-type=module -e '
  const shared = await import("@szop/shared");
  await import("fastify"); await import("drizzle-orm"); await import("pg");
  console.log("resolved", Object.keys(shared).length > 0 ? "shared exports" : "shared is empty");
  console.log(import.meta.resolve("@szop/shared"));'
```

Expected: `resolved …` and a URL under `file:///app/packages/shared/src/`, not under `node_modules`. An `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` here means the workspace was copied into `node_modules`: stop and report.

- [x] **Step 9: All checks, tick, commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/package.json pnpm-lock.yaml apps/api/certs .dockerignore Dockerfile docs/superpowers/plans/2026-10-12-PH-08-container-image.md
git commit -F - <<'EOF'
build: add the container image

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push -u origin feat/ph-08-container-image
```

---

### Task 2: Running and checking it

**Files:**
- Modify: `compose.yaml` (the `app` service), `package.json` (the `check:image` script)
- Create: `scripts/check-image.sh` (executable)

**Interfaces:**
- Consumes: `szop:local` and the `Dockerfile` of Task 1; the `postgres` service of `compose.yaml`.
- Produces: `scripts/check-image.sh [--no-build]`, exit 0 when the image is healthy, its user is not root and `/` serves HTML; exit 1 with the app's logs otherwise. The `app` container is always removed; PostgreSQL is left running. Task 3 calls it with `--no-build`.

- [x] **Step 1: Write the check and see it fail**

Create `scripts/check-image.sh`:

```bash
#!/usr/bin/env bash
# Starts the container image next to PostgreSQL and checks that it serves
# (ADR 0028). Locally: pnpm check:image, which builds the image first. CI
# passes --no-build to use the image its build step loaded.
set -euo pipefail
cd "$(dirname "$0")/.."

build=--build
if [[ "${1:-}" == --no-build ]]; then build=--no-build; fi

compose=(docker compose --profile app)

# Always remove the app's container; PostgreSQL keeps running.
cleanup() { "${compose[@]}" rm --stop --force app > /dev/null 2>&1 || true; }
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  echo "--- the app's logs ---" >&2
  "${compose[@]}" logs --no-color app >&2 || true
  exit 1
}

# --wait returns once the healthcheck passes: /api/health answered 200, which
# the API only does after its migrations ran (OP-078).
echo "==> Starting the image next to PostgreSQL"
"${compose[@]}" up "$build" --wait app || fail "the app did not become healthy"

echo "==> Checking that it does not run as root"
user=$(docker inspect --format '{{.Config.User}}' szop:local) || fail "cannot inspect szop:local"
[[ "$user" == node ]] || fail "the image's user is '$user', not node"
uid=$("${compose[@]}" exec -T app id -u) || fail "cannot run id in the app"
[[ "$uid" != 0 ]] || fail "the app runs as root"

# A wrong WEB_ROOT keeps /api/health at 200 while / answers a plain-text 404
# (OP-084).
echo "==> Checking that / serves the app"
read -r status type < <(curl --silent --output /dev/null \
  --write-out '%{http_code} %{content_type}\n' http://127.0.0.1:8080/) || fail "GET / did not answer"
[[ "$status" == 200 ]] || fail "GET / answered $status, not 200"
[[ "$type" == text/html* ]] || fail "GET / answered '$type', not text/html"

echo "OK: the image starts, migrates, runs as $user (uid $uid) and serves the app"
```

```bash
chmod +x scripts/check-image.sh
scripts/check-image.sh; echo "exit $?"
```

Expected: `FAIL: the app did not become healthy` (Compose reports `no such service: app`), the logs header, and `exit 1`.

- [x] **Step 2: The app service**

In `compose.yaml`, after the `postgres` service and before `volumes:`, add:

```yaml
  # The container image (ADR 0028), started only with --profile app, so
  # `docker compose up` alone still starts PostgreSQL only. pnpm check:image
  # starts it and checks it.
  app:
    profiles: [app]
    build: .
    image: szop:local
    depends_on:
      postgres:
        condition: service_healthy
    # Every setting the image does not set itself (it sets WEB_ROOT and
    # NODE_ENV). Inside the container the API listens on every interface, so
    # Docker's port mapping reaches it; the published port stays on the host's
    # 127.0.0.1.
    environment:
      HOST: 0.0.0.0
      PORT: "3000"
      LOG_LEVEL: info
      DATABASE_HOST: postgres
      DATABASE_PORT: "5432"
      DATABASE_NAME: szop
      DATABASE_USER: szop
      DATABASE_PASSWORD: szop
      TRUSTED_PROXIES: none
    # 8080 on the host, so pnpm dev and pnpm start keep 3000.
    ports:
      - "127.0.0.1:8080:3000"
    # The API writes nothing to disk (logs go to stdout), as ECS's
    # readonlyRootFilesystem will require.
    read_only: true
    # The slim image has no curl, so Node itself asks for /api/health.
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))",
        ]
      interval: 2s
      timeout: 2s
      retries: 15
```

Update the file's first comment line to `# PostgreSQL for local development and CI (ADR 0005, decision 4; ADR 0020), and the container image under the app profile (ADR 0028).`

Check that the default services are unchanged:

```bash
docker compose config --services
docker compose --profile app config --services
```

Expected: `postgres` alone, then `postgres` and `app`.

- [x] **Step 3: The pnpm script**

In the root `package.json`, add after `"test:e2e:report"`:

```json
    "check:image": "scripts/check-image.sh",
```

- [x] **Step 4: See the check pass**

```bash
pnpm check:image; echo "exit $?"
docker compose ps -a
```

Expected: the build (mostly cached), `==>` lines, `OK: the image starts, migrates, runs as node (uid 1000) and serves the app`, `exit 0`; `docker compose ps -a` lists `postgres` only. If the API fails to start without the root `package.json`, add `COPY package.json ./` to the final stage, note it for the ADR, and rerun. If the healthcheck never passes, run `docker compose --profile app up app` in the foreground and read the error.

- [x] **Step 5: With PostgreSQL stopped** (Review Focus 2)

```bash
docker compose stop postgres
pnpm check:image; echo "exit $?"
docker compose ps -a
```

Expected: `exit 0`; afterwards `postgres` is running and healthy, and no `app` container is listed.

- [x] **Step 6: Next to `pnpm start`** (Review Focus 1)

```bash
pnpm build
(pnpm start > "$CLAUDE_JOB_DIR/tmp/api.log" 2>&1 &) ; sleep 3
curl -s http://127.0.0.1:3000/api/health; echo
pnpm check:image; echo "exit $?"
pkill -f "node --env-file=.env src/server.ts"; sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/health || true
```

Expected: the health JSON from the local API, then `exit 0` from the check, then the local API stopped (`000`). If `$CLAUDE_JOB_DIR` is unset, use a file under `/tmp` with a unique name.

- [x] **Step 7: See it fail for the right reasons** (Review Focus 3; spec, success criteria)

Each probe is undone before the next; none is committed.

a) **A missing migrations journal:** add the line `apps/api/drizzle/meta/_journal.json` at the end of `.dockerignore`, then:

```bash
pnpm check:image; echo "exit $?"; docker compose ps -a
```

Expected: `FAIL: the app did not become healthy`, the logs show the error from `readJournal` (a missing `_journal.json`), `exit 1`, no `app` container left. Remove the line again (`git diff .dockerignore` shows nothing).

b) **A wrong `WEB_ROOT`:** add `WEB_ROOT: /app/apps/web/nope` to the `app` service's `environment` in `compose.yaml`, then:

```bash
pnpm check:image; echo "exit $?"; docker compose ps -a
```

Expected: the app becomes healthy, then `FAIL: GET / answered 404, not 200`, the logs show the `"root" path … must exist` warning, `exit 1`, no `app` container left. Remove the line again (`git diff compose.yaml` shows only step 2's changes).

c) **Running as root:** change the Dockerfile's `USER node` to `USER root`, then `pnpm check:image; echo "exit $?"`. Expected: `FAIL: the image's user is 'root', not node`, `exit 1`. Restore `USER node` and rebuild with `pnpm check:image` (passes).

Note each failure's first line for the task report.

- [x] **Step 8: All checks, tick, commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm check:image
git ls-files -s scripts/check-image.sh   # after git add: mode 100755
git add compose.yaml package.json scripts/check-image.sh docs/superpowers/plans/2026-10-12-PH-08-container-image.md
git ls-files -s scripts/check-image.sh
git commit -F - <<'EOF'
build: run and check the container image with Compose

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push
```

Expected: the staged script's mode is `100755`; if not, `git update-index --chmod=+x scripts/check-image.sh` before committing.

---

### Task 3: The docker job in CI

**Files:**
- Modify: `.github/workflows/ci.yml` (a `docker` job after `e2e`; `ci-ok`'s `needs`)

**Interfaces:**
- Consumes: `Dockerfile`, `.dockerignore`, `compose.yaml`'s `app` service, `scripts/check-image.sh --no-build`.
- Produces: a `docker` check on every code PR, required through `ci-ok`.

- [x] **Step 1: Add the job**

In `.github/workflows/ci.yml`, after the `e2e` job and before `commits`, add:

```yaml
  docker:
    name: docker
    needs: changes
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      # Builds without pushing (ADR 0010, decisions 7 and 10) and loads the
      # image into the runner's Docker as szop:local. The layers of every
      # stage are cached in GitHub's cache (ADR 0010, decision 9). The app's
      # dependencies are installed only inside the build, never on the runner
      # (ADR 0012, decision 18).
      - uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: .
          load: true
          push: false
          tags: szop:local
          cache-from: type=gha
          cache-to: type=gha,mode=max
      # Starts the image next to PostgreSQL from compose.yaml and checks it
      # (ADR 0028); on failure it prints the app's logs.
      - run: scripts/check-image.sh --no-build
```

Change `ci-ok`'s `needs` to:

```yaml
    needs: [changes, lint, typecheck, test, build, e2e, docker, commits, workflows]
```

- [x] **Step 2: Check the workflow locally where possible**

```bash
command -v actionlint && actionlint .github/workflows/ci.yml || echo "actionlint not installed: CI's workflows job checks it"
command -v zizmor && zizmor .github/workflows/ci.yml || echo "zizmor not installed: CI's workflows job checks it"
pnpm format:check
```

Expected: no findings where the tools are installed. If zizmor reports `cache-poisoning` for `cache-to: type=gha`, stop and report the finding to the controller rather than silencing it.

- [x] **Step 3: Tick, commit, push**

```bash
git add .github/workflows/ci.yml docs/superpowers/plans/2026-10-12-PH-08-container-image.md
git commit -F - <<'EOF'
ci: build and check the container image

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push
```

The job first runs when the PR is open ([After tasks 1–6](#after-tasks-16-open-the-pr)).

---

### Task 4: Dependabot's docker entry

**Files:**
- Modify: `.github/dependabot.yml`

**Interfaces:**
- Consumes: the `FROM` line of `Dockerfile` (Task 1).
- Produces: weekly Dependabot PRs `build(deps): …` for the Node base image's minor and patch updates and digest changes.

- [ ] **Step 1: Add the entry**

In `.github/dependabot.yml`, change the header's second line from `# Later phases add the docker and terraform ecosystems (OP-068).` to `# A later phase adds the terraform ecosystem (OP-068).`, and add at the end:

```yaml

  - package-ecosystem: docker
    # The Node base image in the Dockerfile (ADR 0028).
    directory: /
    schedule:
      interval: weekly
      day: monday
    cooldown:
      default-days: 7
    groups:
      docker:
        update-types: [minor, patch]
    # build(deps): …
    commit-message:
      prefix: build
      include: scope
    ignore:
      # Node's major changes on purpose, with .nvmrc and engines (audit m13).
      - dependency-name: node
        update-types: ["version-update:semver-major"]
```

- [ ] **Step 2: Check it**

```bash
pnpm format:check
python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/dependabot.yml')); print([u['package-ecosystem'] for u in d['updates']])"
```

Expected: `['npm', 'github-actions', 'docker-compose', 'docker']`. Dependabot validates the file on GitHub once it reaches `main`; the repository's *Insights → Dependency graph → Dependabot* tab then lists the `docker` entry (checked after the merge, noted in the PR).

- [ ] **Step 3: Tick, commit, push**

```bash
git add .github/dependabot.yml docs/superpowers/plans/2026-10-12-PH-08-container-image.md
git commit -F - <<'EOF'
ci: add Dependabot updates for the Node base image

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push
```

---

### Task 5: The guides

**Files:**
- Create: `docs/development/tools/docker.md`
- Modify: `docs/development/tools/docker-compose.md`, `docs/development/tools/dependabot.md`, `docs/architecture/stack-overview.md`, `docs/architecture/architecture.md`, `docs/architecture/threat-model.md`, `docs/development/ci-cd.md`, `docs/development/testing.md`, `docs/development/setup.md`, `docs/glossary.md`

**Interfaces:**
- Consumes: what Tasks 1–4 built, and their reports (the image's size, any deviation from the plan, the failure messages of Task 2, step 7).
- Produces: the living docs the PR and ADR 0028 link to.

Read each file before changing it and follow its existing shape and tone. Link ADR 0028 as `docs/decisions/0028-container-image-details.md` (relative from each file), which Task 6 writes.

- [ ] **Step 1: The tool page**

`docs/development/tools/docker.md`, in the shape of `docs/development/tools/playwright.md` (read it first): what Docker images and the Dockerfile are, BuildKit and its cache mounts, the build context and `.dockerignore`; **why** each choice (the spec's decisions 1, 6, 7, 9, 10 and 11, briefly, linking ADR 0028); **the Dockerfile explained stage by stage** (`base`, `manifests`, `build`, `prod-deps`, the final stage), and why `pnpm deploy` is not used; **everyday use**: `pnpm check:image`, `docker compose --profile app up --build` to run it and open `http://127.0.0.1:8080`, `docker compose --profile app down`, a shell inside (`docker compose --profile app exec app sh`), rebuilding without the cache (`docker build --no-cache -t szop:local .`); **updating the base image** (Dependabot's PRs; the digest; Node's major by hand with `.nvmrc` and `engines`); **official documentation** links (Dockerfile reference, BuildKit cache mounts, `.dockerignore`, the Node image's docs). Add a `## Contents` if it passes about 100 lines.

- [ ] **Step 2: Compose and Dependabot pages**

- `docker-compose.md`: *Configuration* describes the `app` service and the profile (only started with `--profile app`; port 8080; `read_only`; the healthcheck through Node); *Everyday use* gains `pnpm check:image` and links `docker.md`.
- `dependabot.md`: the `docker` entry, as the other entries are described (what it updates, the ignored majors, the grouping, the commit prefix); the line that says the `docker` ecosystem comes later is updated.

- [ ] **Step 3: Testing, CI/CD and setup**

- `testing.md`: *The layers today* gains the image check (what it proves: the image builds, starts next to PostgreSQL, migrates, runs as `node`, serves `/`); *Running the tests* gains `pnpm check:image`, with Docker as a prerequisite; how to read its failure (the `FAIL:` line, then the app's logs). Keep the `## Contents` in sync.
- `ci-cd.md`: *The jobs* gains `docker` (builds with BuildKit's GitHub Actions cache, loads `szop:local`, runs `scripts/check-image.sh --no-build`; no `pnpm install` on the runner); *ci-ok and the required checks* lists it; *Reading a failed run* says where the `FAIL:` line and the app's logs are; *Dependabot* lists the `docker` ecosystem. Keep the `## Contents` in sync.
- `setup.md`: in *8. Check that everything works* or *9. Run the API and the page* (whichever fits), running the image with `pnpm check:image` and `docker compose --profile app up --build`; remove the image from *11. Coming later* if it is listed there.

- [ ] **Step 4: Architecture, stack overview, threat model, glossary**

- `architecture.md`, *5. Deployment*: the image's runtime layout: `/app` with `node_modules`, `apps/api/{package.json,src,drizzle,certs,node_modules}`, `packages/shared/{package.json,src,node_modules}`, `apps/web/dist`; working directory `/app/apps/api`; `node src/server.ts` as `node`; what the image sets (`WEB_ROOT`, `NODE_ENV`) and what the runner sets.
- `stack-overview.md`: a new section *Container images* (numbered after the last, with its `## Contents` line): images and layers, the layer cache and why the manifests are copied first, multi-stage builds, why the user is not root and the files belong to root, pinning by digest versus by tag, a read-only root filesystem, PID 1 and signals. Learning-oriented, as the other sections.
- `threat-model.md`: where it lists what guards the running API (read *Entry points, checked against STRIDE* and *Risks accepted on purpose* first), add the image's guards: non-root user, code read-only to it, read-only root filesystem, no secrets in the image (settings arrive at run time), and that the image is not scanned yet ([OP-090](https://github.com/luiki-dev/szop/issues/194)). Change only what the model's structure has a place for.
- `glossary.md`: add the acronyms new to the docs, each in alphabetical order in the existing table: **CVE** (Common Vulnerabilities and Exposures), **PID** (process identifier), **SBOM** (software bill of materials) if not there, **OCI** (Open Container Initiative) if a doc uses it. Check each with `grep -n '^| \*\*NAME\*\*' docs/glossary.md` first.

- [ ] **Step 5: Check the links, tick, commit**

```bash
for f in docs/development/tools/docker.md docs/development/tools/docker-compose.md docs/development/tools/dependabot.md docs/architecture/stack-overview.md docs/architecture/architecture.md docs/architecture/threat-model.md docs/development/ci-cd.md docs/development/testing.md docs/development/setup.md docs/glossary.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
pnpm format:check
```

Expected: `link check done`, with `BROKEN` lines only for `0028-container-image-details.md`, which Task 6 creates. Then:

```bash
git add docs
git commit -F - <<'EOF'
docs: describe the container image in the guides

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push
```

---

### Task 6: The records

**Files:**
- Create: `docs/decisions/0028-container-image-details.md`
- Modify: `docs/decisions/0008-hosting.md` (status line, decision 12's cell), `docs/decisions/0010-ci-cd.md` (status line, decisions 7 and 18's cells), `docs/roadmap.md`
- GitHub: issues #37, #66, #68, #70 and their project items

**Interfaces:**
- Consumes: everything Tasks 1–5 built and reported (the bundle's count, SHA-256 and date; the image's size; any deviation from the plan).
- Produces: the records the PR links to, and the state the PR is opened from.

- [ ] **Step 1: Write ADR 0028**

`docs/decisions/0028-container-image-details.md`, in the shape of [ADR 0026](../../decisions/0026-first-e2e-journey-details.md) (read it first):

- Title `# ADR 0028 — Container image details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-12` (or the day it is written);
- `- **Completes:** [ADR 0008](0008-hosting.md), decision 12 (the exact build steps, see decisions 6 to 10); [ADR 0010](0010-ci-cd.md), decision 18 (the \`docker\` ecosystem)`;
- `- **Refines:** [ADR 0008](0008-hosting.md), decision 12 (only the SPA is built, since ADR 0023, decision 1); [ADR 0010](0010-ci-cd.md), decision 7 (the startup check is a step of the \`docker\` job, see decision 4)`.
- `## Context`: [PH-08](../roadmap.md#ph-08-container-image); ADR 0008, 0010 and 0023 set the direction; the brainstorm and the [spec](../superpowers/specs/2026-10-12-PH-08-container-image-design.md) settled the details.
- `## Decisions`: the spec's decisions 1 to 12, copied with their wording, links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Add what planning and building settled, as `<br>**Settled while building:** …` in the cells it touches: in decision 6, `corepack install` in a `manifests` stage downloads pnpm once for both install stages, and no `# syntax=` line is used; in decision 8, the probe that showed `apps/api/node_modules/@szop` missing without the move; in decision 2, the source URL, the download date, the number of certificates and the SHA-256, and how to refresh the bundle (download it to the same path, `git diff --stat`, check the subjects with `openssl`, commit as `build: refresh the RDS certificate bundle`); in decision 10, whether the root `package.json` was needed; anything Tasks 1 to 5 reported differently from the plan.
- `## Consequences`: the base image changes only through Dependabot's PRs or a deliberate Node major; every code PR builds the image (the `docker` job's time, measured in the PR); `pnpm check:image` needs Docker; PH-12 points the pool's `ssl.ca` at the bundle and sets the task definition's health check and `readonlyRootFilesystem`; PH-10's registry and the spin-up workflow push the same Dockerfile's image; the candidates [OP-089](https://github.com/luiki-dev/szop/issues/193) and [OP-090](https://github.com/luiki-dev/szop/issues/194); the open points changed (step 3); the living docs (Task 5).

- [ ] **Step 2: Note it in ADR 0008 and ADR 0010**

In the three places `CLAUDE.md` asks for (ADR 0028's header is step 1). Read each status line and cell first, and add in the same style as the notes already there:

- ADR 0008's status line: append `; decision 12 completed and refined by [ADR 0028](0028-container-image-details.md) (the exact build steps; only the SPA is built)`.
- ADR 0008, decision 12's cell, at the bottom: `<br>🧩 **Completed by [ADR 0028](0028-container-image-details.md), decisions 6 to 10:** three stages on one pinned \`node:24-trixie-slim\` base, pnpm through Corepack, the API's production dependencies with pnpm's symlinks, run as \`node\` with \`node src/server.ts\`.` then `<br>✏️ **Refined by [ADR 0028](0028-container-image-details.md), decision 6:** only the SPA is built; the API runs from its TypeScript sources ([ADR 0023](0023-production-build-and-serving-details.md), decision 1).`
- ADR 0010's status line: append `; decision 7 refined and decision 18 completed by [ADR 0028](0028-container-image-details.md) (the startup check is a step of the \`docker\` job; the \`docker\` ecosystem)`.
- ADR 0010, decision 7's cell, at the bottom: `<br>✏️ **Refined by [ADR 0028](0028-container-image-details.md), decision 4:** the \`docker\` job also starts the image next to PostgreSQL and checks it, with \`scripts/check-image.sh\`.`
- ADR 0010, decision 18's cell, at the bottom: `<br>🧩 **Completed by [ADR 0028](0028-container-image-details.md):** the \`docker\` ecosystem updates the Node base image, ignoring its majors.`

Check which notes the cells already carry and keep them oldest first.

- [ ] **Step 3: Change the issues on GitHub first**

Read each issue's body before editing (`gh issue view N --repo luiki-dev/szop`) and keep its sections; write bodies through a file under `$CLAUDE_JOB_DIR/tmp` with `gh issue edit N --repo luiki-dev/szop --body-file <file>`. Links inside bodies follow [project tracking](../../development/project-tracking.md#links-inside-issue-bodies).

- **#66 (OP-013):** *Parts*: `- [x] **PH-08:** the multi-stage Dockerfile ✅ Done (<branch link until the PR exists>)`. Re-parent under PH-09 (#38).
- **#68 (OP-017):** *Parts*: `- [x] **PH-08:** the RDS certificate authority bundle in the image ✅ Done (…)`. Re-parent under PH-12 (#41).
- **#70 (OP-068):** *Parts*: `- [x] **PH-08:** \`docker\` (the Node base image), ignoring its major updates ✅ Done (…)`. Re-parent under PH-09 (#38).
- Re-parenting: `gh api -X POST repos/luiki-dev/szop/issues/<new parent>/sub_issues -F sub_issue_id="$(gh api repos/luiki-dev/szop/issues/<N> -q .id)" -F replace_parent=true`. Then set each one's project Status to ⬜ Backlog: project `PVT_kwHOEVZTps4BmW8P`, Status field `PVTSSF_lAHOEVZTps4BmW8PzhlAT9c`, option `9700a2cc`; the item IDs from `gh project item-list 3 --owner luiki-dev --format json --limit 400`.
- **#67, #69, #71, #72:** no change; the PR closes them.
- **#37 (PH-08):** *Delivers* gains `([ADR 0028](https://github.com/luiki-dev/szop/blob/main/docs/decisions/0028-container-image-details.md))`. Check that its Plan field is set (the plan commit did it).

Then confirm with `gh issue view` on each and `gh api graphql` on #37's, #38's and #41's sub-issues.

- [ ] **Step 4: The roadmap**

`docs/roadmap.md`: PH-08's *Delivers* gains `([ADR 0028](decisions/0028-container-image-details.md))`; the row's Plan column links this plan (the plan commit set it; check). The row stays `🚧 In progress`; the README diagram stays at ◐ until the PR.

- [ ] **Step 5: Walk through the definition of done**

Read `docs/development/definition-of-done.md` and note each item's state for the PR. Expected, as a forecast to check against every item: tests ✅ (the image check, a new layer, with its failure paths shown); domain rules ➖ N/A: no domain rules; CI after the PR opens; the demo check ➖ N/A: no demo environment until PH-12; `infra/base` ➖ N/A; the living docs ✅ (Task 5); the threat model ✅ (Task 5, step 4); open points ✅ (step 3); UI screenshots ➖ N/A: the UI does not change.

- [ ] **Step 6: Links, final checks and a self-review of the diff**

```bash
for f in docs/decisions/0028-container-image-details.md docs/decisions/0008-hosting.md docs/decisions/0010-ci-cd.md docs/roadmap.md README.md docs/development/tools/docker.md docs/development/testing.md docs/development/ci-cd.md docs/architecture/architecture.md docs/architecture/threat-model.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm test:e2e && pnpm check:image
git diff main --stat
```

Expected: `link check done` with no `BROKEN` line; every check passes. Read the whole diff against the spec's *Goal and success criteria*, one by one, and list any gap in the task's report.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add docs
git commit -F - <<'EOF'
docs(adr): add ADR 0028 and update the records for PH-08

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JzvABGc1EuxfBGNwqLyfVi
EOF
git push
```

---

## After tasks 1–6: open the PR

Only when the owner says so, after reviewing Task 6.

1. Run every check once more, with PostgreSQL running: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm test:e2e && pnpm check:image`.
2. Open the PR with `gh pr create`: title `build: add the container image`; the body fills `.github/pull_request_template.md`, says `Closes #37`, `Closes #67`, `Closes #69`, `Closes #71` and `Closes #72` (OP-013, OP-017 and OP-068 stay open for their next phases), lists the issue changes of Task 6, step 3 and of the brainstorm (OP-089 and OP-090 created as candidates; their bodies' links corrected), holds the definition of done as walked through in Task 6, step 5, and the image's size from Task 1, step 6.
3. Then, in one commit (`docs(roadmap): mark PH-08 done`): the PR link in PH-08's roadmap row and in the ticked parts of #66, #68 and #70 on GitHub; the row set to `✅ Done`; the README diagram's PH-08 marker `◐` → `●` ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green: `docker`, `workflows` and `ci-ok` pass. Note the `docker` job's time on the first run (cold cache) and on the push of step 3 (warm cache) in the PR description. Link the runs.
5. Stop. The owner reviews and merges.
