# Roadmap

What is built in which order, and how far along it is. Each **phase** is one superpowers cycle (a brainstorm, then a spec and a plan or a short design in chat, then the implementation), on one branch, in one PR. **Stages** group the phases into milestones. Why the roadmap is shaped this way is recorded in [ADR 0014](decisions/0014-roadmap.md), on top of [ADR 0004](decisions/0004-implementation-process.md).

## Contents

- [How it works](#how-it-works)
- [Stage 1: Local foundations](#stage-1-local-foundations)
  - [PH-01 Monorepo and toolchain](#ph-01-monorepo-and-toolchain)
  - [PH-02 CI checks](#ph-02-ci-checks)
- [Stage 2: Walking skeleton, running locally](#stage-2-walking-skeleton-running-locally)
  - [PH-03 API skeleton](#ph-03-api-skeleton)
  - [PH-04 Database](#ph-04-database)
  - [PH-05 SPA skeleton](#ph-05-spa-skeleton)
  - [PH-06a Production build and serving](#ph-06a-production-build-and-serving)
  - [PH-06b Web security baseline](#ph-06b-web-security-baseline)
  - [PH-07 First E2E journey](#ph-07-first-e2e-journey)
  - [PH-08 Container image](#ph-08-container-image)
- [Stage 3: Walking skeleton, deployed and released](#stage-3-walking-skeleton-deployed-and-released)
  - [PH-09 AWS account and Terraform bootstrap](#ph-09-aws-account-and-terraform-bootstrap)
  - [PH-10 Domain and base infrastructure](#ph-10-domain-and-base-infrastructure)
  - [PH-11 CI access to AWS and the teardown safety net](#ph-11-ci-access-to-aws-and-the-teardown-safety-net)
  - [PH-12a App ready for the cloud](#ph-12a-app-ready-for-the-cloud)
  - [PH-12b Network and the demo-up button](#ph-12b-network-and-the-demo-up-button)
  - [PH-36 Scalability and isolation analysis](#ph-36-scalability-and-isolation-analysis)
  - [PH-12c App on ECS and RDS](#ph-12c-app-on-ecs-and-rds)
  - [PH-12d Safe redeploys](#ph-12d-safe-redeploys)
  - [PH-37 Two tasks](#ph-37-two-tasks)
  - [PH-35 Security scanners](#ph-35-security-scanners)
  - [PH-13 Releases](#ph-13-releases)
  - [PH-34 Landing page and demo status](#ph-34-landing-page-and-demo-status)
  - [PH-38 Autoscaling](#ph-38-autoscaling)
- [Stage 4: MVP](#stage-4-mvp)
  - [PH-14 App shell and design system](#ph-14-app-shell-and-design-system)
  - [PH-15 Seed catalog, read-only](#ph-15-seed-catalog-read-only)
  - [PH-16 Guest workspace and lists](#ph-16-guest-workspace-and-lists)
  - [PH-17 List items](#ph-17-list-items)
  - [PH-18 Registration and login](#ph-18-registration-and-login)
  - [PH-19 Guest data on login](#ph-19-guest-data-on-login)
  - [PH-39 Redis in the stack](#ph-39-redis-in-the-stack)
  - [PH-20 Quotas and rate limits](#ph-20-quotas-and-rate-limits)
  - [PH-21 Shop in a store](#ph-21-shop-in-a-store)
  - [PH-22 Offline state](#ph-22-offline-state)
  - [PH-23 Smart input](#ph-23-smart-input)
  - [PH-24 Catalog browser](#ph-24-catalog-browser)
  - [PH-25 Archive and duplicate](#ph-25-archive-and-duplicate)
  - [PH-26 Catalog and units](#ph-26-catalog-and-units)
  - [PH-27 Categories](#ph-27-categories)
  - [PH-28 Templates](#ph-28-templates)
  - [PH-29 Password reset and change](#ph-29-password-reset-and-change)
  - [PH-30 Settings and account deletion](#ph-30-settings-and-account-deletion)
  - [PH-31 Automatic cleanup](#ph-31-automatic-cleanup)
- [Stage 5: Later](#stage-5-later)
  - [PH-32 Sharing](#ph-32-sharing)
  - [PH-33 Live updates](#ph-33-live-updates)
- [Candidates](#candidates)

## How it works

- **A stage** is a milestone with an exit criterion. It only groups phases: it has no brainstorm, branch or PR of its own.
- **A phase** is the work item: one brainstorm, one branch, one PR, merged when it meets the [definition of done](development/definition-of-done.md). Its ID (`PH-01`, `PH-02`, …) never changes and is never reused; the order is the order on this page.
- **Status lives on GitHub and is mirrored in each stage's table:** ⬜ Not started, 🚧 In progress, ✅ Done, ✖️ Dropped (with the reason). When a phase's work starts, its row gets 🚧 and the links to the spec and the plan as they are committed (a bounded phase has no spec or plan: "➖ N/A: bounded"); the PR link follows when the PR opens. Before the merge, the PR sets the row to ✅, which becomes true when the owner merges it. The diagram in the [README](../README.md#roadmap) mirrors the tables: it changes in the same commit, on the same occasions, including when phases are added, split or reordered ([ADR 0017](decisions/0017-readme-roadmap-diagram.md)).
- **Each phase entry** says:
  - **Goal:** what works when the phase is done. It is also what the demo check looks at.
  - **Delivers:** the requirements and use cases it implements, as links, marked "part" when it delivers only part of one; for tooling and infrastructure, what it builds and the ADRs behind it.
  - **Depends on:** what must happen first, when that is more than the order on this page, such as a spike.
  - **Owner steps:** what only the owner can do. The owner's items of the definition of done (applying `infra/base` from the branch, the demo check) are named only where a phase needs them for the first time or in an unusual way.
  - **Expected path:** full (spec and plan) or bounded (a short design in chat), as expected today; the phase's brainstorm decides ([ADR 0004](decisions/0004-implementation-process.md), decision 8).
  - **Open points:** the phase issue's sub-issues labelled `open-point` on GitHub, and the open points its **Also** section lists; the brainstorm starts from them.
- **Size of a phase** ([ADR 0014](decisions/0014-roadmap.md), decision 6): it ends with something working, brings at most one big concept new to the project, and its plan has about 3 to 8 tasks. A phase that grows past about 10 tasks or a second new concept is split before it is planned or executed, and the owner can ask for a split at any time.
- **Changing the roadmap** is expected as phases teach us things. A split phase becomes `PH-16a`, `PH-16b` and so on, and its old ID is retired; a new phase gets the next free number. A change needs an ADR only when it reflects a significant decision ([ADR 0004](decisions/0004-implementation-process.md), decision 6). A new feature goes through the [functional requirements](requirements/functional-requirements.md) first (decision 10).
- **Not on the roadmap:** work outside phases (dependency updates, documentation fixes, ADR-only PRs), and spikes, which run before the phase that needs them and are listed under its "depends on".
- **On GitHub:** each phase, open point, owner step and ADR made outside a phase is an issue on the [Szop project](https://github.com/users/luiki-dev/projects/3). This page is the source of each phase's plan, and the phase issue's body is a copy, updated when the PR that changes the entry opens; the status lives on GitHub, and the stage tables and the README's diagram mirror it ([ADR 0027](decisions/0027-open-points-on-github.md), decisions 3 and 4).

## Stage 1: Local foundations

**Exit:** the repository is a pnpm monorepo whose lint, type and commit message checks run on every commit and every PR, and a failing check blocks the merge.

| Phase | Status | Spec | Plan | PR | Issue |
|---|---|---|---|---|---|
| [PH-01 Monorepo and toolchain](#ph-01-monorepo-and-toolchain) | ✅ Done | [Spec](superpowers/specs/2026-10-02-PH-01-monorepo-and-toolchain-design.md) | [Plan](superpowers/plans/2026-10-02-PH-01-monorepo-and-toolchain.md) | [#11](https://github.com/luiki-dev/szop/pull/11) | [#29](https://github.com/luiki-dev/szop/issues/29) |
| [PH-02 CI checks](#ph-02-ci-checks) | ✅ Done | [Spec](superpowers/specs/2026-10-04-PH-02-ci-checks-design.md) | [Plan](superpowers/plans/2026-10-04-PH-02-ci-checks.md) | [#14](https://github.com/luiki-dev/szop/pull/14) | [#30](https://github.com/luiki-dev/szop/issues/30) |

### PH-01 Monorepo and toolchain

- **Goal:** the repository is a pnpm workspace in strict TypeScript. `pnpm lint` and `pnpm typecheck` pass, staged files are formatted and linted on every commit, and a commit message that does not follow Conventional Commits is rejected.
- **Delivers:** the development environment of [ADR 0005](decisions/0005-development-environment.md): Node pinned, pnpm workspaces, strict ESM TypeScript, ESLint and Prettier, husky with lint-staged, the VS Code settings and `.gitattributes`; commitlint ([ADR 0009](decisions/0009-git-workflow.md), decision 16); `docs/development/setup.md` with a page per tool, and the README's "Development" section.
- **Depends on:** —
- **Owner steps:** set up the machine following `setup.md`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#29](https://github.com/luiki-dev/szop/issues/29).

### PH-02 CI checks

- **Goal:** every PR runs the lint, type and commit message checks in GitHub Actions and has its title checked, and a failing check blocks the merge. CodeQL scans the code and the workflows, and Dependabot proposes updates every week.
- **Delivers:** from [ADR 0010](decisions/0010-ci-cd.md): `ci.yml` with change detection, `lint`, `typecheck`, `commits` and `ci-ok`; `pr-title.yml`; the composite setup action; actionlint and zizmor; `dependabot.yml`; CodeQL's default setup; the Actions settings and the required checks; `docs/development/ci-cd.md` and its tool pages.
- **Depends on:** —
- **Owner steps:** apply the Actions settings (actions pinned to a full commit SHA, a read-only default token, approval for every outside contributor's runs); turn on CodeQL's default setup; add the required checks (`ci-ok` and the PR title check, with branches up to date) to the `main` ruleset, and the code scanning rule once CodeQL has run on `main`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#30](https://github.com/luiki-dev/szop/issues/30).

## Stage 2: Walking skeleton, running locally

**Exit:** `pnpm dev` shows a page that reads the API's status, which reads PostgreSQL. Every test layer has its first test, and CI runs them all, against a production build and in the container image.

| Phase | Status | Spec | Plan | PR | Issue |
|---|---|---|---|---|---|
| [PH-03 API skeleton](#ph-03-api-skeleton) | ✅ Done | [Spec](superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md) | [Plan](superpowers/plans/2026-10-05-PH-03-api-skeleton.md) | [#18](https://github.com/luiki-dev/szop/pull/18) | [#31](https://github.com/luiki-dev/szop/issues/31) |
| [PH-04 Database](#ph-04-database) | ✅ Done | [Spec](superpowers/specs/2026-10-05-PH-04-database-design.md) | [Plan](superpowers/plans/2026-10-05-PH-04-database.md) | [#20](https://github.com/luiki-dev/szop/pull/20) | [#32](https://github.com/luiki-dev/szop/issues/32) |
| [PH-05 SPA skeleton](#ph-05-spa-skeleton) | ✅ Done | [Spec](superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md) | [Plan](superpowers/plans/2026-10-07-PH-05-spa-skeleton.md) | [#22](https://github.com/luiki-dev/szop/pull/22) | [#33](https://github.com/luiki-dev/szop/issues/33) |
| [PH-06a Production build and serving](#ph-06a-production-build-and-serving) | ✅ Done | [Spec](superpowers/specs/2026-10-08-PH-06a-production-build-and-serving-design.md) | [Plan](superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md) | [#23](https://github.com/luiki-dev/szop/pull/23) | [#35](https://github.com/luiki-dev/szop/issues/35) |
| [PH-06b Web security baseline](#ph-06b-web-security-baseline) | ✅ Done | [Spec](superpowers/specs/2026-10-10-PH-06b-web-security-baseline-design.md) | [Plan](superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md) | [#158](https://github.com/luiki-dev/szop/pull/158) | [#25](https://github.com/luiki-dev/szop/issues/25) |
| [PH-07 First E2E journey](#ph-07-first-e2e-journey) | ✅ Done | [Spec](superpowers/specs/2026-10-11-PH-07-first-e2e-journey-design.md) | [Plan](superpowers/plans/2026-10-11-PH-07-first-e2e-journey.md) | [#163](https://github.com/luiki-dev/szop/pull/163) | [#36](https://github.com/luiki-dev/szop/issues/36) |
| [PH-08 Container image](#ph-08-container-image) | ✅ Done | [Spec](superpowers/specs/2026-10-12-PH-08-container-image-design.md) | [Plan](superpowers/plans/2026-10-12-PH-08-container-image.md) | [#196](https://github.com/luiki-dev/szop/pull/196) | [#37](https://github.com/luiki-dev/szop/issues/37) |

### PH-03 API skeleton

- **Goal:** the Fastify API starts with `pnpm dev`, `GET /api/health` answers, and the first API test passes locally and in CI.
- **Delivers:** `apps/api`, assembled by `buildApp(deps)` with its configuration and request logging ([architecture](architecture/architecture.md)); `GET /api/health`; Vitest and the first API test ([ADR 0007](decisions/0007-testing-strategy.md)); `docs/development/testing.md`; the `test` job in CI.
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#31](https://github.com/luiki-dev/szop/issues/31).

### PH-04 Database

- **Goal:** PostgreSQL runs locally in Docker Compose. The API applies its migrations at startup and reports whether the database is reachable and which schema version it holds. Tests run against isolated test databases, locally and in CI.
- **Delivers:** `compose.yaml` with PostgreSQL and the database's settings in `.env.example`; Drizzle with the first migration, applied at startup ([ADR 0008](decisions/0008-hosting.md), decision 14); a template database per Vitest worker and cleanup between tests ([ADR 0007](decisions/0007-testing-strategy.md), decisions 12 and 13); CI's PostgreSQL from `compose.yaml`.
- **Depends on:** —
- **Owner steps:** have Docker Desktop running, with its WSL integration turned on.
- **Expected path:** full.
- **Open points:** the sub-issues of [#32](https://github.com/luiki-dev/szop/issues/32).

### PH-05 SPA skeleton

- **Goal:** `pnpm dev` serves a page showing the API's status through Vite's proxy, so the slice runs from the single-page application (SPA) through the API to the database.
- **Delivers:** `apps/web` with Vite, React, React Router and TanStack Query ([ADR 0002](decisions/0002-technical-architecture.md)); the development proxy for `/api`; Testing Library and Mock Service Worker (MSW) with the first component test; `packages/shared` with the health response schema, used by the web client, the MSW handlers and the API's health test ([ADR 0021](decisions/0021-spa-skeleton-details.md)).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#33](https://github.com/luiki-dev/szop/issues/33).

### PH-06a Production build and serving

- **Goal:** `pnpm build` and `pnpm start` serve the SPA from the API on one port, compressed and cached, and CI fails a build whose first screen needs more than 200 KB of JavaScript.
- **Delivers:** the API run in production by Node's type stripping, with `packages/shared` from source; the SPA served by `@fastify/static`, precompressed and with the cache headers of [ADR 0013](decisions/0013-visual-design.md), decision 5, and a fallback for client-side routes; the bundle-size gate of [NFR-3](requirements/functional-requirements.md#nfr-3), run by a `build` job in CI ([ADR 0023](decisions/0023-production-build-and-serving-details.md)).
- **Split from:** PH-06 Production build and web baseline, now retired: it held two new concepts, the production build and the web security baseline ([ADR 0014](decisions/0014-roadmap.md), decision 6).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#35](https://github.com/luiki-dev/szop/issues/35).

### PH-06b Web security baseline

- **Goal:** every response carries the security headers and every unsafe request is checked, before the first endpoint that changes data exists. API tests prove the headers, the request checks, the client address behind a forged `X-Forwarded-For` and the tokens stripped from logged URLs.
- **Delivers:** the web baseline of [ADR 0012](decisions/0012-security-baseline.md), decisions 7–9 and 13: `@fastify/helmet` with the Content Security Policy (CSP), HTTP Strict Transport Security (HSTS) and `Referrer-Policy`; the `Sec-Fetch-Site` check and JSON-only bodies on unsafe methods; `TRUSTED_PROXIES`; tokens stripped from logged URLs ([ADR 0025](decisions/0025-web-security-baseline-details.md)).
- **Split from:** PH-06 Production build and web baseline, now retired (see [PH-06a](#ph-06a-production-build-and-serving)).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#25](https://github.com/luiki-dev/szop/issues/25).

### PH-07 First E2E journey

- **Goal:** a Playwright journey drives the production build on a phone and on desktop Chromium and Firefox, scans every page with axe in light and dark mode, and fails on any CSP violation. CI keeps the report and traces of a failed run.
- **Delivers:** `e2e/` with Playwright and axe ([ADR 0007](decisions/0007-testing-strategy.md); [ADR 0013](decisions/0013-visual-design.md), decisions 2, 3, 9 and 11); the CSP violation guard; the `e2e` job in CI ([ADR 0010](decisions/0010-ci-cd.md), decisions 7 and 9); the groundwork for [NFR-1](requirements/functional-requirements.md#nfr-1) and [NFR-2](requirements/functional-requirements.md#nfr-2) ([ADR 0026](decisions/0026-first-e2e-journey-details.md)).
- **Depends on:** —
- **Owner steps:** install Playwright's browsers and the system libraries they need in WSL, once, following `setup.md`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#36](https://github.com/luiki-dev/szop/issues/36).

### PH-08 Container image

- **Goal:** one image holds the API and the built SPA, runs as a non-root user and starts next to PostgreSQL, locally and in CI.
- **Delivers:** the multi-stage Dockerfile of [ADR 0008](decisions/0008-hosting.md), decision 12, with the certificate authority bundle of Amazon Relational Database Service (RDS); the `docker` job in CI and a job proving the image starts; Dependabot for the Node base image ([ADR 0028](decisions/0028-container-image-details.md)).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#37](https://github.com/luiki-dev/szop/issues/37).

## Stage 3: Walking skeleton, deployed and released

**Exit:** one button creates a demo of any commit at `szop.dzwoniec.com`, a nightly run destroys it, `dzwoniec.com` shows whether it is up, and `v0.1.0` is released.

| Phase | Status | Spec | Plan | PR | Issue |
|---|---|---|---|---|---|
| [PH-09 AWS account and Terraform bootstrap](#ph-09-aws-account-and-terraform-bootstrap) | ✅ Done | [Spec](superpowers/specs/2026-10-14-PH-09-aws-account-and-terraform-bootstrap-design.md) | [Plan](superpowers/plans/2026-10-14-PH-09-aws-account-and-terraform-bootstrap.md) | [#203](https://github.com/luiki-dev/szop/pull/203) | [#38](https://github.com/luiki-dev/szop/issues/38) |
| [PH-10 Domain and base infrastructure](#ph-10-domain-and-base-infrastructure) | ✅ Done | [Spec](superpowers/specs/2026-10-15-PH-10-domain-and-base-infrastructure-design.md) | [Plan](superpowers/plans/2026-10-16-PH-10-domain-and-base-infrastructure.md) | [#207](https://github.com/luiki-dev/szop/pull/207) | [#39](https://github.com/luiki-dev/szop/issues/39) |
| [PH-11 CI access to AWS and the teardown safety net](#ph-11-ci-access-to-aws-and-the-teardown-safety-net) | ✅ Done | [Spec](superpowers/specs/2026-10-17-PH-11-ci-access-to-aws-and-the-teardown-safety-net-design.md) | [Plan](superpowers/plans/2026-10-17-PH-11-ci-access-to-aws-and-the-teardown-safety-net.md) | [#215](https://github.com/luiki-dev/szop/pull/215) | [#40](https://github.com/luiki-dev/szop/issues/40) |
| [PH-12a App ready for the cloud](#ph-12a-app-ready-for-the-cloud) | ✅ Done | [Spec](superpowers/specs/2026-10-18-PH-12a-app-ready-for-the-cloud-design.md) | [Plan](superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md) | [#226](https://github.com/luiki-dev/szop/pull/226) | [#219](https://github.com/luiki-dev/szop/issues/219) |
| [PH-12b Network and the demo-up button](#ph-12b-network-and-the-demo-up-button) | ✅ Done | [Spec](superpowers/specs/2026-10-18-PH-12b-network-and-the-demo-up-button-design.md) | [Plan](superpowers/plans/2026-10-18-PH-12b-network-and-the-demo-up-button.md) | [#227](https://github.com/luiki-dev/szop/pull/227) | [#220](https://github.com/luiki-dev/szop/issues/220) |
| [PH-36 Scalability and isolation analysis](#ph-36-scalability-and-isolation-analysis) | ✅ Done | [Spec](superpowers/specs/2026-10-19-PH-36-scalability-and-isolation-analysis-design.md) | [Plan](superpowers/plans/2026-10-19-PH-36-scalability-and-isolation-analysis.md) | [#242](https://github.com/luiki-dev/szop/pull/242) | [#229](https://github.com/luiki-dev/szop/issues/229) |
| [PH-12c App on ECS and RDS](#ph-12c-app-on-ecs-and-rds) | ✅ Done | [Spec](superpowers/specs/2026-10-20-PH-12c-app-on-ecs-and-rds-design.md) | [Plan](superpowers/plans/2026-10-20-PH-12c-app-on-ecs-and-rds.md) | [#246](https://github.com/luiki-dev/szop/pull/246) | [#221](https://github.com/luiki-dev/szop/issues/221) |
| [PH-12d Safe redeploys](#ph-12d-safe-redeploys) | 🚧 In progress | — | — | — | [#244](https://github.com/luiki-dev/szop/issues/244) |
| [PH-37 Two tasks](#ph-37-two-tasks) | ⬜ Not started | — | — | — | [#233](https://github.com/luiki-dev/szop/issues/233) |
| [PH-35 Security scanners](#ph-35-security-scanners) | ⬜ Not started | — | — | — | [#213](https://github.com/luiki-dev/szop/issues/213) |
| [PH-13 Releases](#ph-13-releases) | ⬜ Not started | — | — | — | [#42](https://github.com/luiki-dev/szop/issues/42) |
| [PH-34 Landing page and demo status](#ph-34-landing-page-and-demo-status) | ⬜ Not started | — | — | — | [#205](https://github.com/luiki-dev/szop/issues/205) |
| [PH-38 Autoscaling](#ph-38-autoscaling) | ⬜ Not started | — | — | — | [#234](https://github.com/luiki-dev/szop/issues/234) |

### PH-09 AWS account and Terraform bootstrap

- **Goal:** Szop has its own AWS account, managed with Terraform. The state lives in a locked-down S3 bucket, budget alerts watch the costs, and CI checks every Terraform change.
- **Delivers:** `infra/bootstrap` with the state bucket and the budget alerts ([ADR 0008](decisions/0008-hosting.md)); the Terraform checks in `ci.yml` ([ADR 0010](decisions/0010-ci-cd.md)); `pnpm check:infra` (formatting, validation and tflint, locally and in CI); the start of the runbook `docs/operations/demo-environment.md`, the tool pages for Terraform, tflint and the AWS CLI, and their place in the setup guide; Dependabot for the AWS provider ([ADR 0029](decisions/0029-aws-account-and-terraform-bootstrap-details.md)).
- **Depends on:** —
- **Owner steps:** clean up the existing AWS account, secure its root user with multi-factor authentication (MFA) and set up IAM Identity Center, which upgrades the account to the Paid plan, following the runbook; install tenv (and through it Terraform), tflint and the Session Manager plugin, and check the AWS CLI, following the setup guide; apply `infra/bootstrap` from the branch, then move its state into the bucket, following the runbook.
- **Expected path:** full.
- **Open points:** the sub-issues of [#38](https://github.com/luiki-dev/szop/issues/38).

### PH-10 Domain and base infrastructure

- **Goal:** Szop's domain `dzwoniec.com` resolves through Route 53, only Amazon may issue certificates for it, and Amazon Simple Email Service (SES) has verified it and tells receivers to reject mail forged in its name. The image registry, the Better Auth secret and the log group are ready for the first deploy.
- **Delivers:** the permanent part of `infra/base` ([ADR 0008](decisions/0008-hosting.md); [ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md)): the DNS zone, imported from the registration, with a Certification Authority Authorization (CAA) record and a null MX; the SES identity with the records that let receiving servers check its mail and refuse forgeries (DKIM, DMARC and SPF); the Elastic Container Registry (ECR) with lifecycle rules that keep released images; the Better Auth secret, written through a write-only argument so its value never enters Terraform state; the log group; the runbook's chapters on buying the domain and applying base.
- **Depends on:** —
- **Owner steps:** buy `dzwoniec.com` in Route 53 and confirm its registrant email, following the runbook; apply `infra/base` from the branch and run its checks, and again from `main` after the merge.
- **Expected path:** full.
- **Open points:** the sub-issues of [#39](https://github.com/luiki-dev/szop/issues/39).

### PH-11 CI access to AWS and the teardown safety net

- **Goal:** CI reaches AWS without stored keys. PRs touching `infra/` get a `terraform plan` comment, and `demo-down` destroys the demo by hand and every night, before any demo can exist.
- **Delivers:** in `infra/base`, the GitHub OpenID Connect (OIDC) provider and the `szop-ci-plan` and `szop-ci-deploy` roles, checked by IAM Access Analyzer ([ADR 0010](decisions/0010-ci-cd.md), decisions 15 and 16; [ADR 0012](decisions/0012-security-baseline.md), decisions 16 and 17); `infra-plan.yml`; the real `demo-down.yml` in the `demo-teardown` environment; `infra/demo` with only its backend and provider; a placeholder `demo-up.yml` ([ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 2); actionlint and zizmor in the pre-commit hook.
- **Depends on:** nothing beyond the order, but no demo runs, and no local apply of `infra/demo` happens, before it is merged ([ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 2).
- **Owner steps:** create the `demo-teardown` environment (no reviewer, `main` only); apply `infra/base` from the branch, and again from `main` after the merge; store the plan and deploy roles' ARNs as GitHub variables; after the merge, run `demo-down` once and see it succeed; as the root user, activate IAM access to billing, then the `project` and `group` cost allocation tags, following the runbook.
- **Expected path:** full.
- **Open points:** the sub-issues of [#40](https://github.com/luiki-dev/szop/issues/40).

### PH-12a App ready for the cloud

- **Goal:** the app is ready for Elastic Container Service (ECS) and RDS before it gets there. It refuses to start, with a clear log message, against a database holding migrations it does not know or one it would skip; it connects to the database with TLS and full certificate verification when configured to; it exits within ECS's stop timeout even while connections stay open; and the load balancer's health checks no longer fill the log.
- **Delivers:** the migration check at startup, refining [ADR 0008](decisions/0008-hosting.md), decision 14; the pool's TLS settings, with the RDS certificate bundle of [ADR 0028](decisions/0028-container-image-details.md); a bounded shutdown, refining the graceful shutdown of [ADR 0019](decisions/0019-api-skeleton-details.md), decision 8; quieter request logs for `/api/health`.
- **Split from:** PH-12 First deploy, now retired: it held about twenty tasks and two new concepts, the network with the push-button deploy, and the app running on ECS with a managed database ([ADR 0014](decisions/0014-roadmap.md), decision 6). The app's preparation for both became a phase of its own.
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#219](https://github.com/luiki-dev/szop/issues/219).

### PH-12b Network and the demo-up button

- **Goal:** pressing `demo-up` on a branch creates the demo's network, load balancer and certificate, and `https://szop.dzwoniec.com` answers with a placeholder page. `demo-down` removes everything again.
- **Delivers:** `infra/demo` with the network, the load balancer answering with a fixed placeholder page, the certificate for `szop.dzwoniec.com` with its validation record ([ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md), decision 5) and the `szop` DNS record ([ADR 0008](decisions/0008-hosting.md)); `szop-ci-deploy` widened for these resources, and `demo` added to its trust ([ADR 0032](decisions/0032-ci-access-and-teardown-details.md), decisions 3 and 10); the real `demo-up.yml` in the `demo` environment, which writes the `deployed_commit` output `demo-down` reads and re-enables `demo-down` ([ADR 0010](decisions/0010-ci-cd.md), decision 11; [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7); the runbook's sections on spinning up and tearing down, and on destroying base.
- **Split from:** PH-12 First deploy, now retired (see [PH-12a](#ph-12a-app-ready-for-the-cloud)).
- **Depends on:** PH-11 merged, and its first `demo-down` run seen succeeding.
- **Owner steps:** create the `demo` environment with the owner as required reviewer and "prevent self-review" off; apply `infra/base` from the branch, and again from `main` after the merge; press `demo-up` on the branch, check the placeholder page at `szop.dzwoniec.com`, then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#220](https://github.com/luiki-dev/szop/issues/220).

### PH-36 Scalability and isolation analysis

- **Goal:** we know what it takes for Szop to run as two or more tasks, and whether it is worth it: which parts of the architecture depend on the number of tasks, how far each is built, what goes wrong with several, the solution and its cost, and how a problem shows up locally before AWS. The owner decides to go ahead or stay with one task, and the roadmap and the open points are adjusted to match. We also know whether what Szop deploys to AWS is isolated and marked well enough for other apps to share the account.
- **Delivers:** an analysis of scalability: the app tier (migrations, the event bus and WebSockets, the rate-limit counters, the cleanup job, sessions, seed data, quotas, rolling deploys and connection draining, health checks), the database (connections per task against RDS's limit, Multi-AZ, scaling it) and load-based scaling, each with its current state, its impact, the options, the solution and its cost per demo hour and per month, and how two instances run locally and in the tests; an analysis of isolation of Szop's footprint in the AWS account (names, tags, IAM scope, network ranges, the shared hosted zone, budgets, the Terraform state); an ADR with the decisions, refining or superseding [ADR 0008](decisions/0008-hosting.md), decisions 10, 14 and 32, and [ADR 0012](decisions/0012-security-baseline.md), decision 15, if the owner goes ahead; the roadmap revisited: new or changed phases and open points, their goals, order and size, and the living docs in line. No code or infrastructure changes.
- **Depends on:** —
- **Owner steps:** —
- **Expected path:** full.
- **Open points:** the sub-issues of [#229](https://github.com/luiki-dev/szop/issues/229).

### PH-12c App on ECS and RDS

- **Goal:** pressing `demo-up` on a branch builds that commit's image and serves the walking skeleton from one ECS task backed by RDS: `https://szop.dzwoniec.com` shows the API and the database up, with the schema version. `demo-down` removes everything again.
- **Delivers:** in `infra/demo`, the service on ECS and RDS, in place of the placeholder page ([ADR 0008](decisions/0008-hosting.md)); `db-setup`, a one-off task that creates the database role `szop_app`, which owns the database and which the app connects as, in place of the master user ([ADR 0038](decisions/0038-app-on-ecs-and-rds-details.md)); the app's task execution role and task role, and `szop_app`'s password, in `infra/base`; `szop-ci-deploy` widened for the resources it adds ([ADR 0032](decisions/0032-ci-access-and-teardown-details.md), decision 3), and `szop-ci-plan` denied the data reads they open, such as RDS log files; `demo-up`'s image job, which builds and pushes the commit's image ([ADR 0010](decisions/0010-ci-cd.md), decisions 10 and 11), and its wait for `/api/health` in place of the placeholder page, with the timeouts revisited ([ADR 0034](decisions/0034-network-and-demo-up-details.md)); the TLS connection to RDS; `TRUSTED_PROXIES` set from Terraform; the runbook's section on debugging, with the migration check's message and how to switch branches.
- **Split from:** PH-12 First deploy, now retired (see [PH-12a](#ph-12a-app-ready-for-the-cloud)). Its safe redeploys, which [ADR 0036](decisions/0036-scalability-and-isolation.md) added, became [PH-12d](#ph-12d-safe-redeploys).
- **Depends on:** —
- **Owner steps:** apply `infra/base` from the branch, and again from `main` after the merge; press `demo-up` on the branch, check the demo (including that the log shows the owner's real IP address, also for a request with a forged `X-Forwarded-For` header, that a query through ECS Exec shows the database connection uses TLS, and a Lighthouse run), then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#221](https://github.com/luiki-dev/szop/issues/221).

### PH-12d Safe redeploys

- **Goal:** redeploying a running demo keeps it up: the old and the new version serve side by side until the new one is healthy, a deploy whose tasks keep failing is marked failed instead of retrying for ever, and a database outage no longer replaces healthy tasks.
- **Delivers:** rolling deploys at a minimum of 100% and a maximum of 200% healthy, with the deployment circuit breaker and no rollback; a 30-second deregistration delay on the target group; the load balancer checking a process-only liveness route while `/api/health` stays the readiness check, with the health check's grace period, interval and thresholds tuned; the expand-then-contract rule for migrations in `drizzle.md` ([ADR 0036](decisions/0036-scalability-and-isolation.md), decisions 3 to 5).
- **Split from:** [PH-12c](#ph-12c-app-on-ecs-and-rds): with safe redeploys it held about twelve tasks and three concepts new to the project, ECS, RDS and rolling deploys with two versions at once ([ADR 0014](decisions/0014-roadmap.md), decision 6).
- **Depends on:** PH-12c.
- **Owner steps:** press `demo-up` on the branch, press it again while the demo is up and check that the site keeps answering during the redeploy, then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#244](https://github.com/luiki-dev/szop/issues/244).

### PH-37 Two tasks

- **Goal:** the demo runs two tasks, one in each availability zone. They migrate the database one at a time, a request does not depend on which task answers it, and a deploy or a stopped task loses no request. Two instances run locally and in CI too, so a problem between tasks shows up there first.
- **Delivers:** a PostgreSQL advisory lock around the migration check and the migration, with a test of two migrators at once; a pool of at most 5 connections per task and the connection budget, checked against `SHOW max_connections` on the demo; request IDs unique across tasks; the ECS service's desired count at 2; a Compose profile `scale` with two app containers behind nginx, and its check script in CI's `docker` job; the stack overview's section on running several instances brought in line ([ADR 0036](decisions/0036-scalability-and-isolation.md), decisions 1, 2, 10, 11 and 14).
- **Depends on:** PH-12d.
- **Owner steps:** press `demo-up` on the branch, check that requests reach both tasks, then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#233](https://github.com/luiki-dev/szop/issues/233).

### PH-35 Security scanners

- **Goal:** CI scans the Terraform code for security misconfigurations and the container image for known vulnerabilities, and lints the Dockerfile.
- **Delivers:** a misconfiguration scanner for `infra/` and the image scan with the Dockerfile lint, possibly one tool for both ([ADR 0010](decisions/0010-ci-cd.md), decision 19).
- **Depends on:** PH-12c, which brings the first real image, and RDS with PH-12b's security groups and load balancer, all worth scanning.
- **Owner steps:** —
- **Expected path:** full.
- **Open points:** the sub-issues of [#213](https://github.com/luiki-dev/szop/issues/213).

### PH-13 Releases

- **Goal:** merging release-please's PR tags a version, publishes a GitHub Release and pushes the versioned image. The walking skeleton is released as `v0.1.0`.
- **Delivers:** `release-please.yml` and its configuration ([ADR 0009](decisions/0009-git-workflow.md); [ADR 0010](decisions/0010-ci-cd.md), decision 17); the `szop-ci-release` role; the versioned image.
- **Depends on:** the trial of release-please with merge commits in a throwaway repository, before the brainstorm.
- **Owner steps:** run that trial; create the `release` environment; create the `szop-release` GitHub App, install it on the repository, store its private key in the `release` environment and put the App on the `version-tags` ruleset's bypass list; store the release role's ARN as a GitHub variable; merge the first release PR.
- **Expected path:** full.
- **Open points:** the sub-issues of [#42](https://github.com/luiki-dev/szop/issues/42).

### PH-34 Landing page and demo status

- **Goal:** `dzwoniec.com` always serves a static page that shows whether Szop's demo is up, with a link to it when it is. While no demo runs, `szop.dzwoniec.com` redirects to the page instead of failing.
- **Delivers:** the static page and its hosting; `szop.dzwoniec.com` redirecting to it while the demo is down, which changes how `demo-down` treats the `szop` record; the status check on the page ([ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md), decision 13).
- **Depends on:** PH-12c.
- **Owner steps:** apply `infra/base` from the branch, and again from `main` after the merge, if the phase changes it.
- **Expected path:** full.
- **Open points:** the sub-issues of [#205](https://github.com/luiki-dev/szop/issues/205).

### PH-38 Autoscaling

- **Goal:** the demo's service scales between two and four tasks with its load, and a short load test shows it scaling out and back in.
- **Delivers:** ECS Service Auto Scaling with target tracking (on average CPU, or on requests per target, as the brainstorm decides) between two and four tasks; the deploy role's permissions for Application Auto Scaling and the alarms it creates; a load script run from the owner's machine; the runbook's section on watching a scale-out; the connection budget checked again ([ADR 0036](decisions/0036-scalability-and-isolation.md), decisions 11 and 13).
- **Depends on:** PH-37.
- **Owner steps:** apply `infra/base` from the branch, and again from `main` after the merge; press `demo-up` on the branch, run the load test and watch the service scale out and back in, then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#234](https://github.com/luiki-dev/szop/issues/234).

## Stage 4: MVP

**Exit:** every 🎯 requirement is delivered and meets [NFR-1](requirements/functional-requirements.md#nfr-1) to [NFR-3](requirements/functional-requirements.md#nfr-3), every MVP use case has a passing E2E journey, and `1.0.0` is released: a `Release-As: 1.0.0` footer reaches `main` and the owner merges the release PR ([ADR 0009](decisions/0009-git-workflow.md)).

| Phase | Status | Spec | Plan | PR | Issue |
|---|---|---|---|---|---|
| [PH-14 App shell and design system](#ph-14-app-shell-and-design-system) | ⬜ Not started | — | — | — | [#43](https://github.com/luiki-dev/szop/issues/43) |
| [PH-15 Seed catalog, read-only](#ph-15-seed-catalog-read-only) | ⬜ Not started | — | — | — | [#44](https://github.com/luiki-dev/szop/issues/44) |
| [PH-16 Guest workspace and lists](#ph-16-guest-workspace-and-lists) | ⬜ Not started | — | — | — | [#45](https://github.com/luiki-dev/szop/issues/45) |
| [PH-17 List items](#ph-17-list-items) | ⬜ Not started | — | — | — | [#46](https://github.com/luiki-dev/szop/issues/46) |
| [PH-18 Registration and login](#ph-18-registration-and-login) | ⬜ Not started | — | — | — | [#47](https://github.com/luiki-dev/szop/issues/47) |
| [PH-19 Guest data on login](#ph-19-guest-data-on-login) | ⬜ Not started | — | — | — | [#48](https://github.com/luiki-dev/szop/issues/48) |
| [PH-39 Redis in the stack](#ph-39-redis-in-the-stack) | ⬜ Not started | — | — | — | [#235](https://github.com/luiki-dev/szop/issues/235) |
| [PH-20 Quotas and rate limits](#ph-20-quotas-and-rate-limits) | ⬜ Not started | — | — | — | [#49](https://github.com/luiki-dev/szop/issues/49) |
| [PH-21 Shop in a store](#ph-21-shop-in-a-store) | ⬜ Not started | — | — | — | [#50](https://github.com/luiki-dev/szop/issues/50) |
| [PH-22 Offline state](#ph-22-offline-state) | ⬜ Not started | — | — | — | [#51](https://github.com/luiki-dev/szop/issues/51) |
| [PH-23 Smart input](#ph-23-smart-input) | ⬜ Not started | — | — | — | [#52](https://github.com/luiki-dev/szop/issues/52) |
| [PH-24 Catalog browser](#ph-24-catalog-browser) | ⬜ Not started | — | — | — | [#53](https://github.com/luiki-dev/szop/issues/53) |
| [PH-25 Archive and duplicate](#ph-25-archive-and-duplicate) | ⬜ Not started | — | — | — | [#54](https://github.com/luiki-dev/szop/issues/54) |
| [PH-26 Catalog and units](#ph-26-catalog-and-units) | ⬜ Not started | — | — | — | [#55](https://github.com/luiki-dev/szop/issues/55) |
| [PH-27 Categories](#ph-27-categories) | ⬜ Not started | — | — | — | [#56](https://github.com/luiki-dev/szop/issues/56) |
| [PH-28 Templates](#ph-28-templates) | ⬜ Not started | — | — | — | [#57](https://github.com/luiki-dev/szop/issues/57) |
| [PH-29 Password reset and change](#ph-29-password-reset-and-change) | ⬜ Not started | — | — | — | [#58](https://github.com/luiki-dev/szop/issues/58) |
| [PH-30 Settings and account deletion](#ph-30-settings-and-account-deletion) | ⬜ Not started | — | — | — | [#59](https://github.com/luiki-dev/szop/issues/59) |
| [PH-31 Automatic cleanup](#ph-31-automatic-cleanup) | ⬜ Not started | — | — | — | [#60](https://github.com/luiki-dev/szop/issues/60) |

### PH-14 App shell and design system

- **Goal:** every page sits in Szop's app shell, with the raccoon logo, the navigation (a drawer on phones, a sidebar on larger screens) and the design tokens in light and dark mode. The skeleton's page is restyled in it.
- **Delivers:** the UI foundation of [ADR 0013](decisions/0013-visual-design.md) and [ADR 0022](decisions/0022-ring-tail-redesign.md), and the [visual design](architecture/visual-design.md): Tailwind CSS, shadcn/ui on Base UI under the CSP, the design tokens, Gabarito, Lucide, the favicon and the logo.
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#43](https://github.com/luiki-dev/szop/issues/43).

### PH-15 Seed catalog, read-only

- **Goal:** a visitor without a session browses the default catalog by category and searches it by name, with the categories in their depth-first order.
- **Delivers:** [ACC-1](requirements/functional-requirements.md#acc-1) (part: the seed data before the first change), [PRD-2](requirements/functional-requirements.md#prd-2), [ORD-2](requirements/functional-requirements.md#ord-2) and [ORD-3](requirements/functional-requirements.md#ord-3) (part: the category order rule in `packages/shared`); the seed data; fast-check property tests, StrykerJS and `mutation.yml` ([ADR 0007](decisions/0007-testing-strategy.md)).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#44](https://github.com/luiki-dev/szop/issues/44).

### PH-16 Guest workspace and lists

- **Goal:** a guest creates their first list, which creates their anonymous workspace from the seed data. They rename and delete lists and see their active lists, and nobody can reach another workspace's data.
- **Delivers:** [ACC-1](requirements/functional-requirements.md#acc-1), [LST-1](requirements/functional-requirements.md#lst-1), [LST-2](requirements/functional-requirements.md#lst-2) (part: active lists); Better Auth with its anonymous plugin; the access layer and the composite workspace keys ([ADR 0012](decisions/0012-security-baseline.md), decisions 3–6); the data model conventions every later migration follows.
- **Depends on:** the spike on Better Auth's anonymous plugin, before the brainstorm ([OP-038](https://github.com/luiki-dev/szop/issues/97)).
- **Owner steps:** none.
- **Expected path:** full; a candidate for a split into anonymous sessions and the access layer.
- **Open points:** the sub-issues of [#45](https://github.com/luiki-dev/szop/issues/45).

### PH-17 List items

- **Goal:** a user adds items to a list by name, edits any of their fields, checks, unchecks and removes them, and sees the list sorted by category order or in the order they were added; checked items drop into the haul, which shows how many are done and puts an item back on a tap.
- **Delivers:** [ITM-1](requirements/functional-requirements.md#itm-1), [ITM-6](requirements/functional-requirements.md#itm-6), [ITM-7](requirements/functional-requirements.md#itm-7), [ORD-1](requirements/functional-requirements.md#ord-1), [ORD-2](requirements/functional-requirements.md#ord-2), [ORD-3](requirements/functional-requirements.md#ord-3), [ORD-5](requirements/functional-requirements.md#ord-5); the haul with its chips and drawer ([ADR 0022](decisions/0022-ring-tail-redesign.md)); optimistic updates; forms with React Hook Form.
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#46](https://github.com/luiki-dev/szop/issues/46).

### PH-18 Registration and login

- **Goal:** a guest registers with email and password, verifies the address and keeps their workspace as the account's. They log in and out, on any device.
- **Delivers:** [ACC-2](requirements/functional-requirements.md#acc-2), [ACC-3](requirements/functional-requirements.md#acc-3) (part: logging in and out); the SES email sender, and a way for development and E2E tests to read the emails; completes [UC-8](requirements/functional-requirements.md#uc-8-guest-becomes-a-user).
- **Depends on:** —
- **Owner steps:** verify the email addresses the demo will send to, while SES is in its sandbox.
- **Expected path:** full; a candidate for a split into the authentication flows and sending email.
- **Open points:** the sub-issues of [#47](https://github.com/luiki-dev/szop/issues/47).

### PH-19 Guest data on login

- **Goal:** logging into an existing account from a browser that holds guest data offers to import the guest's lists or to discard them. Imported items find the account's categories by name.
- **Delivers:** [ACC-4](requirements/functional-requirements.md#acc-4) (part: lists; [PH-28](#ph-28-templates) adds templates); completes [UC-9](requirements/functional-requirements.md#uc-9-log-in-on-a-device-with-guest-data).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#48](https://github.com/luiki-dev/szop/issues/48).

### PH-39 Redis in the stack

- **Goal:** Redis runs next to PostgreSQL wherever Szop runs: one ElastiCache node in the demo, a container locally and in CI. The API connects to it and reports it in `/api/health`, ready for the rate limits and the event bus.
- **Delivers:** ElastiCache for Redis OSS, one `cache.t4g.micro` node in `infra/demo`'s private subnets, with encryption in transit, an AUTH token and a security group open only to the tasks; the deploy and plan roles' permissions for it; Redis in `compose.yaml` and in CI; the API's Redis client and its settings, and Redis in the readiness check; the threat model's second data store ([ADR 0036](decisions/0036-scalability-and-isolation.md), decision 6).
- **Depends on:** PH-37.
- **Owner steps:** apply `infra/base` from the branch, and again from `main` after the merge; press `demo-up` on the branch, check that `/api/health` reports Redis, then press `demo-down`.
- **Expected path:** full.
- **Open points:** the sub-issues of [#235](https://github.com/luiki-dev/szop/issues/235).

### PH-20 Quotas and rate limits

- **Goal:** a workspace cannot outgrow its quotas, and a script cannot flood the API, guest creation, registration or login. A user who hits a limit is told which one and what to do about it.
- **Delivers:** [LIM-1](requirements/functional-requirements.md#lim-1) (part: lists and items), [LIM-3](requirements/functional-requirements.md#lim-3), [LIM-4](requirements/functional-requirements.md#lim-4) (part: everything except password reset); `@fastify/rate-limit`; both limiters counting in Redis, so a limit holds across tasks, with a test across two instances ([ADR 0036](decisions/0036-scalability-and-isolation.md), decision 8). Later phases add their own quotas and limits.
- **Depends on:** PH-39.
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#49](https://github.com/luiki-dev/szop/issues/49).

### PH-21 Shop in a store

- **Goal:** in the store, a user checks items off into the haul and sees in it the spent and remaining totals; afterwards, "Put all back" resets the list for next week.
- **Delivers:** [ITM-8](requirements/functional-requirements.md#itm-8) (the amounts in the haul), [LST-5](requirements/functional-requirements.md#lst-5); completes [UC-3](requirements/functional-requirements.md#uc-3-shop-in-a-store) and [UC-4](requirements/functional-requirements.md#uc-4-reuse-a-weekly-list).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#50](https://github.com/luiki-dev/szop/issues/50).

### PH-22 Offline state

- **Goal:** when the connection drops or hangs, the app says so clearly and blocks changes instead of losing them.
- **Delivers:** [NET-1](requirements/functional-requirements.md#net-1).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** bounded, likely.
- **Open points:** the sub-issues of [#51](https://github.com/luiki-dev/szop/issues/51).

### PH-23 Smart input

- **Goal:** typing into a list's input suggests catalog products, and picking one adds it with its defaults. Enter adds the typed text as a one-off item, with an offer to save it to the catalog, and a duplicate offers to increase the existing item's quantity instead.
- **Delivers:** [ITM-2](requirements/functional-requirements.md#itm-2), [ITM-3](requirements/functional-requirements.md#itm-3), [ITM-4](requirements/functional-requirements.md#itm-4); completes [UC-1](requirements/functional-requirements.md#uc-1-first-visit-as-a-guest).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#52](https://github.com/luiki-dev/szop/issues/52).

### PH-24 Catalog browser

- **Goal:** from a list, a user browses the catalog's category tree, selects several products and adds them in one go.
- **Delivers:** [ITM-5](requirements/functional-requirements.md#itm-5); completes [UC-2](requirements/functional-requirements.md#uc-2-plan-a-grocery-trip).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#53](https://github.com/luiki-dev/szop/issues/53).

### PH-25 Archive and duplicate

- **Goal:** a user archives a finished list, finds it read-only in the archive, unarchives it, and duplicates any list with every item unchecked.
- **Delivers:** [LST-2](requirements/functional-requirements.md#lst-2), [LST-3](requirements/functional-requirements.md#lst-3), [LST-4](requirements/functional-requirements.md#lst-4); completes [UC-13](requirements/functional-requirements.md#uc-13-archive-after-a-project).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** bounded, likely.
- **Open points:** the sub-issues of [#54](https://github.com/luiki-dev/szop/issues/54).

### PH-26 Catalog and units

- **Goal:** a user adds, edits and deletes catalog products and units. The smart input suggests the new products, and items already on lists stay as they were.
- **Delivers:** [PRD-1](requirements/functional-requirements.md#prd-1), [PRD-3](requirements/functional-requirements.md#prd-3), [UNT-1](requirements/functional-requirements.md#unt-1), [LIM-1](requirements/functional-requirements.md#lim-1) (part: products and units); completes [UC-7](requirements/functional-requirements.md#uc-7-customize-the-catalog).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#55](https://github.com/luiki-dev/szop/issues/55).

### PH-27 Categories

- **Goal:** a user shapes their own category tree: creates, renames, moves, reorders and deletes categories, and every list re-sorts to match the store.
- **Delivers:** [CAT-1](requirements/functional-requirements.md#cat-1), [CAT-2](requirements/functional-requirements.md#cat-2), [CAT-3](requirements/functional-requirements.md#cat-3), [LIM-1](requirements/functional-requirements.md#lim-1) (part: categories and their depth); completes [UC-6](requirements/functional-requirements.md#uc-6-match-the-store-layout).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#56](https://github.com/luiki-dev/szop/issues/56).

### PH-28 Templates

- **Goal:** a user keeps reusable templates, built from scratch or saved from a list, and starts new lists from them. A guest's templates are imported along with their lists.
- **Delivers:** [TPL-1](requirements/functional-requirements.md#tpl-1), [TPL-2](requirements/functional-requirements.md#tpl-2), [TPL-3](requirements/functional-requirements.md#tpl-3), [LST-6](requirements/functional-requirements.md#lst-6), [ACC-4](requirements/functional-requirements.md#acc-4) (part: templates), [LIM-1](requirements/functional-requirements.md#lim-1) (part: templates); completes [UC-5](requirements/functional-requirements.md#uc-5-build-from-a-template).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#57](https://github.com/luiki-dev/szop/issues/57).

### PH-29 Password reset and change

- **Goal:** a user who forgot their password resets it through an emailed link, and a logged-in user changes it; either change logs out every other session.
- **Delivers:** [ACC-3](requirements/functional-requirements.md#acc-3), [LIM-4](requirements/functional-requirements.md#lim-4) (part: password reset).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#58](https://github.com/luiki-dev/szop/issues/58).

### PH-30 Settings and account deletion

- **Goal:** a user sets their display name and currency, and deletes their account with all its data after confirming their password.
- **Delivers:** [ACC-5](requirements/functional-requirements.md#acc-5), [ACC-6](requirements/functional-requirements.md#acc-6); completes [UC-14](requirements/functional-requirements.md#uc-14-delete-an-account) for the MVP ([PH-32](#ph-32-sharing) adds what happens to shared lists).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#59](https://github.com/luiki-dev/szop/issues/59).

### PH-31 Automatic cleanup

- **Goal:** guest workspaces and unverified accounts are deleted on schedule, and a guest who returns after theirs was deleted understands what happened.
- **Delivers:** [ACC-7](requirements/functional-requirements.md#acc-7), [ACC-8](requirements/functional-requirements.md#acc-8); the scheduled cleanup inside the API, tested with a controllable clock ([ADR 0007](decisions/0007-testing-strategy.md)); each run takes a PostgreSQL try-lock, so one task cleans up per round, with a test of two runs at once ([ADR 0036](decisions/0036-scalability-and-isolation.md), decision 9).
- **Depends on:** —
- **Owner steps:** none.
- **Expected path:** full.
- **Open points:** the sub-issues of [#60](https://github.com/luiki-dev/szop/issues/60).

## Stage 5: Later

**Exit:** every 🔜 requirement is delivered.

Both phases are rough: each is split into smaller phases once the MVP is done ([ADR 0014](decisions/0014-roadmap.md), decision 3).

| Phase | Status | Spec | Plan | PR | Issue |
|---|---|---|---|---|---|
| [PH-32 Sharing](#ph-32-sharing) | ⬜ Not started | — | — | — | [#61](https://github.com/luiki-dev/szop/issues/61) |
| [PH-33 Live updates](#ph-33-live-updates) | ⬜ Not started | — | — | — | [#62](https://github.com/luiki-dev/szop/issues/62) |

### PH-32 Sharing

- **Goal:** an owner shares a list with a registered user or through a link, as shopper or editor, manages who has access, and can take it back.
- **Delivers:** [SHR-1](requirements/functional-requirements.md#shr-1), [SHR-2](requirements/functional-requirements.md#shr-2), [SHR-3](requirements/functional-requirements.md#shr-3), [SHR-4](requirements/functional-requirements.md#shr-4), [SHR-5](requirements/functional-requirements.md#shr-5); completes [UC-12](requirements/functional-requirements.md#uc-12-revoke-access) and [UC-14](requirements/functional-requirements.md#uc-14-delete-an-account); [UC-10](requirements/functional-requirements.md#uc-10-share-with-a-household-member) and [UC-11](requirements/functional-requirements.md#uc-11-hand-off-shopping-to-someone-without-an-account) (part: without live updates).
- **Depends on:** —
- **Owner steps:** none known yet.
- **Expected path:** split into several phases first.
- **Open points:** the sub-issues of [#61](https://github.com/luiki-dev/szop/issues/61).

### PH-33 Live updates

- **Goal:** everyone viewing a shared list sees the others' changes within a few seconds, without reloading.
- **Delivers:** [SYN-1](requirements/functional-requirements.md#syn-1), [SYN-2](requirements/functional-requirements.md#syn-2); completes [UC-10](requirements/functional-requirements.md#uc-10-share-with-a-household-member) and [UC-11](requirements/functional-requirements.md#uc-11-hand-off-shopping-to-someone-without-an-account); the event bus over Redis publish/subscribe, the client's reconnect and refetch, and a test across two instances ([ADR 0036](decisions/0036-scalability-and-isolation.md), decisions 5 and 7).
- **Depends on:** —
- **Owner steps:** none known yet.
- **Expected path:** split into several phases first.
- **Open points:** the sub-issues of [#62](https://github.com/luiki-dev/szop/issues/62).

## Candidates

Optional technical phases that change no behavior, in no particular order. A candidate becomes a phase, with the next free ID, when the owner decides to do it ([ADR 0014](decisions/0014-roadmap.md), decision 13). Feature ideas are not listed here: they live in the [future extensions](requirements/functional-requirements.md#future-extensions-ideas-not-committed) of the functional requirements.

| Candidate | What it would bring | Open point |
|---|---|---|
| Load testing | k6 runs against the demo environment | [OP-029](https://github.com/luiki-dev/szop/issues/114) |
| Supply-chain provenance | Signed attestations, a software bill of materials (SBOM) and an OpenSSF Scorecard | [OP-030](https://github.com/luiki-dev/szop/issues/115) |
| Storybook | A workshop and documentation for the components; to look at again after the first few feature phases | [OP-060](https://github.com/luiki-dev/szop/issues/117) |
| Always-on readiness | What an always-on deployment would need: backups and a Multi-AZ database, a content delivery network (CDN) with a web application firewall, alarms, SES production access, a privacy notice and more; only if one is ever planned | [OP-033](https://github.com/luiki-dev/szop/issues/116) |
| Isolation from other apps | What a second app in the account would need: a stack of its own for the shared pieces (the hosted zone and its domain-wide records, the OIDC provider, the budget), a budget per app, SES identities per app, or an account per app | [OP-100](https://github.com/luiki-dev/szop/issues/236) |
