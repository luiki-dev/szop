# PH-15b Mutation testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** `pnpm test:mutation` runs StrykerJS on Szop's application logic, and the survivors of its first run are reviewed with the owner and dealt with.

**Architecture:** One `stryker.config.mjs` at the root runs the Vitest runner on the root `vitest.config.ts`, so Stryker runs the same projects as `pnpm test`. The API's test databases get a per-Stryker-process prefix, so Stryker's parallel processes never drop each other's databases. The first run's survivors go to the owner as a list; their decisions become tests, `// Stryker disable` comments and open-point issues.

**Tech Stack:** StrykerJS (`@stryker-mutator/core`, `@stryker-mutator/vitest-runner`), Vitest 5, PostgreSQL in Docker Compose.

**Spec:** [`docs/superpowers/specs/2026-10-28-PH-15b-mutation-testing-design.md`](../specs/2026-10-28-PH-15b-mutation-testing-design.md)

## Order of work

1. [Task 1: Test database names per Stryker process](#task-1-test-database-names-per-stryker-process)
2. [Task 2: StrykerJS and `pnpm test:mutation`](#task-2-strykerjs-and-pnpm-testmutation)
3. [Task 3: The mutation testing rules in the docs](#task-3-the-mutation-testing-rules-in-the-docs)
4. [Task 4: The first run and its review list](#task-4-the-first-run-and-its-review-list)
5. [Task 5: Applying the owner's decisions](#task-5-applying-the-owners-decisions)

## Global Constraints

- The branch is `test/ph-15b-mutation-testing`. Commits end with `Claude-Session: https://claude.ai/code/session_01MPNqqdSMFi9HXikaWdzAH2` (or the executing session's line).
- No threshold: no `thresholds.break` in the configuration ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 19). No `mutation.yml`, no CI job ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decision 2).
- `mutate` includes `apps/api/src/**/*.ts`, `apps/web/src/**/*.{ts,tsx}`, `packages/shared/src/**/*.ts`; excludes `**/*.test.{ts,tsx}`, `apps/*/src/test/**`, `**/*.d.ts`, `apps/web/src/components/ui/**`.
- A file's opt-out is its first line: `// Stryker disable all: <reason>`. An accepted survivor: `// Stryker disable next-line <Mutator>: <reason>`, one mutator, one line, never `all` ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decisions 1 and 3). An opt-out is for a file with no logic, never for speed.
- Reporters `clear-text`, `progress`, `html` into `reports/mutation/mutation.html`. `reports/` and `.stryker-tmp/` are ignored by git, Prettier and ESLint.
- Under `pnpm test` the database names stay `szop_test_template`, `szop_test_1`, `szop_test_2`, … unchanged.
- Stryker packages are dev dependencies of the root `package.json`, caret ranges; none may need an install script without the owner (`pnpm-workspace.yaml`, `allowBuilds`).
- `pnpm check` passes after every task; `pnpm test:mutation` needs `pnpm db:up`.
- If the Vitest runner cannot run the root config as `pnpm test` does, stop and report it before working around it (spec, [Risks](../specs/2026-10-28-PH-15b-mutation-testing-design.md#risks)).
- A speed lever turned on (incremental mode, a mutator disabled for noise) and a setting changed from the defaults (`concurrency`, timeouts, the TypeScript checker) go into ADR 0055's "Settled while building" in that task's commit.

## Review Focus

1. **`pnpm test` while a Stryker run is going, or after a crashed one.** Expected: it creates and uses `szop_test_1` …, never a Stryker process's databases, and Stryker's databases are never touched by it. Task 1 tests the names with and without `STRYKER_MUTATOR_WORKER`.
2. **`STRYKER_MUTATOR_WORKER` holding something other than digits.** The name goes into `DROP DATABASE` unquoted. Expected: a thrown error naming the value, no SQL run. Task 1 tests it.
3. **PostgreSQL not running.** Expected: Stryker stops at its dry run with global-setup's "Cannot reach PostgreSQL … `docker compose up -d`" message, not a hang or a report full of survivors. Task 2 checks it.
4. **A sandbox left behind** (`.stryker-tmp/` after an interrupted run). Expected: `pnpm check` (lint, format, typecheck, tests) passes and ignores it. Task 2 checks it with `--cleanTempDir false`.
5. **A mutant in `packages/shared` covered only by an app's tests** (`apiErrorSchema` is tested only in `apps/api`). Expected: killed, not "no coverage" or survived, which proves `@szop/shared` resolves to the sandbox copy. Task 2 checks it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/test/database.ts` | `testDatabaseName`, used by `useTestDatabase` |
| `apps/api/src/test/global-setup.ts` | The template and copies named through `testDatabaseName` |
| `apps/api/src/test/database.test.ts` | The naming tests |
| `stryker.config.mjs` (new) | Stryker's configuration |
| `package.json`, `pnpm-lock.yaml` | The Stryker packages, `test:mutation` |
| `.gitignore`, `.prettierignore`, `eslint.config.js` | `reports/`, `.stryker-tmp/` |
| `docs/development/tools/stryker.md` (new), `scripts.md`, `testing.md`, `definition-of-done.md`, `glossary.md` | The docs the spec lists ([Documentation](../specs/2026-10-28-PH-15b-mutation-testing-design.md#documentation)) |
| Source files under `apps/*/src`, `packages/shared/src` and their tests | Opt-outs, accepted survivors and the tests the review decides (Task 5) |

---

### Task 1: Test database names per Stryker process

**Files:**
- Modify: `apps/api/src/test/database.ts`, `apps/api/src/test/global-setup.ts`
- Test: `apps/api/src/test/database.test.ts`

**Interfaces:**
- Produces: `testDatabaseName(suffix: string): string` exported from `apps/api/src/test/database.ts`. `suffix` is a worker number (`"1"`) or `"template"`. Without `STRYKER_MUTATOR_WORKER`: `szop_test_<suffix>`. With it set to `2`: `szop_test_s2_<suffix>`. It reads `process.env` on each call.

- [x] **Step 1: Write the failing tests** in `database.test.ts`, a `describe("testDatabaseName")` using `vi.stubEnv` and `vi.unstubAllEnvs` in `afterEach`:

```ts
it("keeps the plain names outside Stryker", () => {
  vi.stubEnv("STRYKER_MUTATOR_WORKER", undefined);
  expect(testDatabaseName("1")).toBe("szop_test_1");
  expect(testDatabaseName("template")).toBe("szop_test_template");
});

it("prefixes the names with Stryker's process number", () => {
  vi.stubEnv("STRYKER_MUTATOR_WORKER", "2");
  expect(testDatabaseName("1")).toBe("szop_test_s2_1");
  expect(testDatabaseName("template")).toBe("szop_test_s2_template");
});

it("refuses a process number that is not digits", () => {
  vi.stubEnv("STRYKER_MUTATOR_WORKER", "1; DROP DATABASE szop");
  expect(() => testDatabaseName("1")).toThrow(/STRYKER_MUTATOR_WORKER/);
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm db:up && pnpm test --project api apps/api/src/test/database.test.ts`
Expected: FAIL, `testDatabaseName` is not exported.

- [x] **Step 3: Implement `testDatabaseName` in `database.ts`** and use it in `useTestDatabase` (`testDatabaseName(worker)`) and in `global-setup.ts` for `template` and the copies. Check the value with `/^\d+$/`; the comment in global-setup ("never input, so they are safe") gets a word that the process number is checked.

- [x] **Step 4: Run the tests and the whole suite**

Run: `pnpm test`
Expected: PASS. Then `docker compose exec postgres psql -U szop -d postgres -Atc "SELECT datname FROM pg_database WHERE datname LIKE 'szop_test%' ORDER BY 1"` lists `szop_test_1` … and `szop_test_template` only.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/test/ docs/superpowers/plans/2026-10-28-PH-15b-mutation-testing.md
git commit -m "test(api): name the test databases per Stryker process"
```

---

### Task 2: StrykerJS and `pnpm test:mutation`

**Files:**
- Create: `stryker.config.mjs`, `docs/development/tools/stryker.md`
- Modify: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `.prettierignore`, `eslint.config.js`, `docs/development/scripts.md`

**Interfaces:**
- Consumes: Task 1's naming (no code call; Stryker sets `STRYKER_MUTATOR_WORKER`).
- Produces: `pnpm test:mutation` (= `stryker run`), accepting Stryker's flags (`--mutate`, `--concurrency`, `--incremental`); the report at `reports/mutation/mutation.html`.

- [x] **Step 1: Add the packages and the script**

Run: `pnpm add -D -w @stryker-mutator/core @stryker-mutator/vitest-runner`, then add `"test:mutation": "stryker run"` after `test:coverage`. Expected: pnpm asks to approve no build script; if it does, stop and ask the owner.

- [x] **Step 2: Write `stryker.config.mjs`**

The settings are the spec's; the comments say why, in the style of `vitest.config.ts`:

```js
// @ts-check
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  coverageAnalysis: "perTest",
  mutate: [
    "apps/api/src/**/*.ts",
    "apps/web/src/**/*.{ts,tsx}",
    "packages/shared/src/**/*.ts",
    "!**/*.test.{ts,tsx}",
    "!apps/*/src/test/**",
    "!**/*.d.ts",
    "!apps/web/src/components/ui/**",
  ],
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
};
```

- [x] **Step 3: Ignore `reports/` and `.stryker-tmp/`** in `.gitignore`, `.prettierignore` and `globalIgnores` in `eslint.config.js`, each with a one-line comment like its neighbours ("Generated by pnpm test:mutation."). If the root `tsconfig.json` would include `.stryker-tmp/`, exclude it there too.

- [x] **Step 4: Check the database isolation and the sandbox resolution**

Run: `pnpm test:mutation --mutate apps/api/src/db/migration-lock.ts,packages/shared/src/api-error.ts --concurrency 2`
Expected: the dry run passes, no test fails because of the database, `reports/mutation/mutation.html` exists, and the mutants in `api-error.ts` show as killed (by `apps/api` tests), not "no coverage". If the runner cannot run the root config, stop and report (Global Constraints).

- [x] **Step 5: Check the failure modes**

- `pnpm db:down && pnpm test:mutation --mutate packages/shared/src/names.ts`. Expected: Stryker stops at the dry run with "Cannot reach PostgreSQL". Then `pnpm db:up`.
- `pnpm test:mutation --mutate packages/shared/src/names.ts --cleanTempDir false && pnpm check`. Expected: PASS with `.stryker-tmp/` present. Then `rm -rf .stryker-tmp`.
- `pnpm test` afterwards still creates `szop_test_1` … (Task 1, Step 4's query).

- [x] **Step 6: Write the docs**

- `docs/development/tools/stryker.md`: the shape of `fast-check.md` (what it is, why Szop uses it, the configuration line by line, everyday use, reading the HTML report, official documentation); what mutation testing is, the runner and `perTest`, the test databases under Stryker, the levers for a long run (spec, [Risks](../specs/2026-10-28-PH-15b-mutation-testing-design.md#risks)).
- `docs/development/scripts.md`, [Tests](../../development/scripts.md#tests): `test:mutation`, that it needs `pnpm db:up`, that no CI job or hook runs it.

- [x] **Step 7: Commit**

```bash
git add stryker.config.mjs package.json pnpm-lock.yaml .gitignore .prettierignore eslint.config.js docs/ 
git commit -m "test: add StrykerJS and pnpm test:mutation"
```

---

### Task 3: The mutation testing rules in the docs

**Files:**
- Modify: `docs/development/testing.md`, `docs/development/definition-of-done.md`, `docs/glossary.md`

**Interfaces:**
- Consumes: Task 2's script and report path.
- Produces: the rules Task 5 applies.

- [x] **Step 1: `testing.md`**: drop "Layer still to come" (line 44) and the intro's "grows as the layers arrive" (line 5); add mutation testing to [The layers today](../../development/testing.md#the-layers-today), running it to [Running the tests](../../development/testing.md#running-the-tests), and a `## Mutation testing` section with the rules of the spec's [Reviewing survivors in later phases](../specs/2026-10-28-PH-15b-mutation-testing-design.md#reviewing-survivors-in-later-phases): when a file opts out (no logic a test should check: wiring, configuration, plain rendering), how a survivor is accepted (one mutator, one line, a reason, never `all`), that a new wiring file starts with its opt-out, and that each survivor is killed or accepted in the code, never in the PR. Link [ADR 0055](../../decisions/0055-mutation-testing-phase-details.md). Update `## Contents`.

- [x] **Step 2: `definition-of-done.md`, item 2**: "When the phase changes domain rules in `packages/shared`" → "When the phase adds or changes logic that is mutated"; "accepted with a reason in the PR" → "accepted with a reason in the code (`// Stryker disable next-line <Mutator>: <reason>`); the PR states the score and what was done"; the source column gets `ADR 0055, decision 3`. The PR template's `Mutants` box stays as is.

- [x] **Step 3: `glossary.md`**: mutant, mutation score, equivalent mutant, survivor, in its order and format.

- [x] **Step 4: Check the links**

Run: `pnpm check` (Markdown is not formatted; read the changed anchors by hand: every link resolves to a heading).
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs: add the mutation testing rules"
```

---

### Task 4: The first run and its review list

**Files:** none changed, unless a lever is turned on (then `stryker.config.mjs` and ADR 0055's "Settled while building").

- [ ] **Step 1: Run the whole scope**

Run: `pnpm db:up && time pnpm test:mutation`
Expected: completes. Record the score, the time and the counts (killed, survived, no coverage, timeout). If it takes longer than about 15 minutes, apply the levers in the spec's order ([Risks](../specs/2026-10-28-PH-15b-mutation-testing-design.md#risks)) and record the one turned on.

- [ ] **Step 2: Write the review list** to the owner, in chat, grouped by file:
  - the files proposed to opt out, each with the reason for its comment;
  - each survivor and each "no coverage" mutant: line, mutator, the change, and the proposal: **kill** (the test to add or tighten, named), **accept** (why it is equivalent, the comment's reason) or **open point** (why the fix is larger than a small test change).

- [ ] **Step 3: Stop.** The owner decides each item ([ADR 0055](../../decisions/0055-mutation-testing-phase-details.md), decision 4). Keep the list and the decisions in the conversation for Task 5. If a lever was turned on, commit it:

```bash
git add stryker.config.mjs docs/decisions/0055-mutation-testing-phase-details.md docs/superpowers/plans/2026-10-28-PH-15b-mutation-testing.md
git commit -m "test: <the lever> for the mutation run"
```

Otherwise the step boxes are ticked in Task 5's first commit.

---

### Task 5: Applying the owner's decisions

**Files:**
- Modify: the source files and tests the decisions name.

**Interfaces:**
- Consumes: Task 4's list with the owner's decisions; Task 3's rules.

- [ ] **Step 1: Kill.** For each "kill": write or tighten the named test, run `pnpm test:mutation --mutate <file>` and see the mutant killed. A test for an acceptance criterion keeps its ID prefix.

- [ ] **Step 2: Accept and opt out.** Add each `// Stryker disable next-line <Mutator>: <reason>` above its line and each `// Stryker disable all: <reason>` as its file's first line, with the reasons the owner approved.

- [ ] **Step 3: Open points.** For each "open point": a new `open-point` issue with the next free `OP-` ID ([how to find it](../../development/project-tracking.md#checking-with-gh)), a sub-issue of the phase that will settle it (none for a candidate), with the file, line and mutant in its body.

- [ ] **Step 4: The last run**

Run: `time pnpm test:mutation`
Expected: no survivor or "no coverage" mutant without a decision (a survivor recorded as an open point is still listed; check each against the issues). Record the score and the time for the PR description.

- [ ] **Step 5: Run the checks**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**, one commit per group if they are large (tests by package, then the comments):

```bash
git add apps/ packages/ docs/superpowers/plans/2026-10-28-PH-15b-mutation-testing.md
git commit -m "test: deal with the first mutation run's survivors"
```
