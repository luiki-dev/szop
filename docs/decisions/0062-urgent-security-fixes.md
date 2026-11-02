# ADR 0062 — Urgent security fixes (PH-42)

- **Status:** ✅ Accepted
- **Date:** 2026-11-02
- **Refines:** [ADR 0012](0012-security-baseline.md), decisions 16 and 19; [ADR 0032](0032-ci-access-and-teardown-details.md), decision 6
- **Extends:** [ADR 0010](0010-ci-cd.md), decision 18

## Context

The [security audit of 2026-11-01](../audits/2026-11-01-security-audit.md) found a group of flaws worth fixing before the next feature: Better Auth's unused endpoints reachable (SEC-01), the database growing without bound (SEC-02), Claude sessions able to merge or re-run workflows (SEC-06, SEC-07), vulnerable transitive dependencies Dependabot does not see (SEC-12, SEC-13), what `demo-up`, `demo-down` and the plan job run with AWS credentials (SEC-14, SEC-15, SEC-16), and a destroy that leaves untracked resources running (SEC-18). The phase is bounded ([ADR 0004](0004-implementation-process.md), decision 8): this ADR is its design, and there is no spec or plan. The owner approved the design in chat on 2026-11-02.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Better Auth's endpoints | Better Auth's `disabledPaths`; an allowlist in our route | **An allowlist in `apps/api/src/auth/routes.ts`:** only `POST /api/auth/sign-in/anonymous`, `GET /api/auth/get-session` and `POST /api/auth/sign-out` reach Better Auth; anything else is 404 in the API's error format ([NFR-4.12](../requirements/NFR-non-functional-requirements.md#nfr-4)). An endpoint a Better Auth upgrade adds stays closed until listed. _(the owner's choice)_ |
| 2 | Request bodies | Per-route limits; one global limit | **16 KiB for the whole app** (`bodyLimit`), 413 beyond it ([NFR-4.13](../requirements/NFR-non-functional-requirements.md#nfr-4)). No route takes a large body. |
| 3 | Guest sign-in | Wait for PH-20's quotas; a Better Auth rate-limit rule now | **30 an hour per address**, interim. The counters are in memory per task, so two tasks allow up to 60; PH-20 replaces it. Not an acceptance criterion. |
| 4 | Full database disk | A `FreeStorageSpace` alarm (needs SNS, an email confirmation, more permissions); storage autoscaling | **`max_allocated_storage = 40`** on the RDS instance. The nightly destroy removes it. |
| 5 | Claude's reach on GitHub | Rely on `CLAUDE.md`; more deny rules; a fine-grained token | **More deny rules now, the token as the real boundary** (owner step, [#360](https://github.com/luiki-dev/szop/issues/360)): `gh pr * merge`, `gh workflow * run`, `gh run rerun`, and `gh api` to pending deployments, dispatches, rulesets, environments, merges and GraphQL. They are a seatbelt against mistakes, as ADR 0012, decision 19 says. |
| 6 | Dependencies below the direct ones | Wait for Dependabot; a scheduled audit | **A nightly `deps-audit.yml`** (`pnpm audit --prod --audit-level=moderate`), no secrets, emailed on failure. The current advisories are fixed with `pnpm update` and `overrides` for `glob` and `minimatch`, which `@fastify/static` pins. An advisory with no fix is ignored one GHSA at a time, with the reason written next to it ([ci-cd.md](../development/ci-cd.md#when-deps-audit-fails)). |
| 7 | `demo-up` | Leave as is; refuse unknown commits | **Its run is named by the ref, and the `build` job (no AWS credentials) refuses a commit that no `origin/*` branch of this repository holds** (a pull ref, which checkout also fetches, does not count), so a fork's pull ref never reaches the deploy. |
| 8 | `demo-down` and unmerged code | An override input; fall back to `main`'s code (ruled out by ADR 0032, decision 6); refuse | **It refuses, and destroys nothing, when the recorded commit is on no branch here, or is not in `main`'s history and its `infra/demo/.terraform.lock.hcl` differs from `main`'s.** No override input: merge the branch or destroy by hand. A demo deployed from an unmerged provider update therefore stops the nightly destroy until merged or destroyed by hand. _(the owner's choice)_ |
| 9 | Leftovers after a destroy | Trust Terraform's state; list by tag | **After the destroy, anything still tagged `group = demo` fails the run** and is listed in its summary (retried for 10 minutes: the tagging API lags; inactive task definition revisions are not counted). The deploy role gains `tag:GetResources`, which needs the owner's `terraform apply` of `infra/base` before the merge. |
| 10 | The plan for Dependabot's pushes | Plan every PR; skip Dependabot's | **`plan` skips a push by Dependabot.** The owner's re-run after reading the diff runs it. Every `terraform init` in CI and the demo workflows runs with `-lockfile=readonly`, so a provider the lock does not name fails instead of being fetched. |

## Consequences

- Every `/api/auth/*` path the app starts to use needs an entry in the allowlist, PH-18's first.
- A demo deployed from an unmerged branch stops the nightly destroy; the runbook says how to destroy by hand.
- The owner's steps, in order: `terraform apply` of `infra/base` after the PR opens and before the merge, or the nightly `demo-down` fails with AccessDenied; the token of [#360](https://github.com/luiki-dev/szop/issues/360), any time.
- The deny rules still do not stop a determined attacker; the token stops re-runs and deployment approvals, but not a merge (see "Settled while building") ([threat model](../architecture/threat-model.md)).
- Left to later phases: the rest of the audit's findings, as the [roadmap](../roadmap.md#ph-43-minor-security-fixes) lists. Left to PH-39: conditions on `CreateDBInstance` (OP-124, part 2).

## Settled while building

- The sign-in limit's counters live in a module-level map of Better Auth shared by every app in a process, so the tests give each guest an address of its own (`signIn` sends `X-Forwarded-For`, and `testConfig` trusts the test client).
- `tag:GetResources` is added to the deploy role's inline `state` policy, since it takes no resource scope.
- The whole-branch review found that checkout's full fetch also creates a pull ref under `refs/remotes/pull/`, which `git branch -r --contains` counted as a branch; both workflows now look at `refs/remotes/origin/` only. It also found that a demo deployed from a `main` commit before a provider bump merged would be refused by the lock check, so a commit that is in `main`'s history skips the comparison.
- Findings left to open points: [OP-127](https://github.com/luiki-dev/szop/issues/367) (deny rules for `gh api … rerun`, and the reads they block), [OP-128](https://github.com/luiki-dev/szop/issues/368) (one sign-in bucket without a trusted address), and a note on [OP-124](https://github.com/luiki-dev/szop/issues/357) (`max_allocated_storage` against the `StorageSize` condition).
- The token of [#360](https://github.com/luiki-dev/szop/issues/360) cannot merge-proof Claude: it acts as the owner's account, and the `main` ruleset asks for no approvals and has an empty bypass list ([ADR 0009](0009-git-workflow.md), decision 7), so with *Pull requests* write it can merge a PR whose checks pass. A second account for Claude, kept off a "Restrict updates" bypass list, would close it; Pull requests read-only would stop Claude opening and editing PRs. The owner accepted the gap: only the `gh pr * merge` deny rule and the habit stand before a merge.
- Declined: a Dependabot infrastructure PR passes `ci-ok` with `plan` skipped (decision 10 accepts it; the owner's re-run is a habit, not a gate).
