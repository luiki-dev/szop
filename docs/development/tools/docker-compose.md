# Docker Compose and PostgreSQL

Docker Compose starts the services a project needs from one file. Szop's everyday service is PostgreSQL, the database the API uses in development and the tests use, locally and in CI; a second service, `app`, runs [the container image](docker.md) next to it when asked for.

## Why Szop uses it

- **Services in containers:** [ADR 0005](../../decisions/0005-development-environment.md), decision 4: tools run in Windows Subsystem for Linux (WSL), services in containers. A PostgreSQL installed straight into Ubuntu makes pinning a version and switching between versions awkward; a container is one pinned image, started and thrown away with one command.
- **The same major version as RDS** (Relational Database Service, AWS's managed database): [ADR 0008](../../decisions/0008-hosting.md), decision 19. Development and tests then meet the database behaviour production will have.
- **CI uses this file too,** rather than a separate service container in the workflow, so there is one place that pins the version ([ADR 0020](../../decisions/0020-database-details.md), decision 6).

## Configuration

**`compose.yaml`** at the repository root:

- `name: szop`: the Compose project's name, which prefixes everything it creates (`szop-postgres-1`, `szop_postgres-data`).
- `image: postgres:18.6`: the pinned minor version, never a floating tag, so Dependabot proposes updates as PRs. It is the Debian-based image, not Alpine: Alpine uses the musl C library, whose sorting of text differs from the glibc of Debian and of RDS's Linux.
- `restart: unless-stopped`: the container starts again whenever Docker Desktop starts, until it is stopped by hand.
- `environment`: `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`, all `szop`: local-only literals matching `apps/api/.env.example`. The image reads them only when it first initialises an empty volume, so changing them later needs `docker compose down -v`.
- `ports: "127.0.0.1:5432:5432"`: bound to the loopback address, so only this machine can connect; Docker would otherwise publish the port on every network interface.
- `volumes: postgres-data:/var/lib/postgresql`: a named volume. PostgreSQL 18 keeps its data in `18/docker` below that folder, so the volume is mounted one level up. It lives inside Docker Desktop's virtual machine, not in WSL or Windows, which gives PostgreSQL a real Linux file system; a bind mount to a Windows path would fail on permissions and be slow.
- `healthcheck`: runs `pg_isready` every 2 seconds; the container is `healthy` when it passes, and turns `unhealthy` after 15 failures in a row. It probes over TCP (`-h 127.0.0.1`), not the default Unix socket: while the image initialises an empty volume, it first runs a temporary server that listens on the socket only, so a socket probe could report healthy before the real server is up. Every CI run starts from an empty volume, so it would meet this every time. It is what `docker compose up --wait` waits for.
- **The `app` service** ([ADR 0028](../../decisions/0028-container-image-details.md)), the container image:
  - `profiles: [app]`: a **profile** marks a service that starts only when asked for with `--profile app`, so `docker compose up` still starts PostgreSQL alone.
  - `build: .` and `image: szop:local`: built from the root `Dockerfile` and tagged `szop:local`; with `--no-build`, Compose uses an image of that name already built, as CI does.
  - `depends_on: postgres: condition: service_healthy`: PostgreSQL is started first, and the app only once its health check passes.
  - `environment`: every setting the image does not set itself. `HOST: 0.0.0.0`, because inside the container the API must listen on every interface for Docker's port mapping to reach it; `DATABASE_HOST: postgres`, the service's name on the network Compose creates for the project; the rest as in `apps/api/.env.example`.
  - `ports: "127.0.0.1:8080:3000"`: the API listens on 3000 inside the container and is reached on 8080 on this machine, so `pnpm dev` and `pnpm start` keep 3000.
  - `read_only: true`: the container's root filesystem is read-only, which proves the API writes nothing to disk. On ECS the root filesystem is writable instead, because ECS Exec needs it ([ADR 0038](../../decisions/0038-app-on-ecs-and-rds-details.md)).
  - `healthcheck`: `node -e` with `fetch` on `/api/health`, since the slim image has no `curl`; `docker compose up --wait` waits for it.

## Everyday use

```bash
pnpm db:up                                   # start it, and wait until it is healthy (docker compose up -d --wait)
docker compose ps                            # is it running?
pnpm db:down                                 # stop it; pnpm db:up brings it back (docker compose stop)
docker compose logs postgres                 # the server's log
docker compose exec postgres psql -U szop    # a SQL prompt
docker compose down                          # remove the container, keep the data
docker compose down -v                       # remove the data too
```

- **In `psql`:** `\l` lists the databases, `\c szop_test_1` switches to one, `\dt` lists its tables, `\dt drizzle.*` those of the migration bookkeeping, and `\q` quits.
- **`down -v`** gives a fresh, empty database on the next `up`.
- **Commands without `--profile app` ignore the `app` service.** After `docker compose --profile app up`, a plain `down` removes PostgreSQL but not the app, and warns that the network `szop_default` is still in use; `docker compose --profile app down` (`pnpm image:down`) removes both.
- **What keeps the data:** a container restart, a Docker Desktop restart, a minor image update and `down`. Only `down -v`, `docker volume rm szop_postgres-data` and Docker Desktop's *Clean / Purge data* remove it.
- **A major upgrade** (18 to 19) starts an empty database beside the old one; in development, run `down -v` and let the migrations rebuild the schema.
- **The container image:** `pnpm check:image` builds it, starts it next to PostgreSQL, checks it and removes it; `pnpm image:up` (`docker compose --profile app up --build`) runs it on <http://127.0.0.1:8080>. More on the [Docker page](docker.md#everyday-use).
- **`port is already allocated` or `address already in use`:** something else listens on 5432, often a PostgreSQL installed natively or another project's container. Find it with `docker ps` and `sudo ss -ltnp | grep 5432`.
- **`docker: command not found` in WSL:** Docker Desktop is not running, or its WSL integration is off (*Settings → Resources → WSL integration*).

## Official documentation

- Compose file reference: <https://docs.docker.com/reference/compose-file/>
- `docker compose up`: <https://docs.docker.com/reference/cli/docker/compose/up/>
- The PostgreSQL image: <https://hub.docker.com/_/postgres>
- Docker Desktop's WSL integration: <https://docs.docker.com/desktop/features/wsl/>
