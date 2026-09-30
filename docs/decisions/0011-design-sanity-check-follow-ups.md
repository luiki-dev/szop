# ADR 0011 — Follow-ups to the 2026-09-29 design sanity check

- **Status:** Accepted
- **Date:** 2026-09-30
- **Extends:** decisions 7 and 9 of [ADR 0004](0004-implementation-process.md) (the definition of done, and the document roles)

## Context

Before the visual design topic and the roadmap, a [design sanity check](../audits/2026-09-29-design-sanity-check.md) reviewed every document written so far, the way a code review treats code. It reported 2 critical, 13 major and 24 minor findings, plus 14 suggestions ("consider improving"). The report changes nothing by itself: each finding has to be accepted, rejected or deferred.

The owner went through the findings one by one: first the critical and major ones in the order the report suggests, then the minor ones by group, then the suggestions. For each, the choice was to fix it now, defer it to a named topic or phase, or reject it. This ADR records those choices:

- **Decisions** below holds every decision that changes or adds to the process or design. Accepted ADRs are not rewritten, so corrections to them are made here and noted in their status lines.
- **[Triage of the findings](#triage-of-the-findings)** lists every finding with its outcome and where it went. The report itself stays as written, apart from a resolution marker under each finding that links back here.

Deferred findings, like everything else deferred, go to the new [open points register](../open-points.md) (decision 1).

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Where deferred work is tracked | Inside each ADR and guide, where it came up; a triage file next to the audit; one central register | **One central register, `docs/open-points.md`.** Every point that is still undecided or not yet done, and has been left to a later topic or phase, gets an entry with a stable ID (`OP-001`, …), its source, where it will be settled and its status. Until the roadmap exists, entries are grouped by the topic or kind of phase the ADRs name; the roadmap brainstorm then assigns each one to a real phase. Closed entries stay, with a link to where they were settled. **It joins ADR 0004's document roles** (decision 9): the register owns *what is still open and where it will be settled*; the roadmap keeps the order and status of phases, and ADRs keep the reasons. **It joins the definition of done** (ADR 0004, decision 7): a phase closes its open points, or explicitly re-assigns them, and adds anything it defers. Each topic or phase brainstorm starts from its open points. Before this, deferrals were scattered across ADR consequences ("the CI/CD phase writes…", "decided in the implementation phase"), guides and the audit, and the roadmap brainstorm would have had to collect them by reading everything again; some would have been missed. A triage file next to the audit would have covered only the audit's findings. |
| 2 | Order of the teardown safety net and the deploy workflows (CRITICAL-2) | A bootstrap exception: the phase adding the workflows is checked on the demo right after its merge, from `main`; the safety net and a registered `demo-up` merged first, in an earlier PR | **The safety net and a registered `demo-up` are merged first, before any demo exists.** GitHub runs a manual (`workflow_dispatch`) or scheduled workflow only if its file exists on the default branch. A manual run started on a branch then uses **that branch's** version of the file, while scheduled runs always use `main`'s. As ADRs 0008 and 0010 were written, the phase adding `demo-up.yml` could not press its own button before merging, so it could not meet the definition of done, and a `demo-down` merged "together with" `demo-up` protected nothing before the merge. So: (1) `infra/bootstrap` (state bucket, budget alerts) and `infra/base` (the OIDC provider and the deploy role) are applied from the owner's machine, as ADR 0010, decision 14 already has it. (2) **A PR merges the real `demo-down.yml`** (by hand and nightly), **`infra/demo` with only its backend and provider** (so a destroy has nothing to do) and **a placeholder `demo-up.yml`** that only registers the button and fails with a message. After the merge, one run of `demo-down` is seen succeeding. (3) **The phase that writes the real `demo-up.yml` and `infra/demo` presses `demo-up` on its own branch**; GitHub runs the branch's version, so that phase meets the definition of done like any other, with the nightly net already active. **ADR 0010, decision 23's "before or together with" becomes "before"**, and ADR 0008, decision 26's "before the walking skeleton" means "before any demo runs": the net needs base's deploy role, so it cannot come earlier than base. **Local `terraform apply` of `infra/demo`** from the owner's machine, the normal way to try Terraform code while writing it, **is allowed only once the nightly net is on `main`, and every such demo is destroyed the same day**; the nightly run and the budget alerts are the backstops. The bootstrap exception is simpler, but the one phase whose whole purpose is deploying would be merged without a deploy, and a broken first deploy would be fixed on `main` afterwards. The placeholder costs one short-lived file, and registering a manual workflow on the default branch first is a common GitHub pattern worth knowing. Destroying a demo created from a branch with `main`'s older Terraform code is a separate finding (MAJOR-12). |

## Triage of the findings

Outcomes: **fixed** (resolved in this ADR or a doc change), **deferred** (an open point, with where it will be settled), **rejected** (with the reason), or **pending** (not triaged yet).

### Critical and major

| Finding | Summary | Outcome |
|---|---|---|
| CRITICAL-1 | Referenced IDs not checked against the workspace | Pending |
| CRITICAL-2 | Demo workflows can't run before they are merged | Fixed: decision 2; the phase order is [OP-004](../open-points.md#before-the-roadmap) |
| MAJOR-1 | Persistent public service versus disposable demo | Pending |
| MAJOR-2 | Guest-to-account linking versus Better Auth's anonymous plugin | Pending |
| MAJOR-3 | Guest data lifetime versus sessions and real use | Pending |
| MAJOR-4 | Per-IP rate limits depend on an unmentioned client-IP setting | Pending |
| MAJOR-5 | No web security baseline | Pending |
| MAJOR-6 | Flaky connectivity underspecified; a library default contradicts NET-1 | Pending |
| MAJOR-7 | Open domain and data-model rules that shape the schema | Pending |
| MAJOR-8 | MVP access-control shape rewritten by sharing | Pending |
| MAJOR-9 | Redeploys overlap two tasks and can skip migrations | Pending |
| MAJOR-10 | release-please with merge commits | Pending |
| MAJOR-11 | The `demo` environment is not a security boundary | Pending |
| MAJOR-12 | Nightly destroy runs `main`'s Terraform; runs don't simply queue | Pending |
| MAJOR-13 | Roadmap, phases and definition of done not ready | Pending |

### Minor

| Finding | Summary | Outcome |
|---|---|---|
| m1 | Tag ruleset allows permanent mistakes | Pending |
| m2 | Email authentication covers DKIM only | Pending |
| m3 | "Secrets never enter Terraform state" has no fallback or check | Pending |
| m4 | Real-time updates need more design | Pending |
| m5 | No `.gitignore` | Pending |
| m6 | `infra/base` applied from a branch can drift from `main` | Pending |
| m7 | Dependabot security updates are off | Pending |
| m8 | Undocumented ruleset parameter | Pending |
| m9 | commitlint versus Dependabot commits | Pending |
| m10 | `ci-ok` can pass when nothing ran | Pending |
| m11 | ECR lifecycle policy would expire released images | Pending |
| m12 | `infra-plan` on Dependabot PRs | Pending |
| m13 | Dependabot major-version PRs versus pinned versions | Pending |
| m14 | E2E suite exceeds the default rate limits | Pending |
| m15 | CLAUDE.md guardrails ambiguous or incomplete | Pending |
| m16 | Units have no place in the frontend | Pending |
| m17 | Bulk operations against quotas undefined | Pending |
| m18 | Lazy creation: seed IDs versus workspace IDs | Pending |
| m19 | Sharing semantics that affect its tables | Pending |
| m20 | No non-functional requirements | Pending |
| m21 | README drift | Pending |
| m22 | Stale structure and facts | Pending |
| m23 | ADR cross-references | Pending |
| m24 | Editorial nits | Pending |

### Consider improving

| Finding | Summary | Outcome |
|---|---|---|
| C1 | A threat model page | Pending |
| C2 | A progressive web app with an app-shell cache | Pending |
| C3 | Undo for mis-taps | Pending |
| C4 | Test migrations against existing data | Pending |
| C5 | Test the seed data | Pending |
| C6 | Container and database hardening | Pending |
| C7 | Password policy | Pending |
| C8 | No lifecycle scripts in CI jobs holding AWS credentials | Pending |
| C9 | Order the CodeQL rule last | Pending |
| C10 | The release image is never demo-checked | Pending |
| C11 | Per-IP limits and shared addresses | Pending |
| C12 | Node.js 26 LTS | Pending |
| C13 | API versioning for the future Android app | Pending |
| C14 | Unverified factual claims in the ADRs | Pending |

## Consequences

- `docs/open-points.md` is a new living document. `CLAUDE.md`, the README's documentation list, the glossary and the PR template point to it; the PR template's definition of done gains the open-points item (decision 1).
- The [audit report](../audits/2026-09-29-design-sanity-check.md) gets a resolution marker under each finding as it is triaged: ✅ fixed, ⏳ deferred (with its open point), ✖️ rejected, each linking to the triage table above.
