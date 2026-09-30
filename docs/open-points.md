# Open points

Everything that is still undecided or not yet done and has been left to a later topic or phase: decisions to take, checks to run, documents to write, settings to apply. One list, so nothing deferred in an ADR, a guide or a review is forgotten. Why the register exists is recorded in [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 1.

## Contents

- [How it works](#how-it-works)
- [Before the roadmap](#before-the-roadmap)
- [Security baseline topic](#security-baseline-topic)
- [Development environment phase](#development-environment-phase)
- [Walking skeleton](#walking-skeleton)
- [CI/CD phase](#cicd-phase)
- [Feature phases](#feature-phases)
- [Unassigned](#unassigned)
- [Closed](#closed)

## How it works

- **One entry per open point**, with a stable ID (`OP-001`, `OP-002`, …) that ADRs, specs, plans, PRs and commits can refer to. IDs are never reused.
- **Each entry says** what is open, where it came from (a link to the ADR decision, guide or audit finding) and its status: **open**, or **in progress** with a link to the branch or PR working on it.
- **Entries are grouped by where they will be settled.** Until the roadmap exists (`docs/roadmap.md`), the groups are the topics and kinds of phase the ADRs name. The roadmap brainstorm assigns every entry to a real phase and regroups this page by phase.
- **Adding:** whenever a topic, phase or review defers something, it adds an entry here with the next free ID, in addition to mentioning it where it came up.
- **Using:** each topic or phase brainstorm starts from its group's entries. Before its PR is merged, the phase closes them, or moves them to another group with a note why (the definition of done, [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 1).
- **Closing:** a settled entry moves to [Closed](#closed) with a link to what settled it (an ADR, a commit, a PR). Closed entries stay as a record; an entry dropped without being done says why.

## Before the roadmap

Foundation topics still to come, and what the roadmap brainstorm itself must settle.

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-001 | **Visual design foundation topic**: the overall look, the styling approach, the component library and the design tokens. The last foundation topic. | [ADR 0004](decisions/0004-implementation-process.md), decisions 2–4 | Open |
| OP-002 | **Write the roadmap**, `docs/roadmap.md`: the phases in order, each with its status, spec, plan and requirement IDs. Then `CLAUDE.md` and the README's documentation list point to it, and this page is regrouped by phase. | [ADR 0004](decisions/0004-implementation-process.md), decision 6 and consequences | Open |
| OP-003 | **Place the owner's manual steps** in the phases that need them: create the AWS account, secure the root user with MFA, set up IAM Identity Center and buy the domain (its name is chosen then); create and install the GitHub App, create the `demo` and `release` environments, apply the Actions settings, turn on CodeQL's default setup and update the `main` ruleset; create a throwaway repository for the release-please trial (OP-025). | [ADR 0008](decisions/0008-hosting.md), decisions 17 and 25, consequences; [ADR 0010](decisions/0010-ci-cd.md), decision 23 and consequences | Open |
| OP-004 | **Order the AWS and deploy phases** so that no demo runs without the safety net: `infra/bootstrap` (budget alerts) and `infra/base` (OIDC provider, deploy role) applied first; then a PR merging the nightly `demo-down`, a minimal `infra/demo` and a placeholder `demo-up`; only then the phase with the real `demo-up`, checked from its own branch. Local applies of `infra/demo` only after that PR, destroyed the same day. | [ADR 0008](decisions/0008-hosting.md), decision 26; [ADR 0010](decisions/0010-ci-cd.md), decision 23; [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 2 | Open |
| OP-031 | **Split the walking skeleton and the CI/CD work into phases small enough to review**, and map every "the walking skeleton phase" and "the CI/CD phase" of the ADRs to a real phase. A candidate split from the audit, not decided: development environment; CI checks; the skeleton app with E2E tests; AWS bootstrap and base, OIDC, roles and `demo-down`; `demo-up` and the first deploy; releases. It must respect OP-004. | [Audit, MAJOR-13](audits/2026-09-29-design-sanity-check.md#major-13-roadmap-phases-and-the-definition-of-done-are-not-ready-for-the-roadmap-brainstorm); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 3 | Open |

## Security baseline topic

The foundation topic added by [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6, after CI/CD and before visual design. It settles security rules every endpoint and workflow inherits, in its own brainstorm, ADR and PR.

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-034 | **Every ID in a request is resolved within the workspace** (or, with sharing, the list owner's workspace), not only the record being written: `category_id`, the new parent in a category move, product IDs in a multi-add, the template ID, units. Decide the rule and how it is backed (for example composite foreign keys on `(workspace_id, id)`) and tested ("a reference into another workspace returns 404"). | [Audit, CRITICAL-1](audits/2026-09-29-design-sanity-check.md#critical-1-ids-the-browser-sends-for-related-records-are-not-checked-against-the-workspace); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6 | Open |
| OP-035 | **Client IP and rate limits behind the load balancer**: how many proxy hops are trusted in AWS and locally, Better Auth's IP header set to match, the per-email login limit (not built into Better Auth), limits on password-reset and verification-resend requests, whether requests without a session are limited, and a test with a forged `X-Forwarded-For`. | [Audit, MAJOR-4](audits/2026-09-29-design-sanity-check.md#major-4-the-per-ip-rate-limits-depend-on-a-client-ip-setting-no-document-mentions); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6 | Open |
| OP-036 | **The web security baseline**: `SameSite` value and cookie prefix, Origin or `Sec-Fetch-Site` checks on every unsafe method (and later the WebSocket), exact `trustedOrigins`; security headers (HSTS, CSP, `frame-ancestors`, `Referrer-Policy`); tokens in URLs kept out of logs and the address bar; revoking other sessions on a password change or reset; re-authentication before deleting an account; account enumeration. Correct the stack overview's `SameSite` sentence. | [Audit, MAJOR-5](audits/2026-09-29-design-sanity-check.md#major-5-the-web-security-baseline-is-not-decided); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6 | Open |
| OP-037 | **Who can use the deploy role**: the OIDC subject `environment:demo` is available to any job on any branch that declares the environment. Decide the protection (a required reviewer on `demo`, a customised subject claim), narrow the plan role's log access, and back the `CLAUDE.md`-only rules with Claude Code `deny` permissions. Correct the wording of ADR 0010, decisions 12 and 16, and of the glossary. | [Audit, MAJOR-11](audits/2026-09-29-design-sanity-check.md#major-11-the-demo-environment-is-not-the-security-boundary-adr-0010-says-it-is); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6 | Open |

## Development environment phase

The first implementation phase: the tooling, configuration and guides of [ADR 0005](decisions/0005-development-environment.md) and [ADR 0007](decisions/0007-testing-strategy.md).

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-005 | **Set up the development environment**: Node pinned in `.nvmrc` and `engines`, pnpm workspaces, strict ESM TypeScript, `compose.yaml`, `.env` and `.env.example`, ESLint and Prettier, husky with lint-staged, VS Code settings, `.gitattributes`. Write `docs/development/setup.md` and a page per tool in `docs/development/tools/`. | [ADR 0005](decisions/0005-development-environment.md), decisions 3–15 and consequences | Open |
| OP-006 | **Choose the PostgreSQL major version** for `compose.yaml`, matching the newest one RDS offers, so development and the demo run the same major version. | [ADR 0005](decisions/0005-development-environment.md), decision 4 and consequences; [ADR 0008](decisions/0008-hosting.md), decision 19 | Open |
| OP-007 | **Decide how the API's production build includes `packages/shared`**, which is consumed from source with no build step of its own. | [ADR 0005](decisions/0005-development-environment.md), decision 8 | Open |
| OP-008 | **Give the README a short "Development" section** pointing to `docs/development/`. | [ADR 0005](decisions/0005-development-environment.md), consequences | Open |
| OP-009 | **Add commitlint** with `@commitlint/config-conventional` and husky's `commit-msg` hook. | [ADR 0009](decisions/0009-git-workflow.md), decision 16 and consequences | Open |
| OP-010 | **Add the test tooling**: the Vitest projects, Testing Library, MSW, Playwright with axe, fast-check and StrykerJS, the `test*` scripts and the Vitest and Playwright editor extensions. Write `docs/development/testing.md` and the tool pages; `CLAUDE.md` then points to `testing.md`. | [ADR 0007](decisions/0007-testing-strategy.md), decisions 18, 21, 22 and consequences | Open |
| OP-011 | **Settle how tests are isolated**: the exact `TRUNCATE` mechanism between tests, and the template-database setup per Vitest worker. | [ADR 0007](decisions/0007-testing-strategy.md), decisions 12 and 13 | Open |

## Walking skeleton

The thinnest end-to-end slice (SPA → API → database), built by CI and deployed ([ADR 0004](decisions/0004-implementation-process.md), decision 5), with the AWS infrastructure of [ADR 0008](decisions/0008-hosting.md). The roadmap may split it into several phases.

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-012 | **Write the first test of each layer**, including the first E2E journey on both viewports, so every testing decision is tried end to end. | [ADR 0007](decisions/0007-testing-strategy.md), consequences | Open |
| OP-013 | **Build what the demo runs on**: the Terraform code for `infra/bootstrap`, `infra/base` and `infra/demo`, the multi-stage Dockerfile, serving the SPA with `@fastify/static`, `GET /api/health`, migrations at startup and the SES `EmailSender`. | [ADR 0008](decisions/0008-hosting.md), consequences | Open |
| OP-014 | **Decide how `infra/demo` finds base's resources**: by name (data sources) or from base's outputs (`terraform_remote_state`). | [ADR 0008](decisions/0008-hosting.md), decision 6 | Open |
| OP-015 | **Decide the Dockerfile's exact build steps.** | [ADR 0008](decisions/0008-hosting.md), decision 12 | Open |
| OP-016 | **Confirm, resource by resource, that secret values stay out of Terraform state**, using write-only arguments where the provider supports them. | [ADR 0008](decisions/0008-hosting.md), decision 22 | Open |
| OP-017 | **Decide how the configuration assembles the database connection string** from the password injected by ECS. | [ADR 0008](decisions/0008-hosting.md), consequences | Open |
| OP-018 | **Write the runbook** `docs/operations/demo-environment.md` and the tool pages `terraform.md` and `aws-cli.md`; add the Terraform CLI, AWS CLI and Session Manager plugin to the setup guide. `CLAUDE.md` and the README then point to `docs/operations/`. | [ADR 0008](decisions/0008-hosting.md), decisions 30 and 31, consequences | Open |

## CI/CD phase

The workflows, settings and release tooling of [ADR 0009](decisions/0009-git-workflow.md) and [ADR 0010](decisions/0010-ci-cd.md). The roadmap may split them across several phases.

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-019 | **Write the workflows**: `ci.yml`, `pr-title.yml`, `infra-plan.yml`, `demo-up.yml`, `demo-down.yml`, `release-please.yml` and `mutation.yml`, the composite setup action, `dependabot.yml` and the release-please configuration (`bump-minor-pre-major`; `1.0.0` through a `Release-As` footer). Add the `lint` and `typecheck` scripts if earlier phases have not. For `demo-up` and `demo-down`, settle the details of [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7: the output recording the deployed commit, how `demo-down` reads it and checks that commit out, the concurrency groups and the lock timeout. | [ADR 0009](decisions/0009-git-workflow.md), consequences; [ADR 0010](decisions/0010-ci-cd.md), decisions 5–18 and consequences; [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7 | Open |
| OP-020 | **Create the AWS side of CI** in `infra/base`: the GitHub OIDC provider, the three CI roles and the app's two roles, with the policies checked by IAM Access Analyzer's policy validation. | [ADR 0010](decisions/0010-ci-cd.md), decisions 15 and 16 | Open |
| OP-021 | **Confirm that `demo-up` can build the image in parallel with Terraform**; otherwise the jobs run one after the other. | [ADR 0010](decisions/0010-ci-cd.md), decision 11 | Open |
| OP-022 | **Apply and record the GitHub settings**: the required checks (`ci-ok` and the PR title check, with branches up to date), the code scanning rule, SHA pinning, read-only default token permissions and approval for outside contributors' runs. Update `github-settings.md`. | [ADR 0009](decisions/0009-git-workflow.md), decision 13; [ADR 0010](decisions/0010-ci-cd.md), decisions 8 and 21 | Open |
| OP-023 | **Write the CI/CD docs**: `docs/development/ci-cd.md`, tool pages for GitHub Actions, release-please, Dependabot, tflint, actionlint and zizmor, the buttons as the runbook's primary path, and a CI/CD section in the stack overview. `CLAUDE.md` then points to `ci-cd.md`. | [ADR 0010](decisions/0010-ci-cd.md), decision 22 and consequences | Open |
| OP-024 | **Add the rule that Claude never triggers `demo-up` or `demo-down`** unless the owner asks, to `CLAUDE.md`. | [ADR 0010](decisions/0010-ci-cd.md), consequences | Open |
| OP-032 | **Add a CI job that proves the built image starts**: run it next to a PostgreSQL service and call `/api/health`, or run the E2E suite against the image. It covers what the demo check does not require for other PRs, such as Dependabot's bumps of the Node base image or PostgreSQL. | [Audit, MAJOR-13](audits/2026-09-29-design-sanity-check.md#major-13-roadmap-phases-and-the-definition-of-done-are-not-ready-for-the-roadmap-brainstorm); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 3 | Open |
| OP-025 | **Decide how releases and changelogs work with merge commits, through a trial in a throwaway repository before the phase that sets up release-please.** release-please reads every commit reaching `main`: the task commits a merge commit brings in and the merge commit itself (the PR title), so a phase appears twice, and review-fix `fix:` commits appear as fixes of unreleased code. Also open: where the `Release-As: 1.0.0` footer goes (a merge commit's body is empty; for example an empty commit with the footer, merged through a PR), and that the merge title can still be edited in GitHub's merge dialog after the title check passed. Options to compare: (A) merge commits with GitHub's default message, which release-please ignores, so task commits drive the changelog; (B) the PR-title message with noisy types hidden by `changelog-sections`; (C) squash merges; (D) merge commits with release notes rewritten by a `BEGIN_COMMIT_OVERRIDE` block, if it works for merge commits. If the outcome changes the merge strategy (ADR 0009, decision 6), a new ADR records it. | [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-cicd-phase); [Audit, MAJOR-10](audits/2026-09-29-design-sanity-check.md#major-10-release-please-doesnt-work-well-with-merge-commits) | Open |
| OP-026 | **Confirm the image version tag format**: agreed direction `szop:0.4.0`, without the git tag's `v`. | [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-cicd-phase) | Open |
| OP-027 | **Confirm release-please's branch name** (`release-please--branches--main` by default) against the ruleset and the branch naming rule. | [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-cicd-phase) | Open |

## Feature phases

Points that belong to the phase building a given requirement area (ACC, LST, ITM, …, SHR, SYN).

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-028 | **Decide how E2E tests read emails**: a file "outbox" or a local mail catcher such as Mailpit. In the phase that delivers ACC-2. | [ADR 0007](decisions/0007-testing-strategy.md), decision 15 | Open |
| OP-038 | **Decide how a guest's workspace moves into an account (ACC-2, ACC-4)**, starting with a short spike on Better Auth's anonymous plugin before that phase's brainstorm. By default the plugin links inside the sign-in or sign-up request and then deletes the anonymous user, and with it the guest workspace, before the app can ask ACC-4's question. The spike checks `onLinkAccount`, `disableDeleteAnonymousUser`, and how linking behaves with `requireEmailVerification`: whether sign-up returns a session, and whether opening the verification link (possibly in another browser) links anything. Options to compare: keep the anonymous user until the choice is made; ask the question before signing in; let the app reassign the workspace in its own sign-up hook, in the browser that registered. The brainstorm also decides, as requirement changes: how long a registered but unverified user's former guest data lives (ACC-8's 7 days against ACC-7's 30), and what an unverified user can do (log in, correct a mistyped email, and whether a stranger's email can be blocked for 7 days). **The phase that first creates anonymous users (ACC-1)** creates workspaces explicitly, not in a user-creation hook, so a later sign-up does not create a second workspace. | [Audit, MAJOR-2](audits/2026-09-29-design-sanity-check.md#major-2-moving-a-guest-into-an-account-doesnt-fit-how-better-auths-anonymous-plugin-links-users) | Open |

## Unassigned

Points whose home is not clear yet. The roadmap brainstorm gives each one a group.

| ID | Open point | Source | Status |
|---|---|---|---|
| OP-029 | **Optional phase: load testing** with k6 against the demo environment. The roadmap decides whether to include it. | [ADR 0008](decisions/0008-hosting.md), decision 32 | Open |
| OP-030 | **Optional phase: supply-chain provenance**: signed attestations, a software bill of materials (SBOM) and an OpenSSF Scorecard. The roadmap decides whether to include it. | [ADR 0010](decisions/0010-ci-cd.md), decisions 19 and 24 | Open |
| OP-033 | **Before Szop ever runs always-on**, add what the demo deliberately does without: backups, a CDN with a web application firewall (WAF), alarms and error tracking, SES production access, a storage alarm, and a privacy notice. Only if an always-on deployment is ever planned. | [ADR 0008](decisions/0008-hosting.md), decision 32; [Audit, MAJOR-1](audits/2026-09-29-design-sanity-check.md#major-1-the-docs-describe-two-different-products-a-persistent-public-service-and-a-disposable-demo); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 5 | Open |

## Closed

None yet.
