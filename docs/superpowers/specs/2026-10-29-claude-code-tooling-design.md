# Claude Code tooling: design

The decisions are in [ADR 0056](../../decisions/0056-claude-code-tooling.md), which is made outside a phase, on the branch `chore/adr-0056-claude-code-tooling`. This spec holds what changes in which file and how it is checked.

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [context7](#context7)
  - [graphify: what the owner does](#graphify-what-the-owner-does)
  - [graphify: git hooks](#graphify-git-hooks)
  - [graphify: the guard wrapper](#graphify-the-guard-wrapper)
  - [graphify: CLAUDE.md and ignore files](#graphify-claudemd-and-ignore-files)
  - [The /phase-tracking skill](#the-phase-tracking-skill)
  - [The /new-adr skill](#the-new-adr-skill)
  - [CLAUDE.md](#claudemd)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

Give Claude Code sessions current library docs (context7), a code map kept current at no token cost (graphify, code only), and the tracking and ADR rules as skills loaded when needed instead of in every session. This work is not a roadmap phase.

## Decisions

[ADR 0056, decisions 1 to 11](../../decisions/0056-claude-code-tooling.md#decisions).

## The design

### context7

A new `.mcp.json` at the repository root:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

No API key. The builder checks the URL against context7's current README before committing. Claude Code asks once per machine to approve a project MCP server; the owner approves it.

### graphify: what the owner does

Owner steps, listed in the PR description and in the graphify tool page:

1. `uv tool install graphifyy` (already done at 0.9.92 on the owner's machine).
2. After the branch is checked out: `graphify update .` in the repository, the first code-only build.
3. Approve the context7 server when Claude Code asks.

The owner does not run `graphify hook install` or `graphify claude install`: their output is committed by the branch.

### graphify: git hooks

**The work is built in a local session on the owner's machine,** where graphify 0.9.92 is installed, so the hooks and the `CLAUDE.md` section are graphify's own output, not written by hand; the checks by hand in [Tests](#tests) run in that session too. _Claude's call._

The builder runs `graphify hook install` in the repository on the branch. It writes `.husky/post-commit`, `.husky/post-checkout`, `.husky/post-merge` and `.husky/post-rewrite`, and registers a merge driver (a `.gitattributes` line and local git config).

- **Kept as written,** with one line added after the shebang: `command -v graphify >/dev/null 2>&1 || exit 0`.
- **The pinned interpreter path** (`_PINNED='/home/lemekk/…/python'`) stays: it is graphify's first probe and falls through to the others on any other machine. _Claude's call: editing it out would make the files differ from what graphify writes._
- **The merge driver is removed:** the `.gitattributes` line is deleted (or the file not created), and `git config --local --unset-all merge.graphify.name` and `merge.graphify.driver`.
- The hooks run detached and skip rebases, merges and linked worktrees on their own.

### graphify: the guard wrapper

`.claude/hooks/graphify-guard.ts`, in the style of `guard-git-push.ts`: a header comment with the ADR, only `node:` imports, run by Node directly.

- **Usage:** `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/graphify-guard.ts search` or `read`.
- **Input:** the `PreToolUse` JSON on stdin.
- **Paths it checks:**
  - `Read`: `tool_input.file_path`
  - `Glob`: `tool_input.path`, or `tool_input.pattern` when there is no `path`
  - `Grep`: `tool_input.path`, or `tool_input.glob` when there is no `path`
  - A `pattern` or `glob` only narrows a `path`, so a search inside an ignored `path` is skipped whatever its pattern. _Claude's call._
  - `Bash`: the command split into words, each word that exists on disk relative to the working directory
- **Decision:** absolute paths are made relative to `CLAUDE_PROJECT_DIR`. If at least one path was found and every one is ignored by `git -c core.excludesFile=.graphifyignore check-ignore --no-index` (one call with all paths, ignored count compared to the path count), it prints nothing and exits 0. Otherwise it runs `graphify hook-guard <kind>` with the same stdin and passes its stdout through.
- **Fails open:** graphify not on `PATH`, git failing, bad JSON or any error: no output, exit 0. It never blocks a tool call (no exit 2).
- **Wired in `.claude/settings.json`,** next to the push guard, as graphify's two entries with their matchers (`Bash|Grep`, `Read|Glob`) and `timeout: 10`, but with the wrapper as the command.

### graphify: CLAUDE.md and ignore files

- **`.graphifyignore`** at the root, the owner's contents:

  ```
  # keep docs out of the graph
  docs/
  *.md
  *.mdx
  *.pdf
  *.txt
  # add generated/vendored code if any, e.g.
  # src/generated/
  ```

- **`.gitignore`** gains `graphify-out/`.
- **`CLAUDE.md`** gains graphify's `## graphify` section, written by `graphify claude install --project` and then edited:
  - the line "After modifying code, run `graphify update .`…" becomes: "Before a graph query, if you changed code since the last commit, run `graphify update .` first (AST-only, no API cost)."
  - the line about a committed `graph.json` goes.
  - The builder keeps graphify's markers (if any) so the section can be found, and removes everything else that command writes: the `/graphify` skill, `.claude/CLAUDE.md`, and its bare hooks in `.claude/settings.json`.

### The /phase-tracking skill

`.claude/skills/phase-tracking/SKILL.md`, invocable by Claude and the owner.

- **Frontmatter description** names the moments, so Claude matches it: a phase's brainstorm starts, the phase branch's first commit, a spec or plan commit, owner steps change, a decision while building, before a phase PR opens, the end of a phase, and any open-point change.
- **Body:** the whole "Project tracking" section of today's `CLAUDE.md` (the steps "During a phase" and "Open points"), as one section per moment, each with:
  - the steps on GitHub and in the repo, as today;
  - the exact `gh` commands: `gh project item-edit` with the project ID, the field IDs (Status, Started, Finished, Spec, Plan) and the option IDs of each status, looked up once by the builder with `gh project field-list 3 --owner luiki-dev --format json`; `gh issue create` for an open point with the `OP-` lookup from [project tracking](../../development/project-tracking.md#checking-with-gh); sub-issue and re-parenting commands.
- **Links** to `docs/development/project-tracking.md` for the reasons and "How items move", instead of repeating them.

### The /new-adr skill

`.claude/skills/new-adr/SKILL.md`, invocable by Claude and the owner.

- **Number:** the highest of `docs/decisions/` on `origin/main` and on every open branch (`git fetch`, then `git ls-tree` per remote branch), plus one; checked again before the PR.
- **File:** `docs/decisions/NNNN-short-title.md`, in the shape of recent ADRs: title line, Status (✅ Accepted), Date, the relation headers, Context, a Decisions table (`#`, Decision, Options considered, Outcome, with who chose each), Consequences.
- **Rules moved from `CLAUDE.md`:** never rewrite an accepted ADR, supersede it; mechanical changes (status lines, icons, links) are allowed; a new ADR that supersedes, refines, extends, completes or revisits a decision notes it in its header (`Refines:` …) and at the bottom of that decision's cell (`<br>✏️ **Refined by [ADR NNNN](…), decision N:** …`, oldest first, with the icons of the writing style); the earlier ADR's status line changes only when the whole ADR is superseded or deprecated.
- **Outside a phase:** the `adr` issue (title `ADR NNNN <title>`, body as in [ADR issues](../../development/project-tracking.md#adr-issues)), added to the project, closed by the PR. Inside a phase: the phase ADR is created with its spec ([specs rules](CLAUDE.md)).

### CLAUDE.md

- **"Project tracking"** shrinks to: the first paragraph (where GitHub, `roadmap.md` and the requirements hold what), then "Run `/phase-tracking`" with the list of moments from its description.
- **"Documentation", the `docs/decisions/` entry,** keeps what the folder is and becomes "for a new ADR, or a note on an earlier one, run `/new-adr`".
- **`## graphify`** section as above.

## Acceptance criteria

None: this work changes tooling, not Szop's behavior.

## Tests

- **`.claude/hooks/graphify-guard.test.ts`,** in Vitest like `guard-git-push.test.ts`, on a temporary git repository with a `.graphifyignore` and a stub `graphify` on `PATH` that echoes its input:
  - a `Read` of `docs/a.md` and of `README.md`: no output;
  - a `Read` of `apps/x.ts`: the stub's output;
  - a `Grep` with `path: "docs"`: no output; without a path: the stub's output;
  - a `Glob` with `pattern: "**/*.md"`: no output; with `path: "docs"` and `pattern: "**/*.ts"`: no output;
  - a `Bash` `grep -rn x docs`: no output; `grep -rn x apps`: the stub's output; a command with no existing path: the stub's output;
  - graphify missing from `PATH`, and invalid JSON: no output, exit 0.
- **By hand, after the owner's first build:** a `Read` of a code file shows graphify's nudge; a `Read` of a doc does not; a commit updates `graphify-out/graph.json`; `/mcp` in a fresh session lists context7 as connected.
- `pnpm check` passes.

## Documentation

- **`docs/development/tools/context7.md`** and **`docs/development/tools/graphify.md`:** new tool pages (what, why, configuration explained, the owner's steps, upgrading graphify).
- **`docs/development/setup.md`:** graphify as an optional step; the cloud session's setup is unchanged (no graphify there).
- **`docs/development/project-tracking.md`:** says the steps and commands are in `/phase-tracking`.
- **`docs/development/working-with-claude.md`:** the two skills and the graphify rule where it describes what loads into a session, if it does.
- **`docs/glossary.md`:** the MCP entry's example becomes context7 (ADR 0056).
- **[ADR 0031](../../decisions/0031-graphify-not-adopted.md):** `🔍 Revisited by ADR 0056` notes in decisions 1, 2 and 3.
- **Every link to `CLAUDE.md`'s "Project tracking" or its ADR rules** points to the skill where the rule now lives.

## Demo check

➖ N/A: no deployed behavior changes.

## Risks

- **The trigger list is not followed:** a moment passes without the skill. The list sits where the section was, and the skill's description names the same moments.
- **graphify changes `hook-guard`'s input or output:** the wrapper's test uses a stub, so it does not notice. The graphify page says to check by hand after an upgrade.
- **The nudges steer a session wrongly** on a whole-repository `Grep`: capped at 5 per session by graphify.
- **The pinned interpreter path in the committed hooks** names the owner's home directory; it is not a secret.

## Out of scope

- The Terraform MCP server, the Prettier and unlinked-ID hooks, the docs-conformance subagent (ADR 0056, decision 1).
- A committed graph, the merge driver, the `/graphify` skill, graphify in cloud sessions.
- Measuring sessions with and without the graph.

## Left to the builder

- The wording inside both skills, as long as every step and rule of today's `CLAUDE.md` is kept.
- How the wrapper splits a Bash command into words (the push guard's `parseSegments` may be reused or imported).
- Whether the two skills need supporting files next to `SKILL.md`.
