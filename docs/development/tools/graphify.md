# graphify

graphify is a command-line tool that builds a map of a code base (a knowledge graph of its files, functions and the relations between them) and answers questions from it. Szop uses it for **code only**: Claude Code sessions run `graphify query` to find the files and symbols a question is about, instead of searching and reading raw files.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [The configuration](#the-configuration)
- [What was left out](#what-was-left-out)
- [The owner's steps](#the-owners-steps)
- [Upgrading graphify](#upgrading-graphify)
- [Official documentation](#official-documentation)

## Why Szop uses it

[ADR 0056](../../decisions/0056-claude-code-tooling.md), decisions 3 to 7. [ADR 0031](../../decisions/0031-graphify-not-adopted.md) did not adopt graphify: the code base was small, and building the graph from documents cost model tokens. It named the conditions to revisit; the code base has grown since. The graph is now built from code only, by parsing (the abstract syntax tree, [AST](../../glossary.md)), which calls no model and costs no tokens. The documents stay out through `.graphifyignore`, and the graph is not committed, so each machine builds its own.

## The configuration

- **`.graphifyignore`:** `docs/`, `*.md`, `*.mdx`, `*.pdf` and `*.txt` stay out of the graph.
- **`.gitignore`:** `graphify-out/`, where the graph and its reports are written, is not committed.
- **The four husky hooks:** `.husky/post-commit`, `post-checkout`, `post-merge` and `post-rewrite` are graphify's own output (`graphify hook install`), and rebuild the graph in the background after the git operation they are named for. Each has one line added after the shebang, the **guard line**: `command -v graphify >/dev/null 2>&1 || exit 0`. Without it, a machine without graphify would print a warning on every commit. The pinned interpreter path inside the hooks is graphify's first probe and falls through to the others on any other machine, so it stays.
- **The guard wrapper:** graphify's own `hook-guard` nudges a session to query the graph before a search or a read. `.claude/hooks/graphify-guard.ts` runs it only when a path the call touches is in the graph, and prints nothing when every path is ignored by `.graphifyignore`. It is wired in `.claude/settings.json` next to the push guard: `Bash|Grep` with the argument `search` and `Read|Glob` with `read`, each with `timeout: 10`. It fails open: if graphify or git is missing or anything goes wrong, the call goes on without the nudge. A known limit: a Bash call that names a path outside the project loses the nudge. The guard line also skips the rebuild where graphify is installed but not on `PATH` (for example a GUI git client). A Bash command starting with `cd <project root>;` always reaches graphify's guard, since the `cd` target resolves to `.`, which is not ignored, so subagents, which prefix commands that way, get nudged even on docs-only work (graphify caps the nudge at 5).
- **The `CLAUDE.md` rule:** the `## graphify` section of the root `CLAUDE.md` tells sessions to run `graphify query` before their first search or source read, and to run `graphify update .` first when code changed since the last commit.

## What was left out

- **The merge driver** that `graphify hook install` registers (a `.gitattributes` line and `merge.graphify.*` git config): it only matters for a committed graph.
- **The `/graphify` skill** and **`.claude/CLAUDE.md`**: they build the graph from documents with a model.
- **graphify's own entries in `.claude/settings.json`:** the wrapper replaces them.

`graphify claude install` is never run again in the repository. Version 0.9.97 writes its `CLAUDE.md` section with no markers, so it cannot be told from the edited one, and it leaves a `.claude/settings.json.graphify-bak` file behind.

## The owner's steps

The steps are in the [spec](../../superpowers/specs/2026-10-29-claude-code-tooling-design.md#graphify-what-the-owner-does):

1. `uv tool install graphifyy` ([setup guide](../setup.md#optional-graphify)).
2. `graphify update .` in the repository: the first, code-only build.
3. Approve the context7 server when Claude Code asks ([context7](context7.md)).
4. For cloud sessions, paste `mcp.context7.com` into the cloud environment's *Network access* setting ([setup guide](../setup.md#all-hosts-to-paste)).

The owner does not run `graphify hook install` or `graphify claude install`: the branch holds their output.

## Upgrading graphify

A new version may change the hooks or the output of `hook-guard`, which the wrapper's test cannot notice, since it uses a stub.

1. `uv tool upgrade graphifyy`.
2. `graphify hook uninstall`, then `graphify hook install`.
3. Every `graphify hook install` adds the merge driver again: delete the new line from `.gitattributes` and run `git config --local --unset-all merge.graphify.name` and `merge.graphify.driver`.
4. Put the guard line back after the shebang of the four hooks, and check the diff of `.husky/` for anything else that changed.
5. Check the guard by hand: `echo '{"tool_name":"Read","tool_input":{"file_path":"'$PWD'/apps/api/src/app.ts"},"cwd":"'$PWD'"}' | CLAUDE_PROJECT_DIR=$PWD node .claude/hooks/graphify-guard.ts read` prints graphify's nudge for `app.ts`; the same with `docs/roadmap.md` prints nothing.
6. Commit.

## Official documentation

- Repository and README: <https://github.com/Graphify-Labs/graphify>
