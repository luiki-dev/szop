# Scripts

Every script Szop defines, in one place: what it runs, when to run it, and what else runs it. The scripts live in `package.json` files; `pnpm <script>` runs one from the repository root. The guides explain each in context: the [setup guide](setup.md) for getting started, the [testing guide](testing.md) for the test suites, the [CI/CD guide](ci-cd.md) for what CI runs.

## Contents

- [Running the app](#running-the-app)
- [The database and the container image](#the-database-and-the-container-image)
- [Checks](#checks)
- [Tests](#tests)
- [Formatting](#formatting)
- [Run by tools, not by hand](#run-by-tools-not-by-hand)
- [Scripts of the workspace packages](#scripts-of-the-workspace-packages)
- [Adding a script](#adding-a-script)

## Running the app

| Script | Purpose | Runs | When | Needs |
|---|---|---|---|---|
| `pnpm dev` | Run the dev environment | `pnpm -r --parallel dev`: the API with tsx in watch mode (its log through pino-pretty) and Vite's dev server, side by side | Working on the code: open `http://localhost:5173`; both reload on save | PostgreSQL (`pnpm db:up`), `apps/api/.env` |
| `pnpm build` | Build the web app for production | `pnpm -r build`: Vite's production build of the web app into `apps/web/dist`, with its `.br` and `.gz` copies and the first-screen budget check | Before `pnpm start`; `pnpm test:e2e` runs it itself | — |
| `pnpm start` | Run Szop the production way | The API's `start`: `node --env-file=.env src/server.ts`, which serves the API and the built page on `http://localhost:3000` | Running the app the production way, without Docker | `pnpm build` first, PostgreSQL, `apps/api/.env` |

## The database and the container image

These call Docker Compose with `compose.yaml` ([Docker Compose](tools/docker-compose.md), [Docker](tools/docker.md)); Docker Desktop must be running.

| Script | Purpose | Runs | When |
|---|---|---|---|
| `pnpm db:up` | Start the database | `docker compose up -d --wait`: starts PostgreSQL and waits until it is healthy | Before `pnpm dev`, `pnpm start` and the tests, whenever the database is not running |
| `pnpm db:down` | Stop the database | `docker compose stop`: stops PostgreSQL and keeps its container and data | To free the machine's resources; `pnpm db:up` brings it back at once |
| `pnpm db:reset` | Wipe the local database | `docker compose down --volumes && docker compose up -d --wait`: removes PostgreSQL's container and its volume, then starts it again on an empty one | When the API refuses to start because the database's migrations do not match the code's ([the migration check](tools/drizzle.md#the-migration-check)), or to start from empty. It also removes the test databases, which the next `pnpm test` recreates |
| `pnpm image:up` | Start Szop in containers | `docker compose --profile app up --build`: builds the container image and runs it next to PostgreSQL, in the foreground, on `http://127.0.0.1:8080` | Trying the app as AWS will run it. Ctrl+C stops it; `pnpm image:up -d --wait` runs it in the background |
| `pnpm image:down` | Stop and remove Szop's containers | `docker compose --profile app down`: removes the app's and PostgreSQL's containers (the data stays in its volume) | After `pnpm image:up`. Then `pnpm db:up` brings PostgreSQL back for `pnpm dev` and the tests |
| `pnpm check:image` | Prove the container image works | `scripts/check-image.sh`: builds the image, starts it next to PostgreSQL, checks that it is healthy, runs as `node`, serves the page and reports the commit it was built from in `/api/health`, then removes it | After changing the `Dockerfile`, `.dockerignore`, `compose.yaml` or the dependencies. CI's `docker` job runs it with `--no-build` on every code PR |
| `pnpm check:scale` | Prove two instances work together | `scripts/check-scale.sh`: builds the image, starts two of it (`app-a`, `app-b`) behind nginx on a fresh database `szop_scale` (the `scale` profile), checks that both become healthy, that 10 requests through nginx reach both and that each migration is recorded once, then removes them and the database | After changing anything about startup, the migrations, the database connection or `compose.yaml`. CI's `docker` job runs it with `--no-build` after `check:image` |

`db:reset` leaves the profile out, so a running app container keeps running; stop it first with `pnpm image:down`. `image:down` takes the profile with it on purpose: a plain `docker compose down` leaves out every service behind a profile and warns that the network is still in use ([Docker](tools/docker.md#everyday-use)).

## Checks

The same commands CI runs in its jobs ([CI/CD](ci-cd.md#the-jobs)); run them before pushing, all four at once with `pnpm check`.

| Script | Purpose | Runs | CI job |
|---|---|---|---|
| `pnpm check` | Run the everyday checks in one go | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, in that order, stopping at the first failure. Needs PostgreSQL (`pnpm db:up`) for the tests | — (CI runs its parts as `lint`, `typecheck` and `test`) |
| `pnpm lint` | Find code problems | `eslint .`: ESLint over the whole repository ([ESLint](tools/eslint.md)) | `lint` |
| `pnpm format:check` | Check the formatting | `prettier --check .`: lists the files Prettier would change, and fails if there are any ([Prettier](tools/prettier.md)) | `lint` |
| `pnpm typecheck` | Check the types | `tsc --noEmit` for the root, then each package's own `typecheck` ([TypeScript](tools/typescript.md)) | `typecheck` |
| `pnpm check:infra` | Check the Terraform code | `scripts/check-infra.sh`: `terraform fmt -check`, then `terraform init -backend=false` and `terraform validate` in every module under `infra/`, then tflint; no AWS access ([Terraform](tools/terraform.md), [tflint](tools/tflint.md)). Needs the tools of the [setup guide](setup.md#8-terraform-tflint-and-the-aws-cli) | `infra` |
| `pnpm check:workflows` | Check the workflow files | `scripts/check-workflows.sh`: `actionlint` over every workflow, then `zizmor --offline .github`; no network access, so zizmor's online audits are skipped ([actionlint](tools/actionlint.md), [zizmor](tools/zizmor.md)). Needs the tools of the [setup guide](setup.md#9-actionlint-zizmor-and-uv). No CI job runs the script: CI's `workflows` job runs the two tools directly, with zizmor's online audits | — |
| `pnpm check:scan` | Scan the code and the image for security problems | `scripts/scan.sh all`: `scan.sh config`, Trivy over the Terraform code under `infra/` and the `Dockerfile` (`CRITICAL` and `HIGH` findings fail it, `MEDIUM` and `LOW` are listed, and so are the exceptions the code accepts with `# trivy:ignore` comments), then `scan.sh image`, which builds `szop:local` and scans it for known vulnerabilities (only a fixable `CRITICAL` or `HIGH` in a Node package fails it; the others are counted or listed). `scripts/scan.sh image --no-build` skips the build ([Trivy](tools/trivy.md)). Needs Trivy from the [setup guide](setup.md#8-terraform-tflint-and-the-aws-cli) and Docker | `scan-config` and `scan-image` (pull requests only; each runs its half, `scan-image` on the image `docker` saved) |

## Tests

How to run, filter and read them: the [testing guide](testing.md#running-the-tests).

| Script | Purpose | Runs | When | CI job |
|---|---|---|---|---|
| `pnpm test` | Run the tests | `vitest run`: every Vitest project once (API, database, component, unit and hook tests) | Before every push; needs PostgreSQL | `test` (as `test:coverage`) |
| `pnpm test:watch` | Rerun the tests while coding | `vitest`: stays running and reruns the tests a change affects | While writing code or tests | — |
| `pnpm test:coverage` | Run the tests and measure coverage | `pnpm test --coverage`: the same tests, plus a coverage report in `coverage/` | To see which code the tests reach | `test` |
| `pnpm test:e2e` | Run the end-to-end journeys in real browsers | `pnpm build`, then Playwright's journeys on desktop Chromium, desktop Firefox and an emulated phone ([Playwright](tools/playwright.md)) | After a change to the web app, the API's responses or the security headers; needs PostgreSQL and Playwright's browsers | `e2e` |
| `pnpm test:e2e:report` | Read an end-to-end report | `playwright show-report`: serves the HTML report of the last E2E run, or of a folder given to it | After a failed E2E run, locally or downloaded from CI | — |
| `pnpm check:image` | Prove the container image works | See [the database and the container image](#the-database-and-the-container-image) | — | `docker` |
| `pnpm check:scale` | Prove two instances work together | See [the database and the container image](#the-database-and-the-container-image) | — | `docker` |

## Formatting

| Script | Purpose | Runs | When |
|---|---|---|---|
| `pnpm format` | Fix the formatting | `prettier --write .`: formats every file Prettier knows (Markdown is excluded by `.prettierignore`) | After a `format:check` failure. The pre-commit hook already formats the staged files |
| `pnpm infra:fmt` | Fix the Terraform formatting | `terraform fmt -recursive infra`: rewrites every `.tf` file under `infra/` in Terraform's own style | After a `check:infra` formatting failure. The pre-commit hook already formats the staged `.tf` files |

## Run by tools, not by hand

| What | Purpose | Runs | Triggered by |
|---|---|---|---|
| `prepare` | Install the git hooks | `husky`: installs the git hooks into `.husky/` | pnpm, after every `pnpm install` ([husky and lint-staged](tools/husky-and-lint-staged.md)) |
| pre-commit hook | Clean up the files being committed | `pnpm exec lint-staged`: ESLint with `--fix` and Prettier on the staged code files, `terraform fmt` on the staged `.tf` files, actionlint and zizmor on the staged workflow files under `.github/` (the same tools as `pnpm check:workflows`, on the staged files only), Prettier on the other staged files | Every `git commit` |
| commit-msg hook | Check the commit message | `pnpm exec commitlint --edit`: checks the message against Conventional Commits ([commitlint](tools/commitlint.md)) | Every `git commit` |

## Scripts of the workspace packages

Each package in the workspace has its own `package.json` scripts. The root scripts call most of them; call one directly with `pnpm --filter <package> <script>`.

| Package | Script | Purpose | Runs | Called by |
|---|---|---|---|---|
| `@szop/api` | `dev` | Run the API in watch mode | `tsx watch --env-file=.env src/server.ts \| pino-pretty` | `pnpm dev` |
| `@szop/api` | `start` | Run the API | `node --env-file=.env src/server.ts` | `pnpm start` |
| `@szop/api` | `db:generate` | Create a database migration | `drizzle-kit generate`: writes the next migration after a change to `schema.ts` ([Drizzle](tools/drizzle.md)) | By hand: `pnpm --filter @szop/api db:generate` |
| `@szop/web` | `dev` | Serve the web app for development | `vite`: the dev server on port 5173 ([Vite](tools/vite.md)) | `pnpm dev` |
| `@szop/web` | `build` | Build the web app | `vite build` | `pnpm build` |
| every package | `typecheck` | Check the package's types | `tsc --noEmit` | `pnpm typecheck` |

## Adding a script

- Put it in the root `package.json` when it is run from the root; a package's own script when it belongs to that package, called by a root script or with `--filter`.
- Name it after what it acts on and what it does, in the existing style: `test:e2e`, `db:up`, `check:image`.
- Add its row here, and explain it in the guide where it is used.
