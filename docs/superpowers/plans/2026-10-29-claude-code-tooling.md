# Claude Code tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code sessions get current library docs (context7), a code-only graphify map kept current by git hooks, and the tracking and ADR rules as two skills instead of in every session's `CLAUDE.md`.

**Architecture:** Configuration and docs, plus one hook script with its test: `.mcp.json`; graphify's own output (four `.husky/post-*` hooks, a `## graphify` section in `CLAUDE.md`), trimmed as the spec says; `.claude/hooks/graphify-guard.ts`, which skips graphify's `PreToolUse` guard for paths `.graphifyignore` leaves out; `.claude/skills/phase-tracking/` and `.claude/skills/new-adr/`, which take over two parts of `CLAUDE.md`.

**Tech Stack:** Markdown; JSON; POSIX shell (the husky hooks); TypeScript run by Node directly, tested with Vitest; `gh`; graphify (installed on the owner's machine with `uv tool install graphifyy`).

**Spec:** [`docs/superpowers/specs/2026-10-29-claude-code-tooling-design.md`](../specs/2026-10-29-claude-code-tooling-design.md), with the decisions in [ADR 0056](../../decisions/0056-claude-code-tooling.md).

**Before your task:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md). It holds the repo-wide rules every task follows (git, commits and trailers, docs style, after each task).

## Order of work

1. [Task 1: context7](#task-1-context7)
2. [Task 2: graphify's git hooks and ignore files](#task-2-graphifys-git-hooks-and-ignore-files)
3. [Task 3: graphify's CLAUDE.md section](#task-3-graphifys-claudemd-section)
4. [Task 4: The guard wrapper](#task-4-the-guard-wrapper)
5. [Task 5: The /phase-tracking skill](#task-5-the-phase-tracking-skill)
6. [Task 6: The /new-adr skill](#task-6-the-new-adr-skill)
7. [Task 7: The graphify page and the other docs](#task-7-the-graphify-page-and-the-other-docs)

## Global Constraints

- **Branch:** `chore/adr-0056-claude-code-tooling`. Its `adr` issue is [#311](https://github.com/luiki-dev/szop/issues/311); the PR closes it and [OP-095 (#211)](https://github.com/luiki-dev/szop/issues/211), and is labelled `skip-changelog`. The `adr` issue has no Plan field (only phases do), so nothing is set on GitHub for this plan.
- **Built in a local session on the owner's machine,** where graphify is installed (spec, [graphify: git hooks](../specs/2026-10-29-claude-code-tooling-design.md#graphify-git-hooks)). The spec names 0.9.92; `graphify --version` printed **0.9.97** when this plan was written. If graphify's output differs from what the spec and ADR 0056's Context describe, record the difference in ADR 0056's "Settled while building" in that task's commit; if it changes a decision (a file graphify no longer writes, a `hook-guard` with other arguments), stop and ask the owner.
- **Commit scopes:** `claude` (`.claude/`, `CLAUDE.md`, `.mcp.json`, the husky hooks, the ignore files), `adr`, `plan`; the guides and tool pages take no scope (`docs: …`).
- **graphify's extras never land:** no merge driver (no `.gitattributes` line, no `merge.graphify.*` in local git config), no `.claude/skills/graphify/`, no `.claude/CLAUDE.md`, no bare `graphify hook-guard` command in `.claude/settings.json`, no `graphify-out/` in git.
- **Every step and rule of today's `CLAUDE.md` "Project tracking" section and `docs/decisions/` entry survives,** in a skill or in what `CLAUDE.md` keeps (spec, [Left to the builder](../specs/2026-10-29-claude-code-tooling-design.md#left-to-the-builder)).
- **The criteria and the docs to update** are in the spec: [Acceptance criteria](../specs/2026-10-29-claude-code-tooling-design.md#acceptance-criteria) (none) and [Documentation](../specs/2026-10-29-claude-code-tooling-design.md#documentation).

## Review Focus

1. **`git check-ignore` exits 1 when no path is ignored.** Expected: the wrapper reads that as "not all ignored" and runs graphify, not as a git failure. Task 4, test "Read of apps/x.ts".
2. **A path outside the project** (a `Read` of `/tmp/x.ts`): `check-ignore` exits 128. Expected: no output, exit 0 (fails open), never an error shown to the session. Task 4, test "Read outside the project".
3. **A session whose working directory is a subfolder** (`cwd` in the hook input is `docs`): a Bash word `a.md` must resolve to `docs/a.md` and be skipped; resolved against the root it would not exist and go to graphify. Expected: paths are resolved against `cwd`, then made relative to `CLAUDE_PROJECT_DIR`. Task 4, test "Bash in a subfolder".
4. **A rerun of `graphify hook install`, or a husky reinstall (`pnpm install`).** Expected: the four `.husky/post-*` files and their guard line stay as committed. Task 2, Step 4.
5. **A cloud session** (no graphify, egress through an allow-list). Expected: commits print nothing from the post-* hooks; context7 needs `mcp.context7.com` allowed, so it is listed in setup's allowed hosts. Task 2, Step 4; Task 1, Step 3.

---

### Task 1: context7

**Files:**
- Create: `.mcp.json`
- Create: `docs/development/tools/context7.md`
- Modify: `docs/glossary.md` (the MCP row, line 63)
- Modify: `docs/development/setup.md` (section 13, "Worth allowing as well" and "All hosts, to paste")

- [x] **Step 1: Check the URL against context7's README**

Fetch `https://github.com/upstash/context7` (README, "Claude Code" install section). Expected: the remote HTTP server is `https://mcp.context7.com/mcp` and works without an API key. If it differs, use the README's URL and note it in ADR 0056's "Settled while building".

- [x] **Step 2: Write `.mcp.json`**

The JSON of spec, [context7](../specs/2026-10-29-claude-code-tooling-design.md#context7), byte for byte (with the URL from Step 1).

- [x] **Step 3: Docs**

- `tools/context7.md`, in the shape of the other tool pages (for example `tools/stryker.md`): what it is, why (ADR 0056, decision 2: the new majors), `.mcp.json` explained, the one-time approval per machine, what is sent (library names and questions only), the lower rate limit without a key.
- Glossary, MCP row: the example becomes context7 (ADR 0056) instead of graphify's query server (ADR 0031).
- `setup.md`, section 13: `mcp.context7.com` under "Worth allowing as well" (why: the context7 MCP server, ADR 0056) and in "All hosts, to paste".

- [x] **Step 4: Verify**

Run: `node -e 'JSON.parse(require("fs").readFileSync(".mcp.json","utf8"))' && pnpm format:check && claude mcp list`
Expected: no error; `context7` listed (connected, or awaiting approval).

- [x] **Step 5: Commit**

```bash
git add .mcp.json docs/development/tools/context7.md docs/glossary.md docs/development/setup.md docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "chore(claude): add the context7 MCP server"
```

---

### Task 2: graphify's git hooks and ignore files

**Files:**
- Create: `.husky/post-commit`, `.husky/post-checkout`, `.husky/post-merge`, `.husky/post-rewrite` (written by graphify)
- Create: `.graphifyignore`
- Modify: `.gitignore`

- [x] **Step 1: Ignore files**

`.graphifyignore` with the owner's contents, byte for byte, from spec, [graphify: CLAUDE.md and ignore files](../specs/2026-10-29-claude-code-tooling-design.md#graphify-claudemd-and-ignore-files). `.gitignore` gains, in its style (a comment line, then the pattern): `# graphify's code map, built on each machine (ADR 0056)` and `graphify-out/`.

- [x] **Step 2: Install the hooks**

Run: `graphify hook install` in the repository root. Then `git status --short`, `git diff`, `cat .gitattributes 2>/dev/null` and `git config --local --get-regexp '^merge\.graphify'`, to see everything it wrote.

- [x] **Step 3: Trim to the spec**

Following spec, [graphify: git hooks](../specs/2026-10-29-claude-code-tooling-design.md#graphify-git-hooks):
- In each of the four `.husky/post-*` files, add `command -v graphify >/dev/null 2>&1 || exit 0` as the line after the shebang; change nothing else (the `_PINNED=` line stays).
- Remove the merge driver: delete the `.gitattributes` line graphify added (delete the file if graphify created it), then `git config --local --unset-all merge.graphify.name` and `git config --local --unset-all merge.graphify.driver`.

- [x] **Step 4: Verify**

Run each and compare:
- `graphify update .` → builds `graphify-out/graph.json`; `git status --short` does not list `graphify-out/`.
- `grep -c '"\(docs/\|[^"]*\.md"\)' graphify-out/graph.json` → `0` (no docs in the graph; adjust the pattern to the file's actual path field if it has another shape).
- `graphify hook install` again → "already installed", and `git diff .husky/` is empty.
- `pnpm install` → `git diff .husky/` still empty.
- `env PATH=/usr/bin:/bin sh .husky/post-commit; echo $?` → no output, `0` (graphify missing).
- `git config --local --get-regexp '^merge\.graphify'` → no output; `git grep -n graphify -- .gitattributes` → no match.

- [x] **Step 5: Commit**

```bash
git add .husky/post-commit .husky/post-checkout .husky/post-merge .husky/post-rewrite .graphifyignore .gitignore docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "chore(claude): keep a code-only graphify map current with git hooks"
```

Then check that the commit itself ran the hook: `graphify-out/graph.json`'s modification time is the commit's time (`stat -c %y graphify-out/graph.json`; the hook runs detached, so allow a few seconds).

---

### Task 3: graphify's CLAUDE.md section

**Files:**
- Modify: `CLAUDE.md` (a new `## graphify` section)

**Interfaces:**
- Produces: the exact command graphify wires for its guard (expected `graphify hook-guard search` for `Bash|Grep` and `graphify hook-guard read` for `Read|Glob`, `timeout: 10`), which Task 4 calls from the wrapper. Write the observed entries into the task summary.

- [x] **Step 1: Run the install**

Run: `graphify claude install --project`, then `git status --short`, `git diff` and `ls .claude/skills .claude/CLAUDE.md 2>/dev/null`, to see everything it wrote. Note the two `PreToolUse` entries it added to `.claude/settings.json` (matcher, command, timeout).

- [x] **Step 2: Keep only the section, edited**

Following spec, [graphify: CLAUDE.md and ignore files](../specs/2026-10-29-claude-code-tooling-design.md#graphify-claudemd-and-ignore-files):
- In `CLAUDE.md`'s `## graphify` section, the "After modifying code, run `graphify update .`…" line becomes, exactly: "Before a graph query, if you changed code since the last commit, run `graphify update .` first (AST-only, no API cost)." The line about a committed `graph.json` goes. Keep graphify's markers (if any) around the section.
- Remove the rest: `git checkout .claude/settings.json`, delete `.claude/skills/graphify/` and `.claude/CLAUDE.md`, remove any merge-driver line or git config it wrote again (as in Task 2, Step 3).

- [x] **Step 3: Verify**

Run: `git status --short && git diff --stat`
Expected: only `CLAUDE.md` (and this plan) changed. `grep -n "graphify" .claude/settings.json` → no match. `grep -n -i "graph.json" CLAUDE.md` → no line about committing it.

- [x] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "docs(claude): add graphify's section with the update-before-query rule"
```

---

### Task 4: The guard wrapper

**Files:**
- Create: `.claude/hooks/graphify-guard.ts`
- Create: `.claude/hooks/graphify-guard.test.ts`
- Modify: `.claude/hooks/guard-git-push.ts` (export `parseSegments`)
- Modify: `.claude/settings.json` (two `PreToolUse` entries)

**Interfaces:**
- Consumes: graphify's guard command from Task 3; `parseSegments(command: string): string[][]` from `guard-git-push.ts`, exported by this task (the word splitting, reused as spec, [Left to the builder](../specs/2026-10-29-claude-code-tooling-design.md#left-to-the-builder), allows).
- Produces: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/graphify-guard.ts <kind>`, `<kind>` being `search` or `read`.

The behaviour is spec, [graphify: the guard wrapper](../specs/2026-10-29-claude-code-tooling-design.md#graphify-the-guard-wrapper); this task pins how it is tested and the edges.

- [ ] **Step 1: Write the failing tests**

`graphify-guard.test.ts`, in the style of `guard-git-push.test.ts`, running the hook with `spawnSync(process.execPath, [script, kind], { input, cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, PATH } , encoding: "utf8" })`.

Setup (`beforeAll`), in a `mkdtempSync` folder: `git init`; `.graphifyignore` with the spec's contents; files `docs/a.md`, `README.md`, `apps/x.ts`; a `bin/graphify` stub, mode 755: `#!/bin/sh` / `echo "stub $*"` / `cat`. `PATH` is `<repo>/bin:` plus the test's own `PATH`. For "graphify missing", `PATH` is a folder holding only a symlink to `git` (found with `command -v git`), so a graphify installed on the machine is not found either.

`input(tool, toolInput, cwd = repo)` builds `{ tool_name, tool_input, cwd }`. Each test asserts `status` is `0`, and `stdout` is `""` (no output) or contains `"stub hook-guard <kind>"` and the input JSON (the stub's output):

| Test | Kind | Input | stdout |
|---|---|---|---|
| Read of docs/a.md | read | `Read`, `file_path: <repo>/docs/a.md` | `""` |
| Read of README.md | read | `Read`, `file_path: <repo>/README.md` | `""` |
| Read of apps/x.ts | read | `Read`, `file_path: <repo>/apps/x.ts` | stub |
| Read outside the project | read | `Read`, `file_path: /tmp/x.ts` | `""` |
| Grep in docs | search | `Grep`, `pattern: "x", path: "docs"` | `""` |
| Grep with no path | search | `Grep`, `pattern: "x"` | stub |
| Grep with a docs glob, no path | search | `Grep`, `pattern: "x", glob: "*.md"` | `""` |
| Glob of markdown | read | `Glob`, `pattern: "**/*.md"` | `""` |
| Glob of ts inside docs | read | `Glob`, `path: "docs", pattern: "**/*.ts"` | `""` |
| Bash grep in docs | search | `Bash`, `command: "grep -rn x docs"` | `""` |
| Bash grep in apps | search | `Bash`, `command: "grep -rn x apps"` | stub |
| Bash with no existing path | search | `Bash`, `command: "pnpm test"` | stub |
| Bash in a subfolder | search | `Bash`, `command: "cat a.md"`, `cwd: <repo>/docs` | `""` |
| graphify missing | read | `Read` of apps/x.ts, the git-only `PATH` | `""` |
| Invalid JSON | read | stdin `"not json"` | `""` |

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project hooks .claude/hooks/graphify-guard.test.ts`
Expected: FAIL (the script does not exist).

- [ ] **Step 3: Write `.claude/hooks/graphify-guard.ts`**

A header comment like the push guard's (what it does, ADR 0056 decisions 5 and 6, input and exit codes, "fails open: it never blocks", only `node:` imports). Main, under `import.meta.main`, wrapped in one `try`/`catch` that exits 0 silently:
- Paths per tool as the spec lists; Bash: the words of `parseSegments(command).flat()` that `existsSync(resolve(cwd, word))`.
- Each path: `relative(projectDir, resolve(cwd, path))`, where `cwd` is the input's `cwd` or `process.cwd()` and `projectDir` is `CLAUDE_PROJECT_DIR` or `process.cwd()`.
- Skip when `paths.length > 0` and `spawnSync("git", ["-c", "core.excludesFile=.graphifyignore", "check-ignore", "--no-index", "--", ...paths], { cwd: projectDir })` exits `0` with as many non-empty stdout lines as paths. Exit `1` means "none ignored": go on to graphify. Any other status: exit 0 silently.
- Otherwise `spawnSync("graphify", ["hook-guard", kind], { input: stdin })` (Task 3's command); on `error` (not on `PATH`), exit 0 silently; else write its stdout to ours.

In `guard-git-push.ts`, only `function parseSegments` → `export function parseSegments`.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project hooks`
Expected: PASS, the push guard's tests included.

- [ ] **Step 5: Wire it in `.claude/settings.json`**

Two `PreToolUse` entries after the push guard's: matcher `Bash|Grep`, command `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/graphify-guard.ts search`; matcher `Read|Glob`, command `… read`; both `"timeout": 10` (or what Task 3 observed).

- [ ] **Step 6: Check by hand**

Run (graph built in Task 2):
`echo '{"tool_name":"Read","tool_input":{"file_path":"'$PWD'/apps/api/src/app.ts"},"cwd":"'$PWD'"}' | CLAUDE_PROJECT_DIR=$PWD node .claude/hooks/graphify-guard.ts read`
Expected: graphify's nudge for `app.ts` (its symbols). The same with `docs/roadmap.md` → no output. Then `pnpm check` → passes.

- [ ] **Step 7: Commit**

```bash
git add .claude/hooks/graphify-guard.ts .claude/hooks/graphify-guard.test.ts .claude/hooks/guard-git-push.ts .claude/settings.json docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "feat(claude): skip graphify's guard for paths .graphifyignore leaves out"
```

---

### Task 5: The /phase-tracking skill

**Files:**
- Create: `.claude/skills/phase-tracking/SKILL.md` (supporting files beside it only if `SKILL.md` grows past about 300 lines)
- Modify: `CLAUDE.md` ("Project tracking")
- Modify: `docs/development/project-tracking.md` (line 156, and a pointer to the skill)

- [ ] **Step 1: Look up the IDs**

Run: `gh project view 3 --owner luiki-dev --format json --jq .id` and `gh project field-list 3 --owner luiki-dev --format json`. Keep the project ID, the field IDs of Status, Started, Finished, Spec and Plan, and the option ID of each of the six statuses.

- [ ] **Step 2: Write `SKILL.md`**

Following spec, [The /phase-tracking skill](../specs/2026-10-29-claude-code-tooling-design.md#the-phase-tracking-skill). Frontmatter: `name: phase-tracking` and a `description` naming every moment (a phase's brainstorm starts; the phase branch's first commit; a spec or plan commit; owner steps change; a decision while building; before a phase PR opens; the end of a phase; any open-point change). Body: one section per moment, holding every bullet of today's `CLAUDE.md` "Project tracking" ("During a phase" and "Open points"), each with its commands:
- A project item's ID: `gh project item-add 3 --owner luiki-dev --url https://github.com/luiki-dev/szop/issues/<N> --format json --jq .id` (returns the existing item's ID).
- A field: `gh project item-edit --project-id <id> --id <item> --field-id <field>` with `--single-select-option-id <option>`, `--date YYYY-MM-DD` or `--text <url>`, the IDs from Step 1 written in.
- An open point: the next `OP-` ID with the command from [Checking with gh](../../development/project-tracking.md#checking-with-gh), `gh issue create --label open-point`, then the sub-issue: `gh api repos/luiki-dev/szop/issues/<phase>/sub_issues -F sub_issue_id=<id from gh api repos/luiki-dev/szop/issues/<N> --jq .id>`, adding `-F replace_parent=true` to re-parent.
- Closing as not planned: `gh issue close <N> --reason "not planned" --comment "<reason>"`.

Link [project tracking](../../development/project-tracking.md) for the reasons and "How items move"; do not repeat them.

- [ ] **Step 3: Shrink `CLAUDE.md` and point the guide to the skill**

- `CLAUDE.md`, "Project tracking": the first paragraph stays as it is, its last sentence ("Every step below…") reworded to fit; then "Run `/phase-tracking`" with the moments of the description as a list, then the same for open-point changes. Everything else of the section goes.
- `project-tracking.md`, line 156: "the `/phase-tracking` skill (`.claude/skills/phase-tracking/`) holds the steps and their `gh` commands; a change to this table changes the skill in the same commit." Under "Checking with gh", one line saying the field and option IDs are in the skill.

- [ ] **Step 4: Verify**

- Every bullet of the old section is in the skill: `git show HEAD:CLAUDE.md | sed -n '/^## Project tracking/,/^## Working with Claude/p'`, then read it side by side with `SKILL.md`; list in the task summary any bullet reworded, none dropped.
- The IDs work: `gh project item-add 3 --owner luiki-dev --url https://github.com/luiki-dev/szop/issues/311 --format json --jq .id` prints an ID; the IDs in the skill match `field-list`'s output.
- The skill loads: `claude -p "List your skills whose name contains phase-tracking"` (or a new session's skill list) names it.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/phase-tracking/ CLAUDE.md docs/development/project-tracking.md docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "feat(claude): move the project tracking steps into the /phase-tracking skill"
```

---

### Task 6: The /new-adr skill

**Files:**
- Create: `.claude/skills/new-adr/SKILL.md`
- Modify: `CLAUDE.md` ("Documentation", the `docs/decisions/` entry, line 105)

**Interfaces:**
- Consumes: the `item-add` command from Task 5's skill, for adding the `adr` issue to the project (link the skill's section rather than repeat it, or repeat the one command).

- [ ] **Step 1: Write `SKILL.md`**

Following spec, [The /new-adr skill](../specs/2026-10-29-claude-code-tooling-design.md#the-new-adr-skill). Frontmatter: `name: new-adr`, a `description` naming the moments (a new ADR; a note on an earlier ADR's decision; checking an ADR's number before a PR). Body: the number (`git fetch`, then for each `origin/*` branch `git ls-tree --name-only <branch> docs/decisions/`, the highest `NNNN` plus one), the file's shape (take ADR 0056 as the model), every rule of today's `docs/decisions/` entry, the `adr` issue outside a phase (`gh issue create --label adr --title "ADR NNNN <title>"`, body as in [ADR issues](../../development/project-tracking.md#adr-issues), added to the project), and inside a phase the link to `docs/superpowers/specs/CLAUDE.md`.

- [ ] **Step 2: Shrink the `docs/decisions/` entry**

It keeps what the folder is (ADR-style records, numbered `NNNN-short-title.md`, a new ADR for every significant decision) and becomes "for a new ADR, or a note on an earlier one, run `/new-adr`". The rules move to the skill.

- [ ] **Step 3: Verify**

- Every rule of the old entry is in the skill: `git show HEAD:CLAUDE.md | grep -n "docs/decisions/\` —"`, read side by side.
- The numbering command, run now, prints `0057` or higher (0056 exists on this branch); if an open branch holds a higher one, it prints that plus one.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/new-adr/ CLAUDE.md docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "feat(claude): move the ADR rules into the /new-adr skill"
```

---

### Task 7: The graphify page and the other docs

**Files:**
- Create: `docs/development/tools/graphify.md`
- Modify: `docs/development/setup.md` (an optional graphify step; section 12, the git hooks)
- Modify: `docs/development/working-with-claude.md` (what loads into a session, line 70; the finishing row, line 101)
- Modify: `docs/decisions/0031-graphify-not-adopted.md` (decisions 1, 2 and 3)
- Modify: `docs/decisions/0052-working-with-claude.md` (lines 36, 38: links only, if they point to `CLAUDE.md`'s tracking steps)

- [ ] **Step 1: The graphify page**

`tools/graphify.md`: what it is; why, code only (ADR 0056, decisions 3 to 7, and ADR 0031); the configuration explained (`.graphifyignore`, `graphify-out/` ignored, the four husky hooks and their guard line, the wrapper and its wiring, the `CLAUDE.md` rule); what was left out (merge driver, `/graphify` skill, `.claude/CLAUDE.md`) and that `graphify claude install` is never run again in the repository; the owner's steps (spec, [graphify: what the owner does](../specs/2026-10-29-claude-code-tooling-design.md#graphify-what-the-owner-does)); upgrading: `graphify hook uninstall`, `graphify hook install`, the guard line put back, commit, and the by-hand guard check of Task 4, Step 6.

- [ ] **Step 2: The other docs**

Following spec, [Documentation](../specs/2026-10-29-claude-code-tooling-design.md#documentation):
- `setup.md`: graphify as an optional step (`uv tool install graphifyy`, `graphify update .`, link to the page) where the tool steps are; section 12 adds the post-commit, post-checkout, post-merge and post-rewrite hooks, which update the graph when graphify is installed and do nothing otherwise. The cloud setup script is unchanged.
- `working-with-claude.md`: line 70, what a new session loads, mentions that the tracking and ADR rules load only with their skills; line 101's "CLAUDE.md's "Before opening the PR"" becomes "`/phase-tracking`'s "Before opening the PR"". Update `## Contents` if a heading changes.
- ADR 0031, at the bottom of decisions 1, 2 and 3's cells, after any existing note: `<br>🔍 **Revisited by [ADR 0056](0056-claude-code-tooling.md), decision N:** <one clause>` (decisions 1 and 2: decision 3, graphify adopted for code only; decision 3: decision 8, the revisit done, OP-095 closed). The status line stays.

- [ ] **Step 3: Sweep for links to the moved rules**

Run: `grep -rn -E "CLAUDE\.md's \"(Project tracking|Before opening the PR|During a phase)\"|CLAUDE\.md#project-tracking|its \"Project tracking\" section" --include=*.md . | grep -v -E "^\./docs/(decisions/00([0-4]|5[0-5])|superpowers/(specs|plans)/20|audits|archive)/"`
Expected: no match outside frozen records. In ADR 0052 (accepted), only a link may change, as a mechanical change; if a sentence would have to change, leave it and say so in the task summary.

- [ ] **Step 4: Verify**

Run: `pnpm check && git status --short`
Expected: passes; only the files above and this plan changed. `## Contents` of `setup.md` and `working-with-claude.md` match their headings.

- [ ] **Step 5: Commit**

```bash
git add docs/development/ docs/decisions/0031-graphify-not-adopted.md docs/decisions/0052-working-with-claude.md docs/superpowers/plans/2026-10-29-claude-code-tooling.md
git commit -m "docs: add the graphify page and point the guides to the new skills"
```

The by-hand checks left for the owner after the merge (spec, [Tests](../specs/2026-10-29-claude-code-tooling-design.md#tests)): `/mcp` in a fresh session lists context7 as connected; a `Read` of a code file shows graphify's nudge, a doc's does not. The finishing session lists them in the PR description with the owner's steps.
