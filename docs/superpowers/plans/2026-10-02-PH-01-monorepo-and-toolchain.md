# PH-01 Monorepo and toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the documentation-only repository into a pnpm workspace in strict TypeScript, with ESLint, Prettier, husky, lint-staged and commitlint checking every commit, and the Claude Code push hook moved to TypeScript under that toolchain.

**Architecture:** Root-only workspace: configuration files at the repository root, no packages yet (`apps/*` and `packages/*` arrive in later phases). The only code is the Claude Code push hook in `.claude/hooks/`, which Node 24 runs directly by stripping its types, with no dependencies.

**Tech Stack:** Node 24 (nvm), pnpm 12.8.1, TypeScript 6.0, ESLint 10 with typescript-eslint 8 (`strictTypeChecked`), Prettier 3, husky 9, lint-staged 17, commitlint 21, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-PH-01-monorepo-and-toolchain-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Findings since the spec](#findings-since-the-spec)
- [Tool page template](#tool-page-template)
- [Task 1: Root workspace, Node and pnpm](#task-1-root-workspace-node-and-pnpm)
- [Task 2: TypeScript and the push hook in TypeScript](#task-2-typescript-and-the-push-hook-in-typescript)
- [Task 3: ESLint](#task-3-eslint)
- [Task 4: Prettier](#task-4-prettier)
- [Task 5: husky and lint-staged](#task-5-husky-and-lint-staged)
- [Task 6: commitlint](#task-6-commitlint)
- [Task 7: VS Code settings](#task-7-vs-code-settings)
- [Task 8: Setup guide, records and wrap-up](#task-8-setup-guide-records-and-wrap-up)
- [After the tasks](#after-the-tasks)

## Global Constraints

- Branch `feat/monorepo-toolchain`, already created; never commit to `main`; no worktree (CLAUDE.md, git workflow).
- Node: `engines.node` is `>=24 <25`; `.nvmrc` is `24`.
- pnpm: `packageManager` is `pnpm@12.8.1`; root dev dependencies are added with `pnpm add -D -w` (pnpm refuses to add to the workspace root without `-w`).
- **TypeScript is pinned to `~6.0.3`, not 7.** typescript-eslint 8.71 supports `typescript >=4.8.4 <6.1.0`; TypeScript 7 (the native port) is not supported yet. `@types/node` is `^24`, matching Node 24.
- `allowBuilds: {}` in `pnpm-workspace.yaml`: no dependency runs install scripts. If an install fails with `ERR_PNPM_IGNORED_BUILDS`, stop and ask the owner; never run `pnpm approve-builds` on your own ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- ESM everywhere: `"type": "module"`; configs are `.js` ES modules.
- Prettier uses its defaults (`{}`); **Markdown is never formatted by Prettier** (`*.md` in `.prettierignore`).
- **The push hook imports only `node:` modules** and must keep running with plain `node`, before `pnpm install`.
- Commit messages follow Conventional Commits with ADR 0009's nine types. Tooling tasks use `build: …`, docs-only commits `docs: …` or `docs(<scope>): …`. Every commit ends with the trailers:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines.
- Do not work around `.claude/settings.json`'s deny rules or the push hook.

## Review Focus

Failure modes the spec implies that ordinary runs would not exercise; each has its check in the owning task.

1. **A fresh clone before `pnpm install`:** the push hook must still run and block, since Claude Code calls it on every shell command. Check: Task 2, step 9 (tests run with `node_modules` moved away).
2. **The wrong Node major:** `pnpm install` must refuse it. pnpm skips the check when `node_modules` is up to date, so the check deletes `node_modules` first. Check: Task 1, step 7.
3. **A commit that stages only Markdown:** the pre-commit hook must pass and leave the file untouched. Check: Task 5, step 9.
4. **A commit with our trailers and a long `Claude-Session` link,** and a commit merging `main` into the branch: commitlint must accept both. Check: Task 6, step 5.
5. **A `.tsx` or `.mjs` file staged in a later phase:** lint-staged must lint it without a config change. Check: Task 5, step 10 (an `.mjs` file is linted on commit).

## Findings since the spec

A prototype of every config in a scratch copy (outside the repository) confirmed the design and turned up these details. ADR 0016 records them.

- **pnpm 12 calls the install-script setting `allowBuilds`** (a map in `pnpm-workspace.yaml`, `name: true|false`), and **fails the install** (`ERR_PNPM_IGNORED_BUILDS`) when a dependency's build script is neither allowed nor denied. None of this phase's dependencies has one.
- **pnpm's version switching works:** pnpm 11.28.2 and 12.7.0 both ran the pinned 12.8.1.
- **`engineStrict: true` is needed:** without it, pnpm 12 installed with an unsupported Node.
- **TypeScript 6.0, not 7** (see Global Constraints). TypeScript 6 no longer adds `@types/*` automatically, so the root tsconfig lists `"types": ["node"]`.
- **The `.js` configs need nothing extra for type-aware linting:** `projectService` finds them through the root tsconfig's `include`.
- **`node:test`'s `test()` returns a promise,** which `no-floating-promises` flags. typescript-eslint's documented fix is the rule's `allowForKnownSafeCalls` option for `node:test`, scoped to the hook's test file; it goes away with Vitest in PH-03.
- **No HTML mockups exist** in `docs/architecture/visual-design/` (only PNG and SVG files, which Prettier does not format), so `.prettierignore` does not list that folder. ESLint ignores `.superpowers/` (the brainstorm companion's untracked files).
- **The scope list gains `e2e`**, which `git-workflow.md` already names.

## Tool page template

Every page in `docs/development/tools/` follows this shape ([ADR 0005](../../decisions/0005-development-environment.md), decision 15). Pages stay under 100 lines, so they need no Contents section.

```markdown
# <Tool>

<One sentence: what it is and what it does for Szop.>

## Why Szop uses it

<The reason, and the alternatives that were considered, linking the ADR decision.>

## Configuration

<Each file the tool owns, as a subsection or a list item: where it lives, and every setting in it explained in one line each.>

## Everyday use

<The commands a developer runs, in a fenced block, each with a one-line explanation. Common problems and their fixes, if any.>

## Official documentation

- <Links to the official docs pages that matter.>
```

---

### Task 1: Root workspace, Node and pnpm

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (generated), `.nvmrc`, `.gitattributes`
- Modify: `.gitignore`
- Create: `docs/development/tools/node-and-nvm.md`, `docs/development/tools/pnpm.md`

**Interfaces:**
- Produces: `package.json` with `"type": "module"`, `engines`, `packageManager` and an empty `scripts` object that later tasks extend; `pnpm-workspace.yaml` with the settings below.

- [ ] **Step 1: Ask the owner before installing pnpm globally**

`npm install -g pnpm` changes the owner's machine (the global packages of the current Node version). Ask: "Task 1 installs pnpm globally with `npm install -g pnpm`, as `setup.md` will tell you to. OK to run it, or do you want to run it yourself (`! npm install -g pnpm`)?" Wait for the answer.

- [ ] **Step 2: Install pnpm and check the Node version**

Run: `npm install -g pnpm && pnpm --version && node --version`
Expected: a pnpm version (any 10.x or later) and `v24.x.y`.

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "szop",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24 <25"
  },
  "packageManager": "pnpm@12.8.1",
  "scripts": {}
}
```

- [ ] **Step 4: Write `pnpm-workspace.yaml`, `.nvmrc` and `.gitattributes`**

`pnpm-workspace.yaml`:

```yaml
# The workspace packages. None exist yet: apps/api arrives in PH-03,
# apps/web in PH-05, packages/shared with the first shared code.
packages:
  - apps/*
  - packages/*

# Refuse to install with a Node version outside package.json's engines.
engineStrict: true

# Dependencies allowed to run install scripts: none (ADR 0012, decision 18).
# pnpm 12 fails the install when a dependency with a build script is not
# listed here; the owner then decides between true and false.
allowBuilds: {}
```

`.nvmrc`:

```
24
```

`.gitattributes`:

```
# Store and check out text files with LF line endings, whatever the OS.
* text=auto eol=lf

# Images are binary: never convert their line endings.
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.webp binary
```

- [ ] **Step 5: Add `node_modules/` to `.gitignore`**

Append to `.gitignore`:

```

# Dependencies installed by pnpm
node_modules/
```

- [ ] **Step 6: Install and check that pnpm switched to the pinned version**

Run: `pnpm install && pnpm --version`
Expected: install succeeds and creates `pnpm-lock.yaml`; the version printed is `12.8.1`, whatever the global version was.

- [ ] **Step 7: Check that the wrong Node major is refused**

Run:

```bash
sed -i 's/">=24 <25"/">=25"/' package.json && rm -rf node_modules && pnpm install; echo "exit $?"
git checkout package.json && rm -rf node_modules && pnpm install
```

Expected: the first install fails with `Unsupported engine … wanted: {"node":">=25"}` and a non-zero exit; after restoring, the install succeeds.

- [ ] **Step 8: Check that `.gitattributes` changed no file**

Run: `git add --renormalize . && git status --short`
Expected: only the new and modified files of this task are listed; no existing file shows as modified by renormalizing.

- [ ] **Step 9: Write `docs/development/tools/node-and-nvm.md`**

Follow the [tool page template](#tool-page-template). It must say:
- Node is the JavaScript runtime for the API, the tools and the push hook; nvm installs and switches Node versions per user, without `sudo`.
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decision 3 (nvm, the current LTS, Node 24); the alternatives fnm, Volta and mise.
- Configuration: `.nvmrc` (`24`: the major only; `nvm install` and `nvm use` pick the latest 24.x; CI's setup-node reads the same file from PH-02); `engines.node` in `package.json` (`>=24 <25`), enforced by pnpm's `engineStrict`.
- Everyday use: `nvm install`, `nvm use`, `node --version`; Node 24 runs `.ts` files directly by stripping types (the push hook), with a link to the glossary's "Type stripping".
- Official docs: nvm's README (`https://github.com/nvm-sh/nvm`), Node's release schedule (`https://nodejs.org/en/about/previous-releases`), Node's TypeScript page (`https://nodejs.org/api/typescript.html`).

- [ ] **Step 10: Write `docs/development/tools/pnpm.md`**

Follow the template. It must say:
- pnpm installs the dependencies and runs scripts across the workspace; strict about **phantom dependencies** (link the glossary).
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decisions 5 and 6 (pnpm workspaces, no task runner); how pnpm is installed and why (`npm install -g pnpm` once per Node version, then pnpm switches itself to `packageManager`; Corepack is experimental and no longer bundled from Node 25; the standalone installer pipes a script into the shell), [ADR 0016](../../decisions/0016-toolchain-details.md).
- Configuration: `packageManager` in `package.json`; `pnpm-workspace.yaml` line by line (`packages`, `engineStrict`, `allowBuilds` and what `ERR_PNPM_IGNORED_BUILDS` means: a dependency wants to run a build script; the owner decides, [ADR 0012](../../decisions/0012-security-baseline.md), decision 18); `pnpm-lock.yaml` (committed, never edited by hand).
- Everyday use: `pnpm install`, `pnpm add -D -w <pkg>` (why `-w`), `pnpm <script>`, `pnpm exec <bin>`, `pnpm -r <script>` and `pnpm --filter <pkg> <script>` once packages exist; "Already up to date" skips lifecycle scripts and engine checks, so `rm -rf node_modules && pnpm install` forces a full install.
- Official docs: `https://pnpm.io/motivation`, `https://pnpm.io/workspaces`, `https://pnpm.io/settings`, `https://pnpm.io/cli/approve-builds`.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc .gitattributes .gitignore docs/development/tools/node-and-nvm.md docs/development/tools/pnpm.md
git commit -F - <<'EOF'
build: add the root pnpm workspace

Node 24 and pnpm 12.8.1 pinned, no dependency install scripts allowed,
LF line endings enforced.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

---

### Task 2: TypeScript and the push hook in TypeScript

**Files:**
- Create: `tsconfig.base.json`, `tsconfig.json`
- Rename: `.claude/hooks/guard-git-push.mjs` → `.claude/hooks/guard-git-push.ts`; `.claude/hooks/guard-git-push.test.mjs` → `.claude/hooks/guard-git-push.test.ts`
- Modify: `.claude/settings.json` (the hook command), `package.json` (scripts, dev dependencies), `docs/development/git-workflow.md` (the hook's path)
- Create: `docs/development/tools/typescript.md`

**Interfaces:**
- Consumes: `package.json` from Task 1.
- Produces: `findViolation(command: string): string | null` exported from `.claude/hooks/guard-git-push.ts`; scripts `typecheck` (`tsc --noEmit`) and `test` (`node --test ".claude/hooks/*.test.ts"`); `tsconfig.json` whose `include` covers `*.js` and `.claude/hooks/**/*.ts` (Task 3's type-aware linting relies on it).

- [ ] **Step 1: Add TypeScript and Node's types**

Run: `pnpm add -D -w typescript@~6.0.3 @types/node@^24`
Expected: both added to `devDependencies`; no `ERR_PNPM_IGNORED_BUILDS`.

- [ ] **Step 2: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2024",
    "lib": ["es2024"],
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "checkJs": true,
    "types": ["node"]
  },
  "include": ["*.js", ".claude/hooks/**/*.ts"]
}
```

- [ ] **Step 4: Add the scripts**

In `package.json`, set `"scripts"` to:

```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node --test \".claude/hooks/*.test.ts\""
  },
```

- [ ] **Step 5: Rename the test and write its TypeScript version**

Run: `git mv .claude/hooks/guard-git-push.test.mjs .claude/hooks/guard-git-push.test.ts`

Replace the file's content with:

```ts
// Tests for guard-git-push.ts. Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findViolation } from "./guard-git-push.ts";

const allowed: string[] = [
  "git push",
  "git push -u origin feat/shopping-lists",
  "git push --set-upstream origin docs/adr-0015",
  "git push origin HEAD",
  "git push origin feat/a:feat/a",
  "git push -n -h",
  "git push -o ci.skip origin feat/x",
  "git push --no-force-with-lease origin feat/x",
  "git status && git log -1",
  "git pull --prune",
  "git fetch -f",
  'echo "git push -f"',
  "ls -d dir",
];

const blocked: [command: string, reason: string][] = [
  ["git push -f", "force"],
  ["git push --force origin feat/x", "force"],
  ["git push --force-with-lease origin feat/x", "force"],
  ["git push -uf origin feat/x", "force"],
  ["git push origin +feat/x", "force"],
  ['git push origin "+HEAD:feat/x"', "force"],
  ["git push --mirror origin", "mirror"],
  ["git push -d origin feat/x", "delete"],
  ["git push -ud origin feat/x", "delete"],
  ["git push --delete origin feat/x", "delete"],
  ["git push origin :feat/x", "delete"],
  ["git push --prune origin", "prune"],
  ["git push --tags", "tags"],
  ["git push --follow-tags origin feat/x", "tags"],
  ["git -C . push -f", "force"],
  ["git -c push.default=current push --force", "force"],
  ["GIT_TRACE=1 git push -f", "force"],
  ["git status && git push -f", "force"],
  ["git add . ; git push origin :feat/x", "delete"],
  ["true || git push --tags", "tags"],
  ["git push -- origin :feat/x", "delete"],
];

for (const command of allowed) {
  test(`allows: ${command}`, () => {
    assert.equal(findViolation(command), null);
  });
}

for (const [command, reason] of blocked) {
  test(`blocks: ${command}`, () => {
    assert.match(findViolation(command) ?? "", new RegExp(reason));
  });
}

const script = fileURLToPath(new URL("./guard-git-push.ts", import.meta.url));
const runHook = (command: string) =>
  spawnSync("node", [script], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });

test("hook exits 2 with the reason on stderr for a blocked push", () => {
  const result = runHook("git push -uf origin feat/x");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /force/);
});

test("hook exits 0 for an allowed command", () => {
  const result = runHook("git push -u origin feat/x");
  assert.equal(result.status, 0);
});
```

- [ ] **Step 6: Run the tests to see them fail**

Run: `pnpm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `guard-git-push.ts` (the hook is still `.mjs`).

- [ ] **Step 7: Rename the hook and write its TypeScript version**

Run: `git mv .claude/hooks/guard-git-push.mjs .claude/hooks/guard-git-push.ts`

Replace the file's content with:

```ts
// Claude Code PreToolUse hook: refuses git pushes that force, delete or push tags.
//
// It backs the deny rules in .claude/settings.json where a pattern cannot reach:
// a `+branch` or `:branch` refspec, bundled short flags (`-uf`, `-ud`), `--mirror`,
// `--prune`, `--follow-tags` and `git -C dir push`. Like the deny rules, it guards
// against mistakes, not against a determined attacker; GitHub's rulesets are the
// real boundary. ADR 0015 (docs/decisions/0015-git-push-guard-hook.md).
//
// Input: the tool call as JSON on stdin. Exit 2 blocks the command and shows
// stderr to Claude; exit 0 leaves the decision to the permission rules.
//
// It imports only node: modules, so it runs before `pnpm install`, and Node runs
// it directly by stripping the types (ADR 0016).

import { readFileSync } from "node:fs";

interface HookInput {
  tool_input?: { command?: string };
}

// git's own options that take their value as the next word (`git -C dir push`).
const GIT_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
]);

// Splits a shell command into segments (at ; & | and newlines) of words,
// honouring quotes. Subshells and expansions are not interpreted.
function parseSegments(command: string): string[][] {
  const segments: string[][] = [];
  let words: string[] = [];
  let word: string | null = null;
  let quote: string | null = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    segments.push(words);
    words = [];
  };
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else word = (word ?? "") + char;
    } else if (char === '"' || char === "'") {
      quote = char;
      word ??= "";
    } else if (";&|\n".includes(char)) {
      endSegment();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word = (word ?? "") + char;
    }
  }
  endSegment();
  return segments;
}

// Returns the words after `push` if the segment runs `git push`, otherwise null.
function pushArguments(words: string[]): string[] | null {
  let i = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i] ?? "")) i++; // VAR=value prefixes
  const git = words[i];
  if (git !== "git" && !git?.endsWith("/git")) return null;
  i++;
  for (let option = words[i]; option?.startsWith("-"); option = words[i]) {
    i += GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
  }
  return words[i] === "push" ? words.slice(i + 1) : null;
}

function checkPushArguments(args: string[]): string | null {
  let optionsEnded = false;
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
    } else if (optionsEnded || !arg.startsWith("-")) {
      if (arg.startsWith("+")) return `a "${arg}" refspec force-pushes`;
      if (arg.startsWith(":"))
        return `a "${arg}" refspec deletes a remote branch`;
    } else if (arg === "--") {
      optionsEnded = true;
    } else if (arg.startsWith("--")) {
      const name = arg.split("=")[0] ?? arg;
      if (name.startsWith("--force")) return `${name} force-pushes`;
      if (name === "--mirror")
        return "--mirror can force-push and delete remote branches";
      if (name === "--delete") return "--delete deletes a remote branch";
      if (name === "--prune") return "--prune deletes remote branches";
      if (name === "--tags" || name === "--follow-tags")
        return `${name} pushes tags`;
    } else {
      // A group of short flags, such as -uf. -o takes a value: the rest of the
      // group, or the next word.
      const flags = arg.slice(1);
      for (let j = 0; j < flags.length; j++) {
        const flag = flags.charAt(j);
        if (flag === "f") return `${arg} force-pushes`;
        if (flag === "d") return `${arg} deletes a remote branch`;
        if (flag === "o") {
          skipNext = j === flags.length - 1;
          break;
        }
      }
    }
  }
  return null;
}

// Returns why the command is refused, or null if it is allowed.
export function findViolation(command: string): string | null {
  for (const words of parseSegments(command)) {
    const args = pushArguments(words);
    const violation = args && checkPushArguments(args);
    if (violation) return violation;
  }
  return null;
}

if (import.meta.main) {
  const input = JSON.parse(readFileSync(0, "utf8")) as HookInput;
  const violation = findViolation(input.tool_input?.command ?? "");
  if (violation) {
    console.error(
      `Blocked by .claude/hooks/guard-git-push.ts: ${violation} (ADR 0012, decision 19; ADR 0015). ` +
        "Ask the owner to run it if it is really needed.",
    );
    process.exit(2);
  }
}
```

- [ ] **Step 8: Point Claude Code at the `.ts` hook**

In `.claude/settings.json`, change the hook's command to:

```json
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-git-push.ts"
```

In `docs/development/git-workflow.md`, replace `.claude/hooks/guard-git-push.mjs` with `.claude/hooks/guard-git-push.ts` (the guardrails table).

- [ ] **Step 9: Run the tests and the type check**

Run: `pnpm test && pnpm typecheck`
Expected: `ℹ pass 36`, `ℹ fail 0`; `tsc --noEmit` prints nothing and exits 0.

Then the fresh-clone case (Review Focus 1):

```bash
mv node_modules ../szop-node_modules.off && node --test ".claude/hooks/*.test.ts"; mv ../szop-node_modules.off node_modules
```

Expected: `ℹ pass 36` without `node_modules`.

- [ ] **Step 10: Check that a type error fails**

Run:

```bash
printf 'export const n: number = "x";\n' > .claude/hooks/scratch-type-error.ts && pnpm typecheck; echo "exit $?"; rm .claude/hooks/scratch-type-error.ts
```

Expected: `error TS2322: Type 'string' is not assignable to type 'number'` and a non-zero exit.

- [ ] **Step 11: Check the live hook in Claude Code**

Run each as its own Bash call (they only print usage; the hook must refuse them first):
- `git push -h :x` → refused by the hook, naming `guard-git-push.ts`
- `git push -uf -h` → refused by the hook
- `git push -h` → prints `usage: git push …`

If Claude Code has not reloaded the settings, ask the owner to restart the session and retry.

- [ ] **Step 12: Write `docs/development/tools/typescript.md`**

Follow the template. It must say:
- TypeScript adds static types to JavaScript; `tsc` checks them, other tools (tsx, Vite, Node's type stripping) run the code.
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decisions 7–9; why version 6.0 and not 7 (typescript-eslint support, [ADR 0016](../../decisions/0016-toolchain-details.md), OP-064).
- Configuration: `tsconfig.base.json`, every option in one line (`strict`, `noUncheckedIndexedAccess` with an example `arr[0]` being `T | undefined`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `module`/`moduleResolution` `nodenext`, `target`/`lib` `es2024`, `skipLibCheck`); why `exactOptionalPropertyTypes` is off; `tsconfig.json` (the root's own files: `noEmit`, `erasableSyntaxOnly`, `allowImportingTsExtensions`, `allowJs`/`checkJs`, `types: ["node"]`, `include`); packages will extend the base from PH-03.
- Everyday use: `pnpm typecheck`; running a single `.ts` file with `node file.ts`; why imports name `.ts` files.
- Official docs: `https://www.typescriptlang.org/tsconfig/`, `https://www.typescriptlang.org/docs/handbook/modules/reference.html`, `https://nodejs.org/api/typescript.html`.

- [ ] **Step 13: Commit**

```bash
git add tsconfig.base.json tsconfig.json package.json pnpm-lock.yaml .claude docs/development/git-workflow.md docs/development/tools/typescript.md
git commit -F - <<'EOF'
build: add strict TypeScript and move the push hook to it

Node 24 runs the hook directly by stripping its types, so it keeps no
build step and no dependencies.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

---

### Task 3: ESLint

**Files:**
- Create: `eslint.config.js`, `docs/development/tools/eslint.md`
- Modify: `package.json` (script, dev dependencies)

**Interfaces:**
- Consumes: `tsconfig.json` from Task 2 (`projectService` finds each file's tsconfig through its `include`).
- Produces: script `lint` (`eslint .`), used by Task 5's lint-staged config and by CI in PH-02.

- [ ] **Step 1: Add ESLint and its configs**

Run: `pnpm add -D -w eslint@^10 @eslint/js@^10 typescript-eslint@^8.71 eslint-config-prettier@^10`
Expected: added; a peer-dependency warning about `typescript` must not appear (TypeScript 6.0.3 is in range).

- [ ] **Step 2: Write `eslint.config.js`**

```js
// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files.
  globalIgnores(["docs/", ".superpowers/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Lint each file with the tsconfig that includes it.
        projectService: true,
      },
    },
  },
  {
    // node:test's test() returns a promise the runner itself awaits.
    // Goes away when the tests move to Vitest in PH-03 (OP-062).
    files: [".claude/hooks/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test"] },
          ],
        },
      ],
    },
  },
  // Last: turns off the rules that would fight Prettier.
  prettier,
);
```

- [ ] **Step 3: Add the script**

In `package.json` `"scripts"`, add as the first entry:

```json
    "lint": "eslint .",
```

- [ ] **Step 4: Run the linter**

Run: `pnpm lint`
Expected: no output from ESLint, exit 0. If it reports findings in the hook or the configs, fix the code (do not disable rules) and rerun; note each fix in the commit body.

- [ ] **Step 5: Check that a floating promise fails**

Run:

```bash
printf 'async function f(): Promise<void> {}\nf();\n' > .claude/hooks/scratch-floating.ts && pnpm lint; echo "exit $?"; rm .claude/hooks/scratch-floating.ts
```

Expected: `@typescript-eslint/no-floating-promises` reported and a non-zero exit.

- [ ] **Step 6: Write `docs/development/tools/eslint.md`**

Follow the template. It must say:
- ESLint finds bugs and bad patterns without running the code; with typescript-eslint it uses type information (a **type-aware** rule such as `no-floating-promises` knows a call returns a promise).
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decision 12 (ESLint and Prettier rather than Biome); `strictTypeChecked` rather than `recommendedTypeChecked` or adding `stylisticTypeChecked`, [ADR 0016](../../decisions/0016-toolchain-details.md).
- Configuration: `eslint.config.js` block by block, as **flat config** (link the glossary): the ignores, `js.configs.recommended`, `strictTypeChecked`, `projectService`, the `node:test` exception and when it goes, `eslint-config-prettier` last. The React Hooks rules come with `apps/web` in PH-05.
- Everyday use: `pnpm lint`, `pnpm exec eslint --fix <file>`; reading a rule's name and looking it up; disabling a rule for one line with a reason, as a last resort.
- Official docs: `https://eslint.org/docs/latest/use/configure/configuration-files`, `https://typescript-eslint.io/getting-started/typed-linting`, `https://typescript-eslint.io/users/configs#strict-type-checked`.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js package.json pnpm-lock.yaml docs/development/tools/eslint.md
git commit -F - <<'EOF'
build: add ESLint with type-aware strict rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

---

### Task 4: Prettier

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`, `docs/development/tools/prettier.md`
- Modify: `package.json` (script, dev dependency); any code or config file Prettier reformats

**Interfaces:**
- Produces: script `format` (`prettier --write .`); `.prettierignore` honoured by Task 5's lint-staged config and by the editor (Task 7).

- [ ] **Step 1: Add Prettier**

Run: `pnpm add -D -w prettier@^3`

- [ ] **Step 2: Write `.prettierrc.json` and `.prettierignore`**

`.prettierrc.json`:

```json
{}
```

`.prettierignore`:

```
# Markdown keeps its hand-made formatting: Prettier pads every table to its
# widest cell, which bloats the docs and rewrites whole tables in diffs (ADR 0016).
*.md

# Generated by pnpm.
pnpm-lock.yaml
```

- [ ] **Step 3: Add the script**

In `package.json` `"scripts"`, add after `lint`:

```json
    "format": "prettier --write .",
```

- [ ] **Step 4: Format and check**

Run: `pnpm format && pnpm exec prettier --check .`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 5: Check that no Markdown file changed and everything still passes**

Run: `git status --short -- '*.md' && pnpm lint && pnpm typecheck && pnpm test`
Expected: the first command lists nothing (no Markdown file was reformatted); lint, typecheck and tests pass.

- [ ] **Step 6: Write `docs/development/tools/prettier.md`**

Follow the template. It must say:
- Prettier rewrites code into one consistent layout, so formatting is never discussed in review.
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decision 12; the defaults rather than custom options (Prettier's own option philosophy, `https://prettier.io/docs/option-philosophy`); **Markdown excluded**, with the reason (the table padding: the glossary would grow from 39 KB to 93 KB and one long cell rewrites the whole table in a diff) and OP-063, [ADR 0016](../../decisions/0016-toolchain-details.md).
- Configuration: `.prettierrc.json` (`{}`: double quotes, 80 columns, trailing commas), `.prettierignore` line by line; Prettier also skips what `.gitignore` lists; `eslint-config-prettier` (in `eslint.config.js`) keeps ESLint from fighting it. The Tailwind class-sorting plugin arrives in PH-14.
- Everyday use: `pnpm format`, `pnpm exec prettier --check .`; format on save in VS Code (Task 7); the pre-commit hook formats staged files (Task 5).
- Official docs: `https://prettier.io/docs/configuration`, `https://prettier.io/docs/ignore`, `https://prettier.io/docs/integrating-with-linters`.

- [ ] **Step 7: Commit**

```bash
git add -A
git status --short
git commit -F - <<'EOF'
build: add Prettier for code and configs

Markdown is left out: Prettier pads every table to its widest cell.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

Check the `git status --short` output before committing: only `.prettierrc.json`, `.prettierignore`, `package.json`, `pnpm-lock.yaml`, `prettier.md` and files Prettier reformatted.

---

### Task 5: husky and lint-staged

**Files:**
- Create: `.husky/pre-commit`, `lint-staged.config.js`, `docs/development/tools/husky-and-lint-staged.md`
- Modify: `package.json` (script, dev dependencies)

**Interfaces:**
- Consumes: `eslint` (Task 3) and `prettier` with `.prettierignore` (Task 4).
- Produces: script `prepare` (`husky`), which sets `core.hooksPath` to `.husky/_` on every full `pnpm install`; `.husky/` where Task 6 adds `commit-msg`.

- [ ] **Step 1: Add husky and lint-staged**

Run: `pnpm add -D -w husky@^9 lint-staged@^17`

- [ ] **Step 2: Add the `prepare` script and run it**

In `package.json` `"scripts"`, add as the last entry:

```json
    "prepare": "husky"
```

Run: `pnpm run prepare && git config core.hooksPath`
Expected: `.husky/_`

- [ ] **Step 3: Write `.husky/pre-commit`**

```sh
pnpm exec lint-staged
```

- [ ] **Step 4: Write `lint-staged.config.js`**

```js
// Runs on the staged files of every commit (the pre-commit hook in .husky/).
export default {
  // Every file type ESLint lints, so a new type (such as .tsx) is covered
  // without anyone remembering to add it here.
  "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0",
    "prettier --write",
  ],
  // Everything else Prettier knows. It honours .prettierignore (Markdown).
  "!(*.{ts,tsx,mts,cts,js,jsx,mjs,cjs})": "prettier --write --ignore-unknown",
};
```

Run: `pnpm lint && pnpm exec prettier --check .`
Expected: both pass (the new config is linted and formatted too).

- [ ] **Step 5: Write `docs/development/tools/husky-and-lint-staged.md`**

Follow the template. It must say:
- husky installs **git hooks** (link the glossary) from the repository; lint-staged runs commands on the staged files only.
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decision 13 (Claude edits files outside the editor, so a hook catches every commit; lefthook and CI-only considered); type checks and tests stay in CI.
- Configuration: `"prepare": "husky"` and `core.hooksPath`; `.husky/pre-commit` (and `.husky/commit-msg`, added by Task 6, with a forward pointer to the commitlint page); `lint-staged.config.js` line by line, including why the ESLint glob lists every type ESLint lints.
- Everyday use: what happens on `git commit`; a blocked commit (fix and commit again; files the hook reformatted are re-staged automatically); `git commit --no-verify` exists but CI runs the same checks from PH-02, so skipping only delays the failure; after cloning, `pnpm install` sets the hooks up.
- Official docs: `https://typicode.github.io/husky/`, `https://github.com/lint-staged/lint-staged#readme`.

- [ ] **Step 6: Commit (the new pre-commit hook checks this commit)**

```bash
git add .husky/pre-commit lint-staged.config.js package.json pnpm-lock.yaml docs/development/tools/husky-and-lint-staged.md
git commit -F - <<'EOF'
build: format and lint staged files on every commit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

- [ ] **Step 7: Switch to a throwaway branch for the checks**

Run: `git switch -c scratch/hooks-check`

The checks below commit; they happen on this branch, made from the task's commit so the hooks are in place, and deleted in step 11. If a check fails, fix it on the phase branch in a new commit and rerun the checks.

- [ ] **Step 8: Check that a badly formatted file is formatted on commit**

Run:

```bash
printf "export const a = {b:1,c:'x'}\n" > .claude/hooks/scratch-fmt.ts && git add .claude/hooks/scratch-fmt.ts && git commit -q -m "chore: formatting check" && git show HEAD:.claude/hooks/scratch-fmt.ts
```

Expected: the commit succeeds and the committed content is `export const a = { b: 1, c: "x" };`.

Then the lint error:

```bash
printf 'async function f(): Promise<void> {}\nf();\n' > .claude/hooks/scratch-lint.ts && git add .claude/hooks/scratch-lint.ts && git commit -q -m "chore: lint check"; echo "exit $?"; git reset -q HEAD .claude/hooks/scratch-lint.ts; rm .claude/hooks/scratch-lint.ts
```

Expected: `no-floating-promises` reported, `husky - pre-commit script failed`, a non-zero exit, nothing committed.

- [ ] **Step 9: Check that a Markdown-only commit passes untouched (Review Focus 3)**

Run:

```bash
printf '| a | b |\n|---|---|\n| 1 | 2 |\n' > scratch.md && git add scratch.md && git commit -q -m "docs: markdown check" && git show HEAD:scratch.md
```

Expected: the commit succeeds and the table is exactly as written (`|---|---|`, not padded).

- [ ] **Step 10: Check that an `.mjs` file is linted (Review Focus 5)**

Run:

```bash
printf 'const unused = 1;\n' > scratch.mjs && git add scratch.mjs && git commit -q -m "chore: mjs check"; echo "exit $?"; git reset -q HEAD scratch.mjs; rm scratch.mjs
```

Expected: ESLint reports `no-unused-vars` for `scratch.mjs` (or a typed-linting error because the file is outside every tsconfig); either way a non-zero exit and nothing committed. If it is the typed-linting error, note it in the PR description: it means a new file type also needs a tsconfig `include`, which the phase adding it will do.

- [ ] **Step 11: Return to the phase branch and delete the throwaway branch**

Run: `git switch feat/monorepo-toolchain && git branch -D scratch/hooks-check && git status --short`
Expected: back on the phase branch with a clean tree; the scratch branch is gone (it was never pushed).

---

### Task 6: commitlint

**Files:**
- Create: `commitlint.config.js`, `.husky/commit-msg`, `docs/development/tools/commitlint.md`
- Modify: `package.json` (dev dependencies), `docs/development/git-workflow.md` (the scope rule)

**Interfaces:**
- Consumes: husky's `.husky/` from Task 5.
- Produces: the scope allow-list in `commitlint.config.js`, which later PRs extend.

- [ ] **Step 1: Add commitlint**

Run: `pnpm add -D -w @commitlint/cli@^21 @commitlint/config-conventional@^21`

- [ ] **Step 2: Write `commitlint.config.js`**

```js
// Checks every commit message (the commit-msg hook in .husky/).
// Conventional Commits, ADR 0009, decision 9; the scope list, ADR 0016.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Dependabot's bodies and our Claude-Session trailer hold long links.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "test",
        "refactor",
        "perf",
        "build",
        "ci",
        "chore",
      ],
    ],
    // The scope is optional; when given, it must be one of these.
    // A PR that needs a new scope adds it here.
    "scope-enum": [
      2,
      "always",
      [
        // Workspaces and test layers
        "web",
        "api",
        "shared",
        "e2e",
        // Features: one per requirement area
        "accounts",
        "lists",
        "items",
        "ordering",
        "categories",
        "catalog",
        "units",
        "templates",
        "sharing",
        "sync",
        "limits",
        "connectivity",
        // Docs
        "adr",
        "spec",
        "plan",
        "requirements",
        "audit",
        "roadmap",
        // Tooling
        "infra",
        "deps",
        "main",
        "claude",
      ],
    ],
  },
};
```

- [ ] **Step 3: Write `.husky/commit-msg`**

```sh
pnpm exec commitlint --edit "$1"
```

- [ ] **Step 4: Check the rejected messages**

Run each; commitlint reads the message from stdin:

```bash
echo "foo: bar" | pnpm exec commitlint; echo "exit $?"
echo "feat(aip): add health check" | pnpm exec commitlint; echo "exit $?"
echo "Add thing" | pnpm exec commitlint; echo "exit $?"
echo "style: reformat" | pnpm exec commitlint; echo "exit $?"
```

Expected: each fails with a non-zero exit, naming `type-enum`, `scope-enum`, `subject-empty`/`type-empty`, and `type-enum` respectively.

- [ ] **Step 5: Check the accepted messages (Review Focus 4)**

```bash
echo "feat(api): add health check" | pnpm exec commitlint; echo "exit $?"
echo "build: add ESLint" | pnpm exec commitlint; echo "exit $?"
echo "Merge branch 'main' into feat/monorepo-toolchain" | pnpm exec commitlint; echo "exit $?"
printf 'docs(adr): add ADR 0016 toolchain details\n\nWhy, in a body line.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE_padding_to_go_well_past_one_hundred_characters\n' | pnpm exec commitlint; echo "exit $?"
```

Expected: each exits 0.

- [ ] **Step 6: Update the scope rule in `docs/development/git-workflow.md`**

Replace line 70 (it starts with `- **The scope is optional**`) with:

```markdown
- **The scope is optional**, and when given it must be on the allow-list in `commitlint.config.js` ([ADR 0016](../decisions/0016-toolchain-details.md)): a workspace or test layer (`web`, `api`, `shared`, `e2e`), a feature area, one per requirement area (`lists`, `templates`, …), a kind of doc (`adr`, `spec`, `plan`, `requirements`, `audit`, `roadmap`) or tooling (`infra`, `deps`, `main` for release-please, `claude`). A phase's PR title may name its feature area (`feat(templates): add templates`), since the phase spans several workspaces. A PR that needs a new scope adds it to the list.
```

- [ ] **Step 7: Write `docs/development/tools/commitlint.md`**

Follow the template. It must say:
- commitlint checks each commit message against Conventional Commits, in the `commit-msg` hook.
- Why: [ADR 0009](../../decisions/0009-git-workflow.md), decisions 9 and 16; the two preset changes from [OP-009](../../open-points.md#op-009) (long links in bodies and footers; only the nine types); the scope allow-list, [ADR 0016](../../decisions/0016-toolchain-details.md).
- Configuration: `commitlint.config.js` rule by rule; how to add a scope; merge commits are ignored by default; `.husky/commit-msg`.
- Everyday use: what a rejected commit looks like and how to fix it (the message is in `.git/COMMIT_EDITMSG`; `git commit -e -F .git/COMMIT_EDITMSG`); checking a message without committing: `echo "msg" | pnpm exec commitlint`; CI checks every commit of a PR from PH-02.
- Official docs: `https://commitlint.js.org/`, `https://commitlint.js.org/reference/rules.html`, `https://www.conventionalcommits.org/`.

- [ ] **Step 8: Commit (both hooks check this commit)**

```bash
git add commitlint.config.js .husky/commit-msg package.json pnpm-lock.yaml docs/development/git-workflow.md docs/development/tools/commitlint.md
git commit -F - <<'EOF'
build: check commit messages with commitlint

Conventional Commits with ADR 0009's nine types and an allow-list of
scopes; body and footer line lengths unchecked for long links.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

---

### Task 7: VS Code settings

**Files:**
- Create: `.vscode/extensions.json`, `.vscode/settings.json`, `docs/development/tools/vscode.md`

**Interfaces:**
- Consumes: Prettier (Task 4), ESLint (Task 3), TypeScript (Task 2) from `node_modules`.

- [ ] **Step 1: Write `.vscode/extensions.json`**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-azuretools.vscode-containers"
  ]
}
```

- [ ] **Step 2: Write `.vscode/settings.json`**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

- [ ] **Step 3: Check formatting**

Run: `pnpm exec prettier --check .vscode`
Expected: passes.

- [ ] **Step 4: Write `docs/development/tools/vscode.md`**

Follow the template. It must say:
- VS Code is the editor, connected to WSL through the WSL extension; the repository shares its settings and recommended extensions.
- Why: [ADR 0005](../../decisions/0005-development-environment.md), decision 14; no `.editorconfig`, since Prettier covers it.
- Configuration: `.vscode/extensions.json` (each extension: what it does; the WSL extension is installed on the Windows side and is not in the list because it is needed before the repository opens); `.vscode/settings.json` setting by setting; Markdown is not formatted on save because `.prettierignore` lists it. Test tool extensions arrive with the test tools (PH-03, PH-07); Tailwind CSS IntelliSense in PH-14.
- Everyday use: open the repository from WSL with `code .`; accept the recommended extensions; accept "Use Workspace Version" for TypeScript; what format on save and ESLint fixes on save do.
- Official docs: `https://code.visualstudio.com/docs/remote/wsl`, `https://code.visualstudio.com/docs/configure/settings#_workspace-settings`, `https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript`.

- [ ] **Step 5: Commit**

```bash
git add .vscode docs/development/tools/vscode.md
git commit -F - <<'EOF'
build: share the VS Code settings and recommended extensions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

The owner checks in the editor (PR "How it was tested"): the extensions are recommended, saving a `.ts` file formats it and fixes ESLint findings, and the status bar shows the workspace's TypeScript 6.0.

---

### Task 8: Setup guide, records and wrap-up

**Files:**
- Create: `docs/development/setup.md`, `docs/decisions/0016-toolchain-details.md`
- Modify: `README.md`, `CLAUDE.md`, `docs/glossary.md`, `docs/development/phase-walkthrough.md`, `docs/open-points.md`, `docs/roadmap.md`, `docs/decisions/0005-development-environment.md`, `docs/decisions/0007-testing-strategy.md`, `docs/decisions/0009-git-workflow.md`, `docs/decisions/0015-git-push-guard-hook.md`

**Interfaces:**
- Consumes: every file and script of Tasks 1–7; the tool pages' paths.

- [ ] **Step 1: Write `docs/development/setup.md`**

Over 100 lines, so it starts with a `## Contents`. Steps only, each linking its tool page instead of explaining. Sections, in order, with these commands:

1. **Windows: WSL and Ubuntu** — `wsl --install -d Ubuntu` in an administrator PowerShell, restart, create the Linux user. Link: `https://learn.microsoft.com/windows/wsl/install`.
2. **git** — `sudo apt update && sudo apt install -y git`; `git config --global user.name "…"`, `git config --global user.email "…"`; `git config --global core.autocrlf false` (`.gitattributes` handles line endings).
3. **nvm and Node** — the nvm install command from nvm's README (link it, do not copy a version-pinned URL), then in the clone `nvm install` and `nvm use` (reads `.nvmrc`). Link [node-and-nvm.md](tools/node-and-nvm.md).
4. **pnpm** — `npm install -g pnpm`; pnpm switches to the pinned version itself. Link [pnpm.md](tools/pnpm.md).
5. **VS Code** — install on Windows, add the WSL extension, open the repository from WSL with `code .`, accept the recommended extensions. Link [vscode.md](tools/vscode.md).
6. **Clone and install** — `git clone https://github.com/luiki-dev/szop.git`, `cd szop`, `nvm use`, `pnpm install` (also sets up the git hooks).
7. **Check that everything works** — `pnpm lint`, `pnpm typecheck`, `pnpm test`; what success looks like.
8. **What the git hooks do** — two sentences, linking [husky-and-lint-staged.md](tools/husky-and-lint-staged.md) and [commitlint.md](tools/commitlint.md).
9. **Coming later** — Docker Desktop and the database (PH-04), running the app (PH-03).

- [ ] **Step 2: Write `docs/decisions/0016-toolchain-details.md`**

```markdown
# ADR 0016 — Toolchain details

- **Status:** ✅ Accepted
- **Date:** 2026-10-02
- **Refines:** [ADR 0005](0005-development-environment.md), decision 12 (Markdown left out of Prettier); [ADR 0007](0007-testing-strategy.md), decision 18 (`pnpm test` runs Node's test runner until Vitest arrives); [ADR 0009](0009-git-workflow.md), decision 9 (an allow-list of scopes); [ADR 0015](0015-git-push-guard-hook.md), decision 3 (the push hook in TypeScript)

## Context

[ADR 0005](0005-development-environment.md) settled the development environment and left its details to the setup phase, now [PH-01](../roadmap.md#ph-01-monorepo-and-toolchain). Its brainstorm, the [spec](../superpowers/specs/2026-10-02-PH-01-monorepo-and-toolchain-design.md), and a prototype of every configuration settled them. Some refine accepted ADRs; this record holds them all.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | What the workspace holds | Root only; empty shells for `apps/api`, `apps/web` and `packages/shared`; only `packages/shared` | **Root only.** Each package arrives with its first real code (PH-03, PH-05, the first shared code), like `compose.yaml` in PH-04 ([ADR 0014](0014-roadmap.md), decision 7). Shells would be placeholder code rewritten later. |
| 2 | Installing pnpm | `npm install -g pnpm` and pnpm's own version switching; Corepack; pnpm's standalone installer | **`npm install -g pnpm` once per Node version; pnpm then runs the version in `packageManager` by itself** (tried: 11.28.2 and 12.7.0 both ran the pinned 12.8.1). Corepack is still experimental and no longer bundled from Node 25. The standalone installer pipes a script from the internet into the shell. |
| 3 | pnpm's settings | — | **`engineStrict: true` and `allowBuilds: {}` in `pnpm-workspace.yaml`.** Without `engineStrict`, pnpm 12 installed with an unsupported Node. `allowBuilds` is pnpm 12's name for the install-script allowlist ([ADR 0012](0012-security-baseline.md), decision 18): a dependency with a build script must be listed as allowed or denied, or the install fails, and the owner decides. |
| 4 | TypeScript version | 7.0 (the native port); 6.0 | **6.0 (`~6.0.3`), with `@types/node` 24.** typescript-eslint, which type-aware linting needs, supports TypeScript below 6.1 only. Moving to 7 is [OP-064](../open-points.md#op-064). |
| 5 | The push hook's language | TypeScript run by Node's type stripping; JavaScript checked through JSDoc; JavaScript, not type-checked | **TypeScript, run directly by Node 24.** With no packages, it is the only real code, so it is what makes "strict TypeScript" true now. It keeps no build step and no dependencies. ADR 0005, decision 9 turned type stripping down for the API because of workspace imports, which a standalone file does not have. |
| 6 | Running the hook's tests | `pnpm test` runs `node --test` until Vitest arrives; a permanent `pnpm test:hooks` | **`pnpm test` runs Node's test runner until PH-03 moves the tests into Vitest** ([OP-062](../open-points.md#op-062)). `pnpm test` keeps meaning "every test". Until then, ESLint's `no-floating-promises` allows `node:test`'s `test()`, typescript-eslint's documented setting for it. |
| 7 | ESLint strictness | `strictTypeChecked`; `recommendedTypeChecked`; `strictTypeChecked` with `stylisticTypeChecked` | **`strictTypeChecked`.** Beyond bugs, it flags code that is probably wrong. Loosening later is easy, tightening an existing codebase is not. Style is Prettier's job. |
| 8 | Prettier and Markdown | A one-off reformat of all docs; formatting docs when touched; code only | **Code only: `*.md` is in `.prettierignore`.** On a copy of the docs, Prettier padded every table to its widest cell: the glossary grew from 39 KB to 93 KB, each row of ADR 0011's decision table to 2,583 characters, and an edit to one long cell rewrites the whole table in the diff. Prettier cannot turn table alignment off. A Markdown linter that does not reformat is [OP-063](../open-points.md#op-063). |
| 9 | Prettier options | The defaults; tweaks such as single quotes | **The defaults** (`{}`), Prettier's own advice against debating options. |
| 10 | lint-staged's ESLint glob | The types in use today; every type ESLint lints | **Every type ESLint lints** (`ts`, `tsx`, `mts`, `cts`, `js`, `jsx`, `mjs`, `cjs`), so a phase adding `.tsx` is covered without anyone remembering to extend it. Everything else is formatted by Prettier if it knows the type. |
| 11 | Commit scopes | An allow-list; any scope | **An allow-list in `commitlint.config.js`; the scope stays optional.** Workspaces and test layers, one feature scope per requirement area, the kinds of docs, and tooling (`infra`, `deps`, `main` for release-please, `claude`). Typos and near-duplicates are rejected; a PR that needs a new scope adds it. ADR 0009's examples already went beyond its listed scopes. |
| 12 | Spec and plan names | `YYYY-MM-DD-<topic>`; with the phase ID | **The phase ID after the date, in uppercase as the project writes its IDs:** `2026-10-02-PH-01-monorepo-and-toolchain-design.md`. All files of a phase are found with `ls *PH-01*`. Nothing in superpowers parses the names. Work outside phases keeps `date-topic`. |

## Consequences

- **The configuration files and tool pages exist:** `docs/development/setup.md` and a page per tool in `docs/development/tools/`, living docs from now on ([ADR 0005](0005-development-environment.md), consequences).
- **Every commit is formatted, linted and checked,** the owner's and Claude's; CI repeats the checks from PH-02.
- **Open points:** [OP-005](../open-points.md#op-005) keeps its PH-04 part; [OP-008](../open-points.md#op-008) and [OP-009](../open-points.md#op-009) are closed; [OP-062](../open-points.md#op-062) gains a PH-03 part; [OP-063](../open-points.md#op-063) (a Markdown linter) and [OP-064](../open-points.md#op-064) (TypeScript 7) are new candidates.
- **The living docs are updated:** the README's "Development" section, `CLAUDE.md`'s documentation list, the glossary, `git-workflow.md` (the scope rule, the hook's path) and `phase-walkthrough.md` (the file names).
```

- [ ] **Step 3: Add the status-line pointers to the refined ADRs**

Each is a mechanical status change (CLAUDE.md allows it). Append to the end of each `- **Status:**` line:
- `0005-development-environment.md`: `; decision 12 refined by [ADR 0016](0016-toolchain-details.md) (Markdown left out of Prettier)`
- `0007-testing-strategy.md`: `; decision 18 refined by [ADR 0016](0016-toolchain-details.md) (Node's test runner until Vitest)`
- `0009-git-workflow.md`: if the line is only `✅ Accepted`, append ` — decision 9 refined by [ADR 0016](0016-toolchain-details.md) (an allow-list of scopes)`; otherwise append `; decision 9 refined by …` with the same text.
- `0015-git-push-guard-hook.md`: ` — decision 3 refined by [ADR 0016](0016-toolchain-details.md) (the hook in TypeScript)`

Read each status line first and match its punctuation (`—` before the first refinement, `;` between refinements).

- [ ] **Step 4: Fix the pipe in ADR 0015's table**

In `docs/decisions/0015-git-push-guard-hook.md`, decision 1, replace `` `;`, `&`, `|` and newlines `` with `` `;`, `&`, `\|` and newlines ``. A `|` inside a table cell splits the cell on GitHub, even inside backticks.

- [ ] **Step 5: Update `phase-walkthrough.md`**

- Line 62: `docs/superpowers/specs/2026-10-05-templates-design.md` → `docs/superpowers/specs/2026-10-05-PH-28-templates-design.md`
- Line 63: `docs/superpowers/plans/2026-10-05-templates.md` → `docs/superpowers/plans/2026-10-05-PH-28-templates.md`
- Line 310: `` `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` `` → `` `docs/superpowers/specs/YYYY-MM-DD-PH-NN-<topic>-design.md`, `docs/superpowers/plans/YYYY-MM-DD-PH-NN-<topic>.md` (the phase ID in uppercase; work outside phases leaves it out) ``

Check with `grep -n "superpowers/specs\|superpowers/plans" docs/development/phase-walkthrough.md` that no other example uses the old form.

- [ ] **Step 6: Update the README and `CLAUDE.md`**

README: add a section before `## Documentation`:

```markdown
## Development

Szop is a pnpm monorepo in TypeScript, developed in WSL. To set up a machine and run the checks, follow the [setup guide](docs/development/setup.md); every tool has its own page in [docs/development/tools](docs/development/tools/).
```

and add to the `## Documentation` list, after "GitHub settings":

```markdown
- [Setup guide](docs/development/setup.md) — from a clean Windows machine to passing checks
- [Tool pages](docs/development/tools/) — each development tool, why it was chosen and its configuration explained
```

`CLAUDE.md`, in the Documentation list after the `github-settings.md` line:

```markdown
- `docs/development/setup.md` — the setup guide, from a clean Windows machine to passing checks. Keep it updated when a tool or a step changes.
- `docs/development/tools/` — one page per development tool: what it is, why it was chosen, its configuration explained. Keep a tool's page updated when its configuration changes.
```

- [ ] **Step 7: Update the glossary**

Add, in alphabetical order, to the terms table (check first that none exists; extend an existing entry instead):
- **Flat config** — ESLint's configuration format since version 9: one `eslint.config.js` exporting an array of config objects, applied in order.
- **Git hook** — extend the existing entry: Szop's hooks are managed by husky; the pre-commit hook runs lint-staged and the commit-msg hook runs commitlint.
- **lint-staged** — a tool that runs commands (here ESLint and Prettier) only on the files staged for a commit.
- **Type-aware linting** — linting that uses TypeScript's type information, so a rule can know, for example, that a call returns a promise.

And in the acronyms table, if missing: **LTS** (Long-Term Support).

- [ ] **Step 8: Update `docs/open-points.md`**

- **OP-005:** in its Parts, mark `**PH-01:** … ✅ ([#PR](…))` once the PR number is known (set it after the PR opens, step 11); move the entry under `### PH-04 Database`; remove `[OP-005](#op-005)` from PH-04's "Also" line (it now sits there) and add it to the "Also" line of no other phase.
- **OP-008, OP-009:** move to `## Closed`, status `✅ Closed: [ADR 0016](decisions/0016-toolchain-details.md); built in PH-01 ([#PR](…))`.
- **OP-062:** rewrite its text: the hook is now `guard-git-push.ts`, linted, formatted, type-checked and run by `pnpm test`. Parts: **PH-01:** ✅ (link the PR); **PH-02:** `ci.yml` runs `pnpm test`; **PH-03:** move the tests into a Vitest project and drop the `node:test` exception in `eslint.config.js`. Move it under `### PH-02 CI checks` (its next part), and add `[OP-062](#op-062)` to PH-03's "Also" line; remove it from PH-02's "Also" line.
- **New OP-063** under `## Candidates`: "**Lint the Markdown docs without reformatting them.** Prettier stays out of Markdown because it pads tables ([ADR 0016](decisions/0016-toolchain-details.md), decision 8). A linter such as markdownlint could check headings, lists and links without touching table layout. Source: ADR 0016, decision 8. Status: ⬜ Open."
- **New OP-064** under `## Candidates`: "**Move to TypeScript 7** (the native compiler) once typescript-eslint supports it; until then TypeScript is pinned to 6.0. Source: ADR 0016, decision 4. Status: ⬜ Open."
- Update the Contents if a heading changed.

- [ ] **Step 9: Check the links**

Run:

```bash
python3 - <<'EOF'
import re, pathlib, sys
bad = []
for md in pathlib.Path(".").rglob("*.md"):
    if any(p in md.parts for p in ("node_modules", ".superpowers", ".git")):
        continue
    for m in re.finditer(r"\]\(([^)#\s]+)(#[^)]+)?\)", md.read_text()):
        target = m.group(1)
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        if not (md.parent / target).exists():
            bad.append(f"{md}: {target}")
print("\n".join(bad) or "all relative links resolve")
sys.exit(1 if bad else 0)
EOF
```

Expected: `all relative links resolve`.

- [ ] **Step 10: Run every check once more**

Run: `rm -rf node_modules && pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm exec prettier --check .`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git status --short
git commit -F - <<'EOF'
docs: add the setup guide and ADR 0016 toolchain details

Close OP-008 and OP-009, move OP-005 to PH-04 and OP-062 to PH-02, add
OP-063 and OP-064; point the README and CLAUDE.md to the setup guide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RtEwNsCiAQ5Tfp5ckcTSnE
EOF
```

## After the tasks

1. **Review the branch** (superpowers code review) and fix what it finds, in new commits.
2. **Push and open the PR:** `git push -u origin feat/monorepo-toolchain`, then `gh pr create` with the title `build: set up the monorepo and toolchain` and the PR template filled in: roadmap phase PH-01, the spec and plan, ADR 0016, the open points; "How it was tested" lists the checks of each task, and asks the owner to check VS Code (Task 7) and to follow `setup.md` on their machine (the roadmap's owner step).
3. **Update the roadmap and open points with the PR's number** in a `docs: …` commit: the PH-01 row gets `🚧 In progress` with links to the spec, the plan and the PR; then, as the last commit before the owner merges, `✅ Done`. Fill in the PR links left open in Task 8, step 8.
4. **Never merge the PR**: the owner merges.
