# Security audit

- **Date:** 2026-11-01
- **Scope:** `main` at commit `1e97bb9`: the API and database, the single-page application (SPA) and the landing page, the Terraform in `infra/`, CI/CD and the supply chain, the GitHub settings, Claude Code's configuration, and the live demo at `szop.dzwoniec.com` (running commit `cbe4329`, the same code).
- **Status:** a point-in-time record. It describes that day's code, settings and advisories, and stays as written. What is decided from it goes to GitHub as open points and bugs, triaged with the owner.

The audit looked for holes, not for style. The baseline was the [threat model](../architecture/threat-model.md) and [ADR 0012](../decisions/0012-security-baseline.md): every finding says whether it is **new**, a **docs mismatch** (the docs claim a guard the code or the settings do not have), an **accepted risk that is underestimated** (it is in the threat model's "Risks accepted on purpose", but its reach is wider than written), or a **planned gap exploitable now** (a later phase closes it, but the public demo is open to it today). Risks the threat model accepts and that hold as written are not repeated.

**Severity** follows the project's scale, judged for a public demo with real anonymous users on the owner's personal AWS account: 🔴 critical (exploitable by an outsider, with loss of data or of the account), 🟠 major (an outsider can cause real harm, or a documented boundary does not hold), ⚪ minor (needs an unlikely precondition, or the harm is small or bounded). Items needing no fix, or only an optional one, are listed under [Observations](#observations). **Effort:** S under an hour, M half a day, L one to three days, XL a phase of its own.

## Contents

- [Summary](#summary)
- [How it was done](#how-it-was-done)
- [Application](#application)
  - [SEC-01 Every Better Auth endpoint is open, and `update-user` stores about 1 MB per guest](#sec-01-every-better-auth-endpoint-is-open-and-update-user-stores-about-1-mb-per-guest)
  - [SEC-02 The database grows without bound](#sec-02-the-database-grows-without-bound)
  - [SEC-03 One session can exhaust the database pool](#sec-03-one-session-can-exhaust-the-database-pool)
  - [SEC-04 Session tokens can reach the log, and are stored in plain text](#sec-04-session-tokens-can-reach-the-log-and-are-stored-in-plain-text)
  - [SEC-05 The SPA puts the route's list ID into the API path unencoded](#sec-05-the-spa-puts-the-routes-list-id-into-the-api-path-unencoded)
- [GitHub, Claude Code and the owner's machine](#github-claude-code-and-the-owners-machine)
  - [SEC-06 The owner's admin token in Claude sessions defeats the deploy approval](#sec-06-the-owners-admin-token-in-claude-sessions-defeats-the-deploy-approval)
  - [SEC-07 The `gh` deny rules miss other spellings](#sec-07-the-gh-deny-rules-miss-other-spellings)
  - [SEC-08 The push hook misses escapes, wrappers and shell keywords](#sec-08-the-push-hook-misses-escapes-wrappers-and-shell-keywords)
  - [SEC-09 Checking out a fork's branch runs its husky hooks](#sec-09-checking-out-a-forks-branch-runs-its-husky-hooks)
  - [SEC-10 No private way to report a vulnerability](#sec-10-no-private-way-to-report-a-vulnerability)
  - [SEC-11 Administrators may bypass every environment's rules](#sec-11-administrators-may-bypass-every-environments-rules)
- [CI/CD and the supply chain](#cicd-and-the-supply-chain)
  - [SEC-12 Dependabot does not see the transitive dependencies](#sec-12-dependabot-does-not-see-the-transitive-dependencies)
  - [SEC-13 Known advisories in production dependencies](#sec-13-known-advisories-in-production-dependencies)
  - [SEC-14 One approved `demo-up` becomes standing access through the nightly teardown](#sec-14-one-approved-demo-up-becomes-standing-access-through-the-nightly-teardown)
  - [SEC-15 `demo-up`'s `ref` input deploys any commit, and the approval does not show it](#sec-15-demo-ups-ref-input-deploys-any-commit-and-the-approval-does-not-show-it)
  - [SEC-16 Dependabot's provider bumps run in `plan` before anyone reads them](#sec-16-dependabots-provider-bumps-run-in-plan-before-anyone-reads-them)
- [AWS infrastructure](#aws-infrastructure)
  - [SEC-17 The deploy role can pre-empt a release image](#sec-17-the-deploy-role-can-pre-empt-a-release-image)
  - [SEC-18 The deploy role's cost is bounded less than the docs say](#sec-18-the-deploy-roles-cost-is-bounded-less-than-the-docs-say)
  - [SEC-19 The plan role can read the owner's personal data](#sec-19-the-plan-role-can-read-the-owners-personal-data)
  - [SEC-20 Let's Encrypt may issue a wildcard that covers the app](#sec-20-lets-encrypt-may-issue-a-wildcard-that-covers-the-app)
  - [SEC-21 The threat model is behind the code](#sec-21-the-threat-model-is-behind-the-code)
- [Observations](#observations)
- [Checked and found sound](#checked-and-found-sound)
- [Not covered](#not-covered)
- [Suggested order](#suggested-order)

## Summary

No critical finding. Three major ones: the cheapest way to take the demo down (SEC-01), a boundary the docs rely on that does not hold against a Claude session (SEC-06), and a dependency alerting control that is silently off (SEC-12). The rest are minor, most of them about what an already-approved deploy can reach, or guard-rails with gaps.

| ID | Area | Severity | Finding | Class | Effort |
|---|---|---|---|---|---|
| [SEC-01](#sec-01-every-better-auth-endpoint-is-open-and-update-user-stores-about-1-mb-per-guest) | Application | 🟠 Major | Every Better Auth endpoint is open; `update-user` stores about 1 MB per guest | Accepted, underestimated | S |
| [SEC-02](#sec-02-the-database-grows-without-bound) | Application | ⚪ Minor | The database grows without bound | Planned gap, exploitable now | S (interim) |
| [SEC-03](#sec-03-one-session-can-exhaust-the-database-pool) | Application | ⚪ Minor | One session can exhaust the database pool | Planned gap, exploitable now | M |
| [SEC-04](#sec-04-session-tokens-can-reach-the-log-and-are-stored-in-plain-text) | Application | ⚪ Minor | Session tokens can reach the log, and are stored in plain text | Docs mismatch | M |
| [SEC-05](#sec-05-the-spa-puts-the-routes-list-id-into-the-api-path-unencoded) | Application | ⚪ Minor | The SPA puts the route's list ID into the API path unencoded | New | S |
| [SEC-06](#sec-06-the-owners-admin-token-in-claude-sessions-defeats-the-deploy-approval) | GitHub, Claude | 🟠 Major | The owner's admin token in Claude sessions defeats the deploy approval | Docs mismatch | S, then M |
| [SEC-07](#sec-07-the-gh-deny-rules-miss-other-spellings) | GitHub, Claude | ⚪ Minor | The `gh` deny rules miss other spellings | New | S |
| [SEC-08](#sec-08-the-push-hook-misses-escapes-wrappers-and-shell-keywords) | GitHub, Claude | ⚪ Minor | The push hook misses escapes, wrappers and shell keywords | New | S |
| [SEC-09](#sec-09-checking-out-a-forks-branch-runs-its-husky-hooks) | GitHub, Claude | ⚪ Minor | Checking out a fork's branch runs its husky hooks | New | S |
| [SEC-10](#sec-10-no-private-way-to-report-a-vulnerability) | GitHub, Claude | ⚪ Minor | No private way to report a vulnerability | New | S |
| [SEC-11](#sec-11-administrators-may-bypass-every-environments-rules) | GitHub, Claude | ⚪ Minor | Administrators may bypass every environment's rules | Docs mismatch | S |
| [SEC-12](#sec-12-dependabot-does-not-see-the-transitive-dependencies) | CI/CD | 🟠 Major | Dependabot does not see the transitive dependencies | New | S–M |
| [SEC-13](#sec-13-known-advisories-in-production-dependencies) | CI/CD | ⚪ Minor | Known advisories in production dependencies | New | S |
| [SEC-14](#sec-14-one-approved-demo-up-becomes-standing-access-through-the-nightly-teardown) | CI/CD | ⚪ Minor | One approved `demo-up` becomes standing access through the nightly teardown | Accepted, underestimated | M |
| [SEC-15](#sec-15-demo-ups-ref-input-deploys-any-commit-and-the-approval-does-not-show-it) | CI/CD | ⚪ Minor | `demo-up`'s `ref` input deploys any commit, and the approval does not show it | New | S |
| [SEC-16](#sec-16-dependabots-provider-bumps-run-in-plan-before-anyone-reads-them) | CI/CD | ⚪ Minor | Dependabot's provider bumps run in `plan` before anyone reads them | Accepted, underestimated | S |
| [SEC-17](#sec-17-the-deploy-role-can-pre-empt-a-release-image) | AWS | ⚪ Minor | The deploy role can pre-empt a release image | Accepted, underestimated | M |
| [SEC-18](#sec-18-the-deploy-roles-cost-is-bounded-less-than-the-docs-say) | AWS | ⚪ Minor | The deploy role's cost is bounded less than the docs say | Accepted, underestimated | M |
| [SEC-19](#sec-19-the-plan-role-can-read-the-owners-personal-data) | AWS | ⚪ Minor | The plan role can read the owner's personal data | Docs mismatch | S |
| [SEC-20](#sec-20-lets-encrypt-may-issue-a-wildcard-that-covers-the-app) | AWS | ⚪ Minor | Let's Encrypt may issue a wildcard that covers the app | Docs mismatch | S |
| [SEC-21](#sec-21-the-threat-model-is-behind-the-code) | Threat model | ⚪ Minor | The threat model is behind the code | Docs mismatch | S |

**By area and severity:**

| Area | 🔴 Critical | 🟠 Major | ⚪ Minor |
|---|---|---|---|
| Application | 0 | 1 | 4 |
| GitHub, Claude Code and the owner's machine | 0 | 1 | 5 |
| CI/CD and the supply chain | 0 | 1 | 4 |
| AWS infrastructure | 0 | 0 | 4 |
| Threat model | 0 | 0 | 1 |

## How it was done

- **Reading the code.** Four read-only reviews in parallel, one per area (API and database; Terraform; CI/CD, supply chain and Docker; the SPA, the landing page, the GitHub settings and Claude Code's configuration), each against the threat model and the area's ADRs. Every finding they reported was then checked against the code, the settings or the live demo before it entered this report; two of their estimates were corrected by measurement (SEC-01, SEC-02).
- **Scanners**, run in throwaway containers with nothing written to the repository: `gitleaks` over the whole git history (704 commits; two hits, both the test fixture's placeholder secret in `apps/api/src/config.test.ts`), Trivy over the tree (misconfigurations and secrets) and over the base image, and `pnpm audit`.
- **The GitHub settings**, read with `gh api` GETs: the rulesets, environments, Actions permissions, security features and alerts.
- **The live demo**, by hand, with a few dozen requests in all: response headers, TLS versions and the certificate, the HTTP redirect, the cross-site check, the JSON-only body, the body limit, list isolation between two guests, the rate limit of the anonymous sign-in with and without a forged `X-Forwarded-For`, and Better Auth's other endpoints. The test left three guests, two lists and one `name` of 500 KB, set back to `Anonymous` afterwards, in the demo's database, which the nightly destroy removes.

## Application

### SEC-01 Every Better Auth endpoint is open, and `update-user` stores about 1 MB per guest

🟠 **Major** · accepted risk, underestimated · effort **S** · confirmed on the demo

- **Evidence:** `apps/api/src/auth/routes.ts:13-15` forwards every `GET` and `POST` under `/api/auth/*` to Better Auth; `apps/api/src/auth/auth.ts` sets no `disabledPaths`. Better Auth's `update-user` accepts any `name` and `image`, which land in `users.name` and `users.image`, both `text` (`apps/api/src/db/auth-schema.ts`). `apps/api/src/app.ts` sets no `bodyLimit`, so Fastify's default of 1 MiB applies. The demo's database has 20 GB and no storage autoscaling (`infra/demo/database.tf:43`). The SPA itself uses only `sign-in/anonymous` and `get-session` (`apps/web/src/api/client.ts`).
- **On the demo:** a guest's `POST /api/auth/update-user` with a 500 KB `name` and `"image": "javascript:alert(1)"` answered `200`, and `get-session` then returned both as stored. Twelve such calls in a row all passed. The anonymous sign-in allows about five per 10 seconds per address and task, and a forged `X-Forwarded-For` does not get round it.
- **Attack:** sign in, store 1 MB of random data (which Postgres cannot compress), repeat with a new cookie jar. That is roughly 0.5 to 1 MB a second from one address, so one address fills the 20 GB in 6 to 11 hours and ten addresses in about one; the demo then stops accepting writes until the nightly destroy. Every such guest's `get-session` also returns its megabyte. The threat model's denial-of-service cell counts rows of `users`; the real unit is a megabyte per guest. The `javascript:` image is harmless today, since no screen shows it, and becomes a stored cross-site scripting (XSS) risk as soon as one does.
- **Fix:** forward only the paths Szop uses (`sign-in/anonymous`, `get-session`, `sign-out`, and later PH-18's) in `authRoutes`, or list the others in Better Auth's `disabledPaths`; this also closes `update-session`, `revoke-*`, `list-sessions` and the rest. Set a global `bodyLimit` near the largest real body (16 KiB is plenty). Add a test that an unknown auth path answers `404`.

### SEC-02 The database grows without bound

⚪ **Minor** (it becomes the way in once SEC-01 is fixed) · planned gap, exploitable now ([PH-20](../roadmap.md#ph-20-quotas-and-rate-limits), [ACC-7](../requirements/ACC-accounts-and-guest-mode.md#acc-7)) · effort **S** for the interim steps

- **Evidence:** a guest's first write copies the whole seed, 561 entries, into its workspace (`apps/api/src/access/workspace.ts:49-61`, `apps/api/src/catalog/seed.yaml`). Every sign-in adds a `users` and a `sessions` row, the latter with the client's User-Agent. `POST /api/lists` has no limit. Abandoned guests are never removed until the cleanup ([PH-31](../roadmap.md#ph-31-automatic-cleanup)) exists.
- **Attack:** sign in, create one list, repeat: about 560 rows a second per address at the measured sign-in rate, a few hundred MB an hour. Or keep one session and create lists in a loop.
- **Fix now:** a stricter Better Auth rule for `/sign-in/anonymous` (for example 30 an hour per address), and either RDS storage autoscaling (`max_allocated_storage`) or a `FreeStorageSpace` alarm, so that a full disk is seen rather than found. **Then:** PH-20's quotas and the cleanup.

### SEC-03 One session can exhaust the database pool

⚪ **Minor** · planned gap, exploitable now ([PH-20](../roadmap.md#ph-20-quotas-and-rate-limits)) · effort **M** · not load-tested

- **Evidence:** the pool has five connections per task with a two-second wait (`apps/api/src/db/database.ts:29,32`); every request to lists and the catalog reads the session, and an owner's `GET /api/catalog` runs three more queries; only Better Auth's own routes are rate-limited.
- **Attack:** one cookie and a few hundred requests a second to `/api/catalog`: other users get `500` and `/api/health` answers `503`, so the load balancer may also take the tasks out.
- **Fix:** bring a coarse per-address limit forward (`@fastify/rate-limit` with the in-memory store, as the threat model already plans for PH-20), then PH-20's quotas.

### SEC-04 Session tokens can reach the log, and are stored in plain text

⚪ **Minor** · docs mismatch · effort **M** · confidence medium, not reproduced

- **Evidence:** when a query fails, Drizzle's `DrizzleQueryError` puts the query's parameters into its message, and for the session lookup the parameter is the raw token. Better Auth logs such an error to the console and rethrows it as the cause of a `500`, which `apps/api/src/errors.ts:42` logs; pino adds the causes' messages to the line. The same path runs when a session insert fails, as it would on a full disk (SEC-01) or a pool timeout (SEC-03). `sessions.token` is stored as issued (`apps/api/src/db/auth-schema.ts:53`), while the threat model speaks of "tokens stripped from logs" and lists "hashed tokens" for a reader of leaked data.
- **Attack:** anyone who reads the request log during an outage collects tokens. Using one also needs `BETTER_AUTH_SECRET`, because the cookie is signed, so the gain is small.
- **Fix:** an `err` serializer that drops Drizzle's parameters, and Better Auth's `logger` routed through pino with the same redaction; correct the threat model's wording on stored tokens.

### SEC-05 The SPA puts the route's list ID into the API path unencoded

⚪ **Minor** · new · effort **S**

- **Evidence:** `apps/web/src/api/client.ts:134-150` builds `/api/lists/${id}` with `id` from `useParams()` (`apps/web/src/lists/list-page.tsx:20`). React Router decodes `%2F`, and `fetch` resolves `..`, so `/lists/..%2F..%2Fauth%2Fsign-out` makes the page request `/api/auth/sign-out`.
- **Attack:** a crafted link makes the victim's own page send a same-origin `GET` (and, if they then rename, a `PATCH` with a name) to an API path of the attacker's choice; the cross-site check passes, since the request is the SPA's. Nothing harmful answers a `GET` today; it grows with every state-changing route.
- **Fix:** `encodeURIComponent(id)` in both paths, or validate the ID with the shared UUID schema before fetching.

## GitHub, Claude Code and the owner's machine

### SEC-06 The owner's admin token in Claude sessions defeats the deploy approval

🟠 **Major** · docs mismatch · effort **S** for the deny rules, **M** for a separate token · confirmed from the settings, the approval itself not attempted

- **Evidence:** `gh` on the owner's machine holds the owner's token (scopes `repo`, `workflow`), the identity of the repository's only collaborator, an admin. The `demo` environment's only required reviewer is that same account, with `prevent_self_review: false`. `.claude/settings.json` denies `gh pr merge*` and `gh workflow run*` but no `gh api` call. Yet [ADR 0012](../decisions/0012-security-baseline.md), decision 16, says the reviewer on `demo` stops "a new file pushed by Claude Code … or a prompt-injected session", and the threat model calls "the rulesets and the deploy approval" the real boundaries.
- **Attack:** a prompt-injected Claude session (auto mode may not ask) pushes a branch with a workflow that declares `environment: demo`, or dispatches `demo-up` through `gh api …/dispatches`, then approves its own run through `gh api …/actions/runs/<id>/pending_deployments` with `state=approved`. It gets the deploy role, with both database passwords and the Better Auth secret in reach. The same token can rewrite the rulesets and the environments. Any code running as the owner on that machine (a compromised package's install script, for example) can do the same; that part is the usual risk of a developer's machine.
- **Fix now:** deny rules in `.claude/settings.json` for `gh api` calls that touch `pending_deployments`, `dispatches`, `rulesets`, `environments`, `merge` and GraphQL (or deny `gh api` with a method or fields, and allow reads explicitly). **Then:** give Claude sessions their own fine-grained personal access token (PAT) through `GH_TOKEN` in `settings.local.json`, with Contents, Pull requests, Issues and Workflows read and write and no Actions write, Deployments, Environments or Administration; check it with one refused approval. Or make a second account, never signed in on that machine, the only reviewer on `demo`. Correct ADR 0012, decision 16, with a note, and the threat model.
- **Outside the repository:** the owner's `~/.claude/settings.json` auto-mode context says `main` has "classic protection" (it has rulesets only) and "CI/CD deploy targets: None configured" (the `demo` environment holds the deploy role), and its `soft_deny` list names no merge, dispatch, re-run, approval or settings change. Correcting it lowers the chance that auto mode runs such a call unasked.

### SEC-07 The `gh` deny rules miss other spellings

⚪ **Minor** · new · effort **S**

- **Evidence:** the rules are prefixes (`.claude/settings.json:4-5`). `gh pr -R luiki-dev/szop merge`, `gh workflow -R … run`, `gh api -X PUT …/pulls/N/merge`, the GraphQL `mergePullRequest` and `gh run rerun <id>` all pass. The `demo-teardown` environment has no reviewer, so re-running a `demo-down` run destroys the demo.
- **Attack:** a session "helpfully" merges a PR (the required checks still apply) or re-runs a workflow, against the rules "only the owner merges" and "never trigger `demo-up` or `demo-down`".
- **Fix:** add `Bash(gh pr * merge*)`, `Bash(gh workflow * run*)`, `Bash(gh run rerun*)` and the `gh api` rules of SEC-06, or move the `gh` checks into the PreToolUse hook next to the push guard.

### SEC-08 The push hook misses escapes, wrappers and shell keywords

⚪ **Minor** · new (partly named in [ADR 0015](../decisions/0015-git-push-guard-hook.md)) · effort **S**

- **Evidence:** `.claude/hooks/guard-git-push.ts:32-76`. Run against `findViolation`, all of these were allowed: `git push origin \+main`, `git push \-f`, `git push $'-f'`, `env git push -f`, `command`, `time`, `nohup` and `xargs` in front, `(git push -f)`, `{ git push -f; }`, `if …; then git push -f; fi`, `! git push -f`, and `git -c alias.p=push p -f`. ADR 0015 names subshells, `eval`, aliases and scripts as known gaps, not escapes, wrappers or keywords. Tags pushed through a refspec (`HEAD:refs/tags/x`) also pass; the `version-tags` ruleset still refuses `v*`.
- **Attack:** a session writes `time git push -f` and rewrites a feature branch. `main` stays protected by its ruleset.
- **Fix:** in `parseSegments`, unescape `\x` and `$'…'` and treat `(`, `)`, `{` and `}` as separators; in `pushArguments`, skip the wrappers and keywords above with their options; add each case to the tests.

### SEC-09 Checking out a fork's branch runs its husky hooks

⚪ **Minor** · new · effort **S**

- **Evidence:** `.husky/_/h` runs `.husky/<hook>` from the working tree, and `post-checkout`, `post-merge`, `post-rewrite` and `post-commit` are tracked. `pnpm install` on such a branch runs its `prepare` script. The threat model says a fork contributor reaches "nothing beyond the PR itself".
- **Attack:** `gh pr checkout <fork PR>` runs the fork's `post-checkout` as the owner, next to the admin token of SEC-06 and the AWS sign-in cache.
- **Fix:** write it in the git workflow guide: review a fork's PR on GitHub, or check it out with `HUSKY=0` and install with `--ignore-scripts`. Optionally move the graphify hooks to the untracked `.git/hooks`. (`.husky/post-checkout:79` also holds the owner's local path to graphify's Python, which is harmless.)

### SEC-10 No private way to report a vulnerability

⚪ **Minor** · new · effort **S**

- **Evidence:** private vulnerability reporting is off, and there is no `SECURITY.md`. The repository is public and the demo is live.
- **Attack:** none; someone who finds a hole files a public issue or says nothing.
- **Fix:** turn on private vulnerability reporting, add a short `SECURITY.md` (what is in scope, how to report), and add both to [GitHub settings](../development/github-settings.md).

### SEC-11 Administrators may bypass every environment's rules

⚪ **Minor** · docs mismatch · effort **S** · confidence medium on what the bypass skips

- **Evidence:** `can_admins_bypass: true` on `demo`, `demo-teardown`, `github-pages` and `release`; the [GitHub settings](../development/github-settings.md) page mentions it nowhere, its checks leave out `github-pages`, and that row still describes the temporary `feat/landing-page` rule (the live rule is `main` only, which is right).
- **Attack:** the owner's token, or a session holding it (SEC-06), may deploy past an environment's rules. For `release` and `demo-teardown` the role's trust still requires `main`; `github-pages` has nothing behind it.
- **Fix:** switch "Allow administrators to bypass configured protection rules" off on all four, and document it with a check.

## CI/CD and the supply chain

### SEC-12 Dependabot does not see the transitive dependencies

🟠 **Major** · new · effort **S–M**

- **Evidence:** GitHub's dependency graph for the repository lists 72 packages, the direct ones, as ranges (`fastify@^5…`); the lockfile holds about 1,220. Dependabot shows no alert in any state, while `pnpm audit --prod` reports ten advisories (SEC-13), published on 2026-10-23 and 2026-10-30. The likely cause is pnpm 12's lockfile of two YAML documents (`pnpm-lock.yaml:1` and `:158` are `---`): Trivy's filesystem scan in this audit found no lockfile target either. CI's Trivy scan of the image runs on pull requests and fails only on high and critical, and nothing scans `main` between pull requests. So [ADR 0010](../decisions/0010-ci-cd.md), decision 18's "Dependabot security updates", covers direct dependencies only.
- **Attack:** a vulnerable or hijacked transitive dependency of Fastify or Better Auth raises no alert and no pull request.
- **Fix:** a scheduled workflow on `main`, without credentials, that runs `pnpm audit --prod --audit-level=moderate` (or OSV-Scanner on the lockfile) and opens an issue or fails visibly; or submit a dependency snapshot through GitHub's dependency submission API so that Dependabot's alerts work. Document the gap until then.

### SEC-13 Known advisories in production dependencies

⚪ **Minor** · new · effort **S**

- **Evidence:** `pnpm audit --prod`: 6 moderate, 4 low, nothing high. `fast-uri` 4.2.1 and 3.1.8 (fixed in 4.2.3 and 3.1.9; GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h, GHSA-333x-w4r6-6crp), through Fastify's `ajv` and `fast-json-stringify`; `glob` 13.0.6 (GHSA-3g3m-2fjr-6pw4) and `minimatch` 10.2.6 (GHSA-g3hv-75wg-m249) through `@fastify/static`. None looks reachable: the API validates requests with Zod, `ajv` uses `fast-uri` on schema IDs, and `@fastify/static` globs the app's own `dist/` at startup. The full audit adds five more, in development tools only (`esbuild` through `drizzle-kit`, `qs` through Stryker).
- **Fix:** `pnpm update -r fast-uri glob minimatch` (or `overrides` in `pnpm-workspace.yaml`), then re-lock.

### SEC-14 One approved `demo-up` becomes standing access through the nightly teardown

⚪ **Minor** · accepted risk, underestimated ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 14) · effort **M**

- **Evidence:** `.github/workflows/demo-down.yml:74-125` reads `deployed_commit` from the demo's state, fetches that commit (any commit GitHub holds, a fork PR's included) and runs its `.terraform-version`, providers and `infra/demo` with `init` and `destroy`, unattended, with the deploy role. The deploy role may write `demo/terraform.tfstate` (`infra/base/ci_roles.tf:278-282`). ADR 0012, decision 16, presents the `main`-only `demo-teardown` as "only workflows already on `main`, merged by the owner, can use it"; that holds for the workflow, not for the Terraform it runs.
- **Attack:** code in one approved `demo-up` records its own commit (or any commit) in the state. Every night after that, its providers, `external` data sources and destroy-time provisioners run with the deploy role, with nobody approving, until the next `demo-up` records another commit. The one-hour session of the approval becomes standing access.
- **Fix:** in `demo-down`, refuse a recorded commit unless `git branch -r --contains` names a branch of this repository (not a pull ref), and fail if its `.terraform.lock.hcl` differs from `main`'s; otherwise destroy with `main`'s code and report what is left (see SEC-18). Add the residual risk to the threat model.

### SEC-15 `demo-up`'s `ref` input deploys any commit, and the approval does not show it

⚪ **Minor** · new · effort **S**

- **Evidence:** `.github/workflows/demo-up.yml:21-24` takes "a branch, tag or full commit hash", which `actions/checkout` fetches even from a fork's pull ref. The workflow has no `run-name`, so *Review deployments* shows "demo-up on main" whatever the input says.
- **Attack:** someone with write access (in practice, a session holding the owner's token, SEC-06) dispatches from `main` with a fork's commit; the owner approves what looks like `main`, and the fork's Terraform runs with the deploy role.
- **Fix:** `run-name: demo-up ${{ inputs.ref || github.ref_name }}`, and in the build job refuse a commit that no branch of this repository contains.

### SEC-16 Dependabot's provider bumps run in `plan` before anyone reads them

⚪ **Minor** · accepted risk, underestimated · effort **S**

- **Evidence:** the `plan` job's condition checks only that the head repository is this one (`.github/workflows/ci.yml:425`), so Dependabot's PRs get the plan role (seen in run 39680420821, a bump of `hashicorp/aws`). `terraform init` downloads the new provider, third-party code, and Dependabot writes the lock file's hashes from the registry, so the lock file does not stop a malicious release; the seven-day cooldown is the only delay. The threat model says the plan job runs "Terraform, the AWS CLI, git and jq only".
- **Attack:** a hijacked provider release runs with the read-only plan role with no person involved, and after the merge the nightly `demo-down` runs it with the deploy role.
- **Fix:** add `github.actor != 'dependabot[bot]'` to the condition, so the owner re-runs the plan after reading the diff; add `-lockfile=readonly` to the `init` calls in `ci.yml`, `demo-up.yml` and `demo-down.yml`; or record the risk as accepted.

## AWS infrastructure

### SEC-17 The deploy role can pre-empt a release image

⚪ **Minor** · accepted risk, underestimated · effort **M**

- **Evidence:** the deploy role may push any tag to the `szop` repository (`infra/base/ci_roles.tf:1378-1392`; ECR has no condition key for the tag). Rule 1 of the lifecycle keeps every `*.*.*` tag for ever (`infra/base/registry.tf:29-40`). `release-please.yml:145-146` finds an existing `szop:$VERSION`, prints "nothing to push or tag" and stops.
- **Attack:** one approved malicious `demo-up` pushes a backdoored image as the next version, which the open release PR announces. When the owner merges the release, `publish` finds it and does nothing: the released image is the attacker's, kept for ever, beyond the demo's teardown. The accepted risk bounds the deploy role to "the demo's own tagged resources"; this reaches the released images, which the threat model protects.
- **Fix:** give the demo its own repository (`szop-demo`, immutable tags) for the deploy role's pushes and the execution role's pulls, and leave pushes to `szop` to the release role. Or make `publish` fail when an existing `$VERSION` is not the image built from the release commit on `main`.

### SEC-18 The deploy role's cost is bounded less than the docs say

⚪ **Minor** (it grows with SEC-14) · accepted risk, underestimated ([ADR 0034](../decisions/0034-network-and-demo-up-details.md)) · effort **M**

- **Evidence:** `CreateInstance` sets no condition on the database class, storage or Multi-AZ (`infra/base/ci_roles.tf:842-876`), and `ModifyDBInstance` may change the class (`:956-985`); a `szop-demo-*` task definition may ask for any CPU and memory, and `RunTask` up to ten tasks; nothing limits the number of load balancers. `demo-down` runs only `terraform destroy`, which removes what the state holds. The budget alerts at $5 forecast and $10 actual only notify, and billing data lags by hours.
- **Attack:** an approved malicious `demo-up`, or the nightly path of SEC-14, creates tagged resources outside the state; the nightly destroy never sees them, and they run until the owner reads the alert. The accepted risk counts on "the budget alerts and the nightly destroy" as the bound; the second does not reach what the state does not hold.
- **Fix:** conditions on `CreateInstance` (`rds:DatabaseClass` = `db.t4g.micro`, `rds:StorageSize` ≤ 20, `rds:MultiAz` = false) and a matching deny on `ModifyDBInstance`; after the destroy, list what still carries `group` = `demo` (`aws resourcegroupstaggingapi get-resources`) and fail loudly if anything does; optionally a budget action that attaches a deny-all policy to the deploy role at the actual threshold.

### SEC-19 The plan role can read the owner's personal data

⚪ **Minor** · docs mismatch · effort **S** · confidence medium-high, from the published content of `ReadOnlyAccess`, not checked on the live policy version

- **Evidence:** the plan role holds `ReadOnlyAccess` (`infra/base/ci_roles.tf:47-50`) and denies only `account:GetPrimaryEmail`, `GetContactInformation` and `GetAlternateContact` (`:164-173`). The account is the management account of an AWS Organization, created with IAM Identity Center ([demo environment](../operations/demo-environment.md#4-iam-identity-center)), so `ReadOnlyAccess` also grants `organizations:Describe*` and `List*` (the root email), `identitystore:List*` and `Describe*` (the owner's name and email), and `cloudtrail:LookupEvents` (90 days of the owner's addresses and user names); from PH-18 also SES's suppression list (bounced users' addresses). The threat model says the plan role reads "neither … the account's contact details".
- **Attack:** code in a same-repository PR's `terraform plan`, the accepted path "plan can run arbitrary code", prints them into the public job log.
- **Fix:** extend `DenyAccountContacts` with `organizations:*`, `identitystore:*`, `sso:*`, `sso-directory:*`, `cloudtrail:LookupEvents`, `cloudtrail:GetQueryResults`, `ses:ListSuppressedDestinations`, `ses:GetSuppressedDestination`, `ses:ListContacts` and `ses:GetContact`; the plan needs none of them.

### SEC-20 Let's Encrypt may issue a wildcard that covers the app

⚪ **Minor** · docs mismatch · effort **S**

- **Evidence:** the apex's CAA record allows `letsencrypt.org` and has no `issuewild` (`infra/base/dns.tf:30-36`); the app's own record (`:42-48`) does not apply to `*.dzwoniec.com`, which a CA checks at the apex, where `issue` also governs wildcards. The threat model's accepted risk says Let's Encrypt "could issue for them, not for `szop.dzwoniec.com`".
- **Attack:** a Let's Encrypt mis-issuance, or someone who passes its DNS check for the apex, gets `*.dzwoniec.com`, valid for the app.
- **Fix:** add `0 issuewild ";"` to both records; optionally pin Let's Encrypt to HTTP validation (`0 issue "letsencrypt.org; validationmethods=http-01"`).

### SEC-21 The threat model is behind the code

⚪ **Minor** · docs mismatch · effort **S**

- "Who can reach which secret" says the Better Auth secret is read "from PH-18" and lists the deploy role among those who cannot; the execution role and the app already read it (`infra/base/app_roles.tf:70-79`, `infra/demo/service.tf:116-119`), and the deploy role reaches it through a task definition, like the database passwords. The app task's row lists only `szop_app`'s password, and the accepted risk names "both database passwords" (three secrets, in fact).
- The accepted risk "PH-18 sets Better Auth's base URL explicitly" is done already (`apps/api/src/auth/auth.ts:25`).
- `sign-in/anonymous`, `get-session` and `list-sessions` return the raw session token in their JSON (seen on the demo), readable by the page's scripts; it opens nothing without the bearer plugin or the secret.
- Every guest's address and User-Agent stay in `sessions` with no cleanup: personal data that "What we protect" does not name.
- PH-18 has to check Better Auth's `/reset-password/:token`, which puts a token in the path, against "tokens never in the path".

## Observations

No fix needed, or an optional one of effort S unless stated:

- Better Auth reads a client's single `X-Forwarded-For` when `trustedProxies` is empty, while Fastify ignores it: harmless on the demo, but in a deployment without the load balancer the sign-in limit could be dodged. Overwriting the header with Fastify's `request.ip` in `authRoutes` makes one source of the address.
- A list name accepts control and format characters; a NUL answers `500` instead of `400`. Reject `\p{Cc}` (and the bidirectional controls) in `listNameSchema` before sharing ([SHR](../requirements/SHR-sharing.md)) shows names to others.
- The zone has no Domain Name System Security Extensions (DNSSEC); HTTPS with HSTS protects the app, but the CAA, DMARC and Pages records are unsigned (effort M, about $1 a month for the key).
- ECS Exec is on with default logging, which writes a session's output to `/szop/app`; an `env` typed while debugging lands in the log for seven days. `logging = "NONE"` or a separate group.
- The base image's high-severity Debian findings (util-linux, ncurses, perl-base, SQLite and others) have no fixed version yet; npm's own findings are gone, since the image removes npm.
- The Compose images are pinned by tag, not digest (`postgres:18.6`, `nginx:1.31.7-alpine`); they run only in CI jobs without credentials.
- `packageManager: "pnpm@12.8.1"` has no `+sha512` hash, and `pnpm-workspace.yaml` sets no `minimumReleaseAge`, so a manual `pnpm update` has no cooldown.
- `.gitignore` ignores `.env` but not `.env.*` (`.dockerignore` does).
- Secret scanning's non-provider patterns and validity checks are off; allowed actions are "all", mitigated by the required SHA pinning.
- The Pages artifact publishes `apps/landing` as it is, test file and `tsconfig.json` included; the repository is public anyway.
- Docs drift without a security effect: CodeQL scans Python too, beyond what [GitHub settings](../development/github-settings.md) says; [CI/CD](../development/ci-cd.md) says `demo-up` starts one task, the workflow starts two.

## Checked and found sound

- **The demo from outside:** TLS 1.2 and 1.3 only (`ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09`), an Amazon certificate for `szop.dzwoniec.com` alone, HTTP redirected with `301`; a strict content security policy (CSP), HSTS for a year, `nosniff`, `frame-ancestors 'none'`, `no-referrer`, cross-origin resource policy (CORP) `same-origin`; path traversal answers `400` or the SPA; `OPTIONS` answers `404` with no CORS headers.
- **The cross-site check:** `cross-site`, `same-site` and a foreign `Origin` are refused with `403` on unsafe methods, sign-in included; a cross-site `GET` is answered, but SameSite=Lax, CORP and the missing CORS headers keep its body from the other site. `text/plain` and forms answer `415`; 2 MB answers `413`; a 1,000-character name answers `400`.
- **The session cookie:** `__Host-better-auth.session_token`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, signed, fresh on every sign-in. Email and password sign-up answers "not enabled". The sign-in limit holds against a forged `X-Forwarded-For`.
- **Workspace isolation:** a second guest gets `404` on the first guest's list for `GET` and `PATCH`, and creating a list with the same ID makes a separate list in their own workspace (the key is the workspace and the ID). Every query filters by the session's workspace; the creation race is handled with `ON CONFLICT DO NOTHING`.
- **The rest of the API:** no raw SQL beyond `SHOW max_connections`; `setup-role` quotes identifiers and literals; 5xx answers carry a generic message; query values are hidden in the log; static files are routes for the files present at startup, with no dotfiles; the configuration is validated and never echoed; the database connection is `verify-full` against the RDS bundle; `szop_app` is no superuser and creates no roles or databases.
- **The SPA and the landing page:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or data-driven `href`; storage holds only the colour scheme; no inline scripts or third-party resources; navigation targets are fixed or the server's IDs.
- **The workflows:** `permissions: {}` at the top of all six, every action pinned by SHA (also required by the repository), `persist-credentials: false` everywhere, no `pull_request_target` or `workflow_run`, untrusted values reach the shell only through `env:`, no job holds both AWS credentials and a write token, forks get no plan, release jobs build without caches, and the downloaded tools are checked by SHA-256.
- **The GitHub settings:** the `main` ruleset (no bypass, no deletion or force push, pull request required, `ci-ok`, `pr-title` and CodeQL required), the `version-tags` ruleset (only the release app bypasses), the read-only default token, approval for every outside contributor's run, secret scanning with push protection, Dependabot alerts and security updates on, no deploy keys or webhooks.
- **Git history and the tree:** no secret in 704 commits or the current files; `*.tfvars` is ignored and only the examples are tracked.
- **The image:** pinned by digest, runs as `node` with code owned by root, without npm, Corepack or pnpm, and with only the API's sources, the migrations, the CA bundle, the shared package and the built SPA.
- **AWS:** the OpenID Connect (OIDC) trust of all three roles (audience and immutable subject, `main` pinned for `demo-teardown` and `release`); the state bucket (versioned, public access blocked, encrypted, TLS only, `prevent_destroy`); the plan role kept out of bootstrap's state; secrets never in state; the deploy role's tagging limited to creation, with the gaps for ACM and RDS already accepted; `PassRole` to the two app roles and `ecs-tasks` only; RDS created private with a managed master password, encrypted, `rds.force_ssl` on; security groups from the load balancer to the tasks to the database only, the database with no egress; `drop_invalid_header_fields` on the load balancer; immutable, scanned ECR tags; DKIM, DMARC `p=reject`, SPF `-all` and a null MX.

## Not covered

- The live AWS account: the review read the Terraform, not the account, so drift, the live version of `ReadOnlyAccess` (SEC-19) and what a fine-grained token may approve (SEC-06) are unchecked.
- Load: SEC-03's pool exhaustion is inferred from the code, not measured, so as not to disturb the demo.
- Better Auth's routes that are switched off today (email and password, social sign-in, password reset): PH-18 reviews them when it turns them on.
- The response headers of the landing page on GitHub Pages, and `scripts/` beyond what the workflows call.

## Suggested order

1. **SEC-01** (S): allow only Szop's auth paths and set a body limit; it closes the cheapest way to take the demo down.
2. **SEC-06 and SEC-07** (S now, M later): the `gh api` deny rules today, a separate token for Claude sessions after, and the note on ADR 0012.
3. **SEC-12 and SEC-13** (S–M): a scheduled dependency audit on `main`, and the three updates.
4. **SEC-02's interim steps** (S): a stricter anonymous sign-in rule and storage autoscaling or an alarm, until PH-20.
5. **SEC-14, SEC-15 and SEC-16** (M together): what an approved or automatic run may execute later.
6. The rest of the minor findings, the observations and the threat model's corrections (SEC-21), in small batches or with the phases they touch: SEC-03 and SEC-04 with PH-20 and PH-18, SEC-17 and SEC-18 with the next change to the deploy role.
