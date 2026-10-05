# PH-03 API skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `apps/api`, a Fastify API assembled by `buildApp(deps)`, configured from required environment variables and logging every request, that `pnpm dev` starts and whose `GET /api/health` answers; bring in Vitest with the first API test, and coverage in CI's job summary.

**Architecture:** `server.ts` is the only file reading `process.env`: it validates it with `loadConfig` (a Zod schema), calls `buildApp({ config })`, listens, and closes gracefully on SIGINT or SIGTERM. `buildApp` creates Fastify with pino's logger and registers each feature's routes as a plugin under `/api`, passing dependencies as plugin options. Vitest runs one project per package plus one for the push hook, from a root config.

**Tech Stack:** Node 24.21, pnpm 12.8.1, TypeScript 6.0; Fastify 5.12.5, Zod 4.6.5; tsx 4.23.15, pino-pretty 13.1.3; Vitest 5.0.3 with `@vitest/coverage-v8` 5.0.3; GitHub Actions (jq on the runner).

**Spec:** `docs/superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Findings since the spec](#findings-since-the-spec)
- [Scratch tools](#scratch-tools)
- [Tool page template](#tool-page-template)
- [Task 1: The api workspace and Vitest](#task-1-the-api-workspace-and-vitest)
- [Task 2: Coverage, locally and in CI](#task-2-coverage-locally-and-in-ci)
- [Task 3: Configuration](#task-3-configuration)
- [Task 4: buildApp and the health route](#task-4-buildapp-and-the-health-route)
- [Task 5: Running the API](#task-5-running-the-api)
- [Task 6: Testing guide, tool pages and setup](#task-6-testing-guide-tool-pages-and-setup)
- [Task 7: ADR 0019, living docs and registers](#task-7-adr-0019-living-docs-and-registers)
- [After tasks 1–7: open the PR](#after-tasks-17-open-the-pr)

## Global Constraints

- Branch `feat/api-skeleton`, already created and pushed, holding the spec commits; never commit to `main`; no worktree (`CLAUDE.md`, git workflow).
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **Versions, exactly these** (what pnpm resolved in the prototype; see [Findings](#findings-since-the-spec) for pino-pretty): `fastify ^5.12.5`, `zod ^4.6.5` (dependencies of `@szop/api`); `tsx ^4.23.15`, `pino-pretty ^13.1.3`, `@types/node ^24.19.0` (devDependencies of `@szop/api`); `vitest ^5.0.3`, `@vitest/coverage-v8 ^5.0.3` (root devDependencies). Add packages with `pnpm add`, so the lockfile follows.
- **No defaults in the configuration:** every variable is required (spec, decision 2). The error never contains a variable's value.
- **Imports use `.ts` extensions** (`./app.ts`). Tests import `describe`, `it`, `expect` and the hooks from `"vitest"`: no globals. No `vi.mock` of our own modules ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 16).
- **TDD** for `config.ts` and the health route ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 3): write the test, run it and see it fail for the expected reason, then write the code.
- **`allowBuilds` is the owner's decision:** when `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS`, stop, show the owner the message and the evidence (Task 5, step 1), and add only what the owner chose.
- **Before every commit that touches `.github/`,** run the lint gate from [Scratch tools](#scratch-tools); it must be clean.
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test`. The pre-commit hook formats staged files; Markdown is never formatted by Prettier.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list (`api`, `deps`, `adr`, `plan` …). Every commit ends with the trailers:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines; an ADR that refines another is noted in three places.
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its check in the owning task.

1. **An empty value in `.env`** (`PORT=` or `HOST=`): it must be rejected with a reason, not treated as missing and not defaulted. Check: Task 3, the empty `HOST` and `PORT=""` tests.
2. **A plausible but wrong value:** `PORT=3000.5`, `LOG_LEVEL=INFO` (upper case, as in many other tools). Rejected, naming the variable. Check: Task 3, the `PORT` and `LOG_LEVEL` tables.
3. **No `.env` file at all** (a fresh clone): `pnpm dev` stops with Node's `.env: not found`, not with a crash deep in the app. Check: Task 5, step 6.
4. **The port already taken** (a second `pnpm dev`): startup fails visibly with `EADDRINUSE` and the first server keeps running. Check: Task 5, step 6.
5. **An unknown API path** (`/api/nope`): Fastify's default 404 JSON body, logged as a normal request, no crash; the shape of our own errors is OP-071. Check: Task 5, step 6.

## Findings since the spec

A prototype of the whole phase in a scratch clone (every file of Tasks 1–5, run, linted, type-checked, and the CI step tried on its real output) confirmed the design and settled the spec's "To verify" list:

- **Vitest 5's `test.projects`** takes a path to a package's config (`"apps/api/vitest.config.ts"`) next to an inline project; the output labels tests `|api|` and `|hooks|`. A project with no test files yet does not fail the run.
- **Vitest writes its own test report to the job summary** when it runs in GitHub Actions (`## Vitest Test Report`), but not coverage. The coverage table comes from a `json-summary` reporter and a `jq` step (Task 2), tried on the prototype's real `coverage-summary.json`. Vitest 5's text table hides fully covered files ("2 files fully covered"); the summary table lists every file. Without `coverage.include`, files no test loads (`server.ts`) are missing from the report; with it they show as 0%.
- **`pnpm -r typecheck`** runs only the workspace packages, not the root, so the root script does not call itself; a type error in `apps/api` fails `pnpm typecheck`.
- **`tsconfigRootDir`** works with `projectService`: `apps/api`'s files are linted with `apps/api/tsconfig.json`. ESLint must also ignore `coverage/` (its HTML report holds `.js` files no tsconfig includes), and Prettier too.
- **`tsx watch --env-file=.env`** passes the flag to Node and re-reads `.env` on every restart. On a file change tsx sends SIGTERM: the log shows `shutting down` with `signal: "SIGTERM"`, then the new process's `Server listening`. A missing `.env` makes Node stop with `node: .env: not found` (exit 9).
- **Ctrl+C through `pnpm -r --parallel dev` and the pino-pretty pipe,** tried in a pseudo-terminal: the server logs `shutting down` with `signal: "SIGINT"`, pnpm prints `Done`, and no process is left behind.
- **Zod 4's messages hold no values** (`Invalid input: expected number, received NaN`, `Invalid option: expected one of …`). A missing variable gives `expected string, received undefined` or `received NaN`, which hides that it is missing, so `loadConfig` writes `NAME: missing` itself when the variable is absent.
- **tsx brings esbuild,** whose `postinstall` script pnpm 12 refuses (`ERR_PNPM_IGNORED_BUILDS`). With `esbuild: false`, tsx works: the platform binary comes from the optional package `@esbuild/linux-x64`, and the script only checks it. So the `allowBuilds` decision moves from Task 1 to Task 5, where tsx arrives; Vitest and Fastify bring no install scripts.
- **pino-pretty resolved to 13.1.3, not 13.2.0,** which was published the day before: pnpm 12 holds back versions younger than its minimum release age ("passes supply-chain policies"). Take what pnpm resolves.
- **Task order:** the spec's tasks 1 and 2 are regrouped. `tsc` fails on a tsconfig with no input files, so `apps/api` arrives together with its `vitest.config.ts` and the Vitest setup (Task 1), and the CI change gets a task of its own (Task 2) so its lint gate and review stand apart.

## Scratch tools

Nothing here is installed for good, and nothing goes in the repository. Use one scratch folder outside the repository:

```bash
S="${CLAUDE_JOB_DIR:+$CLAUDE_JOB_DIR/tmp}"; S="${S:-/tmp}/szop-ph03"; mkdir -p "$S/bin"; echo "$S"
```

Set up once (actionlint and jq, checksum-verified; zizmor through `uvx`):

```bash
S="${CLAUDE_JOB_DIR:+$CLAUDE_JOB_DIR/tmp}"; S="${S:-/tmp}/szop-ph03"; mkdir -p "$S/bin"; cd "$S"
curl -fsSL -o al.tgz https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz
echo "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8  al.tgz" | sha256sum --check
tar -xzf al.tgz -C bin actionlint && bin/actionlint -version
command -v jq || { curl -fsSL -o bin/jq https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64 && chmod +x bin/jq; }
uvx -q zizmor@1.30.1 --version
```

Expected: `al.tgz: OK`, `1.7.12`, `zizmor 1.30.1`.

**The lint gate** (from the repository root, before committing anything in `.github/`):

```bash
S="${CLAUDE_JOB_DIR:+$CLAUDE_JOB_DIR/tmp}"; S="${S:-/tmp}/szop-ph03"
"$S/bin/actionlint" -color \
  && GH_TOKEN=$(gh auth token) uvx -q zizmor@1.30.1 . \
  && uvx -q check-jsonschema --builtin-schema vendor.github-workflows .github/workflows/*.yml \
  && echo "LINT GATE: clean"
```

Expected: `No findings to report. Good job!` from zizmor and `LINT GATE: clean`.

## Tool page template

Every page in `docs/development/tools/` follows this shape ([ADR 0005](../../decisions/0005-development-environment.md), decision 15), like the existing pages. Pages stay under 100 lines, so they need no Contents section.

```markdown
# <Tool>

<One sentence: what it is and what it does for Szop.>

## Why Szop uses it

<The reason, and the alternatives that were considered, linking the ADR decision.>

## Configuration

<Each file the tool owns: where it lives, and every setting in it explained in one line each.>

## Everyday use

<The commands a developer uses, each with a one-line explanation. Common problems and their fixes.>

## Official documentation

- <Links to the official docs pages that matter.>
```

---

### Task 1: The api workspace and Vitest

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `vitest.config.ts`
- Modify: `package.json` (scripts, devDependencies), `tsconfig.json` (`include`), `eslint.config.js`, `.claude/hooks/guard-git-push.test.ts`, `.gitignore`, `.prettierignore`, `.vscode/extensions.json`, `pnpm-workspace.yaml` (comment), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: the workspace package `@szop/api` with a `typecheck` script; the Vitest projects `api` (`apps/api/src/**/*.test.ts`) and `hooks`; root scripts `typecheck` (chained), `test`, `test:watch`. Later tasks add files under `apps/api/src/` and they are type-checked, linted and tested with no further setup.

- [x] **Step 1: Create the package**

`apps/api/package.json`:

```json
{
  "name": "@szop/api",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/api/tsconfig.json` (the root's `tsconfig.json` has the same flags; `allowJs` is not needed here):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

`apps/api/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

// The api project of the root vitest.config.ts.
export default defineProject({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Then install:

```bash
pnpm add -Dw vitest@^5.0.3
pnpm --filter @szop/api add -D @types/node@^24.19.0
```

Expected: both finish without `ERR_PNPM_IGNORED_BUILDS`.

- [x] **Step 2: Add the root Vitest config and scripts**

`vitest.config.ts` at the root:

```ts
import { defineConfig } from "vitest/config";

// One project per package, plus the push hook's tests (ADR 0007, decision 8).
export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      {
        test: {
          name: "hooks",
          environment: "node",
          include: [".claude/hooks/**/*.test.ts"],
        },
      },
    ],
  },
});
```

In the root `package.json`, set these scripts (keep `lint`, `format`, `format:check` and `prepare` as they are):

```json
"typecheck": "tsc --noEmit && pnpm -r typecheck",
"test": "vitest run",
"test:watch": "vitest",
```

In the root `tsconfig.json`, change `"include": ["*.js", ".claude/hooks/**/*.ts"]` to `"include": ["*.js", "*.ts", ".claude/hooks/**/*.ts"]`, so `vitest.config.ts` is type-checked and linted.

- [x] **Step 3: Move the push hook's tests to Vitest**

In `.claude/hooks/guard-git-push.test.ts`:

- Replace the imports `import { test } from "node:test";` and `import assert from "node:assert/strict";` with `import { expect, test } from "vitest";`, placed after the `node:` imports.
- Replace the two loops:

```ts
test.each(allowed)("allows: %s", (command) => {
  expect(findViolation(command)).toBeNull();
});

test.each(blocked)("blocks: %s", (command, reason) => {
  expect(findViolation(command)).toMatch(reason);
});
```

- In the two `runHook` tests: `assert.equal(result.status, 2)` → `expect(result.status).toBe(2)`, `assert.match(result.stderr, /force/)` → `expect(result.stderr).toMatch(/force/)`, `assert.equal(result.status, 0)` → `expect(result.status).toBe(0)`.

The `allowed` and `blocked` lists stay exactly as they are.

- [x] **Step 4: Update ESLint, the ignores and the editor**

`eslint.config.js`:
- `globalIgnores(["docs/", ".superpowers/"])` → `globalIgnores(["docs/", ".superpowers/", "coverage/"])`, and extend the comment above it: `// … coverage/ holds Vitest's generated report.`
- Add `tsconfigRootDir: import.meta.dirname,` after `projectService: true,`, and extend its comment: `// Lint each file with the tsconfig that includes it, looked up from this folder.`
- Delete the whole block that starts with `// node:test's test() returns a promise the runner itself awaits.` (the `files: [".claude/hooks/**/*.test.ts"]` override).

`.gitignore`, at the end:

```
# Local configuration (copied from .env.example) and test coverage reports
.env
coverage/
```

`.prettierignore`: add a line `coverage/` with a comment `# Generated by pnpm test:coverage`, in the file's style.

`.vscode/extensions.json`: add `"vitest.explorer"` to `recommendations`, after `"esbenp.prettier-vscode"`.

`pnpm-workspace.yaml`: replace the first two comment lines with `# The workspace packages: apps/api since PH-03; apps/web arrives in PH-05,` and `# packages/shared with the first shared code.`

- [x] **Step 5: Run every check**

```bash
pnpm test && pnpm lint && pnpm format:check && pnpm typecheck
```

Expected: Vitest prints `Test Files  1 passed (1)` and `Tests  36 passed (36)`, every test labelled `|hooks|`; ESLint and `tsc` print only their commands; Prettier prints `All matched files use Prettier code style!`. `pnpm typecheck` prints `tsc --noEmit` twice (the root, then `apps/api`).

- [x] **Step 6: Prove the checks bite**

- Change `toBeNull()` to `not.toBeNull()` in the hook test and run `pnpm test`: expect the 13 `allows:` tests to fail and a non-zero exit code. Undo the change.
- Create `apps/api/src/bad.ts` holding `export const x: number = "a";`, run `pnpm typecheck`: expect `error TS2322` from `apps/api` and a non-zero exit. Delete the file.

- [x] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts vitest.config.ts package.json pnpm-lock.yaml tsconfig.json eslint.config.js .claude/hooks/guard-git-push.test.ts .gitignore .prettierignore .vscode/extensions.json pnpm-workspace.yaml docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
build(api): add the api workspace and Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 2: Coverage, locally and in CI

**Files:**
- Modify: `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml` (the `test` job)

**Interfaces:**
- Consumes: Task 1's root `vitest.config.ts` and `test` script.
- Produces: `pnpm test:coverage`, writing `coverage/coverage-summary.json` (read by CI), `coverage/index.html` and a table in the terminal; the `test` job's job summary with Vitest's test report and a coverage table.

- [x] **Step 1: Configure coverage**

```bash
pnpm add -Dw @vitest/coverage-v8@^5.0.3
```

In the root `vitest.config.ts`, add next to `projects`, inside `test`:

```ts
    // Measured, never gated (ADR 0007, decision 19). include lists files no
    // test loads too, such as server.ts, so they show up at 0%.
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.ts", ".claude/hooks/**/*.ts"],
      reporter: ["text", "html", "json-summary"],
    },
```

In the root `package.json` scripts, after `test:watch`:

```json
"test:coverage": "pnpm test --coverage",
```

- [x] **Step 2: Try it**

```bash
pnpm test:coverage && ls coverage
```

Expected: the tests pass, the terminal shows a `Coverage report from v8` table listing `.claude/hooks/guard-git-push.ts`, and `coverage/` holds `index.html` and `coverage-summary.json`. `git status` does not list `coverage/`.

- [x] **Step 3: Show coverage in CI's job summary**

In `.github/workflows/ci.yml`, in the `test` job, replace `- run: pnpm test` with:

```yaml
      # Vitest adds its own test report to the job summary when it runs in
      # GitHub Actions.
      - run: pnpm test:coverage
      # Coverage is shown, never gated (ADR 0007, decision 19).
      - name: Coverage summary
        run: |
          {
            echo "## Coverage"
            echo
            jq -r --arg root "$PWD/" '
              "| File | Statements | Branches | Functions | Lines |",
              "|---|---:|---:|---:|---:|",
              (to_entries[] | "| \(.key | ltrimstr($root)) | \(.value.statements.pct)% | \(.value.branches.pct)% | \(.value.functions.pct)% | \(.value.lines.pct)% |")
            ' coverage/coverage-summary.json
          } >> "$GITHUB_STEP_SUMMARY"
```

- [x] **Step 4: Try the summary step locally**

From the repository root, after step 2:

```bash
S="${CLAUDE_JOB_DIR:+$CLAUDE_JOB_DIR/tmp}"; S="${S:-/tmp}/szop-ph03"
PATH="$S/bin:$PATH" GITHUB_STEP_SUMMARY="$S/summary.md" bash -eo pipefail -c "$(python3 -c "
import yaml
steps = yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']['test']['steps']
print(next(s['run'] for s in steps if s.get('name') == 'Coverage summary'))")" && cat "$S/summary.md"; rm -f "$S/summary.md"
```

Expected: `## Coverage`, then a Markdown table whose rows are `total` and `.claude/hooks/guard-git-push.ts`, with repository-relative paths (no `/home/…`).

- [x] **Step 5: Lint gate and checks**

Run the [lint gate](#scratch-tools), then `pnpm lint && pnpm format:check && pnpm typecheck`. Expected: `LINT GATE: clean` and no errors.

- [x] **Step 6: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml .github/workflows/ci.yml docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
ci: show test coverage in the job summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 3: Configuration

**Files:**
- Create: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`
- Modify: `apps/api/package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1's `api` Vitest project.
- Produces, from `apps/api/src/config.ts`:
  - `interface Config { host: string; port: number; logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent" }` (the `logLevel` type is inferred from the schema's enum)
  - `function loadConfig(env: Record<string, string | undefined>): Config`, which throws an `Error` whose message starts with `Invalid configuration:` and has one line per problem, `  NAME: missing` or `  NAME: <Zod's message>`.

- [ ] **Step 1: Install Zod**

```bash
pnpm --filter @szop/api add zod@^4.6.5
```

- [ ] **Step 2: Write the failing tests**

`apps/api/src/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const valid = { HOST: "127.0.0.1", PORT: "3000", LOG_LEVEL: "info" };

// The message loadConfig throws for env.
function errorFor(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("returns the typed config for a valid environment", () => {
    expect(loadConfig(valid)).toEqual({
      host: "127.0.0.1",
      port: 3000,
      logLevel: "info",
    });
  });

  it("ignores variables it does not know", () => {
    expect(loadConfig({ ...valid, PATH: "/usr/bin" })).toEqual(
      loadConfig(valid),
    );
  });

  it.each(["HOST", "PORT", "LOG_LEVEL"])(
    "names %s when it is missing",
    (name) => {
      expect(errorFor({ ...valid, [name]: undefined })).toContain(
        `${name}: missing`,
      );
    },
  );

  it("lists every problem at once", () => {
    const message = errorFor({});
    expect(message).toContain("HOST: missing");
    expect(message).toContain("PORT: missing");
    expect(message).toContain("LOG_LEVEL: missing");
  });

  it("rejects an empty HOST instead of treating it as missing", () => {
    expect(errorFor({ ...valid, HOST: "" })).toMatch(/HOST: (?!missing)/);
  });

  it.each(["abc", "0", "70000", "3000.5", ""])("rejects PORT=%j", (port) => {
    expect(errorFor({ ...valid, PORT: port })).toMatch(/PORT: (?!missing)/);
  });

  it.each(["loud", "INFO"])("rejects LOG_LEVEL=%j", (level) => {
    expect(errorFor({ ...valid, LOG_LEVEL: level })).toMatch(
      /LOG_LEVEL: (?!missing)/,
    );
  });

  it("never puts a value in the error", () => {
    const secret = "s3cr3t-value";
    const message = errorFor({ HOST: "", PORT: secret, LOG_LEVEL: secret });
    expect(message).toContain("PORT:");
    expect(message).not.toContain(secret);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm test --project api`
Expected: FAIL, `Failed to load url ./config.ts` (or `Cannot find module`), since `config.ts` does not exist yet.

- [ ] **Step 4: Write `config.ts`**

`apps/api/src/config.ts`:

```ts
import { z } from "zod";

// Every setting is required: a missing one stops startup instead of
// falling back to a default (ADR 0019, decision 2).
const envSchema = z.object({
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
});

export interface Config {
  host: string;
  port: number;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Names and Zod's messages only, never the values: they may be secrets.
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return env[name] === undefined
        ? `  ${name}: missing`
        : `  ${name}: ${issue.message}`;
    });
    throw new Error(`Invalid configuration:\n${problems.join("\n")}`);
  }
  const { HOST, PORT, LOG_LEVEL } = result.data;
  return { host: HOST, port: PORT, logLevel: LOG_LEVEL };
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm test`
Expected: PASS, `Test Files  2 passed (2)`; the `|api|` tests include `names PORT when it is missing`, `rejects PORT="3000.5"`, `rejects LOG_LEVEL="INFO"` and `never puts a value in the error`.

- [ ] **Step 6: Checks and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/package.json pnpm-lock.yaml docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
feat(api): validate the configuration at startup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 4: buildApp and the health route

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/health/routes.ts`, `apps/api/src/health/routes.test.ts`
- Modify: `apps/api/package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Config` from `apps/api/src/config.ts` (Task 3).
- Produces:
  - from `apps/api/src/app.ts`: `interface AppDeps { config: Config }` and `function buildApp(deps: AppDeps): FastifyInstance`, which returns the app without listening;
  - from `apps/api/src/health/routes.ts`: `function healthRoutes(app: FastifyInstance): void`, a Fastify plugin registering `GET /health`.

- [ ] **Step 1: Install Fastify**

```bash
pnpm --filter @szop/api add fastify@^5.12.5
```

- [ ] **Step 2: Write the failing API test**

`apps/api/src/health/routes.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Config } from "../config.ts";

const config: Config = { host: "127.0.0.1", port: 3000, logLevel: "silent" };

describe("GET /api/health", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({ config });
  });

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
```

`inject()` sends a request through Fastify without opening a port; `host` and `port` in the test config are never used.

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm test --project api`
Expected: FAIL in `health/routes.test.ts`, the module `../app.ts` not found.

- [ ] **Step 4: Write `buildApp` with an empty app, and see the route's absence fail**

`apps/api/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.ts";

// Everything the app needs from outside. Production and tests both call
// buildApp, passing real or fake dependencies (ADR 0007, decision 14).
export interface AppDeps {
  config: Config;
}

export function buildApp({ config }: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });
  return app;
}
```

Run: `pnpm test --project api`
Expected: FAIL with `expected 404 to be 200`: the app builds, the route is missing.

- [ ] **Step 5: Add the health route**

`apps/api/src/health/routes.ts`:

```ts
import type { FastifyInstance } from "fastify";

// GET /api/health. PH-04 adds the database check (ADR 0008, decision 15).
export function healthRoutes(app: FastifyInstance): void {
  app.get("/health", () => ({ status: "ok" }));
}
```

In `apps/api/src/app.ts`, import it and register it before `return app;`:

```ts
import { healthRoutes } from "./health/routes.ts";
```

```ts
  // Each feature's routes are a plugin; later ones get their services as
  // plugin options.
  app.register(healthRoutes, { prefix: "/api" });
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm test`
Expected: PASS, `Test Files  3 passed (3)`, including `|api| src/health/routes.test.ts > GET /api/health > answers 200 with status ok`.

- [ ] **Step 7: Checks and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck
git add apps/api/src/app.ts apps/api/src/health/routes.ts apps/api/src/health/routes.test.ts apps/api/package.json pnpm-lock.yaml docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
feat(api): add buildApp and GET /api/health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 5: Running the API

**Files:**
- Create: `apps/api/src/server.ts`, `apps/api/.env.example`
- Modify: `apps/api/package.json` (the `dev` script, devDependencies), `package.json` (the `dev` script), `pnpm-workspace.yaml` (`allowBuilds`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `loadConfig`, `Config` (Task 3); `buildApp` (Task 4).
- Produces: `pnpm dev` at the root, starting every package's `dev` script; `apps/api/.env.example`, documented in Task 6.

- [ ] **Step 1: Install tsx and pino-pretty, and ask the owner about esbuild**

```bash
pnpm --filter @szop/api add -D tsx@^4.23.15 pino-pretty@^13.1.3
```

Expected: it stops with `ERR_PNPM_IGNORED_BUILDS` … `Ignored build scripts: esbuild@…`. **Stop and ask the owner**, showing:
- the message;
- esbuild's script: `grep -A2 '"scripts"' node_modules/.pnpm/esbuild@*/node_modules/esbuild/package.json` (`"postinstall": "node install.js"`);
- that the binary is already there without it: `ls node_modules/.pnpm | grep esbuild` lists `@esbuild+linux-x64@…`;
- the recommendation: `esbuild: false`. The script only checks, and on some systems re-copies, the binary that the optional platform package already installed; tsx ran with it denied in the prototype. Allowing it would run code from the internet at install time for no gain ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).

Record the owner's choice in `pnpm-workspace.yaml`, replacing `allowBuilds: {}`:

```yaml
allowBuilds:
  # tsx's esbuild: its postinstall only checks the binary that the optional
  # @esbuild/<platform> package already installs (ADR 0019).
  esbuild: false
```

(with `true` and an adjusted comment if the owner chose so), then run `pnpm install`. Expected: it finishes with no error.

- [ ] **Step 2: Write the entry point**

`apps/api/src/server.ts`:

```ts
import { buildApp } from "./app.ts";
import { loadConfig, type Config } from "./config.ts";

// The only file that reads process.env. Checked by hand, not by tests:
// everything it calls is tested (ADR 0019, decision 10).
let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const app = buildApp({ config });

// Let requests in flight finish before exiting: on Ctrl+C, on tsx's
// restarts, and when ECS stops the task.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
```

- [ ] **Step 3: Add the scripts and `.env.example`**

`apps/api/package.json` scripts:

```json
"dev": "tsx watch --env-file=.env src/server.ts | pino-pretty",
"typecheck": "tsc --noEmit"
```

Root `package.json`, first in `scripts`:

```json
"dev": "pnpm -r --parallel dev",
```

`apps/api/.env.example`:

```bash
# The API's configuration for local development. Copy this file to .env
# (git-ignored) and adjust it. Every variable is required: the API refuses
# to start if one is missing or invalid (ADR 0019, decision 2).

# Address to listen on. 127.0.0.1 keeps the API unreachable from the network.
HOST=127.0.0.1

# Port to listen on, 1-65535.
PORT=3000

# Least severe log level to write: fatal, error, warn, info, debug, trace or
# silent.
LOG_LEVEL=info
```

Then `cp apps/api/.env.example apps/api/.env`. `git status` must not list `.env`.

- [ ] **Step 4: Run it**

In one terminal: `pnpm dev`. In another:

```bash
curl -si http://127.0.0.1:3000/api/health
```

Expected: `HTTP/1.1 200 OK`, `content-type: application/json; charset=utf-8`, body `{"status":"ok"}`. The first terminal shows, prefixed with `apps/api dev:`, `Server listening at http://127.0.0.1:3000`, then `incoming request` (with `reqId`, `method`, `url`) and `request completed` (with `statusCode: 200` and `responseTime`) as pretty-printed lines.

- [ ] **Step 5: Restart and shutdown**

- Save `apps/api/src/app.ts` unchanged (`touch` it). Expected: `[tsx] change in ./src/app.ts Restarting...`, `shutting down` with `signal: "SIGTERM"`, then `Server listening` again; `curl` still answers.
- Press Ctrl+C. Expected: `shutting down` with `signal: "SIGINT"`, pnpm's `Done`, the prompt back, and `pgrep -fa "tsx|pino-pretty"` lists nothing from this repository.

- [ ] **Step 6: The unhappy paths (Review Focus 3–5)**

- **Unknown path:** with `pnpm dev` running, `curl -s http://127.0.0.1:3000/api/nope` → `{"message":"Route GET:/api/nope not found","error":"Not Found","statusCode":404}`, logged as a request with `statusCode: 404`; the server keeps running.
- **Port taken:** with `pnpm dev` running, in a second terminal run `cd apps/api && pnpm exec tsx --env-file=.env src/server.ts`. Expected: it fails with `EADDRINUSE` and exits; the first server still answers.
- **Invalid setting:** stop `pnpm dev`; in `apps/api/.env` set `PORT=abc` and delete the `LOG_LEVEL` line; run `cd apps/api && pnpm exec tsx --env-file=.env src/server.ts`. Expected: exit code 1 and exactly
  ```
  Invalid configuration:
    PORT: Invalid input: expected number, received NaN
    LOG_LEVEL: missing
  ```
  with no `abc` in it. Restore `.env` from `.env.example`.
- **No `.env`:** move `.env` away, run the same command. Expected: `node: .env: not found` and a non-zero exit. Move it back.

Record the outputs of steps 4–6 for the PR's *How it was tested*.

- [ ] **Step 7: Checks and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src/server.ts apps/api/.env.example apps/api/package.json package.json pnpm-workspace.yaml pnpm-lock.yaml docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
feat(api): start the API with pnpm dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 6: Testing guide, tool pages and setup

**Files:**
- Create: `docs/development/testing.md`, `docs/development/tools/vitest.md`, `docs/development/tools/tsx.md`, `docs/development/tools/pino-pretty.md`
- Modify: `docs/development/setup.md`, `CLAUDE.md`, `docs/development/tools/pnpm.md` (the `allowBuilds` entry), `docs/development/tools/eslint.md` (`tsconfigRootDir`, the removed exception, `coverage/`), `docs/development/tools/typescript.md` (the per-package configs and the chained `typecheck`), `docs/development/tools/vscode.md` (the Vitest extension), `docs/development/tools/prettier.md` (`coverage/` in `.prettierignore`)

**Interfaces:**
- Consumes: the files of Tasks 1–5, described as committed.
- Produces: `docs/development/testing.md`, which `CLAUDE.md`, ADR 0019 and Task 7's docs link to.

- [ ] **Step 1: Write `docs/development/testing.md`**

The living guide to how Szop is tested now ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 22). It will pass 100 lines, so it starts with `## Contents`. Sections:

1. Intro: what this guide is (the *how*; [ADR 0007](../decisions/0007-testing-strategy.md) is the *why*), and that it grows as layers arrive: the database (PH-04), components (PH-05), E2E journeys (PH-07), property tests and mutation testing (PH-15).
2. `## The layers today`: a table of the layer, where its tests live, what they prove, and the Vitest project: API tests (`apps/api/src/**/*.test.ts`, HTTP through `buildApp` and `inject()`, project `api`); unit tests (next to the code, e.g. `config.test.ts`, project `api`); the push hook's tests (`.claude/hooks/`, project `hooks`). Then a short list of the layers still to come, with their phases.
3. `## Running the tests`: `pnpm test` (every project, as CI); `pnpm test:watch` (re-runs on save); `pnpm test --project api` (one project); `pnpm test <part of a file name>` (one file); `pnpm test:coverage` (`coverage/index.html` and the terminal table; it is `pnpm test --coverage`, so both always run the same tests); the Vitest extension in VS Code.
4. `## Writing an API test`: the health test as the worked example, explained line by line: a literal `Config` with `logLevel: "silent"`; a fresh app per test in `beforeEach` and `app.close()` in `afterEach`; `app.inject()` sends a request through Fastify without a port; assert the status, the content type and the body. Later phases pass a test database, a recording email sender and a controllable clock through the same `buildApp(deps)` ([ADR 0007](../decisions/0007-testing-strategy.md), decision 14).
5. `## Writing a unit test`: next to the code; `describe`/`it`/`expect` imported from `vitest` (no globals); `it.each` for tables of inputs, as in `config.test.ts`.
6. `## Rules`: [ADR 0007](../decisions/0007-testing-strategy.md), decision 16 in short: test at the lowest layer that proves the behavior; no `vi.mock` of our own modules, fakes go in through `buildApp(deps)`; no snapshot tests of markup; flaky tests are bugs. Decision 3: TDD for domain rules, services and routes, and every bug fix starts with a failing test. Plus: **entry points are checked by hand** (`server.ts` only reads the environment, listens and shuts down; everything it calls is tested; the checks are in the phase's PR), [ADR 0019](../decisions/0019-api-skeleton-details.md), decision 10.
7. `## Coverage`: measured, never gated ([ADR 0007](../decisions/0007-testing-strategy.md), decision 19); what the table's columns mean; files no test loads show at 0% because the config lists them; fully covered files are hidden from the terminal table but present in the HTML report; CI's job summary shows the same numbers ([CI/CD](ci-cd.md)).

- [ ] **Step 2: Write the three tool pages**

Each follows the [tool page template](#tool-page-template).

- `vitest.md`: what Vitest is (a test runner built on Vite, running TypeScript and ES modules natively); why ([ADR 0007](../../decisions/0007-testing-strategy.md), decisions 8 and 18: Jest's ESM support; Node's test runner until PH-03, [ADR 0016](../../decisions/0016-toolchain-details.md), decision 6); *Configuration*: the root `vitest.config.ts` (`projects`, `coverage`: `provider`, `include`, `reporter`), `apps/api/vitest.config.ts` (`name`, `environment`, `include`), each setting in one line, and that a new package adds its own config to `projects`; *Everyday use*: the scripts, `--project`, filtering by file name, watch mode's keys (`a` re-run all, `f` failed only, `q` quit), the VS Code extension (the Testing view, running one test from the gutter), reading a failure (the diff of expected and received), "No test files found" when a filter matches nothing.
- `tsx.md`: what tsx is (runs TypeScript files directly by compiling them with esbuild on the fly; `watch` restarts on change); why ([ADR 0005](../../decisions/0005-development-environment.md), decision 9; Node's type stripping and `tsc` then run considered); *Configuration*: none of its own; the `dev` script explained part by part (`watch`, `--env-file=.env` passed on to Node, `| pino-pretty`); tsx does not check types, `pnpm typecheck` does; esbuild's install script is denied in `allowBuilds` and why; *Everyday use*: `pnpm dev`, what a restart looks like in the log (`[tsx] change in … Restarting...`, SIGTERM, graceful shutdown), typing `rs` + Enter does not apply (pnpm's parallel mode has no input), running a file once with `pnpm exec tsx --env-file=.env src/server.ts` from `apps/api`.
- `pino-pretty.md`: what it is (turns pino's JSON lines into coloured, readable ones); why ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 3: a pipe in the `dev` script only, so the app always writes JSON and production gets exactly what CloudWatch reads; the transport setting and raw JSON considered); *Configuration*: none; *Everyday use*: what an `incoming request` / `request completed` pair shows (`reqId`, method, URL, status, response time); seeing the raw JSON by running without the pipe (`pnpm exec tsx --env-file=.env src/server.ts` from `apps/api`); changing the level with `LOG_LEVEL` in `.env`.

- [ ] **Step 3: Update the existing tool pages**

- `pnpm.md`: in its `allowBuilds` part, the first entry: `esbuild: false`, why (tsx's esbuild; the binary comes from the optional platform package), and that `ERR_PNPM_IGNORED_BUILDS` asks the owner for each new one. Also the workspace commands now in use: `pnpm -r <script>`, `pnpm --filter @szop/api add <pkg>`, `pnpm add -Dw <pkg>` for root tools.
- `eslint.md`: `tsconfigRootDir` (why: with several tsconfigs, typescript-eslint needs to know where to look them up from), `coverage/` in the ignores, and the removed `node:test` exception.
- `typescript.md`: each package has its own `tsconfig.json` extending the base (`apps/api/tsconfig.json` explained: `noEmit`, `erasableSyntaxOnly`, `allowImportingTsExtensions`, `types`, `include`); `pnpm typecheck` checks the root, then each package with `pnpm -r typecheck` ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 4); imports keep their `.ts` extension (decision 6). Update the line saying packages arrive "from PH-03".
- `vscode.md`: the Vitest extension in the recommendations, and what it gives.
- `prettier.md`: `coverage/` in `.prettierignore`.

- [ ] **Step 4: Update `setup.md`**

- Section 6, after `pnpm install`: `cp apps/api/.env.example apps/api/.env`, with a sentence: the API's local configuration; every variable is required; `.env` is git-ignored and never committed.
- Section 7: `pnpm test` now ends with Vitest's `Test Files … passed` and `Tests … passed` lines; add [Vitest](tools/vitest.md) to the list of tool pages.
- A new section after 7, `## 8. Run the API`: `pnpm dev`, then `curl http://127.0.0.1:3000/api/health` → `{"status":"ok"}`; what the log lines are; Ctrl+C stops it; editing a file restarts it; if it stops with `Invalid configuration`, compare `.env` with `.env.example`; links to [tsx](tools/tsx.md), [pino-pretty](tools/pino-pretty.md) and [testing](testing.md). Renumber "What the git hooks do" and "Coming later" to 9 and 10, and update `## Contents`.
- "Coming later": remove the "Running the app" line; keep Docker Desktop and the database (PH-04); add "the web app, in [PH-05](../roadmap.md#ph-05-spa-skeleton)".

- [ ] **Step 5: Update `CLAUDE.md`**

- In `## Documentation`, after the `docs/development/ci-cd.md` line: `` - `docs/development/testing.md` — how Szop is tested: the layers, running the suites, writing each kind of test, and the rules. Read it before writing or changing tests, and keep it updated when a test layer or tool changes. ``

- [ ] **Step 6: Verify links and contents**

```bash
for f in docs/development/testing.md docs/development/tools/{vitest,tsx,pino-pretty,pnpm,eslint,typescript,vscode,prettier}.md docs/development/setup.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
```

Expected: `link check done`, with no `BROKEN` line except links to `docs/decisions/0019-api-skeleton-details.md`, which Task 7 creates. Check by eye that `testing.md`'s and `setup.md`'s Contents list every `##` and `###` heading.

- [ ] **Step 7: Commit**

```bash
git add docs/development/testing.md docs/development/tools/vitest.md docs/development/tools/tsx.md docs/development/tools/pino-pretty.md docs/development/tools/pnpm.md docs/development/tools/eslint.md docs/development/tools/typescript.md docs/development/tools/vscode.md docs/development/tools/prettier.md docs/development/setup.md CLAUDE.md docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
docs: add the testing guide and the API's tool pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

### Task 7: ADR 0019, living docs and registers

**Files:**
- Create: `docs/decisions/0019-api-skeleton-details.md`
- Modify: `docs/decisions/0005-development-environment.md`, `docs/decisions/0007-testing-strategy.md`, `docs/decisions/0016-toolchain-details.md` (status lines and decision cells), `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/development/ci-cd.md`, `docs/glossary.md`, `README.md`, `docs/open-points.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the records the PR links to.

- [ ] **Step 1: Write ADR 0019**

`docs/decisions/0019-api-skeleton-details.md`, in ADR 0018's shape:

- Title `# ADR 0019 — API skeleton details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-05`; `- **Refines:** [ADR 0005](0005-development-environment.md), decision 9 (tsx runs with `--env-file` and its output piped through pino-pretty; see decisions 2 and 3)`; `- **Completes:** [ADR 0007](0007-testing-strategy.md), decision 8 (how the Vitest projects are laid out; see decision 5); [ADR 0016](0016-toolchain-details.md), decision 6 (Node's test runner retires; `pnpm test` runs Vitest)`.
- `## Context`: [PH-03](../roadmap.md#ph-03-api-skeleton) created the API; the architecture, ADR 0002, 0005 and 0007 set its direction; its brainstorm, the [spec](../superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md) and a prototype of the whole phase settled the details.
- `## Decisions`: the spec's "Decisions taken in the brainstorm" table, decisions 1–10 copied with their wording, links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Then:
  - `| 11 | Install script of tsx's esbuild | Allow it; deny it | **<the owner's choice from Task 5>.** <the reasoning shown to the owner: the postinstall only checks the binary that the optional @esbuild/<platform> package installs; tsx runs with it denied; ADR 0012, decision 18>. |`
  - `| 12 | Coverage in CI | Vitest's job summary reporter; a json-summary report turned into a table by jq; no coverage in CI yet | **A json-summary report and a jq step** in the test job, after pnpm test:coverage. Vitest's GitHub Actions reporter writes the test results to the job summary but not coverage. Deferring would leave ADR 0010, decision 7 unmet while coverage already exists locally. test:coverage is pnpm test --coverage, so CI and local runs run the same tests. |` (format scripts and file names as code in the real cell).
- `## Consequences`: `apps/api` exists and `pnpm dev` runs it; `pnpm test` runs Vitest and CI shows coverage; each later dependency of the app joins `AppDeps`; the open points ([OP-010](../open-points.md#op-010), [OP-012](../open-points.md#op-012), [OP-013](../open-points.md#op-013) PH-03 parts done; [OP-062](../open-points.md#op-062), [OP-065](../open-points.md#op-065) closed; new [OP-071](../open-points.md#op-071), [OP-072](../open-points.md#op-072)); the living docs (`testing.md`, three tool pages, `setup.md`, the architecture, the stack overview, `ci-cd.md`, `CLAUDE.md`).

- [ ] **Step 2: Note the refinements in the earlier ADRs**

Each in the three places `CLAUDE.md` asks for (ADR 0019's header is step 1):

- ADR 0005, status line: append `; decision 9 refined by [ADR 0019](0019-api-skeleton-details.md) (tsx with --env-file and pino-pretty)`. Decision 9's cell, at the bottom after any notes: `<br>✏️ **Refined by [ADR 0019](0019-api-skeleton-details.md), decisions 2 and 3:** the dev script runs tsx with Node's --env-file and pipes the logs through pino-pretty.` (code formatting in the real cell).
- ADR 0007, status line: append `; decision 8 completed by [ADR 0019](0019-api-skeleton-details.md) (the Vitest projects' layout)`. Decision 8's cell: `<br>🧩 **Completed by [ADR 0019](0019-api-skeleton-details.md), decision 5:** a root vitest.config.ts lists each package's own config and an inline project for the push hook; no globals.`
- ADR 0016, status line: append `; decision 6 completed by [ADR 0019](0019-api-skeleton-details.md) (Vitest replaces Node's test runner)`. Decision 6's cell: `<br>🧩 **Completed by [ADR 0019](0019-api-skeleton-details.md), decision 5:** the push hook's tests moved to Vitest in PH-03, and the ESLint exception for node:test is gone.`

- [ ] **Step 3: Update the architecture and the stack overview**

`docs/architecture/architecture.md`:
- In 1, the monorepo paragraph: packages are named `@szop/api`, `@szop/web`, `@szop/shared`; imports keep their `.ts` extension ([ADR 0019](../decisions/0019-api-skeleton-details.md), decisions 6 and 7).
- In 2, *Code structure*: a short paragraph on assembly: `buildApp(deps)` in `app.ts` creates Fastify and registers each feature's routes as a plugin under `/api`, passing the services it needs as plugin options; no decorators for dependencies ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 1). `server.ts` is the entry point: it reads the configuration, calls `buildApp`, listens, and on SIGINT or SIGTERM closes the app so requests in flight finish.
- In 4, *Cross-cutting*: **Configuration** gains: every variable is required, with no defaults; locally `apps/api/.env` (from `.env.example`, git-ignored) loaded by Node's `--env-file`; the error names each bad variable, never its value. **Logging** gains: Fastify logs each request (`incoming request`, `request completed`, with a request ID); in development the output is piped through pino-pretty, the app itself always writes JSON.

`docs/architecture/stack-overview.md`, in section 6 after the request-lifecycle paragraph, a paragraph **"How Szop's API is put together"**: a Fastify *instance* is the app; a *plugin* is a function receiving the instance (and options) that adds routes or hooks; *encapsulation* means what a plugin adds stays inside it unless it says otherwise; `buildApp` is a factory that creates the instance and registers the plugins, which is how tests get the same app with fakes; `inject()` runs a fake HTTP request through the whole app without a network. And in section 11 (the monorepo), one or two sentences: `apps/api` is the first package; the `@szop/` scope; `pnpm -r` runs a script in each package; Vitest runs every package's tests from the root. Link [ADR 0019](../decisions/0019-api-skeleton-details.md) and [testing](../development/testing.md).

- [ ] **Step 4: Update `ci-cd.md`, the glossary and the README**

- `docs/development/ci-cd.md`, the `test` row of the jobs table: `The tests: every Vitest project (pnpm test:coverage), with Vitest's test report and a coverage table in the job summary` and the local script `pnpm test` (or `pnpm test:coverage`). In *Reading a failed run*, a line: the job summary (the run's *Summary* page) lists the failed tests and the coverage.
- `docs/glossary.md`: under `## Acronyms`, alphabetically, **SIGINT** and **SIGTERM** (signals: interrupt, sent by Ctrl+C; terminate, sent by tsx on a restart and by ECS when it stops a task; the API closes gracefully on both). Under `## Terms`: **Encapsulation (Fastify)**, **Graceful shutdown**, **Job summary**, **Plugin (Fastify)**, **Test coverage**, **Vitest project**, each one or two sentences in the existing style. Check first that none exists already (`grep -n "^| \*\*<term>" docs/glossary.md`).
- `README.md`, the *Development* section, a second paragraph: `pnpm dev` starts the API (after copying `apps/api/.env.example` to `apps/api/.env`), `pnpm test` runs every test; link [testing](docs/development/testing.md).

- [ ] **Step 5: Update the open points**

In `docs/open-points.md`:
- **OP-010:** the PH-03 part gets `✅ Done (PR link)` (the PR number is known in [After tasks 1–7](#after-tasks-17-open-the-pr); until then link the branch); the status goes back to `⬜ Open`; the entry moves under `### PH-05 SPA skeleton`, and PH-03's group keeps no copy.
- **OP-012** and **OP-013:** the same, moving under `### PH-04 Database`.
- **OP-062** and **OP-065:** the PH-03 part (OP-062) is done; both move to `## Closed`, status `✅ Closed`, with a link to the PR and, for OP-062, to [ADR 0019](decisions/0019-api-skeleton-details.md).
- **OP-067:** ask the owner whether the Dependabot check has happened. If not, move it under `### PH-04 Database` unchanged.
- New, under `### PH-15 Seed catalog, read-only`: `#### OP-071` **Add the JSON error shape and a not-found handler.** The architecture's error shape (`{ "error": { "code", "message" } }`, [architecture, Errors](architecture/architecture.md#errors)) for validation errors, unknown routes and unexpected errors, with `setErrorHandler` and `setNotFoundHandler`, when the first route that can fail arrives; until then unknown routes return Fastify's default 404 body. Source: the [PH-03 spec](superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md#out-of-scope). Status ⬜ Open.
- New, under `### PH-12 First deploy`: `#### OP-072` **Quieten the health route's request logs.** The load balancer calls `GET /api/health` every few seconds, which would fill CloudWatch with two lines per check; for example, the route's `logLevel` set to `warn`. Source: the [PH-03 spec](superpowers/specs/2026-10-05-PH-03-api-skeleton-design.md#out-of-scope). Status ⬜ Open.
- Keep `## Contents` in sync if it lists entries.

- [ ] **Step 6: Update the roadmap**

`docs/roadmap.md`, PH-03's row already links the spec and the plan (the plan's own commit added it). Check that it still reads `🚧 In progress`; the README diagram stays as it is (◐) until the PR sets ✅ ([After tasks 1–7](#after-tasks-17-open-the-pr)). Nothing to commit here if both are right.

- [ ] **Step 7: Verify links and contents**

```bash
for f in docs/decisions/0019-api-skeleton-details.md docs/decisions/000{5,7}-*.md docs/decisions/0016-*.md docs/architecture/architecture.md docs/architecture/stack-overview.md docs/development/ci-cd.md docs/development/testing.md docs/open-points.md docs/roadmap.md README.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
grep -c "^#### OP-07[12]$" docs/open-points.md
```

Expected: `link check done` with no `BROKEN` line, and `2`. Walk through the [definition of done](../../development/definition-of-done.md) and note each item's state for the PR.

- [ ] **Step 8: Commit**

```bash
git add docs/decisions/0019-api-skeleton-details.md docs/decisions/0005-development-environment.md docs/decisions/0007-testing-strategy.md docs/decisions/0016-toolchain-details.md docs/architecture/architecture.md docs/architecture/stack-overview.md docs/development/ci-cd.md docs/glossary.md README.md docs/open-points.md docs/roadmap.md docs/superpowers/plans/2026-10-05-PH-03-api-skeleton.md
git commit -F - <<'EOF'
docs(adr): add ADR 0019 and update the living docs for PH-03

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014eEZKtPSDhj66gViQinsbL
EOF
```

---

## After tasks 1–7: open the PR

Only when the owner says so, after reviewing Task 7.

1. Run every check once more: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
2. Open the PR with `gh pr create`: title `feat(api): add the API skeleton`; the body fills `.github/pull_request_template.md`, with *How it was tested* holding the outputs recorded in Task 5, steps 4–6, and the definition of done: item 1 (tests) ✅; item 2 ➖ N/A: no domain rules in `packages/shared`; item 3 after CI; item 4 ➖ N/A: there is no demo environment until PH-12; item 5 ➖ N/A: no `infra/base`; items 6–10 ✅; item 11 ➖ N/A: no UI.
3. Then, in one commit (`docs(roadmap): mark PH-03 done`): the PR link in PH-03's roadmap row and in the open points that pointed at the branch; the row set to `✅ Done`; the README diagram's PH-03 marker `◐` → `●`, with the road travelled ending at PH-03 ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green, and that the `test` job's summary shows Vitest's report and the coverage table. Link the run in the PR.
5. Stop. The owner reviews and merges.
