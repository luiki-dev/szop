# StrykerJS

StrykerJS is a **mutation testing** tool. It changes the application's code in small ways, one change at a time, and runs the tests after each change. A change is a **mutant**: `a < b` becomes `a <= b`, `+` becomes `-`, a condition becomes `true`, a string becomes empty. If a test fails, the mutant is **killed**: the tests noticed. If every test still passes, the mutant **survived**: the tests do not check that behavior. The **mutation score** is the share of mutants killed. Coverage tells which lines the tests run; the mutation score tells whether they check what those lines do.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [The configuration](#the-configuration)
- [The test databases](#the-test-databases)
- [Everyday use](#everyday-use)
- [Reading the report](#reading-the-report)
- [A long run](#a-long-run)
- [Official documentation](#official-documentation)

## Why Szop uses it

[ADR 0007](../../decisions/0007-testing-strategy.md), decision 19, chose it to judge whether the tests check anything, the tests Claude writes above all. The score is measured, never gated. [ADR 0055](../../decisions/0055-mutation-testing-phase-details.md) settles what is mutated, that it runs only locally, and how a survivor is dealt with. The rules for survivors are in [the testing guide](../testing.md#mutation-testing).

## The configuration

`stryker.config.mjs` at the root:

- **`testRunner: "vitest"` and `vitest.configFile`:** Stryker runs the Vitest runner on the root `vitest.config.ts`, so it runs the same projects as `pnpm test`.
- **`plugins`:** names the runner by its resolved path. pnpm does not put the runner where Stryker looks for plugins by default, and without the line Stryker stops with "Cannot find TestRunner plugin".
- **`coverageAnalysis: "perTest"`:** Stryker first runs the suite once to learn which tests reach which mutant, then runs for each mutant only those tests. A mutant no test reaches is reported as "no coverage" without running anything.
- **`mutate`:** the application sources of `apps/api`, `apps/web` and `packages/shared`, minus the tests, `apps/*/src/test/`, declaration files and the shadcn/ui components.
- **`reporters`:** `clear-text` (the table in the terminal), `progress`, and `html` into `reports/mutation/mutation.html`.
- **No threshold:** there is no `thresholds.break`, so a low score never fails the run.

Stryker copies the repository into `.stryker-tmp/` (the **sandbox**) and mutates the copies, so the working tree is never touched. `@szop/shared` is aliased to its source in the api and web Vitest configs: pnpm's link would otherwise lead the tests out of the sandbox, to the original `packages/shared`.

## The test databases

Stryker runs several processes at once, and each runs the API's test setup. `testDatabaseName` in `apps/api/src/test/database.ts` gives each process its own names, `szop_test_s<n>_template` and `szop_test_s<n>_<worker>`, from the `STRYKER_MUTATOR_WORKER` variable Stryker sets, so no process drops another's databases. Under `pnpm test` the names stay `szop_test_template`, `szop_test_1`, …. Nothing is dropped afterwards; the next run drops what it needs.

## Everyday use

- `pnpm db:up`, then `pnpm test:mutation` for the whole scope.
- `pnpm test:mutation --mutate apps/api/src/db/migration-lock.ts` for one file or a few, comma-separated. Use it while working on a file's tests.
- `--concurrency <n>` sets the number of processes; the default is one less than the CPUs.
- If PostgreSQL is not running, the run stops at its first test run with "Cannot reach PostgreSQL … `docker compose up -d`".
- An interrupted run can leave `.stryker-tmp/`. It is ignored by git, Prettier and ESLint; delete it.

## Reading the report

The terminal table lists each file with its score and the counts: **killed**, **timeout** (the mutant made the code loop; counted as killed), **survived**, **no cov** (no test reaches it) and **errors**. Open `reports/mutation/mutation.html` in a browser: it shows each file's source with every mutant on its line, the change it made, and the tests that ran against it. A survivor is either a missing check (write the test) or an **equivalent mutant**, a change that cannot alter the behavior (accept it with a comment).

## A long run

If a full run grows past about 15 minutes, the levers are, in this order: `--incremental`, which reruns only the mutants whose code or tests changed; `--mutate` for the files being worked on; and disabling one noisy mutator on a line or in a file. A lever turned on goes into ADR 0055's "Settled while building".

## Official documentation

- Introduction: <https://stryker-mutator.io/docs/stryker-js/introduction/>
- Configuration: <https://stryker-mutator.io/docs/stryker-js/configuration/>
- Vitest runner: <https://stryker-mutator.io/docs/stryker-js/vitest-runner/>
- Disabling mutants with comments: <https://stryker-mutator.io/docs/stryker-js/disable-mutants/>
