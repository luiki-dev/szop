# Open points

Everything that is still undecided or not yet done and has been left to a later topic or phase: decisions to take, checks to run, documents to write, settings to apply. One list, so nothing deferred in an ADR, a guide or a review is forgotten. Why the register exists is recorded in [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 1; how it is grouped by the roadmap's phases, in [ADR 0014](decisions/0014-roadmap.md).

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
  - [PH-12 First deploy](#ph-12-first-deploy)
  - [PH-13 Releases](#ph-13-releases)
- [Stage 4: MVP](#stage-4-mvp)
  - [PH-14 App shell and design system](#ph-14-app-shell-and-design-system)
  - [PH-15 Seed catalog, read-only](#ph-15-seed-catalog-read-only)
  - [PH-16 Guest workspace and lists](#ph-16-guest-workspace-and-lists)
  - [PH-17 List items](#ph-17-list-items)
  - [PH-18 Registration and login](#ph-18-registration-and-login)
  - [PH-19 Guest data on login](#ph-19-guest-data-on-login)
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
- [Closed](#closed)

## How it works

- **One entry per open point**, with a stable ID (`OP-001`, `OP-002`, …) that ADRs, specs, plans, PRs and commits can refer to. IDs are never reused. **Every entry is a heading of its own** (`#### OP-041`), so a link to it (`open-points.md#op-041`) keeps working when the entry moves to another group, on GitHub and in an editor's preview alike.
- **Each entry says** what is open, where it came from (a link to the ADR decision, guide or audit finding) and its status: ⬜ **open**, or 🚧 **in progress** with a link to the branch or PR working on it.
- **Entries are grouped by the [roadmap](roadmap.md)'s stages and phases**, under the phase that will settle them. Points for optional work sit under [Candidates](#candidates).
- **An entry that spans several phases** sits under the first of them, and its **Parts** say which part each phase takes. The other phases list it on their "Also" line. When a phase has done its part, it marks that part ✅ with its PR and moves the entry to the next phase's group.
- **Adding:** whenever a topic, phase or review defers something, it adds an entry here with the next free ID, under the phase that will settle it, in addition to mentioning it where it came up.
- **Using:** each phase brainstorm starts from its group, including the entries on its "Also" line. Before its PR is merged, the phase closes its entries or its parts of them, or moves them to another group with a note why (the [definition of done](development/definition-of-done.md), item 9).
- **Closing:** a settled entry moves to [Closed](#closed) with a link to what settled it (an ADR, a commit, a PR). Its status becomes ✅ **closed**, or ✖️ **dropped** when it was dropped without being done, saying why. Closed and dropped entries stay as a record.
- **Each open entry has an issue** on GitHub ([ADR 0024](decisions/0024-github-project-tracking.md)), named on its **Issue** line: a sub-issue of its phase's issue, on the [Szop project](https://github.com/users/luiki-dev/projects/3). During the trial ([OP-086](#op-086)) the issues are the source and this page mirrors them: an entry is added, moved or closed on GitHub first, then here ([project tracking](development/project-tracking.md#how-items-move)).

## Stage 1: Local foundations

### PH-01 Monorepo and toolchain

Roadmap entry: [PH-01](roadmap.md#ph-01-monorepo-and-toolchain).

### PH-02 CI checks

Roadmap entry: [PH-02](roadmap.md#ph-02-ci-checks).

## Stage 2: Walking skeleton, running locally

### PH-03 API skeleton

Roadmap entry: [PH-03](roadmap.md#ph-03-api-skeleton).

### PH-04 Database

Roadmap entry: [PH-04](roadmap.md#ph-04-database).

### PH-05 SPA skeleton

Roadmap entry: [PH-05](roadmap.md#ph-05-spa-skeleton).

### PH-06a Production build and serving

Roadmap entry: [PH-06a](roadmap.md#ph-06a-production-build-and-serving).

### PH-06b Web security baseline

Roadmap entry: [PH-06b](roadmap.md#ph-06b-web-security-baseline).

### PH-07 First E2E journey

Roadmap entry: [PH-07](roadmap.md#ph-07-first-e2e-journey).

#### OP-010

**Add the test tooling**: the Vitest projects, Testing Library, MSW, Playwright with axe, fast-check and StrykerJS, the `test*` scripts and the Vitest and Playwright editor extensions. Write `docs/development/testing.md` and the tool pages; `CLAUDE.md` then points to `testing.md`. Each tool's editor extension and tool page come with it.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-03:** Vitest, its projects and the `test*` scripts, `testing.md` and the `CLAUDE.md` pointer ✅ Done ([#18](https://github.com/luiki-dev/szop/pull/18))
  - **PH-05:** Testing Library and MSW ✅ Done ([#22](https://github.com/luiki-dev/szop/pull/22))
  - **PH-07:** Playwright with axe
  - **PH-15:** fast-check and StrykerJS
- **Source:** [ADR 0007](decisions/0007-testing-strategy.md), decisions 18, 21, 22 and consequences
- **Issue:** [#63](https://github.com/luiki-dev/szop/issues/63)
- **Status:** ⬜ Open

#### OP-012

**Write the first test of each layer**, including the first E2E journey on both viewports, so every testing decision is tried end to end.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-03:** the first API test ✅ Done ([#18](https://github.com/luiki-dev/szop/pull/18))
  - **PH-04:** the first test against the database ✅ Done ([#20](https://github.com/luiki-dev/szop/pull/20))
  - **PH-05:** the first component test ✅ Done ([#22](https://github.com/luiki-dev/szop/pull/22))
  - **PH-07:** the first E2E journey on both viewports
- **Source:** [ADR 0007](decisions/0007-testing-strategy.md), consequences
- **Issue:** [#64](https://github.com/luiki-dev/szop/issues/64)
- **Status:** ⬜ Open

#### OP-057

**Extend the E2E suite for the visual design**, with the first E2E journey (OP-012): a Playwright Firefox project at the desktop viewport, next to desktop Chromium and the Pixel; axe with the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` rule sets, scanning every page in light and dark (Playwright can emulate `prefers-color-scheme`); and a journey that fails on any CSP violation the browser reports (for example a listener for `securitypolicyviolation` events, or the console). Show once that the guard catches an injected `<style>` element.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decisions 2, 3, 9 and 11
- **Issue:** [#65](https://github.com/luiki-dev/szop/issues/65)
- **Status:** ⬜ Open

#### OP-067

**Confirm CI on its first real PRs after PH-02's merge.** (1) Dependabot: the owner ran *Insights → Dependency graph → Dependabot → Check for updates* on 2026-10-05 and no PR came. What remains: the first Dependabot PR must pass `commits` (audit m9 on a real commit), and its npm update must handle pnpm 12's lockfile; if it cannot, decide between waiting, pinning and Renovate ([ADR 0010](decisions/0010-ci-cd.md), decision 18). (2) The first PR that changes only Markdown skips `lint`, `typecheck`, `test` and `workflows`, and `ci-ok` is green ✅ Done ([#16](https://github.com/luiki-dev/szop/pull/16)). (3) CodeQL's default setup lists Actions among its languages once workflows are on `main`; if not, the owner adds it ✅ Done: CodeQL added `actions` by itself after the merge, and [#16](https://github.com/luiki-dev/szop/pull/16) ran *Analyze (actions)*.

- **Moved from PH-04:** it does not depend on that phase.
- **Moved from PH-05:** it does not depend on that phase.
- **Moved from PH-06:** it does not depend on that phase.
- **Moved from PH-06b:** it does not depend on that phase.
- **Source:** [ADR 0018](decisions/0018-ci-details.md), decisions 9 and 10
- **Issue:** [#27](https://github.com/luiki-dev/szop/issues/27)
- **Status:** ⬜ Open

### PH-08 Container image

Roadmap entry: [PH-08](roadmap.md#ph-08-container-image).

#### OP-013

**Build what the demo runs on**: the Terraform code for `infra/bootstrap`, `infra/base` and `infra/demo`, the multi-stage Dockerfile, serving the SPA with `@fastify/static`, `GET /api/health`, migrations at startup and the SES `EmailSender`. ECR's lifecycle policy must not expire released images (m11): a higher-priority rule selects `v*`-tagged images with a count limit never reached, which shields them from the lower-priority rule keeping only the last few of the rest, since ECR has no "keep" action. Bootstrap's state bucket has versioning, the public-access block and a policy that allows only TLS (C6).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-03:** `GET /api/health` ✅ Done ([#18](https://github.com/luiki-dev/szop/pull/18))
  - **PH-04:** migrations at startup ✅ Done ([#20](https://github.com/luiki-dev/szop/pull/20))
  - **PH-06a:** serving the SPA with `@fastify/static` ✅ Done ([#23](https://github.com/luiki-dev/szop/pull/23))
  - **PH-08:** the multi-stage Dockerfile
  - **PH-09:** `infra/bootstrap`, with the state bucket's protections
  - **PH-10:** the permanent part of `infra/base`, with ECR's lifecycle policy
  - **PH-12:** `infra/demo`
  - **PH-18:** the SES `EmailSender`
- **Source:** [ADR 0008](decisions/0008-hosting.md), consequences; [Audit, m11](audits/2026-09-29-design-sanity-check.md#process-and-ci); [Audit, C6](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Issue:** [#66](https://github.com/luiki-dev/szop/issues/66)
- **Status:** ⬜ Open

#### OP-015

**Decide the Dockerfile's exact build steps.** The final image runs as a non-root user.

- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 12; [Audit, C6](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Issue:** [#67](https://github.com/luiki-dev/szop/issues/67)
- **Status:** ⬜ Open

#### OP-017

**Connect to RDS with TLS and full certificate verification.** That needs the RDS certificate authority bundle in the image and the pool's TLS settings, with full verification. Nothing is assembled: the five `DATABASE_*` settings stay separate and ECS injects only the password, which the pool takes as a field.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-08:** the RDS certificate authority bundle in the image
  - **PH-12:** the pool's TLS settings, with full certificate verification
- **Source:** [ADR 0008](decisions/0008-hosting.md), consequences; [Audit, C6](audits/2026-09-29-design-sanity-check.md#consider-improving); [ADR 0020](decisions/0020-database-details.md), decision 3 (the settings stay separate, so no connection string is assembled)
- **Issue:** [#68](https://github.com/luiki-dev/szop/issues/68)
- **Status:** ⬜ Open

#### OP-032

**Add a CI job that proves the built image starts**: run it next to PostgreSQL from `compose.yaml` and call `/api/health`, or run the E2E suite against the image. It covers what the demo check does not require for other PRs, such as Dependabot's bumps of the Node base image or PostgreSQL.

- **Source:** [Audit, MAJOR-13](audits/2026-09-29-design-sanity-check.md#major-13-roadmap-phases-and-the-definition-of-done-are-not-ready-for-the-roadmap-brainstorm); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 3
- **Issue:** [#69](https://github.com/luiki-dev/szop/issues/69)
- **Status:** ⬜ Open

#### OP-068

**Add Dependabot's other ecosystems.** Majors of Node and PostgreSQL change on purpose, together with `.nvmrc`, `engines`, the Dockerfile, `compose.yaml` and the RDS version (audit m13).

- **Parts:**
  - **PH-04:** `docker-compose` (PostgreSQL in `compose.yaml`), ignoring its major updates ✅ Done ([#20](https://github.com/luiki-dev/szop/pull/20))
  - **PH-08:** `docker` (the Node base image), ignoring its major updates
  - **PH-09:** `terraform` (the AWS provider)
- **Source:** [ADR 0010](decisions/0010-ci-cd.md), decision 18; [Audit, m13](audits/2026-09-29-design-sanity-check.md#process-and-ci); [ADR 0018](decisions/0018-ci-details.md)
- **Issue:** [#70](https://github.com/luiki-dev/szop/issues/70)
- **Status:** ⬜ Open

#### OP-078

**Keep the migrations folder where the API finds it.** The API is not compiled: Node runs `apps/api/src/db/migrate.ts` itself, which resolves `migrationsFolder` as `../../drizzle` from its own location, so the path stays correct as long as the image keeps `apps/api/` whole. PH-08's image must copy `drizzle/` with `meta/_journal.json`, because `readJournal()` reads the journal on every `buildApp`. If the journal is missing, `buildApp` (`server.ts`, outside the startup `try`) throws an uncaught exception that is not logged through pino as `startup failed`: PH-08 tests the image's startup, or catches that case.

- **Since PH-06a:** no build step ([ADR 0023](decisions/0023-production-build-and-serving-details.md), decision 1); the PH-06a part is settled by design.
- **Source:** [ADR 0020](decisions/0020-database-details.md), consequences
- **Issue:** [#71](https://github.com/luiki-dev/szop/issues/71)
- **Status:** ⬜ Open

#### OP-084

**Keep the symlinked workspace in the container image.** Node refuses to strip types in files under `node_modules`; `@szop/shared` works because pnpm links it to `packages/shared/src/`. An image built with `pnpm deploy`, or any step that copies workspace packages into `node_modules`, makes the API fail at startup with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` once it imports `@szop/shared`. The image copies the workspace as it is and installs production dependencies with `pnpm install --prod --frozen-lockfile`.

**Check the pages, not only the API, at startup.** A `WEB_ROOT` that points at a missing or wrong folder does not stop the API: `/api/health` answers 200 while every page path answers a plain-text 404, with only a warning in the log ([ADR 0023](decisions/0023-production-build-and-serving-details.md), decision 2). The image's startup check must therefore also request `/` and expect HTML with status 200.

- **Source:** [ADR 0023](decisions/0023-production-build-and-serving-details.md), decision 1
- **Issue:** [#72](https://github.com/luiki-dev/szop/issues/72)
- **Status:** ⬜ Open

#### OP-086

**Decide how the GitHub tracking trial ends.** After PH-06b and PH-07, decide whether to drop `open-points.md` and keep `roadmap.md` as a view updated from the issues, and what the roadmap keeps: the phase entries, the stage tables, the README's diagram ([ADR 0017](decisions/0017-readme-roadmap-diagram.md)). Dropping the register means rewriting the links to its entries in ADRs, specs and guides to the issues. Look back at how often the docs fell behind GitHub, and which views were used.

- **Source:** [ADR 0024](decisions/0024-github-project-tracking.md), decision 2
- **Issue:** [#156](https://github.com/luiki-dev/szop/issues/156)
- **Status:** ⬜ Open

## Stage 3: Walking skeleton, deployed and released

### PH-09 AWS account and Terraform bootstrap

Roadmap entry: [PH-09](roadmap.md#ph-09-aws-account-and-terraform-bootstrap).\
Also: [OP-013](#op-013), [OP-068](#op-068).

#### OP-018

**Write the runbook** `docs/operations/demo-environment.md` and the tool pages `terraform.md` and `aws-cli.md`; add the Terraform CLI, AWS CLI and Session Manager plugin to the setup guide. `CLAUDE.md` and the README then point to `docs/operations/`.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-09:** the runbook's account setup, the tool pages and the setup guide, and the pointers in `CLAUDE.md` and the README
  - **PH-11:** tearing down with `demo-down`
  - **PH-12:** spinning up, tearing down and debugging, and the message of OP-043
- **Source:** [ADR 0008](decisions/0008-hosting.md), decisions 30 and 31, consequences
- **Issue:** [#73](https://github.com/luiki-dev/szop/issues/73)
- **Status:** ⬜ Open

#### OP-023

**Write the CI/CD docs**: `docs/development/ci-cd.md`, tool pages for GitHub Actions, release-please, Dependabot, tflint, actionlint and zizmor, the buttons as the runbook's primary path, and a CI/CD section in the stack overview. `CLAUDE.md` then points to `ci-cd.md`.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-02:** `ci-cd.md`, the pages for GitHub Actions, Dependabot, actionlint and zizmor, and the stack overview's CI/CD section ✅ Done ([#14](https://github.com/luiki-dev/szop/pull/14))
  - **PH-09:** the tflint page
  - **PH-11 and PH-12:** the buttons as the runbook's primary path
  - **PH-13:** the release-please page
- **Source:** [ADR 0010](decisions/0010-ci-cd.md), decision 22 and consequences
- **Issue:** [#74](https://github.com/luiki-dev/szop/issues/74)
- **Status:** ⬜ Open

### PH-10 Domain and base infrastructure

Roadmap entry: [PH-10](roadmap.md#ph-10-domain-and-base-infrastructure).\
Also: [OP-013](#op-013).

#### OP-016

**Make "secret values never enter Terraform state" a hard rule, with a fallback and a check.** Confirm it resource by resource, using write-only arguments where the provider supports them (they need Terraform 1.11 or later, so the version is pinned to match); where it does not, the secret is created outside Terraform, for example the owner creates the Better Auth secret with one AWS CLI command and Terraform refers only to its name. Add a way to check it (for example searching the state for the secret's value once after the first apply) and document how the secret is rotated. Plan output already masks values marked sensitive; the exposure the rule guards against is the state itself, which the plan role can read from any branch (OP-037).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-10:** the rule, the Terraform version pin, the Better Auth secret created outside Terraform, the check and the rotation
  - **PH-12:** confirming it for the RDS-managed database password
- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 22; [ADR 0010](decisions/0010-ci-cd.md), decision 14; [Audit, m3](audits/2026-09-29-design-sanity-check.md#security-and-operations)
- **Issue:** [#75](https://github.com/luiki-dev/szop/issues/75)
- **Status:** ⬜ Open

#### OP-044

**Protect the domain against spoofed email, and decide what a failed send does.** **The phase that sets up SES in `infra/base`** adds a DMARC record with `p=reject` (the record that tells receivers to refuse mail pretending to come from the domain; SES's DKIM signature already aligns with the domain, so Szop's own mail passes) and `v=spf1 -all` on the domain, which sends nothing itself; a custom MAIL FROM subdomain with its own SPF record is optional, since with SES's default the envelope sender is `amazonses.com` and the domain's SPF is not checked. **The phase delivering [ACC-2](requirements/functional-requirements.md#acc-2)** decides what registration, password reset and verification resend do when SES refuses to send, as the sandbox does for unverified addresses: what the user sees, weighed against revealing which emails are registered (OP-036).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-10:** the DMARC and SPF records
  - **PH-18:** what a failed send does
- **Source:** [Audit, m2](audits/2026-09-29-design-sanity-check.md#security-and-operations); [ADR 0008](decisions/0008-hosting.md), decision 24
- **Issue:** [#76](https://github.com/luiki-dev/szop/issues/76)
- **Status:** ⬜ Open

### PH-11 CI access to AWS and the teardown safety net

Roadmap entry: [PH-11](roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net).\
Also: [OP-018](#op-018), [OP-023](#op-023).

#### OP-019

**Write the workflows**: `ci.yml`, `pr-title.yml`, `infra-plan.yml`, `demo-up.yml`, `demo-down.yml`, `release-please.yml` and `mutation.yml`, the composite setup action, `dependabot.yml` and the release-please configuration (`bump-minor-pre-major`; `1.0.0` through a `Release-As` footer). Add the `lint` and `typecheck` scripts if earlier phases have not. For `demo-up` and `demo-down`, settle the details of [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7: the output recording the deployed commit, how `demo-down` reads it and checks that commit out, the concurrency groups and the lock timeout. Details from the design sanity check: the `commits` job is tried on a real Dependabot commit before `ci-ok` becomes a required check (m9, with the commitlint rules of OP-009); `ci-ok` requires the change-detection job to have succeeded and fails if any job reports `failure` or `cancelled`, since a failed detection job leaves every other job `skipped` (m10), which a PR that makes detection fail can prove; check whether `infra-plan` gets an OIDC token on Dependabot PRs, and if not, skip it for them by testing the PR's author (`github.event.pull_request.user.login`), not `github.actor`, which becomes whoever re-runs the job, and plan provider bumps locally instead (m12); `dependabot.yml` ignores major updates of the Node image, `@types/node` (whose major follows Node's) and the PostgreSQL image, so a major upgrade is a deliberate change of `.nvmrc`, `engines`, the Dockerfile, `compose.yaml` and the RDS version together, keeping development on production's major version (m13); the release image is built from the release commit and never demo-checked, and the "re-tag if ECR already has it" path will rarely apply, which `ci-cd.md` (OP-023) states as a known, small risk (the release commit changes only the version and the changelog, and OP-032 covers whether the image starts), and the privileged `release` job restores no cache (C10). From [ADR 0012](decisions/0012-security-baseline.md), decisions 16 and 18: `demo-up`'s jobs declare `environment: demo` and `demo-down`'s declare `demo-teardown`; `id-token: write` is granted per job, never per workflow; jobs holding AWS credentials run no `pnpm install` and no project scripts on the runner.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-02:** `ci.yml` (with the `commits` and `ci-ok` details above), `pr-title.yml`, the composite setup action and `dependabot.yml`, whose ecosystems and ignore rules are added by the phases that introduce them (Dependabot writes `build(deps-dev): …` for devDependencies, which `scope-enum` rejects, so `dependabot.yml` and the scope list in `commitlint.config.js` are aligned in PH-02) ✅ Done ([#14](https://github.com/luiki-dev/szop/pull/14)), with the `ci-ok` (m10) and m9 details: commitlint accepted a real Dependabot commit message, locally and in CI's `commits` job on the proof PR [#15](https://github.com/luiki-dev/szop/pull/15) ([ADR 0018](decisions/0018-ci-details.md), decision 9); real Dependabot PRs follow in [OP-067](#op-067)
  - **PH-11:** `infra-plan.yml` and `demo-down.yml`
  - **PH-12:** `demo-up.yml`
  - **PH-13:** `release-please.yml` and its configuration
  - **PH-15:** `mutation.yml`
- **Source:** [ADR 0009](decisions/0009-git-workflow.md), consequences; [ADR 0010](decisions/0010-ci-cd.md), decisions 5–18 and consequences; [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7; [Audit, Process and CI](audits/2026-09-29-design-sanity-check.md#process-and-ci); [Audit, C10](audits/2026-09-29-design-sanity-check.md#consider-improving); [ADR 0012](decisions/0012-security-baseline.md), decisions 16 and 18
- **Issue:** [#77](https://github.com/luiki-dev/szop/issues/77)
- **Status:** ⬜ Open

#### OP-020

**Create the AWS side of CI** in `infra/base`: the GitHub OIDC provider, the three CI roles and the app's two roles, with the policies checked by IAM Access Analyzer's policy validation. From [ADR 0012](decisions/0012-security-baseline.md), decisions 16 and 17: `szop-ci-deploy` trusts the subjects of both `demo` and `demo-teardown`; `szop-ci-plan` is denied `logs:GetLogEvents`, `logs:FilterLogEvents`, `logs:StartQuery` and `logs:StartLiveTail`.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-11:** the OIDC provider, `szop-ci-plan` and `szop-ci-deploy`
  - **PH-12:** the app's two roles
  - **PH-13:** `szop-ci-release`
- **Source:** [ADR 0010](decisions/0010-ci-cd.md), decisions 15 and 16; [ADR 0012](decisions/0012-security-baseline.md), decisions 16 and 17
- **Issue:** [#78](https://github.com/luiki-dev/szop/issues/78)
- **Status:** ⬜ Open

#### OP-066

**Revisit a local hook for workflow files.** actionlint and zizmor run only in CI ([ADR 0018](decisions/0018-ci-details.md), decision 6). PH-11 writes the next workflows; if slips caught by CI were a nuisance in PH-02, add a lint-staged entry for `.github/**/*.yml`, with both tools installed as their tool pages describe.

- **Source:** [ADR 0018](decisions/0018-ci-details.md), decision 6
- **Issue:** [#79](https://github.com/luiki-dev/szop/issues/79)
- **Status:** ⬜ Open

#### OP-069

**Refer to the setup action with `$/`.** Once actionlint accepts GitHub's self-repository syntax (rhysd/actionlint#732), change `uses: ./.github/actions/setup` to `uses: $/.github/actions/setup`, re-enable zizmor's `self-repository` audit in `.github/zizmor.yml`, check that Dependabot and CodeQL still read the workflows, and consider moving the checkout into the setup action.

- **Source:** [ADR 0018](decisions/0018-ci-details.md), decision 12
- **Issue:** [#80](https://github.com/luiki-dev/szop/issues/80)
- **Status:** ⬜ Open

#### OP-070

**Let zizmor report even when actionlint fails.** In the `workflows` job, zizmor's step runs only if actionlint's step passed, so a workflow with both kinds of problem shows only actionlint's first. The PH-02 gate proofs showed it: an untrusted `${{ github.event.pull_request.title }}` in a `run:` script was caught by actionlint, and zizmor never ran ([#15](https://github.com/luiki-dev/szop/pull/15)). Add `if: success() || failure()` to the zizmor step, so both tools report in one run while a cancelled run still stops; consider the same for `pnpm format:check` after `pnpm lint` in the `lint` job.

- **Source:** PH-02 gate proofs ([#14](https://github.com/luiki-dev/szop/pull/14)); [ADR 0018](decisions/0018-ci-details.md), decision 5
- **Issue:** [#81](https://github.com/luiki-dev/szop/issues/81)
- **Status:** ⬜ Open

### PH-12 First deploy

Roadmap entry: [PH-12](roadmap.md#ph-12-first-deploy).\
Also: [OP-013](#op-013), [OP-016](#op-016), [OP-017](#op-017), [OP-018](#op-018), [OP-019](#op-019), [OP-020](#op-020), [OP-023](#op-023).

#### OP-014

**Decide how `infra/demo` finds base's resources**: by name (data sources) or from base's outputs (`terraform_remote_state`).

- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 6
- **Issue:** [#82](https://github.com/luiki-dev/szop/issues/82)
- **Status:** ⬜ Open

#### OP-021

**Confirm that `demo-up` can build the image in parallel with Terraform**; otherwise the jobs run one after the other.

- **Source:** [ADR 0010](decisions/0010-ci-cd.md), decision 11
- **Issue:** [#83](https://github.com/luiki-dev/szop/issues/83)
- **Status:** ⬜ Open

#### OP-043

**Make redeploys safe for the single-instance demo**, in the phase that builds the ECS service (PH-12); an ADR records it, refining [ADR 0008](decisions/0008-hosting.md), decisions 14 and 15. ECS starts the new task before stopping the old one by default, so a redeploy (which applies the new commit's `infra/demo`, [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 7) migrates the database while the old task still serves traffic and runs its cleanup timer. **Settled in PH-04:** Drizzle's migrator skips a migration older than the last one applied, silently ([`drizzle.md`](development/tools/drizzle.md); [ADR 0020](decisions/0020-database-details.md), consequences); an unreachable database stops startup ([ADR 0020](decisions/0020-database-details.md), decision 11); and the health check stays one combined route, `/api/health`, which includes the database, acceptable with one instance (decision 11; its tuning is [OP-075](#op-075)). **Still open:** a minimum of 0% and a maximum of 100% healthy tasks, so the old task stops first; the app refusing to start, with a clear log message, if the database holds migrations its code does not know or one of its migrations is older than the last one applied (today the health route reports `"unknown"` for an unknown migration and the older one is skipped without a word), since switching branches can otherwise skip a migration or run old code on a newer schema; and the runbook explaining the message and how to switch branches: destroy, then spin up again.

- **Source:** [Audit, MAJOR-9](audits/2026-09-29-design-sanity-check.md#major-9-the-single-instance-guarantee-doesnt-hold-during-a-redeploy-and-branch-redeploys-can-skip-migrations)
- **Issue:** [#84](https://github.com/luiki-dev/szop/issues/84)
- **Status:** ⬜ Open

#### OP-053

**Build the app-wide web baseline** with the first endpoints: `@fastify/helmet` with the CSP, HSTS and `Referrer-Policy: no-referrer`; the `Sec-Fetch-Site` or `Origin` check and JSON-only bodies on every unsafe method; `TRUSTED_PROXIES` in the configuration, and how Better Auth is handed the same client IP; the request log's URL serializer that strips tokens; the API test with a forged `X-Forwarded-For`, and the one-time manual check on the demo that the log shows the real address.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-06b:** everything except the demo check ✅ Done ([#158](https://github.com/luiki-dev/szop/pull/158))
  - **PH-12:** the one-time check on the demo that the log shows the real address, and `TRUSTED_PROXIES` set to the load balancer's subnets or the VPC's range from Terraform
  - **PH-18:** Better Auth handed the same client address, its exact `trustedOrigins`, and the forged-header test extended to its limiter; Better Auth's `baseURL` set explicitly, so nothing relies on `request.host` or `request.protocol` ([ADR 0025](decisions/0025-web-security-baseline-details.md)); the end-to-end "token never in the log" test extended to Better Auth's token routes, since Fastify's own programming-error warnings can carry the raw URL ([ADR 0025](decisions/0025-web-security-baseline-details.md), decision 6)
  - **PH-20:** the forged-header test extended to `@fastify/rate-limit`
- **Moved from PH-06:** PH-06 was split; the web baseline is PH-06b.
- **Source:** [ADR 0012](decisions/0012-security-baseline.md), decisions 7–9 and 13; [ADR 0025](decisions/0025-web-security-baseline-details.md), decision 7
- **Issue:** [#26](https://github.com/luiki-dev/szop/issues/26)
- **Status:** ⬜ Open

#### OP-072

**Quieten the health route's request logs.** The load balancer calls `GET /api/health` every few seconds, which would fill CloudWatch with two lines per check; for example, the route's `logLevel` set to `warn`.

- **Source:** [PH-03 spec](superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md#out-of-scope)
- **Issue:** [#85](https://github.com/luiki-dev/szop/issues/85)
- **Status:** ⬜ Open

#### OP-074

**Choose the database role the app uses on RDS.** The master user, or a role with only the privileges the app needs (no `CREATEDB`, no role management), created by a migration or by Terraform. Locally the app and the tests use the superuser `szop`, which the tests need for `CREATE DATABASE`.

- **Source:** [PH-04 spec](superpowers/specs/2026-10-05-PH-04-database-design.md#out-of-scope)
- **Issue:** [#86](https://github.com/luiki-dev/szop/issues/86)
- **Status:** ⬜ Open

#### OP-075

**Tune the ECS health check and the deployment circuit breaker.** The health check's grace period (long enough for migrations at startup), its interval and thresholds, and the circuit breaker with rollback, so that a deploy whose tasks keep failing is marked failed. `/api/health` includes the database, so a database outage replaces running tasks; acceptable with one instance ([ADR 0020](decisions/0020-database-details.md), decision 11).

- **Source:** [ADR 0020](decisions/0020-database-details.md), decision 11
- **Issue:** [#87](https://github.com/luiki-dev/szop/issues/87)
- **Status:** ⬜ Open

#### OP-085

**Bound the API's shutdown when connections stay open.** In PH-06a's browser check (Node 24.21, Fastify 5), `pnpm start` received SIGTERM, logged `shutting down` and closed its port at once, but the process took about 145 seconds to exit, held by one open connection from Chrome after its tab was closed. On ECS, a task that has not exited by its stop timeout (30 seconds by default) is killed, so a slow shutdown could cut off requests that are still running or end without the pool closing cleanly. Options to check: Fastify's `forceCloseConnections`, or a deadline after which `server.ts` exits anyway, and how either fits the graceful shutdown of [ADR 0019](decisions/0019-api-skeleton-details.md), decision 8.

- **Source:** PH-06a, Task 7's browser check ([#23](https://github.com/luiki-dev/szop/pull/23))
- **Issue:** [#88](https://github.com/luiki-dev/szop/issues/88)
- **Status:** ⬜ Open

### PH-13 Releases

Roadmap entry: [PH-13](roadmap.md#ph-13-releases).\
Also: [OP-019](#op-019), [OP-020](#op-020), [OP-023](#op-023).

#### OP-025

**Decide how releases and changelogs work with merge commits, through a trial in a throwaway repository before the phase that sets up release-please.** release-please reads every commit reaching `main`: the task commits a merge commit brings in and the merge commit itself (the PR title), so a phase appears twice, and review-fix `fix:` commits appear as fixes of unreleased code. Also open: where the `Release-As: 1.0.0` footer goes (a merge commit's body is empty; for example an empty commit with the footer, merged through a PR), and that the merge title can still be edited in GitHub's merge dialog after the title check passed. Options to compare: (A) merge commits with GitHub's default message, which release-please ignores, so task commits drive the changelog; (B) the PR-title message with noisy types hidden by `changelog-sections`; (C) squash merges; (D) merge commits with release notes rewritten by a `BEGIN_COMMIT_OVERRIDE` block, if it works for merge commits. If the outcome changes the merge strategy (ADR 0009, decision 6), a new ADR records it.

- **Source:** [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-releases-phase); [Audit, MAJOR-10](audits/2026-09-29-design-sanity-check.md#major-10-release-please-doesnt-work-well-with-merge-commits)
- **Issue:** [#89](https://github.com/luiki-dev/szop/issues/89)
- **Status:** ⬜ Open

#### OP-026

**Confirm the image version tag format**: agreed direction `szop:0.4.0`, without the git tag's `v`.

- **Source:** [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-releases-phase)
- **Issue:** [#90](https://github.com/luiki-dev/szop/issues/90)
- **Status:** ⬜ Open

#### OP-027

**Confirm release-please's branch name** (`release-please--branches--main` by default) against the ruleset and the branch naming rule.

- **Source:** [phase walkthrough](development/phase-walkthrough.md#open-points-for-the-releases-phase)
- **Issue:** [#91](https://github.com/luiki-dev/szop/issues/91)
- **Status:** ⬜ Open

## Stage 4: MVP

### PH-14 App shell and design system

Roadmap entry: [PH-14](roadmap.md#ph-14-app-shell-and-design-system).

#### OP-056

**Build the UI foundation** in the first MVP phase, not the SPA skeleton ([ADR 0014](decisions/0014-roadmap.md), decision 9): Tailwind CSS v4 through `@tailwindcss/vite`; `shadcn init` with Base UI, and Base UI's `CSPProvider` with `disableStyleElements` plus the scrollbar CSS it then expects; the design tokens of [visual-design.md](architecture/visual-design.md#3-design-tokens) as CSS custom properties, light and dark, with every pair's contrast checked; Gabarito from `@fontsource-variable/gabarito`; Lucide; the favicon and the header logo, polished from the draft [`raccoon.svg`](architecture/visual-design/raccoon.svg); the app shell with the navigation of [section 5](architecture/visual-design.md#5-layout-and-navigation) (a drawer on phones, a sidebar from `lg`); `prettier-plugin-tailwindcss`, the Tailwind CSS IntelliSense extension in `.vscode/extensions.json`, and the tool pages for Tailwind CSS and shadcn/ui in `docs/development/tools/`.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decisions 7–17 and 19; [ADR 0022](decisions/0022-ring-tail-redesign.md), decisions 2 and 9–12
- **Issue:** [#92](https://github.com/luiki-dev/szop/issues/92)
- **Status:** ⬜ Open

### PH-15 Seed catalog, read-only

Roadmap entry: [PH-15](roadmap.md#ph-15-seed-catalog-read-only).\
Also: [OP-010](#op-010), [OP-019](#op-019).

#### OP-052

**Test the data the demo never has.** Every environment starts empty, so a migration that breaks on existing rows is never run against any. **The first phase whose migration changes an existing table** adds a test that migrates to the previous version, inserts fixture data, then applies the new migration; the first data phase has nothing to migrate from. **The first data phase**, where the seed data is written, tests that it satisfies [LIM-1](requirements/functional-requirements.md#lim-1)'s quotas, the depth limit and uniqueness, and reports how much of the 300-category quota it uses.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-15:** the seed data tests
  - the first phase whose migration changes an existing table (probably PH-17): the migration test with fixture data
- **Source:** [Audit, C4 and C5](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Issue:** [#93](https://github.com/luiki-dev/szop/issues/93)
- **Status:** ⬜ Open

#### OP-071

**Add the JSON error shape and a not-found handler.** The architecture's error shape (`{ "error": { "code", "message" } }`, [architecture, Errors](architecture/architecture.md#errors)) for validation errors, unknown routes and unexpected errors, with `setErrorHandler` and `setNotFoundHandler`, when the first route that can fail arrives; until then unknown routes return Fastify's default 404 body. Until then, the 403 of the cross-site check and the 415 of the JSON rule use Fastify's shape too ([ADR 0025](decisions/0025-web-security-baseline-details.md)).

- **Source:** [PH-03 spec](superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md#out-of-scope)
- **Issue:** [#94](https://github.com/luiki-dev/szop/issues/94)
- **Status:** ⬜ Open

#### OP-076

**Check in CI that the migrations match the schema.** A step that runs `drizzle-kit generate` (or `check`) and fails if it would write a new migration, so a forgotten `pnpm db:generate` cannot be merged.

- **Source:** [PH-04 spec](superpowers/specs/2026-10-05-PH-04-database-design.md#out-of-scope)
- **Issue:** [#95](https://github.com/luiki-dev/szop/issues/95)
- **Status:** ⬜ Open

#### OP-079

**Serialize the API's responses through the shared schemas.** The health route sends its body as written; the first route that needs response serialization (Fastify's schema compiler with `fastify-type-provider-zod`, or an explicit parse) validates the response against the `packages/shared` schema, so the contract is enforced in the API, not only checked by a test.

- **Source:** [PH-05 spec](superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md#out-of-scope)
- **Issue:** [#96](https://github.com/luiki-dev/szop/issues/96)
- **Status:** ⬜ Open

### PH-16 Guest workspace and lists

Roadmap entry: [PH-16](roadmap.md#ph-16-guest-workspace-and-lists).

#### OP-038

**Decide how a guest's workspace moves into an account ([ACC-2](requirements/functional-requirements.md#acc-2), [ACC-4](requirements/functional-requirements.md#acc-4))**, starting with a short spike on Better Auth's anonymous plugin before the brainstorm of PH-16, the phase that first creates anonymous users ([ADR 0014](decisions/0014-roadmap.md), decision 10). By default the plugin links inside the sign-in or sign-up request and then deletes the anonymous user, and with it the guest workspace, before the app can ask [ACC-4](requirements/functional-requirements.md#acc-4)'s question. The spike checks `onLinkAccount`, `disableDeleteAnonymousUser`, and how linking behaves with `requireEmailVerification`: whether sign-up returns a session, and whether opening the verification link (possibly in another browser) links anything. Options to compare: keep the anonymous user until the choice is made; ask the question before signing in; let the app reassign the workspace in its own sign-up hook, in the browser that registered. The brainstorm also decides, as requirement changes: how long a registered but unverified user's former guest data lives ([ACC-8](requirements/functional-requirements.md#acc-8)'s 7 days against [ACC-7](requirements/functional-requirements.md#acc-7)'s 30), and what an unverified user can do (log in, correct a mistyped email, and whether a stranger's email can be blocked for 7 days). **The phase that first creates anonymous users ([ACC-1](requirements/functional-requirements.md#acc-1))** creates workspaces explicitly, not in a user-creation hook, so a later sign-up does not create a second workspace. Whatever the option, copying the guest's lists and templates into another workspace ([ACC-4](requirements/functional-requirements.md#acc-4)) remaps every reference, such as categories and units, to the target workspace's records; the composite foreign keys of [ADR 0012](decisions/0012-security-baseline.md), decision 6 refuse anything else.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - the spike before PH-16's brainstorm
  - **PH-16:** workspaces created explicitly
  - **PH-18:** the option for registration, and what an unverified user can do
  - **PH-19:** copying into the account's workspace with every reference remapped
- **Source:** [Audit, MAJOR-2](audits/2026-09-29-design-sanity-check.md#major-2-moving-a-guest-into-an-account-doesnt-fit-how-better-auths-anonymous-plugin-links-users); [ADR 0012](decisions/0012-security-baseline.md), decision 6
- **Issue:** [#97](https://github.com/luiki-dev/szop/issues/97)
- **Status:** ⬜ Open

#### OP-039

**Make guest data live as long as [ACC-7](requirements/functional-requirements.md#acc-7) promises.** Better Auth sessions expire after 7 days by default, so a guest returning after 10 days has lost access to a workspace [ACC-7](requirements/functional-requirements.md#acc-7) keeps for 30. **The phase that first creates anonymous sessions ([ACC-1](requirements/functional-requirements.md#acc-1))** sets the session lifetime so it outlives guest retention (for example one sliding lifetime of at least 30 days for all users, as Better Auth's `expiresIn` is global), and decides whether inactivity is measured by the session or by the workspace's `last_active_at`, so the two cannot drift apart. It tests expiry too, for example by moving `expires_at` back in the database, since Better Auth does not read the app's controllable clock. **The phase delivering [ACC-7](requirements/functional-requirements.md#acc-7)** revisits the 3-day tier, which deletes a list built on Monday in one sitting before it is used in the store on Friday: lengthen the window (for example to 7 days) rather than exempt workspaces with items, which a script gets around with one request and which would undo the tier's purpose ([ADR 0003](decisions/0003-abuse-protection.md), decision 4); a change is recorded in an ADR. It also decides what a returning guest sees when their workspace is gone, and how guests learn how long their data lasts ("Register to keep this list"), and whether a guest can delete their own data at once, which a privacy notice would also want (OP-033, m20).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-16:** the session lifetime and its expiry test
  - **PH-31:** the 3-day tier, a returning guest, how guests learn how long their data lasts, and deleting one's own guest data
- **Source:** [Audit, MAJOR-3](audits/2026-09-29-design-sanity-check.md#major-3-guest-data-lifetime-doesnt-match-how-guests-use-a-shopping-list)
- **Issue:** [#98](https://github.com/luiki-dev/szop/issues/98)
- **Status:** ⬜ Open

#### OP-040

**Handle a weak connection in the store, not only a lost one ([NET-1](requirements/functional-requirements.md#net-1)).** **The phase that builds the first change the SPA sends:** sets `networkMode: 'always'` for mutations, since TanStack Query's default `'online'` pauses a mutation started while offline and sends it on reconnect, a queue that [NET-1](requirements/functional-requirements.md#net-1) rules out; puts a timeout on every request (for example `AbortSignal.timeout`), because a weak signal still counts as online and a request can hang for minutes; shows a visible "not saved" state; and refetches after a failed change, not only rolls it back, since a lost response rolls back a change the server has applied. Checking and unchecking send an explicit value (`checked: true`) rather than a toggle. **The first data phase**, together with the ID type (OP-041), decides on IDs generated by the browser (for example UUIDv7), so a repeated create returns the existing row instead of a duplicate and optimistic adds need no temporary ID; a create whose ID exists in another workspace answers as if nothing were there (OP-034). **The phase delivering [NET-1](requirements/functional-requirements.md#net-1)** adds an E2E journey with the network cut or slowed; journeys follow use cases ([ADR 0007](decisions/0007-testing-strategy.md), decision 4), and [NET-1](requirements/functional-requirements.md#net-1) has none. **Settled by the roadmap:** "offline check-off" stays a future extension ([ADR 0014](decisions/0014-roadmap.md), decision 13).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-16:** the first change the SPA sends, and IDs generated by the browser
  - **PH-17:** checking and unchecking with an explicit value
  - **PH-22:** the E2E journey with the network cut or slowed
- **Source:** [Audit, MAJOR-6](audits/2026-09-29-design-sanity-check.md#major-6-flaky-connectivity-in-the-store-is-underspecified-and-a-library-default-contradicts-the-decision)
- **Issue:** [#99](https://github.com/luiki-dev/szop/issues/99)
- **Status:** ⬜ Open

#### OP-041

**Settle the data-model rules that shape the schema**, and record them in `architecture.md`, "Data model highlights". The directions below are where the brainstorms start, not decisions. **The first data phase**, as conventions every later migration follows: the ID type (with OP-040); `created_at` as `timestamptz` on every table ([ACC-7](requirements/functional-requirements.md#acc-7) and [ACC-8](requirements/functional-requirements.md#acc-8) depend on creation times); how uniqueness constraints are named and chosen; how money and quantity are stored and calculated, so client and server totals agree (for example quantity as an integer in thousandths next to money in minor units, each line total rounded once and totals summed from rounded lines, all in `packages/shared`; or a decimal library on both sides, since Drizzle returns `numeric` as a string); and one way to compare text: displayed order always from one shared function (for example `Intl.Collator('pl')`), so the database's collation matters only for search and uniqueness, and Unicode NFC plus case folding for "same name" checks ([ITM-4](requirements/functional-requirements.md#itm-4)); and whether quantities and prices accept a decimal comma ("0,5") as well as a point (m20). **The phases building each area:** a server-assigned `position` on list and template items, following the order of a batch request, since rows inserted in one transaction share `now()` and "order added" ([ORD-5](requirements/functional-requirements.md#ord-5)) becomes random, and manual reordering needs it anyway; category moves ([CAT-1](requirements/functional-requirements.md#cat-1)) that refuse a move under a descendant and keep parent depth plus subtree height within 5 ([LIM-1](requirements/functional-requirements.md#lim-1)), with the workspace's tree locked during a move so two concurrent moves cannot form a cycle, and moves included in the fast-check property tests; units ([UNT-1](requirements/functional-requirements.md#unt-1)): items copy the unit's label, a product's default unit is cleared when the unit is deleted; currency ([ACC-5](requirements/functional-requirements.md#acc-5)): only currencies with 2 decimal places, a change converts no amounts, and a default for guests; matching categories by name ([ACC-4](requirements/functional-requirements.md#acc-4), [SHR-5](requirements/functional-requirements.md#shr-5)) by full path, falling back to the leaf name only when it is unique; [CAT-3](requirements/functional-requirements.md#cat-3)'s "uncategorize" covering `template_items` too.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-16:** the conventions (ID type, `created_at`, uniqueness constraints, comparing text)
  - **PH-17:** `position`, how money and quantity are stored and calculated, the decimal comma
  - **PH-19:** matching categories by full path for [ACC-4](requirements/functional-requirements.md#acc-4)
  - **PH-21:** a default currency for guests
  - **PH-23:** "same name" checks for [ITM-4](requirements/functional-requirements.md#itm-4)
  - **PH-26:** units
  - **PH-27:** category moves
  - **PH-28:** [CAT-3](requirements/functional-requirements.md#cat-3)'s "uncategorize" for `template_items`
  - **PH-30:** the currency setting
  - **PH-32:** matching categories for [SHR-5](requirements/functional-requirements.md#shr-5)
- **Source:** [Audit, MAJOR-7](audits/2026-09-29-design-sanity-check.md#major-7-domain-rules-and-the-data-model-leave-decisions-open-that-shape-the-schema)
- **Issue:** [#100](https://github.com/luiki-dev/szop/issues/100)
- **Status:** ⬜ Open

#### OP-048

**Make a guest's first change survive the switch from seed data to a workspace ([ACC-1](requirements/functional-requirements.md#acc-1)).** Before the first change, the frontend holds the in-memory seed data's IDs; copying the seed into the new workspace gives new IDs, so the first change itself (for example adding the seed product "Milk" with its seed category) and any cached reference can hit 404. The phase delivering [ACC-1](requirements/functional-requirements.md#acc-1) compares: copies keep the seed IDs, which works if IDs need only be unique within a workspace (for example composite keys `(workspace_id, id)`, see OP-034 and OP-041); or the server maps seed IDs in that first request. Afterwards the frontend refetches everything. Only one anonymous session is created at a time, across tabs too (for example with the Web Locks API, `navigator.locks`), since two tabs changing something at once would otherwise each create one and orphan a workspace.

- **Source:** [Audit, m18](audits/2026-09-29-design-sanity-check.md#requirements-and-architecture)
- **Issue:** [#101](https://github.com/luiki-dev/szop/issues/101)
- **Status:** ⬜ Open

#### OP-054

**Build the access layer and the workspace keys.** **The first data phase:** `ownWorkspace` and `requireListAccess` (owner role only), repositories that require `workspaceId`, `workspace_id` with `UNIQUE (workspace_id, id)` on every workspace-owned table and composite foreign keys for every reference, the two-workspace test helper with "a reference into another workspace returns 404", and the schema test over PostgreSQL's catalog. Every later phase follows the same pattern for its tables and reference fields.

- **Source:** [ADR 0012](decisions/0012-security-baseline.md), decisions 3–6
- **Issue:** [#102](https://github.com/luiki-dev/szop/issues/102)
- **Status:** ⬜ Open

### PH-17 List items

Roadmap entry: [PH-17](roadmap.md#ph-17-list-items).\
Also: [OP-040](#op-040), [OP-041](#op-041), [OP-052](#op-052).

#### OP-051

**Decide whether mis-taps can be undone.** "Remove item" and "Uncheck all" are easy to trigger by accident on a phone in a store. The phases delivering them consider an undo message: with IDs generated by the browser (OP-040), undoing a removal re-creates the item with the same ID, with no soft-delete column; undoing "Uncheck all" re-checks the items the client knows were checked. A confirmation dialog is the cheaper alternative for "Uncheck all" alone.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-17:** removing an item
  - **PH-21:** "Uncheck all"
- **Source:** [Audit, C3](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Issue:** [#103](https://github.com/luiki-dev/szop/issues/103)
- **Status:** ⬜ Open

#### OP-080

**Add `@testing-library/user-event`** with the first component test that clicks or types ([ADR 0007](decisions/0007-testing-strategy.md), decision 10 names it with `jest-dom`; nothing in PH-05 interacts).

- **Source:** [PH-05 spec](superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md#out-of-scope)
- **Issue:** [#104](https://github.com/luiki-dev/szop/issues/104)
- **Status:** ⬜ Open

#### OP-081

**Pick a drawer component that works under the CSP** for the haul's drawer ([visual-design.md](architecture/visual-design.md#the-list-and-the-haul)). shadcn/ui's Drawer is built on vaul; check whether vaul injects `<style>` elements, which the CSP forbids ([visual-design.md](architecture/visual-design.md#under-the-content-security-policy)). If it does, shape Base UI's Dialog as a bottom sheet, with dragging added on top. Either way the drawer is a modal dialog: focus moves in and is trapped, Esc and the dimmed list close it, and dragging is never the only way to open or close it.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), decisions 4 and 5; [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md#out-of-scope)
- **Issue:** [#105](https://github.com/luiki-dev/szop/issues/105)
- **Status:** ⬜ Open

#### OP-082

**Decide how "checked" is stored.** The haul orders items by when they were checked, so list items need a `checked_at` timestamp. Either it is the only field (`checked_at IS NOT NULL` means checked), or a `checked` flag stays next to it. One field cannot disagree with itself; a flag keeps the API's `{ "checked": true }` shape and simple queries. "Put all back" ([LST-5](requirements/functional-requirements.md#lst-5)) and duplicating a list must clear it either way.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), consequences; [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md#architecture-changes)
- **Issue:** [#106](https://github.com/luiki-dev/szop/issues/106)
- **Status:** ⬜ Open

#### OP-083

**Consider splitting PH-17.** The haul makes PH-17 bigger: besides adding, editing, checking and sorting items, it builds the haul, its chips, putting items back, the drawer (a new component, [OP-081](#op-081)) and the progress by item count. Its brainstorm checks the plan against the size rule of [ADR 0014](decisions/0014-roadmap.md), decision 6, and splits the drawer into a phase of its own if it is too big.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), consequences
- **Issue:** [#107](https://github.com/luiki-dev/szop/issues/107)
- **Status:** ⬜ Open

### PH-18 Registration and login

Roadmap entry: [PH-18](roadmap.md#ph-18-registration-and-login).\
Also: [OP-013](#op-013), [OP-038](#op-038), [OP-044](#op-044), [OP-053](#op-053).

#### OP-028

**Decide how E2E tests read emails**: a file "outbox" or a local mail catcher such as Mailpit. In the phase that delivers [ACC-2](requirements/functional-requirements.md#acc-2).

- **Source:** [ADR 0007](decisions/0007-testing-strategy.md), decision 15
- **Issue:** [#108](https://github.com/luiki-dev/szop/issues/108)
- **Status:** ⬜ Open

#### OP-055

**Apply the session, password and account rules** in the phases delivering [ACC-2](requirements/functional-requirements.md#acc-2), [ACC-3](requirements/functional-requirements.md#acc-3) and [ACC-6](requirements/functional-requirements.md#acc-6): the session cookie's name and `__Host-` prefix (or `__Secure-`, if Better Auth does not allow it), with the cookie cache off; revoking other sessions on a password change or reset; 15 to 128 characters and the Have I Been Pwned plugin, failing open; login, registration, reset and resend that never reveal whether an account exists, and the Better Auth hooks that need; the per-email limits, the limit on requests without a session and the daily email cap; the current password required for deleting an account.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-18:** the session cookie, the password policy, and no enumeration on registration, login and resend; email links built by the app with the token in the query string, not Better Auth's path-token default ([ADR 0025](decisions/0025-web-security-baseline-details.md), decision 6); the SPA removes a used token from the address bar ([ADR 0012](decisions/0012-security-baseline.md), decision 9)
  - **PH-20:** the per-email limits, the limit on requests without a session and the daily email cap
  - **PH-29:** revoking other sessions, and no enumeration on reset; the reset link built the same way
  - **PH-30:** the current password for deleting an account
- **Source:** [ADR 0012](decisions/0012-security-baseline.md), decisions 10–12 and 14; [ADR 0025](decisions/0025-web-security-baseline-details.md), decision 6
- **Issue:** [#109](https://github.com/luiki-dev/szop/issues/109)
- **Status:** ⬜ Open

### PH-19 Guest data on login

Roadmap entry: [PH-19](roadmap.md#ph-19-guest-data-on-login).\
Also: [OP-038](#op-038), [OP-041](#op-041).

### PH-20 Quotas and rate limits

Roadmap entry: [PH-20](roadmap.md#ph-20-quotas-and-rate-limits).\
Also: [OP-053](#op-053), [OP-055](#op-055).

#### OP-046

**Set the E2E server's rate limits explicitly.** About 14 journeys on two viewports, each as a new guest and some registering, all from one IP address, exceed the default 10 guests and 5 registrations per hour. [ADR 0007](decisions/0007-testing-strategy.md), decision 14 makes the limits generous only for the API tests. The phase delivering [LIM-4](requirements/functional-requirements.md#lim-4) gives the E2E server generous limits in its configuration too, and says so in `testing.md`.

- **Source:** [Audit, m14](audits/2026-09-29-design-sanity-check.md#process-and-ci)
- **Issue:** [#110](https://github.com/luiki-dev/szop/issues/110)
- **Status:** ⬜ Open

#### OP-047

**Define bulk actions against quotas, and what an archived list allows.** The phases delivering [ACC-4](requirements/functional-requirements.md#acc-4) (importing guest lists), [ITM-5](requirements/functional-requirements.md#itm-5) (multi-add), [LST-4](requirements/functional-requirements.md#lst-4) (duplicating a list) and [LST-6](requirements/functional-requirements.md#lst-6) or [TPL-3](requirements/functional-requirements.md#tpl-3) (templates) decide whether an action that would cross a quota fails entirely or partly; the suggested direction is all or nothing, in one transaction, with [LIM-3](requirements/functional-requirements.md#lim-3)'s message. The phase delivering [ITM-4](requirements/functional-requirements.md#itm-4) decides what happens when the units differ; suggested: offer to increase the quantity only when the units match or neither item has one. The phase delivering [LST-3](requirements/functional-requirements.md#lst-3) lists what still works on an archived list; suggested: unarchive, delete, duplicate and save as template, which change nothing on the list itself.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-20:** the rule for bulk actions against quotas, applied to the import of [ACC-4](requirements/functional-requirements.md#acc-4)
  - **PH-23:** [ITM-4](requirements/functional-requirements.md#itm-4) with different units
  - **PH-24:** multi-add
  - **PH-25:** duplicating, and what an archived list allows
  - **PH-28:** templates
- **Source:** [Audit, m17](audits/2026-09-29-design-sanity-check.md#requirements-and-architecture)
- **Issue:** [#111](https://github.com/luiki-dev/szop/issues/111)
- **Status:** ⬜ Open

### PH-21 Shop in a store

Roadmap entry: [PH-21](roadmap.md#ph-21-shop-in-a-store).\
Also: [OP-041](#op-041), [OP-051](#op-051).

### PH-22 Offline state

Roadmap entry: [PH-22](roadmap.md#ph-22-offline-state).\
Also: [OP-040](#op-040).

### PH-23 Smart input

Roadmap entry: [PH-23](roadmap.md#ph-23-smart-input).\
Also: [OP-041](#op-041), [OP-047](#op-047).

#### OP-045

**Design live updates ([SYN](requirements/functional-requirements.md#live-updates-syn)) for real connections.** **The [SYN](requirements/functional-requirements.md#live-updates-syn) brainstorm:** re-check access when forwarding events, or close a socket when its user's access to the list is removed or a link is revoked; a ping (for example every 30 seconds) so the load balancer's 60-second idle timeout does not drop quiet sockets; a refetch on reconnect, since mobile browsers drop sockets in the background; not letting the refetch triggered by one's own change overwrite changes still in flight (skip one's own events, or wait until they settle); and how WebSockets are tested, which [ADR 0007](decisions/0007-testing-strategy.md) does not cover. **The phase delivering [ITM-4](requirements/functional-requirements.md#itm-4)**, already in the MVP: "increase quantity" is an atomic update in the database (`SET quantity = quantity + $1`), not read-modify-write, since two tabs or a double tap lose an increase even without live updates.

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-23:** the atomic increase for [ITM-4](requirements/functional-requirements.md#itm-4)
  - **PH-33:** the design of live updates
- **Source:** [Audit, m4](audits/2026-09-29-design-sanity-check.md#security-and-operations)
- **Issue:** [#112](https://github.com/luiki-dev/szop/issues/112)
- **Status:** ⬜ Open

### PH-24 Catalog browser

Roadmap entry: [PH-24](roadmap.md#ph-24-catalog-browser).\
Also: [OP-047](#op-047).

### PH-25 Archive and duplicate

Roadmap entry: [PH-25](roadmap.md#ph-25-archive-and-duplicate).\
Also: [OP-047](#op-047).

### PH-26 Catalog and units

Roadmap entry: [PH-26](roadmap.md#ph-26-catalog-and-units).\
Also: [OP-041](#op-041).

### PH-27 Categories

Roadmap entry: [PH-27](roadmap.md#ph-27-categories).\
Also: [OP-041](#op-041).

### PH-28 Templates

Roadmap entry: [PH-28](roadmap.md#ph-28-templates).\
Also: [OP-041](#op-041), [OP-047](#op-047).

### PH-29 Password reset and change

Roadmap entry: [PH-29](roadmap.md#ph-29-password-reset-and-change).\
Also: [OP-055](#op-055).

### PH-30 Settings and account deletion

Roadmap entry: [PH-30](roadmap.md#ph-30-settings-and-account-deletion).\
Also: [OP-041](#op-041), [OP-055](#op-055).

### PH-31 Automatic cleanup

Roadmap entry: [PH-31](roadmap.md#ph-31-automatic-cleanup).\
Also: [OP-039](#op-039).

## Stage 5: Later

### PH-32 Sharing

Roadmap entry: [PH-32](roadmap.md#ph-32-sharing).\
Also: [OP-041](#op-041).

#### OP-049

**Settle the sharing semantics that shape its tables ([SHR](requirements/functional-requirements.md#sharing-shr)).** The [SHR](requirements/functional-requirements.md#sharing-shr) brainstorm decides first whether access is bound to the link or to the user who redeemed it, which changes the tables, and then: whether regenerating a link ([UC-12](requirements/functional-requirements.md#uc-12-revoke-access)) also removes people who already joined through it; inviting an email that has no account; an accept step for [SHR-1](requirements/functional-requirements.md#shr-1), so nobody can push lists into someone's "Shared with me"; whether a shopper may run "Uncheck all"; what happens to shares when an anonymous owner's workspace expires ([ACC-7](requirements/functional-requirements.md#acc-7)). Directions to start from: redeeming a link counts as a guest's first change and creates the anonymous session, since `architecture.md`'s "a guest opening a share link already has an anonymous user" contradicts lazy creation and is corrected then; and a shopper editing a list they can see gets 403, while 404 stays for lists a user cannot see.

- **Source:** [Audit, m19](audits/2026-09-29-design-sanity-check.md#requirements-and-architecture)
- **Issue:** [#113](https://github.com/luiki-dev/szop/issues/113)
- **Status:** ⬜ Open

### PH-33 Live updates

Roadmap entry: [PH-33](roadmap.md#ph-33-live-updates).\
Also: [OP-045](#op-045).

## Candidates

Optional technical phases on the [roadmap](roadmap.md#candidates), not scheduled. A candidate's entry moves to its phase once the owner decides to do it.

#### OP-029

**Optional phase: load testing** with k6 against the demo environment. The roadmap decides whether to include it.

- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 32
- **Issue:** [#114](https://github.com/luiki-dev/szop/issues/114)
- **Status:** ⬜ Open

#### OP-030

**Optional phase: supply-chain provenance**: signed attestations, a software bill of materials (SBOM) and an OpenSSF Scorecard. The roadmap decides whether to include it.

- **Source:** [ADR 0010](decisions/0010-ci-cd.md), decisions 19 and 24
- **Issue:** [#115](https://github.com/luiki-dev/szop/issues/115)
- **Status:** ⬜ Open

#### OP-033

**Before Szop ever runs always-on**, add what the demo deliberately does without: backups, a CDN with a web application firewall (WAF), alarms and error tracking, SES production access, a storage alarm, a privacy notice, and a lock (for example a PostgreSQL advisory lock) around migrations and scheduled jobs once more than one instance runs (OP-043). Only if an always-on deployment is ever planned. Also a shared store (for example PostgreSQL or Redis) for the rate-limit counters, which live in memory while one instance runs ([ADR 0012](decisions/0012-security-baseline.md), decision 15).

- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 32; [Audit, MAJOR-1](audits/2026-09-29-design-sanity-check.md#major-1-the-docs-describe-two-different-products-a-persistent-public-service-and-a-disposable-demo); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 5; [ADR 0012](decisions/0012-security-baseline.md), decision 15
- **Issue:** [#116](https://github.com/luiki-dev/szop/issues/116)
- **Status:** ⬜ Open

#### OP-060

**Revisit Storybook** once the component set has grown (for example after the first few feature phases) or reviewing components' states in the running app gets tedious. If it comes in, it is a workshop and documentation; its test integration would need Vitest Browser Mode, which [ADR 0007](decisions/0007-testing-strategy.md), decision 9 left out.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decision 20
- **Issue:** [#117](https://github.com/luiki-dev/szop/issues/117)
- **Status:** ⬜ Open

#### OP-063

**Lint the Markdown docs without reformatting them.** Prettier stays out of Markdown because it pads tables ([ADR 0016](decisions/0016-toolchain-details.md), decision 8). A linter such as markdownlint could check headings, lists and links without touching table layout.

- **Source:** [ADR 0016](decisions/0016-toolchain-details.md), decision 8
- **Issue:** [#118](https://github.com/luiki-dev/szop/issues/118)
- **Status:** ⬜ Open

#### OP-064

**Move to TypeScript 7** (the native compiler) once typescript-eslint supports it; until then TypeScript is pinned to 6.0.

- **Source:** [ADR 0016](decisions/0016-toolchain-details.md), decision 4
- **Issue:** [#119](https://github.com/luiki-dev/szop/issues/119)
- **Status:** ⬜ Open

#### OP-077

**Upgrade to Drizzle 1.0** once it is stable: its migrations folder has a new layout, and drizzle-kit drops the deprecated `@esbuild-kit` packages. Those packages pull in an old esbuild (0.18), which `pnpm audit` reports as the GitHub Security Advisory (GHSA) [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (moderate, esbuild 0.24.2 or older): it concerns esbuild's development server, which drizzle-kit never runs, and drizzle-kit is a development dependency, so it is not exploitable here. Dependabot will raise an alert and probably cannot fix it; whether to dismiss the alert or add a `pnpm.overrides` entry is the owner's decision, and the upgrade removes it.

- **Source:** [ADR 0020](decisions/0020-database-details.md), decision 1
- **Issue:** [#120](https://github.com/luiki-dev/szop/issues/120)
- **Status:** ⬜ Open

## Closed

#### OP-001

**Visual design foundation topic**: the overall look, the styling approach, the component library and the design tokens. The last foundation topic. It also records the non-functional requirements Szop has none of yet (m20): which browsers are supported (iPhones run WebKit, while E2E runs Chromium only; supporting Safari would add a WebKit project for the phone viewport, extending [ADR 0007](decisions/0007-testing-strategy.md)), the accessibility target axe checks against, and a performance budget for a phone on a weak signal (compression and cache headers matter without a CDN). The styling approach must work under the Content Security Policy of [ADR 0012](decisions/0012-security-baseline.md), decision 8: no inline scripts and no `<style>` elements, so build-time CSS (CSS modules, Tailwind and the like), not a CSS-in-JS library that injects styles at run time.

- **Source:** [ADR 0004](decisions/0004-implementation-process.md), decisions 2–4; [Audit, m20](audits/2026-09-29-design-sanity-check.md#requirements-and-architecture); [ADR 0012](decisions/0012-security-baseline.md), decision 8
- **Status:** ✅ Closed: settled by [ADR 0013](decisions/0013-visual-design.md); the browsers, accessibility target and performance budget are [NFR-1 to NFR-3](requirements/functional-requirements.md#3-non-functional-requirements). The work it leaves is OP-056 to OP-059 (walking skeleton, CI/CD phase), and OP-060 and OP-061 (unassigned)

#### OP-002

**Write the roadmap**, `docs/roadmap.md`: the phases in order, each with its status, its requirement IDs as links to their headings in the [functional requirements](requirements/functional-requirements.md), and links to its spec and plan once that phase's own brainstorm has written them. A bounded phase has no spec or plan, and nothing about a phase is detailed up front ([ADR 0004](decisions/0004-implementation-process.md), decisions 1 and 8). Then `CLAUDE.md` and the README's documentation list point to it, and this page is regrouped by phase.

- **Source:** [ADR 0004](decisions/0004-implementation-process.md), decision 6 and consequences
- **Status:** ✅ Closed: written as the [roadmap](roadmap.md), with [ADR 0014](decisions/0014-roadmap.md); `CLAUDE.md` and the README point to it, and this page is grouped by its stages and phases

#### OP-003

**Place the owner's manual steps** in the phases that need them: create the AWS account, secure the root user with MFA, set up IAM Identity Center and buy the domain (its name is chosen then); create and install the GitHub App and put it on the `version-tags` ruleset's bypass list ([ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 8), create the `demo` and `release` environments, apply the Actions settings, turn on CodeQL's default setup and update the `main` ruleset; create a throwaway repository for the release-please trial (OP-025). Also: create the `demo-teardown` environment (no reviewer, `main` only), add the owner as required reviewer on `demo`, with "prevent self-review" off ([ADR 0012](decisions/0012-security-baseline.md), decision 16).

- **Source:** [ADR 0008](decisions/0008-hosting.md), decisions 17 and 25, consequences; [ADR 0010](decisions/0010-ci-cd.md), decision 23 and consequences; [ADR 0012](decisions/0012-security-baseline.md), decision 16
- **Status:** ✅ Closed: each phase entry on the [roadmap](roadmap.md) lists the owner's steps it needs ([ADR 0014](decisions/0014-roadmap.md), decision 11): the Actions settings, CodeQL and the `main` ruleset in PH-02; the AWS account, its root user and IAM Identity Center in PH-09; the domain in PH-10; the `demo-teardown` environment in PH-11; the `demo` environment and its reviewer in PH-12; the release-please trial, the GitHub App, its bypass and the `release` environment in PH-13

#### OP-004

**Order the AWS and deploy phases** so that no demo runs without the safety net: `infra/bootstrap` (budget alerts) and `infra/base` (OIDC provider, deploy role) applied first; then a PR merging the nightly `demo-down`, a minimal `infra/demo` and a placeholder `demo-up`; only then the phase with the real `demo-up`, checked from its own branch. Local applies of `infra/demo` only after that PR, destroyed the same day.

- **Source:** [ADR 0008](decisions/0008-hosting.md), decision 26; [ADR 0010](decisions/0010-ci-cd.md), decision 23; [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 2
- **Status:** ✅ Closed: `infra/bootstrap` and the permanent part of `infra/base` are applied in PH-09 and PH-10, the safety net is merged in PH-11, and the real `demo-up` comes with PH-12 ([ADR 0014](decisions/0014-roadmap.md), decision 8)

#### OP-005

**Set up the development environment**: Node pinned in `.nvmrc` and `engines`, pnpm workspaces, strict ESM TypeScript, `compose.yaml`, `.env` and `.env.example`, ESLint and Prettier, husky with lint-staged, VS Code settings, `.gitattributes`, and the tools' entries in `.gitignore` (which already ignores Terraform state and Claude Code's local settings). Write `docs/development/setup.md` and a page per tool in `docs/development/tools/`. Keep pnpm's default of running no dependency install scripts, with the allowlist (`allowBuilds` in pnpm 12, [ADR 0016](decisions/0016-toolchain-details.md), decision 3) as short as possible ([ADR 0012](decisions/0012-security-baseline.md), decision 18).

- **Parts** ([ADR 0014](decisions/0014-roadmap.md)):
  - **PH-01:** everything except `compose.yaml` and the `.env` files ✅ Done ([#11](https://github.com/luiki-dev/szop/pull/11))
  - **PH-03:** `apps/api/.env.example` and the `.env` copy step ✅ Done ([#18](https://github.com/luiki-dev/szop/pull/18))
  - **PH-04:** `compose.yaml` and the database's settings in `.env.example` ✅ Done ([#20](https://github.com/luiki-dev/szop/pull/20))
- **Source:** [ADR 0005](decisions/0005-development-environment.md), decisions 3–15 and consequences; [ADR 0012](decisions/0012-security-baseline.md), decision 18
- **Status:** ✅ Closed: the last part, PH-04's, is done ([ADR 0020](decisions/0020-database-details.md), decisions 8 and 9; [#20](https://github.com/luiki-dev/szop/pull/20))

#### OP-006

**Choose the PostgreSQL major version** for `compose.yaml`, matching the newest one RDS offers, so development and the demo run the same major version. It must be **PostgreSQL 15 or newer**, for `ON DELETE SET NULL (column)` on composite foreign keys ([ADR 0012](decisions/0012-security-baseline.md), decision 6).

- **Source:** [ADR 0005](decisions/0005-development-environment.md), decision 4 and consequences; [ADR 0008](decisions/0008-hosting.md), decision 19; [ADR 0012](decisions/0012-security-baseline.md), decision 6
- **Status:** ✅ Closed: PostgreSQL 18 (18.6), [ADR 0020](decisions/0020-database-details.md), decision 8 ([#20](https://github.com/luiki-dev/szop/pull/20))

#### OP-007

**Decide how the API's production build includes `packages/shared`**, which is consumed from source with no build step of its own.

- **Since PH-05:** `packages/shared` exists and is consumed from source by `apps/web` and, in a test, by `apps/api`; the API's production build still has to include it.
- **Source:** [ADR 0005](decisions/0005-development-environment.md), decision 8
- **Status:** ✅ Closed: [ADR 0023](decisions/0023-production-build-and-serving-details.md), decision 1: nothing is compiled; production runs the source by Node's type stripping, so `packages/shared` reaches production from source too ([#23](https://github.com/luiki-dev/szop/pull/23))

#### OP-008

**Give the README a short "Development" section** pointing to `docs/development/`.

- **Source:** [ADR 0005](decisions/0005-development-environment.md), consequences
- **Status:** ✅ Closed: [ADR 0016](decisions/0016-toolchain-details.md); built in PH-01 ([#11](https://github.com/luiki-dev/szop/pull/11))

#### OP-009

**Add commitlint** with `@commitlint/config-conventional` and husky's `commit-msg` hook. Two changes to the preset, agreed in the triage of m9: `body-max-line-length` and `footer-max-line-length` are turned off for everyone, since Dependabot's commit bodies hold links longer than 100 characters (and so may people's), which would fail every Dependabot PR in CI; and `type-enum` allows only the nine types of [ADR 0009](decisions/0009-git-workflow.md), decision 9, not the preset's `style` and `revert`.

- **Source:** [ADR 0009](decisions/0009-git-workflow.md), decision 16 and consequences; [Audit, m9](audits/2026-09-29-design-sanity-check.md#process-and-ci)
- **Status:** ✅ Closed: [ADR 0016](decisions/0016-toolchain-details.md); built in PH-01 ([#11](https://github.com/luiki-dev/szop/pull/11))

#### OP-011

**Settle how tests are isolated**: the exact `TRUNCATE` mechanism between tests, and the template-database setup per Vitest worker.

- **Source:** [ADR 0007](decisions/0007-testing-strategy.md), decisions 12 and 13
- **Status:** ✅ Closed: [ADR 0020](decisions/0020-database-details.md), decisions 7 and 13 ([#20](https://github.com/luiki-dev/szop/pull/20))

#### OP-022

**Apply and record the GitHub settings**: the required checks (`ci-ok` and the PR title check, with branches up to date), the code scanning rule, SHA pinning, read-only default token permissions and approval for outside contributors' runs. Update `github-settings.md`. The code scanning rule comes last, only after CodeQL has run successfully on `main`, since with an empty bypass list a CodeQL that cannot run would block every merge; and check that the SHA-pinning policy does not block CodeQL's default setup or Dependabot's own workflows (C9).

- **Source:** [ADR 0009](decisions/0009-git-workflow.md), decision 13; [ADR 0010](decisions/0010-ci-cd.md), decisions 8 and 21; [Audit, C9](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Status:** ✅ Closed: applied around the PH-02 PR and read back with `gh api`; recorded in [github-settings.md](development/github-settings.md) and [ADR 0018](decisions/0018-ci-details.md), decision 9 ([#14](https://github.com/luiki-dev/szop/pull/14)). CodeQL ran on `main` under the SHA-pinning policy (audit C9); its Actions language follows after the merge ([OP-067](#op-067))

#### OP-024

**Add the rule that Claude never triggers `demo-up` or `demo-down`** unless the owner asks, to `CLAUDE.md`.

- **Source:** [ADR 0010](decisions/0010-ci-cd.md), consequences
- **Status:** ✅ Closed: added to `CLAUDE.md` in the triage of [m15](decisions/0011-design-sanity-check-follow-ups.md#minor)

#### OP-031

**Split the walking skeleton and the CI/CD work into phases small enough to review**, and map every phase name the ADRs use to a real phase: "the walking skeleton phase" and "the CI/CD phase", and also "the development environment setup phase" and "the setup phase" (ADR 0005) and "the implementation phase" (ADR 0008). A candidate split from the audit, not decided: development environment; CI checks; the skeleton app with E2E tests; AWS bootstrap and base, OIDC, roles and `demo-down`; `demo-up` and the first deploy; releases. It must respect OP-004.

- **Source:** [Audit, MAJOR-13](audits/2026-09-29-design-sanity-check.md#major-13-roadmap-phases-and-the-definition-of-done-are-not-ready-for-the-roadmap-brainstorm); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 3
- **Status:** ✅ Closed: split into PH-01 to PH-13 in three stages, and every phase name of the ADRs mapped to them ([ADR 0014](decisions/0014-roadmap.md), decision 8 and [phase names](decisions/0014-roadmap.md#phase-names-in-earlier-adrs))

#### OP-034

**Every ID in a request is resolved within the workspace** (or, with sharing, the list owner's workspace, resolved as OP-042 decides), not only the record being written: `category_id`, the new parent in a category move, product IDs in a multi-add, the template ID, units, and IDs the browser generates for new rows (OP-040). Decide the rule and how it is backed (for example composite foreign keys on `(workspace_id, id)`) and tested ("a reference into another workspace returns 404").

- **Source:** [Audit, CRITICAL-1](audits/2026-09-29-design-sanity-check.md#critical-1-ids-the-browser-sends-for-related-records-are-not-checked-against-the-workspace); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6
- **Status:** ✅ Closed: every ID resolved within the workspace, backed by composite foreign keys and tested by a two-workspace pattern and a schema test; [ADR 0012](decisions/0012-security-baseline.md), decisions 3, 5 and 6; built in OP-054

#### OP-035

**Client IP and rate limits behind the load balancer**: how many proxy hops are trusted in AWS and locally, Better Auth's IP header set to match, the per-email login limit (not built into Better Auth), limits on password-reset and verification-resend requests, whether requests without a session are limited, and a test with a forged `X-Forwarded-For`.

- **Source:** [Audit, MAJOR-4](audits/2026-09-29-design-sanity-check.md#major-4-the-per-ip-rate-limits-depend-on-a-client-ip-setting-no-document-mentions); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6
- **Status:** ✅ Closed: one trusted proxy hop in AWS, none locally, Better Auth handed the same address, new [LIM-4](requirements/functional-requirements.md#lim-4) rows and a daily email cap; [ADR 0012](decisions/0012-security-baseline.md), decisions 13–15; built in OP-053 and OP-055

#### OP-036

**The web security baseline**: `SameSite` value and cookie prefix, Origin or `Sec-Fetch-Site` checks on every unsafe method (and later the WebSocket), exact `trustedOrigins`; security headers (HSTS, CSP, `frame-ancestors`, `Referrer-Policy`); tokens in URLs kept out of logs and the address bar; revoking other sessions on a password change or reset; re-authentication before deleting an account; account enumeration. Correct the stack overview's `SameSite` sentence. Also the password policy (C7): the minimum length; whether to use Better Auth's breached-password check, which sends a hash prefix to an outside service (Have I Been Pwned); and keeping Better Auth's session cookie cache off, since while it is on a revoked session keeps working until the cache expires.

- **Source:** [Audit, MAJOR-5](audits/2026-09-29-design-sanity-check.md#major-5-the-web-security-baseline-is-not-decided); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6; [Audit, C7](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Status:** ✅ Closed: cookies, CSRF checks, security headers, tokens in URLs, sessions, the password policy and no account enumeration; [ADR 0012](decisions/0012-security-baseline.md), decisions 7–12; built in OP-053 and OP-055

#### OP-037

**Who can use the deploy role**: the OIDC subject `environment:demo` is available to any job on any branch that declares the environment. Decide the protection (a required reviewer on `demo`, a customised subject claim), narrow the plan role's log access, and back the `CLAUDE.md`-only rules with Claude Code `deny` permissions. Correct the wording of ADR 0010, decisions 12 and 16, and of the glossary. Also what code runs next to AWS credentials (C8): for example, jobs with `id-token: write` never run `pnpm install` on the runner (dependencies are installed inside the Docker build, which does not see the runner's credentials), and pnpm's default of running no dependency install scripts outside an allowlist is kept.

- **Source:** [Audit, MAJOR-11](audits/2026-09-29-design-sanity-check.md#major-11-the-demo-environment-is-not-the-security-boundary-adr-0010-says-it-is); [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 6; [Audit, C8](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Status:** ✅ Closed: a required reviewer on `demo`, a `demo-teardown` environment for `main` only, the plan role denied log contents, no installs next to AWS credentials, Claude Code deny rules; [ADR 0012](decisions/0012-security-baseline.md), decisions 16–19; built in OP-019, OP-020 and this ADR's PR

#### OP-042

**Shape access control so sharing only adds roles**, decided together with OP-034. With sharing, lists, their items and the owner's categories are reached through the list owner's workspace, not the session's, so an MVP where every query takes the session's workspace would be rewritten. Directions to start from: `requireListAccess(user, listId, role)` exists from the first list endpoint, with only the owner role in the MVP; services receive the workspace ID they work in from an access layer (the session's workspace for one's own data, the list owner's for anything reached through a list) instead of reading the session themselves; item routes nest under their list (`/api/lists/:listId/items/:itemId`), with the item looked up within that list, not only by its ID; and editors read the owner's category tree through the list ([SHR-5](requirements/functional-requirements.md#shr-5)), for example `GET /api/lists/:listId/categories` or the tree embedded in the list, since category routes are per workspace. The outcome updates `architecture.md` (Access control) and the stack overview's route examples.

- **Source:** [Audit, MAJOR-8](audits/2026-09-29-design-sanity-check.md#major-8-the-mvps-access-control-shape-will-have-to-be-rewritten-for-sharing)
- **Status:** ✅ Closed: an access layer (`ownWorkspace`, `requireListAccess`) gives services their workspace, and item routes nest under their list; [ADR 0012](decisions/0012-security-baseline.md), decision 4; built in OP-054

#### OP-050

**Start the topic from a threat model**: one short page listing who can do what, and through which path: the owner, Claude Code acting with the owner's credentials, Dependabot, forks, anonymous visitors and a compromised dependency. It would have caught MAJOR-11 and m1 directly, and OP-034 to OP-037 and OP-042 follow from it. If the page stays as a living document, the topic's ADR gives it a row in the document roles ([ADR 0011](decisions/0011-design-sanity-check-follow-ups.md#document-roles)).

- **Source:** [Audit, C1](audits/2026-09-29-design-sanity-check.md#consider-improving)
- **Status:** ✅ Closed: the threat model is a living page, [threat-model.md](architecture/threat-model.md), with a row in the document roles; [ADR 0012](decisions/0012-security-baseline.md), decision 2

#### OP-058

**Serve the SPA's files compressed and cached**, with `@fastify/static` (OP-013): the build writes Brotli and gzip copies of every file and the server sends them with `preCompressed`; fingerprinted assets get `Cache-Control: public, max-age=31536000, immutable`; `index.html`, including the fallback for client-side routes, gets `no-cache`. An API test checks the headers.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decision 5
- **Status:** ✅ Closed: [ADR 0023](decisions/0023-production-build-and-serving-details.md), decisions 3, 5 and 6: an inline Vite plugin writes the copies, `/assets/` is `immutable`, everything else `no-cache`, and the fallback answers page paths with `index.html`; API tests check the headers ([#23](https://github.com/luiki-dev/szop/pull/23))

#### OP-059

**Gate the bundle size in CI**: a check that fails when the JavaScript needed for the first screen exceeds 200 KB compressed ([NFR-3](requirements/functional-requirements.md#nfr-3)). Choose the tool (for example size-limit, or a small script reading Vite's build manifest) and whether it is part of `ci-ok`.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decision 4
- **Status:** ✅ Closed: [ADR 0023](decisions/0023-production-build-and-serving-details.md), decisions 4 and 7: an inline Vite plugin sums the Brotli size of the first screen's chunks and fails the build above 200 KB, run by a `build` job that `ci-ok` needs ([#23](https://github.com/luiki-dev/szop/pull/23))

#### OP-061

**Decide whether Szop becomes an installable app**: a web app manifest, home-screen icons from the raccoon, and possibly a service worker. It belongs with the offline extensions of the [functional requirements](requirements/functional-requirements.md#future-extensions-ideas-not-committed), since a service worker is how offline use would work.

- **Source:** [ADR 0013](decisions/0013-visual-design.md), decision 23
- **Status:** ✅ Closed: an installable app is a feature idea, now listed among the [future extensions](requirements/functional-requirements.md#future-extensions-ideas-not-committed) next to offline use ([ADR 0014](decisions/0014-roadmap.md), decision 13)

#### OP-062

**Bring the Claude Code push hook into the toolchain and CI.** The hook is now `.claude/hooks/guard-git-push.ts`: ESLint lints it, Prettier formats it, `tsc` type-checks it and `pnpm test` runs its tests with Node's test runner.

- **Parts:**
  - **PH-01:** ✅ Done ([#11](https://github.com/luiki-dev/szop/pull/11))
  - **PH-02:** `ci.yml` runs `pnpm test`, so a broken hook fails CI instead of silently letting pushes through ✅ Done ([#14](https://github.com/luiki-dev/szop/pull/14))
  - **PH-03:** move the tests into a Vitest project and drop the `node:test` exception in `eslint.config.js` ✅ Done ([#18](https://github.com/luiki-dev/szop/pull/18))
- **Source:** [ADR 0015](decisions/0015-git-push-guard-hook.md), consequences; [ADR 0016](decisions/0016-toolchain-details.md), decision 6
- **Status:** ✅ Closed: the hook's tests are a Vitest project and the `node:test` exception is gone ([ADR 0019](decisions/0019-api-skeleton-details.md), decision 5; [#18](https://github.com/luiki-dev/szop/pull/18))

#### OP-065

**Set `tsconfigRootDir` in `eslint.config.js`.** When the workspaces add their own `tsconfig.json` files, set `tsconfigRootDir: import.meta.dirname` next to `projectService`, as typescript-eslint's typed-linting guide does. Without it, typescript-estree can fail with "multiple candidate TSConfigRootDirs".

- **Source:** PH-01 final review
- **Status:** ✅ Closed: set in `eslint.config.js` with the first workspace `tsconfig.json` ([#18](https://github.com/luiki-dev/szop/pull/18))

#### OP-073

**Brainstorm the "Ring tail" redesign of the list screen** before the design system is built, then keep, adjust or drop it. An alternative look the owner liked in a design exploration: a fur-gray page (`#CBD0D6`) with white rounded category cards, Gabarito instead of Figtree, the raccoon mark in the header, and a progress bar drawn as a ringed raccoon tail that narrows to its tip and fills one ring per checked item. Checked items leave the list and drop as chips into a dark "haul" tray at the bottom (`#1F2937`), which shows the amount in the basket and holds the add bar; tapping a chip puts the item back. If it is kept, a new ADR supersedes the affected decisions of [ADR 0013](decisions/0013-visual-design.md) (the look, the color tokens, the font) and [visual-design.md](architecture/visual-design.md) changes with it. To settle:

- The haul tray replaces the unchecked/checked split of [ORD-1](requirements/functional-requirements.md#ord-1) and makes the "hide checked items" toggle of [ORD-3](requirements/functional-requirements.md#ord-3) redundant, so the requirements change too.
- The tray shows the basket out of the whole list, not the remaining amount that [ITM-8](requirements/functional-requirements.md#itm-8) asks for.
- How the tray scales to a long list: 40 checked items as chips.
- Dark mode, which was not drawn.

- **Source:** the owner's design exploration of 2026-10-06: [a screenshot of the mockup](ideas/visual-design/ring-tail.png), and the "Ring tail" artboard on [this canvas](https://claude.ai/artifact/Toj7j2GizWnVV7viL6bmc9) (private), next to the two directions not taken, "Store route" and "Yellow sticker"
- **Status:** ✅ Closed: kept and adjusted in [ADR 0022](decisions/0022-ring-tail-redesign.md), designed in the [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md): sage instead of the exploration's green, the add bar above the haul, one row of chips with a drawer, progress inside the haul, the same tray on a desktop, and a darkest-haul dark mode. The work it leaves is OP-081 to OP-083 (PH-17) and OP-056 (PH-14)
