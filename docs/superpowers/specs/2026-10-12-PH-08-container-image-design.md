# PH-08 Container image — design

- **Phase:** [PH-08](../../roadmap.md#ph-08-container-image) ([#37](https://github.com/luiki-dev/szop/issues/37))
- **Date:** 2026-10-12
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-013](https://github.com/luiki-dev/szop/issues/66) (PH-08 part, then on to PH-09); [OP-015](https://github.com/luiki-dev/szop/issues/67); [OP-017](https://github.com/luiki-dev/szop/issues/68) (PH-08 part, then on to PH-12); [OP-032](https://github.com/luiki-dev/szop/issues/69); [OP-068](https://github.com/luiki-dev/szop/issues/70) (PH-08 part, then on to PH-09); [OP-078](https://github.com/luiki-dev/szop/issues/71); [OP-084](https://github.com/luiki-dev/szop/issues/72); new candidates [OP-089](https://github.com/luiki-dev/szop/issues/193) and [OP-090](https://github.com/luiki-dev/szop/issues/194)

Szop gets its container image: one image that holds the API and the built single-page application (SPA), runs as a non-root user and starts next to PostgreSQL, on the owner's machine and in CI. The direction was settled by [ADR 0008](../../decisions/0008-hosting.md), decision 12 (a multi-stage Dockerfile on a slim Node 24 image), [ADR 0010](../../decisions/0010-ci-cd.md), decisions 7, 9 and 18 (the `docker` job, BuildKit's cache, Dependabot's `docker` ecosystem) and [ADR 0023](../../decisions/0023-production-build-and-serving-details.md), decision 1 (the API is not compiled: Node strips the types of `src/server.ts` itself). This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0028.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [The Dockerfile](#the-dockerfile)
  - [What goes into the build context](#what-goes-into-the-build-context)
  - [The RDS certificate bundle](#the-rds-certificate-bundle)
  - [The app service in Compose](#the-app-service-in-compose)
  - [The startup check](#the-startup-check)
  - [The docker job in CI](#the-docker-job-in-ci)
  - [Dependabot](#dependabot)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: one image holds the API and the built SPA, runs as a non-root user and starts next to PostgreSQL, locally and in CI.

The phase is done when:

- `docker build .` produces an image whose final stage holds no pnpm store, no development dependencies, no test files and no web sources, only what the API runs and the built SPA;
- `pnpm check:image` builds the image, starts it next to PostgreSQL from `compose.yaml` with a read-only root filesystem, and passes: the container is healthy (`/api/health` answers 200, so the migrations ran), its user is not root, and `/` answers 200 with HTML;
- the check fails, with the app's logs printed, when the migrations journal is missing from the image and when `WEB_ROOT` points at a wrong folder (both shown once, locally, not committed);
- the `docker` job builds the image with BuildKit's GitHub Actions cache and runs the same check on every code PR, and `ci-ok` needs it;
- Dependabot has a `docker` entry that proposes the base image's minor and patch updates and ignores its majors;
- the RDS certificate authority bundle is in the image at `/app/apps/api/certs/rds-global-bundle.pem`;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated.

## Out of scope

- **Using the RDS bundle.** The pool's TLS settings, with full certificate verification, come with the first deploy in [PH-12](../../roadmap.md#ph-12-first-deploy) ([OP-017](https://github.com/luiki-dev/szop/issues/68)).
- **Pushing the image anywhere.** The registry is created in [PH-10](../../roadmap.md#ph-10-domain-and-base-infrastructure); the spin-up and release workflows push ([ADR 0010](../../decisions/0010-ci-cd.md), decision 10).
- **Running the E2E suite against the image**, the other option of [OP-032](https://github.com/luiki-dev/szop/issues/69): a candidate, [OP-089](https://github.com/luiki-dev/szop/issues/193) ([decision 3](#decisions-taken-in-the-brainstorm)).
- **Scanning the image or linting the Dockerfile** (Trivy, hadolint): a candidate, [OP-090](https://github.com/luiki-dev/szop/issues/194) ([decision 5](#decisions-taken-in-the-brainstorm)).
- **Supply-chain provenance** (signed attestations, a software bill of materials (SBOM)), left to a later learning phase by [ADR 0010](../../decisions/0010-ci-cd.md), decision 19.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | Base image | `node:24-trixie-slim`; `node:24-alpine`; distroless (`gcr.io/distroless/nodejs24-debian12`); hardened images (Docker Hardened Images, Chainguard) | **`node:24-trixie-slim`, pinned by digest** (`node:24-trixie-slim@sha256:…`), Debian 13. It is the official image, uses glibc like the PostgreSQL image of `compose.yaml`, has the `node` user, and Dependabot bumps both the tag and the digest. A shell helps when debugging a task. Alpine's musl is the kind of difference the PostgreSQL image avoided; distroless has no shell to debug with and no way for a health check to run anything but Node; hardened images need a vendor account or registry for a learning project. |
| 2 | Where the RDS certificate authority bundle comes from | Committed to the repository; downloaded during the build; downloaded with `ADD --checksum` | **Committed** as `apps/api/certs/rds-global-bundle.pem`, copied by the Dockerfile. It is reviewed once in a PR, the build is reproducible and needs no network for it, and a change shows up in a diff. AWS publishes no checksum, so a download trusts whatever the URL answers that day; a pinned checksum gives the same result as committing, plus a network dependency. The roots it holds last until about 2061; the ADR records the source URL and how to refresh the file. |
| 3 | How CI proves the image starts ([OP-032](https://github.com/luiki-dev/szop/issues/69)) | A startup check; the E2E suite against the image; both | **A startup check:** the image starts next to PostgreSQL, the container becomes healthy, its user is not root, and `/` answers with HTML. It covers what the open points ask for in seconds. Running the E2E suite against the image is the stronger proof but changes how PH-07's job starts the app, a second concept for the phase: it is a candidate, [OP-089](https://github.com/luiki-dev/szop/issues/193). |
| 4 | CI jobs, and how the image runs next to PostgreSQL | One `docker` job that builds, then checks; two jobs, `docker` and a start job; the check as a long `docker run` in the workflow | **One `docker` job:** it builds the image, loads it into the runner's Docker and runs the check on it. The check cannot run without the build, and the image never leaves the runner; a second job needs the image moved as an artifact (about 80 MB) or rebuilt from the cache. **The image runs as an `app` service in `compose.yaml`, under a profile,** so `docker compose up` still starts PostgreSQL only, and the same check runs locally and in CI. **Refines ADR 0010, decision 7:** the roadmap's "job proving the image starts" is a step of `docker`. |
| 5 | Scanning | None in this phase; hadolint; Trivy | **None in this phase.** The phase brings one concept, the image; Dependabot keeps the base current, the final image holds only production dependencies and runs as a non-root user. hadolint adds a pinned tool and its page; Trivy needs a threshold and an ignore list, since Debian slim images almost always carry CVEs without a fix. Both are a candidate, [OP-090](https://github.com/luiki-dev/szop/issues/194). |
| 6 | The Dockerfile's layout ([OP-015](https://github.com/luiki-dev/szop/issues/67)) | Three stages (`build`, `prod-deps`, final); one build stage pruned in place; `pnpm deploy` | **Three stages on one `base`:** `build` builds the SPA, `prod-deps` installs the API's production dependencies with pnpm's symlinks, and the final stage copies those two outputs and the API's runtime files. A web change does not invalidate the dependency layer, and the final image holds only what is copied into it on purpose. Pruning in place copies whatever the build left behind and reinstalls everything on any source change. **`pnpm deploy` is rejected:** it copies `@szop/shared` into `node_modules`, where Node refuses to strip types, so the API would fail to start ([OP-084](https://github.com/luiki-dev/szop/issues/72)). **pnpm comes from Corepack** (`corepack enable`), which reads `packageManager` from `package.json`, so the version stays in one place; `npm i -g pnpm@…` would repeat it. Corepack leaves Node in version 25, and Node's major changes on purpose (audit m13). |
| 7 | One pin or two | The final stage `FROM base`; the final stage repeating the pinned image | **One pin: every stage is `FROM base`.** The final image then carries Corepack's shims, a few symlinks inside Node's install, but no pnpm, which is only downloaded when `pnpm` first runs. Dependabot has one digest to bump. |
| 8 | `@szop/shared` in the API | Stays in `devDependencies`; moves to `dependencies` | **Moves to `dependencies`.** The API does not import it at run time yet, but `pnpm install --prod` leaves a development dependency's symlink out, so the image would fail to start the first time it does. |
| 9 | What the image sets | Everything with a sensible value; nothing; facts of the image only | **Facts of the image only:** `WEB_ROOT=/app/apps/web/dist`, where the image puts the SPA, and `NODE_ENV=production`. `HOST`, `PORT`, `LOG_LEVEL`, the `DATABASE_*` settings and `TRUSTED_PROXIES` come from whoever runs it, Compose now and ECS in PH-12, which keeps [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2: no defaults. |
| 10 | Process and file system | `node` as PID 1; `tini` or `--init`; files owned by `node` or by root | **`node` as process 1 (PID 1), without an init process:** `server.ts` handles `SIGTERM` and `SIGINT` itself and starts no child processes that could be left as zombies. **Files owned by root, read-only to `node`,** so the process cannot change its own code. Nothing in the API writes to disk: pino logs to stdout, which Docker collects. Compose runs the container with a read-only root filesystem to prove it, ready for ECS's `readonlyRootFilesystem`. |
| 11 | Health checks | A `HEALTHCHECK` in the Dockerfile; one in `compose.yaml` | **In `compose.yaml` only.** ECS ignores the Dockerfile's `HEALTHCHECK` and uses the task definition's, decided in PH-12. Compose's check runs `node -e` with `fetch`, since the slim image has no `curl`. |
| 12 | The check's language | A bash script; a Node script | **Bash, `scripts/check-image.sh`.** Its steps are Docker commands and `curl` on the host; a Node script would only wrap them. It is not unit-tested: its failure path is shown once instead, with a missing journal and a wrong `WEB_ROOT`. |

## Design

### The Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# One pin for every stage (decision 7); Dependabot bumps the digest.
FROM node:24-trixie-slim@sha256:<digest> AS base
WORKDIR /app
RUN corepack enable

# The workspace manifests: enough for pnpm to install, so a source change
# does not invalidate the install layers.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/

# The SPA: every dependency, then the production build (its budget check runs
# here too).
FROM manifests AS build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @szop/web build

# The API's production dependencies, with pnpm's symlinks kept (OP-084).
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter @szop/api...

FROM base
ENV NODE_ENV=production
ENV WEB_ROOT=/app/apps/web/dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY apps/api/package.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/certs ./apps/api/certs
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "src/server.ts"]
```

- The sketch shows the shape; the plan settles the exact lines. The [checks below](#to-verify-during-implementation) decide the store's path, whether `packages/shared/node_modules` exists after a filtered production install, and whether the root `package.json` is needed at run time.
- `drizzle/` keeps `meta/_journal.json`, which `readJournal()` reads on every `buildApp` ([OP-078](https://github.com/luiki-dev/szop/issues/71)). `migrate.ts` finds it as `../../drizzle` from `src/db/`, which holds because `apps/api/` keeps its layout.
- `COPY` without `--chown` leaves the files owned by root ([decision 10](#decisions-taken-in-the-brainstorm)).
- The pnpm store is a BuildKit cache mount, so it never lands in a layer and is reused between local builds.

### What goes into the build context

`.dockerignore` keeps out what the image must not hold or does not need, which also keeps the context small and the `COPY . .` layer stable:

```
.git
**/node_modules
**/dist
coverage
**/.env
**/.env.*
!**/.env.example
docs
e2e/playwright-report
e2e/test-results
**/*.test.ts
**/*.test.tsx
apps/api/src/test
.claude
.superpowers
.husky
.vscode
```

The `build` stage needs no test files: `vite build` only follows the imports of the app's entry. The plan lists the final entries after checking what the build needs.

### The RDS certificate bundle

`apps/api/certs/rds-global-bundle.pem` is AWS's `global-bundle.pem` from `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`, the root certificates of every region, committed as downloaded. The ADR records the source, the download date and how to refresh it (download, diff, commit). Nothing reads it yet: PH-12 points the pool's `ssl.ca` at it ([OP-017](https://github.com/luiki-dev/szop/issues/68)).

### The app service in Compose

```yaml
  # The container image (ADR 0028), started only with --profile app.
  app:
    profiles: [app]
    build: .
    image: szop:local
    depends_on:
      postgres:
        condition: service_healthy
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
    ports:
      - "127.0.0.1:8080:3000"
    read_only: true
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
      interval: 2s
      timeout: 2s
      retries: 15
```

- **`HOST: 0.0.0.0`:** inside the container, the API must listen on every interface for Docker's port mapping to reach it; the published port stays on the host's `127.0.0.1`.
- **Port 8080 on the host,** so `pnpm dev` and `pnpm start` keep 3000.
- **The development database:** locally the image migrates `szop`, as `pnpm start` does; the migrations are the same files.
- **`TRUSTED_PROXIES: none`:** nothing stands in front of the container.

### The startup check

`scripts/check-image.sh`, run locally as `pnpm check:image` and in CI with `--no-build`:

1. `docker compose --profile app up --wait app`, with `--build` unless `--no-build` is given. `--wait` returns when the health check passes, so `/api/health` answered 200, which the API only does after `runMigrations()` succeeded; a missing journal makes `buildApp` throw and the container exit, and `--wait` fails.
2. The image's user is `node` (`docker inspect`), and `id -u` inside the running container is not `0`.
3. `curl` on `http://127.0.0.1:8080/` answers 200 with a `content-type` starting with `text/html` ([OP-084](https://github.com/luiki-dev/szop/issues/72)): a wrong `WEB_ROOT` keeps `/api/health` at 200 while `/` answers a plain-text 404.
4. On any failure, it prints `docker compose logs app` and exits 1. In every case it stops and removes the `app` container at the end, and leaves PostgreSQL running.

The script uses `set -euo pipefail`, a `trap` for the cleanup, and prints each step, so a failed CI log reads like the local run.

### The docker job in CI

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
      - uses: actions/checkout@<SHA> # v…
        with:
          persist-credentials: false
      - uses: docker/setup-buildx-action@<SHA> # v…
      - uses: docker/build-push-action@<SHA> # v…
        with:
          context: .
          load: true
          push: false
          tags: szop:local
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - run: scripts/check-image.sh --no-build
```

- `ci-ok` adds `docker` to its `needs`, so it becomes required without changing GitHub's settings, as `build` and `e2e` did.
- **No `pnpm install` on the runner:** the dependencies are installed only inside the build, as [ADR 0012](../../decisions/0012-security-baseline.md), decision 18 wants for the later jobs that hold AWS credentials.
- `mode=max` caches the `build` and `prod-deps` stages too, not only the final one.
- `context: .` uses the checked-out files, so `.dockerignore` applies as it does locally.
- The `build` job stays: it reports the bundle budget without Docker. The SPA is built in both jobs, in parallel.

### Dependabot

```yaml
  - package-ecosystem: docker
    # The Node base image in the Dockerfile.
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

The header comment's "later phases add the docker and terraform ecosystems" becomes "the terraform ecosystem".

## Documentation and records

- **ADR 0028 "Container image details"**, with the decisions above. It **completes** [ADR 0008](../../decisions/0008-hosting.md), decision 12 (the exact build steps) and **refines** it (only the SPA is built, since ADR 0023, decision 1); it **refines** [ADR 0010](../../decisions/0010-ci-cd.md), decision 7 (the startup check is a step of `docker`) and **completes** decision 18 (the `docker` ecosystem). The notes go in all three places: the new ADR's header, the earlier ADRs' status lines, and a line at the bottom of each decision's cell.
- **`docs/development/tools/docker.md`** (new): what the Dockerfile, BuildKit, the build context and `.dockerignore` are, why each choice was made, the Dockerfile explained stage by stage, the `app` profile and `pnpm check:image`. `docker-compose.md` links to it and describes the `app` service.
- **`docs/architecture/stack-overview.md`:** a section on container images: layers and caching, multi-stage builds, why the user is not root, why images are pinned by digest, a read-only root filesystem.
- **`docs/architecture/architecture.md`:** the image's runtime layout (`/app`, the working directory `apps/api`, what is in it and what is not).
- **`docs/development/ci-cd.md`:** the `docker` job, its cache, and how to read a failed check.
- **`docs/development/testing.md`:** the image check as a layer, what it proves and how to run it.
- **`docs/development/setup.md`:** running the image locally with `pnpm check:image` and `docker compose --profile app up --build`.
- **`docs/development/tools/dependabot.md`:** the `docker` entry.
- **`docs/architecture/threat-model.md`:** the non-root user and the read-only file system, where it lists the guards of the running API.
- **`docs/glossary.md`:** any acronym new to the docs (PID, CVE, SBOM if not there yet).
- **GitHub first, then the docs** ([ADR 0027](../../decisions/0027-open-points-on-github.md)):
  - [#37](https://github.com/luiki-dev/szop/issues/37) is 🚧 In progress; its Spec and Plan fields set as they are committed. The roadmap's PH-08 row follows, with the README's diagram.
  - Closed by the PR: [OP-015](https://github.com/luiki-dev/szop/issues/67), [OP-032](https://github.com/luiki-dev/szop/issues/69), [OP-078](https://github.com/luiki-dev/szop/issues/71), [OP-084](https://github.com/luiki-dev/szop/issues/72).
  - The PH-08 part ticked with the PR, then re-parented, still open, ⬜ Backlog: [OP-013](https://github.com/luiki-dev/szop/issues/66) to PH-09, [OP-017](https://github.com/luiki-dev/szop/issues/68) to PH-12, [OP-068](https://github.com/luiki-dev/szop/issues/70) to PH-09.
  - New candidates, created in the brainstorm: [OP-089](https://github.com/luiki-dev/szop/issues/193) (the E2E suite against the image) and [OP-090](https://github.com/luiki-dev/szop/issues/194) (scanning the image and linting the Dockerfile).

## Tasks

1. **The image.** The Dockerfile, `.dockerignore`, the RDS bundle and `@szop/shared` in `dependencies`. `docker build .` passes, and the final image holds only what [the Dockerfile](#the-dockerfile) copies.
2. **Running and checking it.** The `app` service in `compose.yaml`, `scripts/check-image.sh` and the `check:image` script. The check passes, and fails with the logs for a missing journal and a wrong `WEB_ROOT`.
3. **The `docker` job in CI**, with BuildKit's cache and `ci-ok`'s `needs`.
4. **Dependabot's `docker` entry.**
5. **The guides.** `tools/docker.md`, `tools/docker-compose.md`, `tools/dependabot.md`, `stack-overview.md`, `architecture.md`, `ci-cd.md`, `testing.md`, `setup.md`, `threat-model.md` and the glossary.
6. **The records.** ADR 0028 and the notes in ADR 0008 and ADR 0010; GitHub, then the roadmap and the README's diagram.

## To verify during implementation

- The digest of `node:24-trixie-slim` at the time, for the linux/amd64 and linux/arm64 index (the multi-platform digest, so the pin works on either), and that it carries Node 24.12 or later, as `engines` requires.
- Corepack in that image runs pnpm 12 from `packageManager` without a prompt (`COREPACK_ENABLE_DOWNLOAD_PROMPT=0` if it asks), and where pnpm 12 keeps its store as root, for the cache mount's `target`.
- `pnpm install --frozen-lockfile` in `manifests` + `build` works with only the manifests copied before it, and `engineStrict` accepts the image's Node.
- After `pnpm install --prod --frozen-lockfile --filter @szop/api...`: `apps/api/node_modules/@szop/shared` is a symlink to `../../../packages/shared`, the API's production dependencies resolve, and whether `packages/shared/node_modules` exists (for `zod`). The final stage copies exactly what exists.
- Whether Node needs the root `package.json` at run time (the `"type": "module"` of `apps/api/package.json` should be enough).
- The final image as a user sees it: `docker run --rm --entrypoint sh szop:local -c 'ls -R …'` shows no `*.test.ts`, no `apps/web/src`, no pnpm store; its size, for the PR description.
- `vite build` passes with the test files left out of the context.
- The compressed size of the image and the time of the `docker` job, cold and with the cache, for the PR description.
- The failure path: with `apps/api/drizzle/meta/_journal.json` left out, and with `WEB_ROOT` overridden to a wrong folder, `pnpm check:image` fails and prints the logs. Shown locally, not committed.
- The SHAs of the latest `docker/setup-buildx-action` and `docker/build-push-action` releases a week old or more, like Dependabot's cooldown.
