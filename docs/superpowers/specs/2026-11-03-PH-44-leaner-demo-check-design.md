# PH-44 Leaner demo check: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [The three buckets](#the-three-buckets)
  - [The production-like environment](#the-production-like-environment)
  - [The database's certificate authority](#the-databases-certificate-authority)
  - [The local check script](#the-local-check-script)
  - [The deferred-checks issue](#the-deferred-checks-issue)
  - [`/demo-check`](#demo-check-1)
  - [The definition of done and the PR template](#the-definition-of-done-and-the-pr-template)
  - [Claude's GitHub login](#claudes-github-login)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

The demo environment comes up only when a PR changes what only AWS can show, everything a local copy of production can show is checked on the owner's machine at the owner's choice, and "just in case" checks wait for the next demo, at most four phases ([PH-44](../../roadmap.md#ph-44-leaner-demo-check)).

## Decisions

[ADR 0064](../../decisions/0064-leaner-demo-check-phase-details.md#decisions).

## The design

### The three buckets

`/demo-check` sorts every hand check a PR could need into one of three buckets, by the PR's diff against `main` (decisions 1 to 3):

| Bucket | When | Where | Examples |
|---|---|---|---|
| **AWS** | The diff changes what only AWS can show | `demo-up`, the check, `demo-down` | a resource or variable under `infra/demo` or `infra/base`; `.github/workflows/demo-*.yml`; a task definition's environment or secrets; a behavior the spec marks "needs AWS" |
| **Local** | The diff changes what the production-like environment can show | `pnpm check:prodlike`, then the owner's look and Lighthouse in the same environment | `apps/api/src/security/`, `auth/`, `db/` (migrations, `db-setup`, TLS), `config.ts`, the `Dockerfile`, a major update of a runtime dependency, any UI change (Lighthouse), the spec's behaviors |
| **Deferred** | The diff could affect AWS without changing it directly | Added to the deferred-checks issue | an AWS provider bump in `infra/*/.terraform.lock.hcl`; a change to code the demo workflows run that no test covers |

The table's examples are a guide, not a rule list: Claude says for each proposed check why the diff calls for it, and the owner decides (decision 2). A PR whose diff touches none of these, such as documentation or a component covered by E2E, gets no proposal: `Checks` is `➖ N/A`.

**Repeating** (decision 4): after a check passed, a later commit calls for it again only when it changes that check's area. A fix in a React component after the local check of a CSP change does not repeat the CSP check; a change to `infra/demo` after the demo does repeat the demo.

### The production-like environment

A new profile in `compose.yaml`, `prodlike` (decision 7). Its services sit next to the existing ones and do not touch the developer's database or the `app` and `scale` profiles:

- **`postgres-tls`**: the same `postgres:18.6` image as `postgres`, its own data in a volume, with `ssl=on`, `ssl_cert_file` and `ssl_key_file` pointing at the mounted server certificate, and `hostssl` lines only, so a connection without TLS is refused. It publishes no port.
- **`db-setup-prodlike`**: the image (`szop:local`) running `node src/db-setup.ts`, as the demo's ECS task does, against `postgres-tls`. It runs once and exits, and the app waits for it (`service_completed_successfully`).
- **`app-prodlike`**: the image with the app's settings as on AWS where they matter: `DATABASE_TLS=verify-full`, `DATABASE_CA_FILE` pointing at the mounted local certificate authority, `DATABASE_HOST=postgres-tls`, the database user and password that `db-setup` gives the app's role, `APP_ORIGIN=https://localhost:8443`, `TRUSTED_PROXIES` set to the profile's network subnet, `read_only: true`. It publishes no port.
- **`nginx-prodlike`**: `nginx:1.31.7-alpine` with `compose/nginx-prodlike.conf`. It listens on 8443 with TLS (the server certificate for `localhost`) and proxies to `app-prodlike` with `X-Forwarded-For` and `X-Forwarded-Proto`. On 8080 it answers every request with a `301` to `https://localhost:8443` and the same path, as the load balancer's listener does. It sets `Host` from `$http_host`, not `$host`: the API's cross-site check compares the `Host` header, port included, with the `Origin` when `Sec-Fetch-Site` is missing, and `$host` drops the port (the scale profile's config would break it). It publishes `127.0.0.1:8443:8443` and `127.0.0.1:8082:8080`; 8080 and 8081 stay with the `app` and `scale` profiles.

**The network** _(Claude's call)_. The four services share a network of their own, `prodlike`, declared with a fixed subnet, `10.89.44.0/24`, so `TRUSTED_PROXIES` can name it. Without trusting nginx, the API ignores `X-Forwarded-Proto` and `X-Forwarded-For`, and the check proves nothing. If the subnet clashes with another network on the owner's machine, Docker refuses to create it, and the script fails with that message. The subnet is then changed in `compose.yaml` and `TRUSTED_PROXIES` together.

**Certificates.** The script makes them at each run with `openssl` into `.prodlike/certs/`, which `.gitignore` lists: a throwaway certificate authority, a server certificate for `localhost` (nginx) and one for `postgres-tls` (PostgreSQL). Each server certificate has its name in the subject alternative name (SAN), since `verify-full` checks the host. PostgreSQL's key file must be owned by the server's user and mode `0600`; the builder makes that hold inside the container. Nothing is committed and the authority is never added to the owner's system: the browser warns about it once per session.

### The database's certificate authority

`apps/api/src/config.ts` gains `DATABASE_CA_FILE`: optional, a path (decision 8). `DatabaseSettings` gains `caFile`, set to the RDS bundle's path (`rdsCaBundle`) when the variable is unset. `createDatabase` reads `settings.caFile` instead of `rdsCaBundle`. A missing file still stops startup, as now. With `DATABASE_TLS=none` the setting is ignored. `db-setup` reads its own settings (`apps/api/src/db/setup-role.ts`, `loadSetupConfig`), so the same variable is added there too. Nothing changes on AWS: the task definitions do not set the variable.

### The local check script

`scripts/check-prodlike.sh`, run as `pnpm check:prodlike`, in the style of `check-image.sh` and `check-scale.sh`: builds the image unless `--no-build`, and prints `FAIL: …` followed by the services' logs on a failure. It:

1. makes the certificates (above);
2. starts the profile with `docker compose --profile prodlike up --wait` on a fresh database (the volume removed first);
3. checks, with `curl --cacert` against the throwaway authority:
   - `https://localhost:8443/api/health` answers `ok` with the commit the image was built from;
   - `http://localhost:8082/lists?x=1` answers `301` with `Location: https://localhost:8443/lists?x=1`;
   - the response to `/` has `Strict-Transport-Security` and `Content-Security-Policy`;
4. checks that the app's connections to `postgres-tls` use TLS (`pg_stat_ssl` joined with `pg_stat_activity` for the app's role: every row `ssl = true`);
5. runs the Playwright project `prodlike` (below);
6. with `--keep`, leaves the environment up and prints the URL, so the owner can look and Claude can run Lighthouse; without it, removes the profile's containers and volume on exit. `--keep` keeps the environment after a failure too, so it can be looked into _(Claude's call)_. `--down` removes them later.

**The Playwright project `prodlike`.** In `e2e/`, its own config file (`playwright.prodlike.config.ts`) with `testDir: "prodlike"`, and its tests in `e2e/prodlike/`, outside `e2e/tests/`, so `pnpm test:e2e` and CI never run them _(Claude's call)_. They import the console and CSP listener from `e2e/support/` as the journeys do, and fall under the same lint and typecheck as the rest of `e2e/`. It uses `baseURL: https://localhost:8443`, `ignoreHTTPSErrors: true`, Chromium only and no `webServer`. It holds:

- a guest's first change (the PH-16a journey's first step, "New list"): the session cookie is `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`;
- `/` and every screen the router knows: no console message and no CSP violation, with the same listener the E2E journeys use.

**Lighthouse.** Run by Claude against the kept environment, from the scratchpad as `/demo-check` does today, with `--chrome-flags="--headless --ignore-certificate-errors"` on `https://localhost:8443/` (decision 6).

### The deferred-checks issue

One open issue, `Deferred demo checks`, labelled `deferred-checks` (a new label), on the project at ⬜ Backlog (decision 3). Its body is a checklist, one line per check: what to check, the PR it came from and the date that PR was merged, filled in at the merge's next `/demo-check` or `/phase-tracking`.

**Counting** _(Claude's call)_: the phase PRs counted are the merged PRs whose branch is a phase branch (`<type>/ph-NN-…`), merged on or after the date of the oldest open line, the PR that line came from left out, whether they deferred anything or not, plus the PR being prepared. Other PRs do not count. `gh pr list --state merged --search "merged:>=YYYY-MM-DD" --json headRefName` gives them. `/demo-check`:

- adds a line for every check the owner defers;
- at every AWS demo, adds every open line to the demo's list and ticks those that passed;
- before a phase PR, counts the phase PRs since the oldest open line was added (its own PR left out). When this PR is the fourth, it proposes an AWS demo to clear the list, even if nothing in its diff calls for one.

The issue stays open when its list is empty. `/phase-tracking`'s "Before opening the PR" step names the count.

### `/demo-check`

`.claude/skills/demo-check/SKILL.md` is rewritten around the buckets (decision 9), keeping ADR 0059's one-table message:

1. Read `git diff --name-only main...HEAD` and, where the names are not enough, the diff itself. Read the spec's "Demo check" section and the deferred-checks issue.
2. Send one message: a table of proposed checks, each with its bucket, the reason from the diff, who does it and where; then the question of which to run. A PR with nothing to propose gets one line saying so, and `Checks` is `➖ N/A`.
3. Run the chosen local checks (`pnpm check:prodlike --keep`, Lighthouse). `--keep` is always passed, even when no hand check or Lighthouse was chosen: one way of running is simpler than choosing one, and step 4 removes the environment anyway _(Claude's call)_. Then list the owner's behaviors as rows with the steps written out, and the AWS rows as today (sign-in, `infra/base`, `demo-up`, health, redirect, console, `demo-down`). Claude still never triggers `demo-up` or `demo-down`.
4. Report one line per check ✅ or ❌, update the deferred-checks issue, fill in the PR's "Checked by hand:" and "Deferred:" lines, and run `pnpm check:prodlike --down`.

`/finish-phase` still offers `/demo-check` after the PR opens; its text changes only where it names the demo as always needed.

### The definition of done and the PR template

`docs/development/definition-of-done.md` (decision 10):

- item 4 becomes **Checks** (`Checks`): the checks the owner chose from `/demo-check`'s proposal passed on the final head; `➖ N/A` when nothing was proposed or the owner chose none;
- "The demo check" section becomes "The checks", with the three buckets and a link to this design's table;
- "Which PRs need which items": item 4 applies to every PR by its diff, the same for phases and the rest. The line on Dependabot's PRs goes;
- "When the demo check must be repeated" becomes "When a check must be repeated", with decision 4's rule;
- item 6's "to check at the next demo" becomes "to check by hand".

`.github/pull_request_template.md`: `Demo check` → `Checks`; the comment says "Checked by hand:" and "Deferred:".

`docs/superpowers/specs/CLAUDE.md`: the spec's "Demo check" section lists each behavior with where it is checked, local or AWS, and the line "Checked by hand:" with the criteria's IDs.

### Claude's GitHub login

The owner already deleted `GH_TOKEN` from `.claude/settings.local.json`, and sessions use the owner's `gh auth login` (decision 11). In the repository:

- [threat model](../../architecture/threat-model.md): the "deny rules and the token" item says the token was withdrawn and the deny rules and push hook are the only guard; the Claude Code row is unchanged;
- ADR 0062, decision 5, gets the 🔍 revisited note;
- [#360](https://github.com/luiki-dev/szop/issues/360) gets a comment linking this ADR. It stays closed.

## Acceptance criteria

None: the phase changes how Szop is checked, not what it does. [NFR-3](../../requirements/NFR-non-functional-requirements.md#nfr-3) and [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4) are unchanged; only where their hand checks run changes.

## Tests

- `apps/api/src/config.test.ts`: `DATABASE_CA_FILE` unset gives the RDS bundle's path; set gives the resolved path.
- `setup-role.ts`'s tests: the same for `db-setup`'s settings.
- The database tests that cover `createDatabase`'s TLS options: `verify-full` reads `caFile`.
- `pnpm check:prodlike` is itself the test of the profile and the script, run by the builder and once by the owner. It is not in CI (decision 2).
- Mutation testing covers the config change as it covers `config.ts` today.

## Documentation

- [definition-of-done.md](../../development/definition-of-done.md), the PR template, [specs/CLAUDE.md](CLAUDE.md), `/demo-check`, `/finish-phase` where needed, `/phase-tracking` (the count), as above.
- [testing.md](../../development/testing.md): the production-like check as a layer of its own, run by hand, and how to read its failures.
- [scripts.md](../../development/scripts.md): `check:prodlike`.
- [tools/docker.md](../../development/tools/docker.md): the `prodlike` profile.
- [setup.md](../../development/setup.md): `openssl` as a prerequisite of `check:prodlike`, and the browser's certificate warning.
- [project-tracking.md](../../development/project-tracking.md): the `deferred-checks` label and the issue, and a row in "How items move".
- [phase-walkthrough.md](../../development/phase-walkthrough.md): step 5 shows a phase with local checks only, and says when the demo is needed.
- [ci-cd.md](../../development/ci-cd.md): where it says the demo check comes with every phase.
- [threat-model.md](../../architecture/threat-model.md) as above.
- [architecture.md](../../architecture/architecture.md) and [stack-overview.md](../../architecture/stack-overview.md): `DATABASE_CA_FILE`, and the concept of a TLS-terminating proxy and a private certificate authority.
- [glossary.md](../../glossary.md): SAN, if not there.
- Notes on ADR 0008 (decision 29), ADR 0013 (decision 4), ADR 0059 (decision 9) and ADR 0062 (decision 5).

## Demo check

The phase changes no AWS resource and no workflow that `demo-up` runs, so by its own rule it needs no demo. Checked by hand, locally:

- `pnpm check:prodlike --keep` passes;
- in the owner's browser at `https://localhost:8443`, past the certificate warning: "New list", a name, Enter; the list shows, and the cookie in the browser's tools is `__Host-` and `Secure`;
- `http://localhost:8082` lands on `https://localhost:8443`;
- `/demo-check` run on this PR proposes the local checks above and no AWS demo.

Checked by hand: none (no acceptance criteria).

## Risks

- **A difference between the local environment and AWS hides a bug.** nginx is not the load balancer, and the throwaway authority is not RDS's. Decision 1 keeps what only AWS shows on the demo, and decision 3 bounds what slips through.
- **PostgreSQL's key file permissions.** The server refuses a key readable by others. A bind mount from WSL may not keep the mode. If so, the builder copies the key in an entrypoint step or uses a Docker volume. The builder settles this before writing the rest.
- **The owner's machine is slower than the demo.** Lighthouse's simulated throttling makes its scores mostly independent of it, but a noisy machine can move TBT. A borderline score is re-run once.
- **The local database user is a superuser.** The `postgres` image makes `szop` one, unlike RDS's master user, so `db-setup` runs with more rights locally than on AWS. The local check does not cover the roles' privileges; a change to them is in the AWS bucket.
- **The `__Host-` cookie needs a secure context on a host without a port in the cookie's scope.** Chromium treats `https://localhost:8443` as secure; the Playwright check proves it.

## Out of scope

- Keeping the demo up longer or making `demo-up` faster (the owner ruled it out in the brainstorm).
- Running the production-like check in CI.
- A second GitHub account for Claude, or any other limit beyond the deny rules.
- The other environments' approvals and rulesets.

## Left to the builder

- The names of the Compose services and volumes, as long as they say `prodlike`.
- How the script waits for `db-setup` and the app, and how it removes the volume.
- The `openssl` commands and the certificates' lifetime (short is fine).
- How the Playwright project lists the router's screens: read from `apps/web/src/routes` or written out.
- The deferred-checks issue's exact body format.
- The wording of `/demo-check`'s message, keeping ADR 0059's table.
