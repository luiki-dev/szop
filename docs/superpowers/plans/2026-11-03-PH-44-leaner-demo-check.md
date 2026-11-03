# PH-44 Leaner demo check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A `prodlike` Compose profile and `pnpm check:prodlike` check on the owner's machine what the demo checked until now, and `/demo-check`, the definition of done and the tracking propose the demo only when the diff changes what only AWS can show.

**Architecture:** The API gains an optional `DATABASE_CA_FILE`, so `verify-full` can check a local certificate authority. The `prodlike` profile runs a TLS-only PostgreSQL, `db-setup`, the image and nginx with TLS on its own network. `scripts/check-prodlike.sh` makes throwaway certificates with `openssl`, starts the profile, checks it with `curl`, `psql` and a Playwright project of its own, then removes it unless `--keep`. The rest is process: `/demo-check`, the definition of done, the PR template, the deferred-checks issue and the docs.

**Tech Stack:** Docker Compose, PostgreSQL 18.6, nginx 1.31.7-alpine, `openssl`, Bash, Zod, node-postgres, Vitest, Playwright 1.64.1, `gh`.

**Spec:** [`docs/superpowers/specs/2026-11-03-PH-44-leaner-demo-check-design.md`](../specs/2026-11-03-PH-44-leaner-demo-check-design.md); decisions in [ADR 0064](../../decisions/0064-leaner-demo-check-phase-details.md). The phase has no acceptance criteria. The docs to update are in the spec's [Documentation](../specs/2026-11-03-PH-44-leaner-demo-check-design.md#documentation); each task below names the ones it updates.

## Order of work

1. [Task 1: The database's certificate authority](#task-1-the-databases-certificate-authority)
2. [Task 2: The prodlike profile and its script](#task-2-the-prodlike-profile-and-its-script)
3. [Task 3: The Playwright project and the duration](#task-3-the-playwright-project-and-the-duration)
4. [Task 4: `/demo-check` and the deferred-checks issue](#task-4-demo-check-and-the-deferred-checks-issue)
5. [Task 5: The definition of done and the process docs](#task-5-the-definition-of-done-and-the-process-docs)
6. [Task 6: The GitHub login and the ADR notes](#task-6-the-github-login-and-the-adr-notes)

## Global Constraints

- The branch is `ci/ph-44-leaner-demo-check`. Commit types and scopes: `feat(api)` for Task 1, `test` (no scope, as `check:scale` was) for Tasks 2 and 3, `feat(claude)` for Task 4, `docs` for Tasks 5 and 6.
- Nothing on AWS changes: no file under `infra/` or `.github/workflows/` is edited, and no task definition sets `DATABASE_CA_FILE`.
- `pnpm check:prodlike` never runs in CI, and `pnpm test:e2e` never runs `e2e/prodlike/` (decision 2).
- Ports: `127.0.0.1:8443` (HTTPS) and `127.0.0.1:8082` (HTTP redirect). 8080, 8081 and 5432 stay with the existing profiles. `postgres-tls` and `app-prodlike` publish no port.
- The profile's network subnet is `10.89.44.0/24`, written once in `compose.yaml`; `TRUSTED_PROXIES` names the same subnet.
- Images: `postgres:18.6`, `nginx:1.31.7-alpine`, `szop:local`.
- Certificates go to `.prodlike/certs/`, listed in `.gitignore`; nothing under it is committed, and the authority is never installed on the system.
- `pnpm check` passes after every task.

## Review Focus

1. **`--keep` after a failure.** Expected: the environment stays up and the logs are printed; the exit code is still non-zero. Task 2 checks it by hand with a deliberately wrong expectation.
2. **A second run while a kept environment is up.** Expected: the script starts from a fresh database (the volume removed first) and new certificates, and does not fail on "port already allocated" from its own previous run. Task 2 checks it.
3. **The subnet already taken on the owner's machine.** Expected: the script fails with Docker's message and names `compose.yaml`'s subnet and `TRUSTED_PROXIES` as the two places to change. Task 2's `fail` message covers it.
4. **A connection to `postgres-tls` without TLS.** Expected: refused. Task 2 checks it with `psql "sslmode=disable"` from inside the network.
5. **`DATABASE_CA_FILE` pointing at a missing file.** Expected: startup stops, as it does now for a missing RDS bundle. Task 1 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/config.ts`, `apps/api/src/db/setup-role.ts` | read `DATABASE_CA_FILE` into `DatabaseSettings.caFile` |
| `apps/api/src/db/database.ts` | `verify-full` reads `settings.caFile ?? rdsCaBundle` |
| `compose.yaml` | the `prodlike` profile: four services, a network, a volume |
| `compose/nginx-prodlike.conf` (new) | TLS on 8443, the redirect on 8080 |
| `scripts/check-prodlike.sh` (new) | certificates, up, checks, Playwright, teardown, `--keep`, `--down`, `--no-build` |
| `e2e/playwright.prodlike.config.ts`, `e2e/prodlike/*.spec.ts` (new) | the cookie and the console/CSP checks over HTTPS |
| `.claude/skills/demo-check/SKILL.md` | the three buckets, one message, the deferred-checks issue |

---

### Task 1: The database's certificate authority

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/src/db/setup-role.ts`, `apps/api/src/db/database.ts`
- Test: `apps/api/src/config.test.ts`, `apps/api/src/db/setup-role.test.ts`, `apps/api/src/db/database.test.ts`
- Docs: `docs/architecture/architecture.md` (the setting), `apps/api/.env.example` (a commented line), [ADR 0064](../../decisions/0064-leaner-demo-check-phase-details.md) "Settled while building"

**Interfaces:**
- Produces: `DatabaseSettings.caFile?: string` (absolute path, set only when `DATABASE_CA_FILE` is set); `createDatabase` reads `settings.caFile ?? rdsCaBundle` for `verify-full`. Task 2 sets `DATABASE_CA_FILE=/certs/ca.pem` on `db-setup-prodlike` and `app-prodlike`.

`caFile` is optional rather than always set to the RDS path as the spec says: the RDS path stays in one place (`database.ts`), and the eight `DatabaseSettings` literals in the tests stay as they are. Record this under "Settled while building" in ADR 0064, in this task's commit.

- [ ] **Step 1: Write the failing tests**

In `config.test.ts`:

```ts
it("leaves caFile unset without DATABASE_CA_FILE", () => {
  expect(loadConfig(valid).database.caFile).toBeUndefined();
});

it("resolves DATABASE_CA_FILE", () => {
  expect(
    loadConfig({ ...valid, DATABASE_CA_FILE: "certs/ca.pem" }).database.caFile,
  ).toBe(resolve("certs/ca.pem"));
});

it("rejects an empty DATABASE_CA_FILE", () => {
  expect(errorFor({ ...valid, DATABASE_CA_FILE: "" })).toMatch(
    /DATABASE_CA_FILE: (?!missing)/,
  );
});
```

The same three in `setup-role.test.ts`, against `loadSetupConfig`. In `database.test.ts`:

```ts
it("verifies the server against caFile when it is set", () => {
  // a temp file holding "-----BEGIN CERTIFICATE-----\ntest\n"
  db = createDatabase({ ...settings, tls: "verify-full", caFile: file });
  expect(db.$client.options.ssl).toEqual({
    ca: "-----BEGIN CERTIFICATE-----\ntest\n",
    rejectUnauthorized: true,
  });
});

it("stops when caFile does not exist", () => {
  expect(() =>
    createDatabase({ ...settings, tls: "verify-full", caFile: "/nonexistent/ca.pem" }),
  ).toThrow(/ENOENT/);
});
```

The temp file is made with `mkdtempSync(join(tmpdir(), "szop-ca-"))` and removed in `afterEach`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run apps/api/src/config.test.ts apps/api/src/db/setup-role.test.ts apps/api/src/db/database.test.ts`
Expected: the new tests fail (`caFile` undefined where a path is expected; `ssl.ca` is the RDS bundle).

- [ ] **Step 3: Implement**

- Both schemas: `DATABASE_CA_FILE: z.string().min(1).optional()`, with a one-line comment: the authority `verify-full` checks against, the RDS bundle when unset (ADR 0064, decision 8).
- Both loaders: `...(data.DATABASE_CA_FILE && { caFile: resolve(data.DATABASE_CA_FILE) })` in `database`.
- `DatabaseSettings`: `caFile?: string` with its comment.
- `database.ts`: `readFileSync(settings.caFile ?? rdsCaBundle, "utf8")`; the comment above it names `caFile`.

- [ ] **Step 4: Run the tests and the mutation run**

Run: `pnpm vitest run apps/api/src/config.test.ts apps/api/src/db/setup-role.test.ts apps/api/src/db/database.test.ts`
Expected: PASS.
Run: `pnpm test:mutation --mutate apps/api/src/config.ts,apps/api/src/db/setup-role.ts,apps/api/src/db/database.ts`
Expected: no surviving mutant on the new lines.

- [ ] **Step 5: Docs, `pnpm check`, commit**

`architecture.md` names `DATABASE_CA_FILE` where it describes `DATABASE_TLS`; `.env.example` gets a commented `# DATABASE_CA_FILE=` line under `DATABASE_TLS`.

```bash
git commit -m "feat(api): read the database's certificate authority from DATABASE_CA_FILE"
```

---

### Task 2: The prodlike profile and its script

**Files:**
- Modify: `compose.yaml`, `.gitignore`, `package.json` (`"check:prodlike": "scripts/check-prodlike.sh"`)
- Create: `compose/nginx-prodlike.conf`, `scripts/check-prodlike.sh`
- Docs: `docs/development/tools/docker.md` (the profile), `docs/development/scripts.md` (`check:prodlike`), `docs/development/setup.md` (`openssl`, the browser's warning)

**Interfaces:**
- Consumes: Task 1's `DATABASE_CA_FILE`.
- Produces: the script's steps 1 to 4 and 6 from the spec, and a placeholder where step 5 (Playwright) goes in Task 3. Flags: `--no-build`, `--keep`, `--down` (only removes and exits). Files: `.prodlike/certs/ca.pem`, `localhost.{pem,key}`, `postgres.{pem,key}`.

- [ ] **Step 1: Settle the key file's permissions first** (spec, Risks)

Make the certificates by hand into `.prodlike/certs/`, start `postgres-tls` alone and see whether a read-only bind mount of `postgres.key` is accepted. Expected: PostgreSQL refuses a key that is not `0600` and owned by `postgres`. The fix the plan expects: mount the folder at `/certs:ro`, and start the server with an entrypoint that runs `install -m 0600 -o postgres -g postgres /certs/postgres.{pem,key} /var/lib/postgresql/` and writes the `pg_hba.conf` below, then `exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=… -c ssl_key_file=… -c hba_file=…`. `pg_hba.conf`: `local all all trust` (for `docker compose exec … psql` and the image's init) and `hostssl all all all scram-sha-256`, nothing else. If another way turns out simpler, use it and add a line to ADR 0064's "Settled while building".

- [ ] **Step 2: The profile in `compose.yaml`**

The four services as the spec's [The production-like environment](../specs/2026-11-03-PH-44-leaner-demo-check-design.md#the-production-like-environment) describes, with `profiles: [prodlike]`, the network `prodlike` (`ipam.config: [{subnet: 10.89.44.0/24}]`) and the volume `postgres-prodlike-data`. `app-prodlike` reuses `*app` and overrides `depends_on` (`db-setup-prodlike: service_completed_successfully`) and the environment: `DATABASE_HOST: postgres-tls`, `DATABASE_NAME: szop`, `DATABASE_USER: szop_app`, `DATABASE_PASSWORD: szop-app-local`, `DATABASE_TLS: verify-full`, `DATABASE_CA_FILE: /certs/ca.pem`, `TRUSTED_PROXIES: 10.89.44.0/24`, `APP_ORIGIN: https://localhost:8443`. `db-setup-prodlike`: the same image, `command: ["node", "src/db-setup.ts"]`, the master user `szop`/`szop`, `APP_DATABASE_USER: szop_app`, `APP_DATABASE_PASSWORD: szop-app-local`, `DATABASE_TLS: verify-full`, `DATABASE_CA_FILE: /certs/ca.pem`, `restart: "no"`. Each mounts `./.prodlike/certs:/certs:ro`. A comment above the profile says what it stands in for (the load balancer, RDS) and links ADR 0064, decision 7; a comment on the subnet says `TRUSTED_PROXIES` must change with it. `nginx-prodlike` has a healthcheck like `nginx`'s, against `https://127.0.0.1:8443/api/live` with `--no-check-certificate`.

- [ ] **Step 3: `compose/nginx-prodlike.conf`**

Two `server` blocks: `listen 8443 ssl` with `localhost.pem`/`.key`, proxying to `app-prodlike:3000` with `proxy_set_header Host $http_host`, `X-Forwarded-For $proxy_add_x_forwarded_for`, `X-Forwarded-Proto $scheme`; and `listen 8080` with `return 301 https://localhost:8443$request_uri`. The header comment says why `$http_host`, not `$host` (the spec's reason, one line).

- [ ] **Step 4: `scripts/check-prodlike.sh`**

In `check-scale.sh`'s shape (`set -euo pipefail`, `GIT_COMMIT`, `fail` printing `FAIL: …` then each service's logs). Order:

1. `--down`: `docker compose --profile prodlike down --volumes --remove-orphans` limited to the profile's services and volume, then exit 0.
2. Remove a previous run (the same `down`), so a second run starts fresh.
3. Certificates with `openssl` into `.prodlike/certs/`: a CA, then `localhost` (SAN `DNS:localhost`) and `postgres-tls` (SAN `DNS:postgres-tls`) signed by it, lifetime a few days. Files readable by the container users (`chmod 0644`; the key's `0600` is set inside the container, Step 1).
4. Build unless `--no-build` (as `check-scale.sh`).
5. `docker compose --profile prodlike up --no-build --wait`; on failure, `fail` with a hint that a subnet clash is fixed in `compose.yaml` and `TRUSTED_PROXIES` together.
6. `curl --cacert .prodlike/certs/ca.pem`: `https://localhost:8443/api/health` is 200 with `"commit":"$GIT_COMMIT"`; `http://localhost:8082/lists?x=1` is 301 with `Location: https://localhost:8443/lists?x=1`; `/` has `Strict-Transport-Security` and `Content-Security-Policy`.
7. `psql` in `postgres-tls`: `SELECT bool_and(s.ssl), count(*) FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid) WHERE a.usename = 'szop_app'` is `t|N` with `N > 0`. And a connection with `sslmode=disable` over TCP (`-h 127.0.0.1`) is refused.
8. `# Task 3: the Playwright project runs here.`
9. Teardown: a `trap` on `EXIT` runs the `down` unless `--keep`. With `--keep`, on success or failure, print `https://localhost:8443` and `pnpm check:prodlike --down`.

Print `OK: …` at the end, as the other scripts do.

- [ ] **Step 5: Run it**

Run: `pnpm check:prodlike`
Expected: `OK: …`, and afterwards `docker compose --profile prodlike ps -a` lists nothing.
Run: `pnpm check:prodlike --no-build --keep`, then the same again (Review Focus 2), then `pnpm check:prodlike --down`.
Expected: both pass; the second starts fresh; after `--down` nothing is left.
Change the expected commit by hand (`GIT_COMMIT=0000… pnpm check:prodlike --no-build --keep`).
Expected: `FAIL: …`, the logs, a non-zero exit, and the environment still up (Review Focus 1). Then `--down`.

- [ ] **Step 6: Docs, `pnpm check`, commit**

`.gitignore`: `.prodlike/` with a comment. The three docs as listed above.

```bash
git commit -m "test: check a production-like environment locally with check:prodlike"
```

---

### Task 3: The Playwright project and the duration

**Files:**
- Create: `e2e/playwright.prodlike.config.ts`, `e2e/prodlike/session.spec.ts`, `e2e/prodlike/screens.spec.ts`
- Modify: `scripts/check-prodlike.sh` (step 8), `eslint.config.js` (the `no-restricted-imports` rule also covers `e2e/prodlike/**/*.ts`)
- Docs: `docs/development/testing.md` (the production-like check as a layer: when it runs, how to read a failure, how long it takes)

**Interfaces:**
- Consumes: Task 2's environment on `https://localhost:8443`; `test` and `expect` from `e2e/support/test.ts` (the CSP guard).
- Produces: `pnpm --filter @szop/e2e exec playwright test -c playwright.prodlike.config.ts`, which the script runs.

`e2e/support/` has no console listener; the screens test collects `page.on("console")` messages itself.

- [ ] **Step 1: The config**

`testDir: "prodlike"`, `baseURL: "https://localhost:8443"`, `ignoreHTTPSErrors: true`, one project `prodlike` with `devices["Desktop Chrome"]`, no `webServer`, `retries: 0`, the `list` reporter. A comment says it runs only from `check:prodlike` (ADR 0064, decision 2).

- [ ] **Step 2: The tests**

`session.spec.ts`:

```ts
test("a guest's first change sets a __Host- session cookie", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "New list" }).click();
  const field = page.getByRole("textbox", { name: "List name" });
  await field.fill("Prodlike");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  const session = (await context.cookies()).find((c) => c.name.startsWith("__Host-"));
  expect(session).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax", path: "/" });
});
```

`screens.spec.ts`: one test per path in `["/", "/lists/new", "/catalog", "/design"]` (written out, with a comment that it follows `apps/web/src/routes.tsx`; `/lists/:id` is covered by `session.spec.ts`): go to the path, wait for `networkidle`, and expect the collected console messages to equal `[]`. The CSP guard comes from the fixture.

- [ ] **Step 3: Run them against a kept environment**

Run: `pnpm check:prodlike --keep`, then `pnpm --filter @szop/e2e exec playwright test -c playwright.prodlike.config.ts`
Expected: all pass. Then confirm `pnpm test:e2e --list` does not list `prodlike/` tests.

- [ ] **Step 4: Wire it into the script**

Replace the placeholder with the Playwright command; a failure calls `fail "the prodlike Playwright project failed"`.

- [ ] **Step 5: Measure the whole run once**

With the image already built, run `time pnpm check:prodlike --no-build` and note the `real` time: from `up` to teardown, the certificates, all checks and Playwright included. Write it into `testing.md` ("about N minutes on the owner's machine, measured on 2026-11-DD"), and into the task summary for the owner. This is a one-time number, not a feature: the script does not time itself.

- [ ] **Step 6: Docs, `pnpm check`, commit**

```bash
git commit -m "test: run a Playwright project against the prodlike environment"
```

---

### Task 4: `/demo-check` and the deferred-checks issue

**Files:**
- Modify: `.claude/skills/demo-check/SKILL.md` (rewritten), `.claude/skills/finish-phase/SKILL.md` (only where it says the demo is always needed), `.claude/skills/phase-tracking/SKILL.md` ("Before opening the PR" names the count)
- On GitHub: the label `deferred-checks` and the issue `Deferred demo checks` on the Szop project at ⬜ Backlog, made with `gh` (the owner's login, decision 11)

**Interfaces:**
- Consumes: `pnpm check:prodlike --keep` and `--down` (Tasks 2 and 3).
- Produces: the skill text Task 5's docs link to; the issue's number, which Task 5 writes into `project-tracking.md`.

- [ ] **Step 1: Make the label and the issue**

`gh label create deferred-checks --description "Checks deferred to the next demo (ADR 0064, decision 3)"`; `gh issue create --title "Deferred demo checks" --label deferred-checks --body …` with a body that says what the list is, the counting rule, and an empty checklist; add it to the project and set Status to ⬜ Backlog (the `/phase-tracking` skill has the commands). Note its number.

- [ ] **Step 2: Rewrite `/demo-check`**

The four steps of the spec's [`/demo-check`](../specs/2026-11-03-PH-44-leaner-demo-check-design.md#demo-check-1) section, with the buckets table linked (not copied), the counting rule with its `gh pr list --state merged --search "merged:>YYYY-MM-DD" --json headRefName` command and the `<type>/ph-NN-…` filter, `--keep` always passed, Lighthouse with `--chrome-flags="--headless --ignore-certificate-errors"` on `https://localhost:8443/`, and `--down` at the end. Keep ADR 0059's one-table message and "Claude never triggers `demo-up` or `demo-down`". Update the skill's `description` front matter.

- [ ] **Step 3: `/finish-phase` and `/phase-tracking`**

Only the lines the spec names.

- [ ] **Step 4: Check the skill by reading it as a fresh session would**

Read the rewritten skill against this branch's diff: it must propose the local checks and no AWS demo (the spec's Demo check, last line). Fix what it gets wrong.

- [ ] **Step 5: `pnpm check`, commit**

```bash
git commit -m "feat(claude): propose checks from the diff in /demo-check"
```

---

### Task 5: The definition of done and the process docs

**Files:**
- Modify: `docs/development/definition-of-done.md`, `.github/pull_request_template.md`, `docs/superpowers/specs/CLAUDE.md`, `docs/development/project-tracking.md`, `docs/development/phase-walkthrough.md`, `docs/development/ci-cd.md`

**Interfaces:**
- Consumes: Task 4's issue number and skill.

- [ ] **Step 1: The definition of done and the template**

As the spec's [The definition of done and the PR template](../specs/2026-11-03-PH-44-leaner-demo-check-design.md#the-definition-of-done-and-the-pr-template) lists, item by item. The item's label in both files is `Checks`.

- [ ] **Step 2: The other docs**

`specs/CLAUDE.md`: the "Demo check" section's rule. `project-tracking.md`: the label, the issue (linked by number) and a row in "How items move". `phase-walkthrough.md` step 5: a phase with local checks only, and when the demo is needed. `ci-cd.md`: wherever it says the demo check comes with every phase. Keep each `## Contents` in sync.

- [ ] **Step 3: Check the links**

Run: `grep -rn "Demo check\|demo check" docs .github .claude CLAUDE.md | grep -v "docs/archive\|docs/audits\|docs/decisions\|docs/superpowers"`
Expected: every remaining hit is right under the new rules.

- [ ] **Step 4: `pnpm check`, commit**

```bash
git commit -m "docs: make the demo check a set of checks chosen from the diff"
```

---

### Task 6: The GitHub login and the ADR notes

**Files:**
- Modify: `docs/architecture/threat-model.md`, `docs/architecture/stack-overview.md`, `docs/glossary.md`, `docs/decisions/0008-hosting.md`, `0013-visual-design.md`, `0059-session-skills.md`, `0062-urgent-security-fixes.md`
- On GitHub: a comment on [#360](https://github.com/luiki-dev/szop/issues/360) linking ADR 0064; the issue stays closed

- [ ] **Step 1: The notes**

Run `/new-adr` for the notes' format. ADR 0008 decision 29, ADR 0013 decision 4 and ADR 0059 decision 9 get ✏️ refined by ADR 0064; ADR 0062 decision 5 gets 🔍 revisited.

- [ ] **Step 2: The other docs**

`threat-model.md`: the token was withdrawn, the deny rules and the push hook are the only guard; the Claude Code row is unchanged. `stack-overview.md`: a TLS-terminating proxy and a private certificate authority, short. `glossary.md`: SAN, if missing.

- [ ] **Step 3: The comment on #360**

`gh issue comment 360 --body "…"`: one or two sentences linking ADR 0064, decision 11.

- [ ] **Step 4: `pnpm check`, commit**

```bash
git commit -m "docs: record the withdrawn token and the ADR notes for PH-44"
```

After this task the branch is finished with `/finish-phase`; the owner then runs `/demo-check` and `pnpm check:prodlike` once (the spec's [Demo check](../specs/2026-11-03-PH-44-leaner-demo-check-design.md#demo-check)).
