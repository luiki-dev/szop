# ADR 0055 — Mutation testing phase details

- **Status:** ✅ Accepted
- **Date:** 2026-10-28
- **Refines:** [ADR 0007](0007-testing-strategy.md), decision 19 (what is mutated and where an accepted survivor's reason lives, see decisions 1 and 3)
- **Revisits:** [ADR 0010](0010-ci-cd.md), decision 5 (no `mutation.yml`, see decision 2)

## Context

[PH-15b](../roadmap.md#ph-15b-mutation-testing) brings mutation testing with StrykerJS, which [ADR 0007](0007-testing-strategy.md), decision 19, chose to judge whether tests check anything, tests Claude wrote above all. The score is measured, not gated. The owner wants the result reviewed and the weak tests it reveals improved: good tests are what test-driven development (TDD) relies on. The [spec](../superpowers/specs/2026-10-28-PH-15b-mutation-testing-design.md) holds the design. Decisions 1 to 4 were settled in the brainstorm.

## Changes to the roadmap

PH-15b no longer delivers `mutation.yml` (decision 2): its goal drops "and in a workflow run on demand", and its **Delivers** drops `mutation.yml`. The PH-15b part of [OP-019](https://github.com/luiki-dev/szop/issues/77) is dropped, which closes that open point.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|---|---|---|
| 1 | What is mutated | `packages/shared` only, as ADR 0007, decision 19, put it; a list of files in Stryker's configuration; a naming convention for logic files that a glob picks up. | **Every application source file under `apps/api/src`, `apps/web/src` and `packages/shared/src` is mutated by default, except the tests, the test infrastructure and the vendored shadcn/ui components. A file that holds no logic a test should check (wiring, configuration, plain rendering) opts out with a `// Stryker disable all` comment at its top, giving the reason** _(the owner's choice, on Claude's recommendation)_. The criterion is pure logic wherever it lives: `packages/shared` is not the only place, the catalog search in `apps/web` and the URL redaction in `apps/api` are logic too. A list in the configuration would age, and a logic file nobody added would silently go unmeasured. A naming convention would bend the code's structure to the tool. With an opt-out, the choice is made in the file, when it is written, and forgetting it adds visible noise to the report instead of hiding logic. The E2E journeys, `apps/landing`, the Claude Code hooks and `infra/` are out _(Claude's call)_: they are not application code, and E2E tests would need a build per mutant. |
| 2 | Where mutation testing runs | `mutation.yml`, run on demand, as ADR 0010, decision 5, planned. | **Only locally, with `pnpm test:mutation`; there is no `mutation.yml`** _(the owner's choice, on Claude's recommendation)_. The owner could name no situation in which they would start a workflow instead of running the script. The review at the end of a phase runs locally, a cloud session has Docker and PostgreSQL too, and a workflow would still need its documentation, permissions and Dependabot updates. If runs grow long enough to be a nuisance, a workflow can come back as a candidate. |
| 3 | Where an accepted survivor's reason lives | In the PR description, as the definition of done said. | **In the code, as a comment above the line: `// Stryker disable next-line <Mutator>: <reason>`, one mutator on one line, never `all`** _(the owner's choice, on Claude's recommendation)_. A reason in the PR is lost to the next run, which shows the same survivor again, so every phase would review it anew. In the code, the next report shows only new survivors, and the reason stays next to the code and goes with it. Naming one mutator keeps a stale comment from hiding a new, real survivor on the same line. |
| 4 | What happens to the survivors of the first run | Fixing them all here; recording them all as open points. | **Each survivor is killed by a better test, accepted with a reason in the code (decision 3), or, when the fix is larger, recorded as an open point; small fixes are done in this phase** _(the owner's choice)_. The phase is small, so most fixes are expected to fit. |
