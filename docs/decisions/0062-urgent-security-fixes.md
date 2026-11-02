# ADR 0062 — Urgent security fixes (PH-42)

- **Status:** ✅ Accepted
- **Date:** 2026-11-02
- **Refines:** [ADR 0012](0012-security-baseline.md), decisions 16 and 19; [ADR 0032](0032-ci-access-and-teardown-details.md), decision 6
- **Extends:** [ADR 0010](0010-ci-cd.md), decision 18

## Context

The [security audit of 2026-11-01](../audits/2026-11-01-security-audit.md) found a group of flaws worth fixing before the next feature: Better Auth's unused endpoints reachable and guest sign-in unlimited (SEC-01, SEC-02), a full database disk (SEC-12), a pull request that can run code with AWS credentials through the plan job, `demo-up` and `demo-down` (SEC-13, SEC-14, SEC-16), a destroy that leaves untracked resources running (SEC-15), Claude sessions able to merge or re-run workflows (SEC-06, SEC-07), and vulnerable transitive dependencies (SEC-18). The phase is bounded ([ADR 0004](0004-implementation-process.md), decision 8): this ADR is its design, and there is no spec or plan. The owner approved the design in chat on 2026-11-02.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Better Auth's endpoints | Better Auth's `disabledPaths`; an allowlist in our route | **An allowlist in `apps/api/src/auth/routes.ts`:** only `POST /api/auth/sign-in/anonymous`, `GET /api/auth/get-session` and `POST /api/auth/sign-out` reach Better Auth; anything else is 404 in the API's error format ([NFR-4.12](../requirements/NFR-non-functional-requirements.md#nfr-4)). An endpoint a Better Auth upgrade adds stays closed until listed. _(the owner's choice)_ |
| 2 | Request bodies | Per-route limits; one global limit | **16 KiB for the whole app** (`bodyLimit`), 413 beyond it ([NFR-4.13](../requirements/NFR-non-functional-requirements.md#nfr-4)). No route takes a large body. |
| 3 | Guest sign-in | Wait for PH-20's quotas; a Better Auth rate-limit rule now | **30 an hour per address**, interim. The counters are in memory per task, so two tasks allow up to 60; PH-20 replaces it. Not an acceptance criterion. |
| 4 | Full database disk | A `FreeStorageSpace` alarm (needs SNS, an email confirmation, more permissions); storage autoscaling | **`max_allocated_storage = 40`** on the RDS instance. The nightly destroy removes it. |
| 5 | Claude's reach on GitHub | Rely on `CLAUDE.md`; more deny rules; a fine-grained token | **More deny rules now, the token as the real boundary** (owner step, [#360](https://github.com/luiki-dev/szop/issues/360)): `gh pr * merge`, `gh workflow * run`, `gh run rerun`, and `gh api` to pending deployments, dispatches, rulesets, environments, merges and GraphQL. They are a seatbelt against mistakes, as ADR 0012, decision 19 says. |
| 6 | Dependencies below the direct ones | Wait for Dependabot; a scheduled audit | **A nightly `deps-audit.yml`** (`pnpm audit --prod --audit-level=moderate`), no secrets, emailed on failure. The current advisories are fixed with `pnpm update` and `overrides` for `glob` and `minimatch`, which `@fastify/static` pins. An advisory with no fix is ignored one GHSA at a time, with the reason written next to it ([ci-cd.md](../development/ci-cd.md#when-deps-audit-fails)). |
| 7 | `demo-up` | Leave as is; refuse unknown commits | **Its run is named by the ref, and the `build` job (no AWS credentials) refuses a commit that no branch of this repository holds**, so a fork's pull ref never reaches the deploy. |
| 8 | `demo-down` and unmerged code | An override input; fall back to `main`'s code (ruled out by ADR 0032, decision 6); refuse | **It refuses, and destroys nothing, when the recorded commit is on no branch here or its `infra/demo/.terraform.lock.hcl` differs from `main`'s.** No override input: merge the branch or destroy by hand. A demo deployed from an unmerged provider update therefore stops the nightly destroy until merged or destroyed by hand. _(the owner's choice)_ |
| 9 | Leftovers after a destroy | Trust Terraform's state; list by tag | **After the destroy, anything still tagged `group = demo` fails the run** and is listed in its summary (retried for 10 minutes: the tagging API lags; inactive task definition revisions are not counted). The deploy role gains `tag:GetResources`, which needs the owner's `terraform apply` of `infra/base` before the merge. |
| 10 | The plan for Dependabot's pushes | Plan every PR; skip Dependabot's | **`plan` skips a push by Dependabot.** The owner's re-run after reading the diff runs it. Every `terraform init` in CI and the demo workflows runs with `-lockfile=readonly`, so a provider the lock does not name fails instead of being fetched. |

## Consequences

- Every `/api/auth/*` path the app starts to use needs an entry in the allowlist, PH-18's first.
- A demo deployed from an unmerged branch stops the nightly destroy; the runbook says how to destroy by hand.
- The owner's steps, in order: `terraform apply` of `infra/base` after the PR opens and before the merge, or the nightly `demo-down` fails with AccessDenied; the token of [#360](https://github.com/luiki-dev/szop/issues/360), any time.
- The deny rules still do not stop a determined attacker; only the token does ([threat model](../architecture/threat-model.md)).
- Left to PH-43: SEC-03 onward. Left to PH-39: conditions on `CreateDBInstance` (OP-124, part 2).

## Settled while building

- The sign-in limit's counters live in a module-level map of Better Auth shared by every app in a process, so the tests give each guest an address of its own (`signIn` sends `X-Forwarded-For`, and `testConfig` trusts the test client).
- `tag:GetResources` is added to the deploy role's inline `state` policy, since it takes no resource scope.
