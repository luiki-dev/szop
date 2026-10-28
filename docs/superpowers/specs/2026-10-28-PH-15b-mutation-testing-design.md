# PH-15b Mutation testing: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [StrykerJS and the script](#strykerjs-and-the-script)
  - [What is mutated](#what-is-mutated)
  - [The test database under Stryker](#the-test-database-under-stryker)
  - [The first run and its review](#the-first-run-and-its-review)
  - [Reviewing survivors in later phases](#reviewing-survivors-in-later-phases)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

`pnpm test:mutation` runs StrykerJS on Szop's application logic and shows which changes to the code no test catches, and the survivors of its first run are reviewed and dealt with ([PH-15b](../../roadmap.md#ph-15b-mutation-testing)).

## Decisions

[ADR 0055](../../decisions/0055-mutation-testing-phase-details.md#decisions).

## The design

### StrykerJS and the script

- **Packages:** `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, dev dependencies of the root `package.json`.
- **One configuration at the repository root**, `stryker.config.mjs` _(Claude's call)_. It uses the Vitest runner with the root `vitest.config.ts`, so Stryker runs the same projects as `pnpm test`, and `coverageAnalysis: "perTest"`, so each mutant runs only the tests that reach it.
- **Reporters:** `clear-text` and `progress` in the terminal, `html` into `reports/mutation/` _(Claude's call)_. `reports/` and `.stryker-tmp/` are ignored by git, Prettier and ESLint.
- **No threshold:** no `thresholds.break`, so the run never fails on its score ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 19).
- **`pnpm test:mutation`** runs `stryker run`. Like `pnpm test`, it needs PostgreSQL running (`pnpm db:up`).
- No incremental mode for now _(Claude's call)_: with accepted survivors marked in the code, a full run's report is already short. It is the first answer to a long run (see [Risks](#risks)).

### What is mutated

The `mutate` globs:

- included: `apps/api/src/**/*.ts`, `apps/web/src/**/*.{ts,tsx}`, `packages/shared/src/**/*.ts`;
- excluded: `**/*.test.{ts,tsx}`, `apps/*/src/test/**` (test infrastructure), `**/*.d.ts`, and `apps/web/src/components/ui/**`, the shadcn/ui components, which the shadcn CLI may regenerate and so would lose an opt-out comment _(Claude's call)_.

A file with no logic worth a test starts with an opt-out ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decision 1):

```ts
// Stryker disable all: wiring only; the API tests check the app it builds.
```

Which files opt out is decided during the first run's review, not up front: the builder proposes them, file by file, in the same list as the survivors.

### The test database under Stryker

The API tests create their databases in `apps/api/src/test/global-setup.ts`: a template, then one copy per Vitest worker, named `szop_test_1`, `szop_test_2`, …, dropped with `FORCE` at the start of each run. Stryker runs several test runner processes at once (its `concurrency`), each starting Vitest, so they would drop each other's databases. Each Stryker process must use its own database names. Stryker numbers its processes in the environment variable `STRYKER_MUTATOR_WORKER`; when it is set, the names get it as a prefix or suffix (`szop_test_s2_1`, `szop_test_s2_template`). Under `pnpm test` nothing changes. The exact naming is the builder's.

### The first run and its review

1. Run `pnpm test:mutation` on the whole scope and record the score, the time it took and the counts (killed, survived, no coverage, timeout).
2. List for the owner, grouped by file:
   - the files proposed to opt out, each with its reason;
   - each surviving mutant (and each mutant with no coverage), with Claude's proposal: **kill** (the test to add or tighten), **accept** (an equivalent mutant, with the reason for the comment), or **open point** (when the fix is larger than a small test change).
3. The owner decides each one ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decision 4).
4. The builder applies the decisions: the tests, the `// Stryker disable next-line <Mutator>: <reason>` comments, the opt-outs, the open-point issues.
5. A last run shows no unreviewed survivor. Its score and time go into the PR.

### Reviewing survivors in later phases

The definition of done's item 2 (`Mutants`) changes from "when the phase changes domain rules in `packages/shared`" to **"when the phase adds or changes logic that is mutated"**. Each survivor is then killed by a test or accepted with a reason in the code, never in the PR. The PR states the score and what was done. `testing.md` holds the rules: when to opt a file out, how to accept a survivor (one mutator, one line, a reason), and that a new wiring file starts with its opt-out.

## Acceptance criteria

None: this phase delivers no requirement.

## Tests

- No new tests of the tooling itself. The phase's tests are the test changes the review decides.
- **Verification:** `pnpm test` stays green, and `pnpm test:mutation` completes with PostgreSQL running and writes `reports/mutation/mutation.html`. A run of `pnpm test` while no Stryker run is going still creates `szop_test_1` and so on, unchanged.
- **Checking the database isolation:** a Stryker run with `concurrency` of at least 2 over files covered by the API tests finishes with no test failing because of the database (Stryker stops at the start when a dry run fails).

## Documentation

- `docs/development/tools/stryker.md` (new): what mutation testing is, why StrykerJS, its configuration explained, reading the HTML report.
- `docs/development/testing.md`: the mutation testing layer (no longer "still to come"), running it, and the rules of [Reviewing survivors in later phases](#reviewing-survivors-in-later-phases).
- `docs/development/scripts.md`: `test:mutation`.
- `docs/development/definition-of-done.md`: item 2's new wording.
- `docs/glossary.md`: mutant, mutation score, equivalent mutant, survivor.
- `docs/roadmap.md`: PH-15b's goal and **Delivers** without `mutation.yml` ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md#changes-to-the-roadmap)).
- Notes in the cells of [ADR 0007](../../decisions/0007-testing-strategy.md), decision 19 (✏️ refined) and [ADR 0010](../../decisions/0010-ci-cd.md), decision 5 (🔍 revisited). Both done in the spec's commit.

## Demo check

None: nothing deployed changes.

## Risks

- **Run time.** Mutants in `apps/api` reached by tests against PostgreSQL run those tests. They stay in: they are the only check of logic such as the migration lock and the migration check, and without them its mutants would show as "no coverage", unmeasured _(the owner's choice)_. If a full run takes longer than about 15 minutes, the levers are, in this order: incremental mode (`--incremental`), which reruns only the mutants whose code or tests changed; `--mutate` on the command line for a run over a few files while working on them; and disabling one noisy mutator in a file or on a line. An opt-out comment is only for a file with no logic, never for speed. The builder records a lever turned on in the ADR's "Settled while building".
- **The vitest runner and Vitest projects.** The root config holds five projects, two of them inline (`landing`, `hooks`). If the runner cannot run the root config as `pnpm test` does, the builder stops and reports it before working around it.
- **pnpm and Stryker's sandbox.** Stryker copies the repository into `.stryker-tmp/` and links `node_modules`. pnpm's symlinked workspace packages (`@szop/shared`) must resolve to the sandbox copy, not the original, or mutants in `packages/shared` reached through an app's tests would never be seen as killed by them.

## Out of scope

- `mutation.yml` and any CI run of mutation testing ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decision 2).
- A threshold on the score.
- Mutating the E2E journeys, `apps/landing`, the hooks and `infra/`.

## Left to the builder

- The exact database naming under Stryker.
- Stryker's `concurrency` and timeouts, set only if the defaults misbehave.
- Whether the TypeScript checker plugin (`@stryker-mutator/typescript-checker`) is needed: added only if mutants that do not compile make the report noisy.
