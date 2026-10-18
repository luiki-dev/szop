# Docker and the container image

Docker builds and runs **containers**: a program packed together with everything it needs (the operating system's files, the runtime, the libraries) into one **image**, which then runs the same way on the owner's machine, in CI and on AWS. An image is built from a **Dockerfile**, a recipe of steps; **BuildKit**, Docker's build engine, runs those steps, caches their results and skips the ones whose inputs did not change. Szop's image holds the API and the built single-page application (SPA) and is what the demo environment will run on AWS's container service (ECS). [Docker Compose](docker-compose.md) runs it locally next to PostgreSQL.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [Configuration](#configuration)
  - [The build context and `.dockerignore`](#the-build-context-and-dockerignore)
  - [The Dockerfile, stage by stage](#the-dockerfile-stage-by-stage)
  - [What the image holds](#what-the-image-holds)
  - [Running it: the app profile and the check](#running-it-the-app-profile-and-the-check)
- [Everyday use](#everyday-use)
- [Updating the base image](#updating-the-base-image)
- [Official documentation](#official-documentation)

## Why Szop uses it

- **One image for the API and the SPA:** [ADR 0008](../../decisions/0008-hosting.md), decisions 11 and 12. The API serves the built SPA itself, so one container holds the whole app, built by a multi-stage Dockerfile on a slim Node 24 image.
- **The details:** [ADR 0028](../../decisions/0028-container-image-details.md):
  - **`node:24-trixie-slim`, pinned by digest** (decision 1): the official Debian 13 image, with glibc like the PostgreSQL image and RDS; Alpine, distroless and hardened images were considered.
  - **Three stages on one pinned `base`, plus a shared `manifests` stage** (decisions 6 and 7), pnpm through Corepack, and not `pnpm deploy`, which would copy `@szop/shared` into `node_modules`, where Node refuses to strip types.
  - **What the image sets** (decision 9): only `WEB_ROOT` and `NODE_ENV`; every other setting comes from whoever runs it.
  - **Non-root, read-only** (decision 10): the `node` user, code owned by root, no file written at run time.
  - **The RDS certificate bundle committed** (decision 2), for the database connection's TLS: the API reads it from `apps/api/certs/rds-global-bundle.pem` when `DATABASE_TLS=verify-full`, which the demo sets from PH-12c ([ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 5). Under Compose, `DATABASE_TLS` is `none`: the local PostgreSQL has no TLS.
  - **A startup check** (decisions 3, 4, 11 and 12): `scripts/check-image.sh`, the same locally and in CI.

## Configuration

### The build context and `.dockerignore`

`docker build .` sends the **build context**, the repository folder, to BuildKit; the Dockerfile's `COPY` steps can only read from it. **`.dockerignore`** at the root keeps out what the image must not hold or does not need: `.git`, every `node_modules`, `dist` and `coverage` (the image installs and builds its own), local `.env` files with passwords (`.env.example` stays), Terraform's local state and provider caches, the docs, test files (`*.test.ts`, `*.test.tsx`, `apps/api/src/test`), Playwright's output and the editors' and tools' folders. A small context builds faster, and a stable one keeps the cache of `COPY . .` valid.

### The Dockerfile, stage by stage

A **multi-stage** build runs several images in one Dockerfile; the last one is the image, and the others only exist to produce files it copies. Each step (`RUN`, `COPY`) makes a **layer**, cached by its inputs: change a file and every layer from the first step that reads it is rebuilt, everything before it is reused.

| Stage | From | What it does |
|---|---|---|
| `base` | `node:24-trixie-slim@sha256:…` | The one pinned image every stage starts from. `WORKDIR /app`; `corepack enable` adds the `pnpm` shim, which downloads the version named by `packageManager` in `package.json` |
| `manifests` | `base` | Copies only `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and each package's `package.json`, then `corepack install` downloads pnpm once. A change to the source code does not invalidate it, so the install steps below stay cached until a dependency changes |
| `build` | `manifests` | `pnpm install --frozen-lockfile` (every dependency, refusing a lockfile that does not match), then `COPY . .` and `pnpm --filter @szop/web build`: the SPA in `apps/web/dist`, with its first-screen budget check |
| `prod-deps` | `manifests` | `pnpm install --prod --frozen-lockfile --filter "@szop/api..."`: only the API's production dependencies and the workspace packages it depends on. pnpm links `@szop/shared` as a symlink to `packages/shared`, which is what lets Node strip its types |
| final | `base` | Copies the `node_modules` folders from `prod-deps`, the API's `package.json`, `src`, `drizzle` and `certs` and `@szop/shared`'s `package.json` and `src` from the context, and `apps/web/dist` from `build`. Sets `NODE_ENV=production` and `WEB_ROOT=/app/apps/web/dist`, switches to `USER node` and `WORKDIR /app/apps/api`, and runs `node src/server.ts` |

- **The pnpm store** is a **cache mount** (`RUN --mount=type=cache,…`): BuildKit keeps it between builds on the same machine, but it never becomes part of a layer, so the image does not carry it.
- **No `# syntax=` line:** Docker's built-in Dockerfile support already understands cache mounts, and the line would pull another, unpinned image on every build.
- **`apps/api/drizzle`** keeps `meta/_journal.json`, which the API reads at every start; without it the API exits before it listens.

### What the image holds

```
/app
├── node_modules/                 pnpm's store of the production dependencies (.pnpm/)
├── apps/
│   ├── api/                      the working directory
│   │   ├── package.json
│   │   ├── src/                  TypeScript, run by Node's type stripping
│   │   ├── drizzle/              the migrations and meta/_journal.json
│   │   ├── certs/                rds-global-bundle.pem
│   │   └── node_modules/         symlinks into /app/node_modules/.pnpm, and @szop/shared → packages/shared
│   └── web/dist/                 the built SPA, with its .br and .gz copies
└── packages/shared/              package.json, src/, node_modules/ (zod)
```

No pnpm, no development dependencies, no tests, no web sources, no `.env`. Every file belongs to root and is read-only to the `node` user (uid 1000) the API runs as.

### Running it: the app profile and the check

`compose.yaml` has an `app` service under the **profile** `app`: a profile marks services that start only when asked for, so `docker compose up` still starts PostgreSQL alone. The service builds the Dockerfile as `szop:local`, waits for PostgreSQL to be healthy, sets every setting the image does not (`HOST: 0.0.0.0`, so Docker's port mapping reaches the API inside the container; `PORT`, `LOG_LEVEL`, the `DATABASE_*` settings with `DATABASE_HOST: postgres`, the service's name on Compose's network; `TRUSTED_PROXIES: none`), publishes it on `127.0.0.1:8080`, runs it with a **read-only root filesystem**, and checks `/api/health` with `node -e` and `fetch`, since the slim image has no `curl`. Its options are explained on the [Docker Compose page](docker-compose.md#configuration).

**`scripts/check-image.sh`**, run as `pnpm check:image`, proves the image works:

1. `docker compose --profile app up --build --wait app`: builds, starts it next to PostgreSQL and waits until the health check passes. The API answers `/api/health` only after its migrations ran.
2. The image's user is `node`, and `id -u` inside the running container is not 0.
3. `GET http://127.0.0.1:8080/` answers 200 with `text/html`: a wrong `WEB_ROOT` would keep `/api/health` at 200 while every page answered a plain-text 404.
4. On any failure it prints `FAIL: …` and the app's logs and exits 1. In every case it removes the `app` container and leaves PostgreSQL running.

CI's `docker` job builds the image itself and runs the script with `--no-build` ([CI/CD](../ci-cd.md#the-jobs)).

## Everyday use

```bash
pnpm check:image                                    # build, start, check, remove
pnpm image:up                                       # run the image in the foreground; open http://127.0.0.1:8080
pnpm image:up -d --wait                             # the same, in the background
docker compose --profile app logs -f app            # follow its log
docker compose --profile app exec app sh            # a shell inside, as node
pnpm image:down                                     # stop and remove it (and PostgreSQL's container; the data stays)
docker build -t szop:local .                        # build only
docker build --no-cache -t szop:local .             # build without any cached layer
docker run --rm --entrypoint sh szop:local -c 'ls -la /app'   # look inside without starting the API
```

- **It uses the development database** `szop`, as `pnpm start` does, and migrates it the same way.
- **Stop it with the profile too:** `pnpm image:down` runs `docker compose --profile app down`, and `pnpm image:up` runs `docker compose --profile app up --build`. A plain `docker compose down` only sees the services without a profile, so it removes PostgreSQL, leaves the app running (soon unhealthy, with its database gone) and warns `Network szop_default Resource is still in use`. Run `pnpm image:down` to clean up, then `pnpm db:up` to bring PostgreSQL back for `pnpm dev` and the tests.
- **Port 8080, not 3000,** so the image and `pnpm dev` or `pnpm start` can run at the same time.
- **A failed check:** read the `FAIL:` line, then the logs under it. `the app did not become healthy` means the API did not start or did not answer `/api/health`: the logs show why (a missing setting, an unreachable database, a missing file). `GET / answered 404` means the SPA is not where `WEB_ROOT` points.
- **Docker Desktop must be running,** with its WSL integration on ([Docker Compose](docker-compose.md#everyday-use)).

## Updating the base image

- **Minor and patch updates** of `node:24-trixie-slim`, and new digests of the same tag, arrive as Dependabot's `build(deps): …` PRs every Monday ([Dependabot](dependabot.md)). The PR changes the digest in the `FROM` line; CI's `docker` job builds and checks it.
- **Node's next major** is ignored by Dependabot: it changes on purpose, together with `.nvmrc`, `engines` in `package.json`, the tag and the digest in the Dockerfile (audit m13).
- **The digest by hand:** `docker buildx imagetools inspect node:24-trixie-slim` prints the index digest, which covers every platform (amd64 and arm64); pin that one, not a platform's own digest.
- **The RDS bundle** is refreshed by hand: [ADR 0028](../../decisions/0028-container-image-details.md), decision 2.

## Official documentation

- Dockerfile reference: <https://docs.docker.com/reference/dockerfile/>
- Multi-stage builds: <https://docs.docker.com/build/building/multi-stage/>
- Build cache and cache mounts: <https://docs.docker.com/build/cache/optimize/>
- `.dockerignore`: <https://docs.docker.com/build/concepts/context/#dockerignore-files>
- The Node image: <https://hub.docker.com/_/node>
- Compose profiles: <https://docs.docker.com/compose/how-tos/profiles/>
