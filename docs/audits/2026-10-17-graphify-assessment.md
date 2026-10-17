# graphify assessment — 2026-10-17

An assessment of [graphify](https://github.com/Graphify-Labs/graphify), a tool that turns a repository into a knowledge graph for AI coding assistants, done to decide whether Szop should adopt it. The owner installed it to map the connections between Szop's code and documentation, so that Claude Code could find its way around more cheaply, with fewer tokens.

This is a point-in-time report, not a living document. Its sections are the findings as Claude gave them to the owner in the session of 2026-10-17, kept close to word for word; only links, headings and the questions that ended each reply were changed. The decision it led to is [ADR 0031](../decisions/0031-graphify-not-adopted.md): graphify is not adopted for now, and [OP-095](https://github.com/luiki-dev/szop/issues/211) is the reminder to revisit it.

## Contents

- [Scope and method](#scope-and-method)
- [What graphify is and what it changed](#what-graphify-is-and-what-it-changed)
  - [What it changed in the repository](#what-it-changed-in-the-repository)
  - [What its page says about the goal](#what-its-page-says-about-the-goal)
- [How graphify handles documentation changes](#how-graphify-handles-documentation-changes)
  - [graphify update](#graphify-update)
  - [The /graphify --update skill](#the-graphify---update-skill)
  - [What it means for Szop](#what-it-means-for-szop)
- [How a Claude Code session finds its way around](#how-a-claude-code-session-finds-its-way-around)
- [What the sessions actually cost](#what-the-sessions-actually-cost)
  - [Where the cost comes from](#where-the-cost-comes-from)
  - [How much goes to finding the way around](#how-much-goes-to-finding-the-way-around)
  - [Most-read files and most expensive sessions](#most-read-files-and-most-expensive-sessions)
- [What building the graph cost](#what-building-the-graph-cost)
- [Conclusion](#conclusion)

## Scope and method

**What was tried.** graphify 0.9.92, installed by the owner:

1. `uv tool install graphifyy`, the CLI, with the `terraform` and `postgres` extras (`uv tool install "graphifyy[terraform]"`, `uv tool install "graphifyy[postgres]"`)
2. `graphify install --project`, the Claude Code skill and hooks in this repository
3. `/graphify .` in Claude Code, a full build of the graph, then `/graphify update .` once the Terraform parser was installed

The graph had 1,676 nodes, 2,934 edges and 107 communities (clusters of closely connected nodes). Claude also merged by hand the 61 nodes graphify made for `ADR-NNNN` comments in the code into the nodes of the ADRs themselves, which graphify does not do on its own.

**How it was assessed.**

- **graphify itself:** the repository's [page on GitHub](https://github.com/Graphify-Labs/graphify) and the installed source (`cli.py`, `watch.py`, `cache.py` and the skill's `references/update.md`).
- **The cost of Claude Code sessions:** the transcripts Claude Code keeps of every session in `~/.claude/projects/`. Their usage records give the tokens of every model call; their tool calls and results show what was read and searched. The two scripts are in [`2026-10-17-graphify-assessment/`](2026-10-17-graphify-assessment/): [`analyze_transcripts.py`](2026-10-17-graphify-assessment/analyze_transcripts.py) for the totals, the tool results and the most-read files, and [`context_composition.py`](2026-10-17-graphify-assessment/context_composition.py) for what fills the context. Run them with `python3 -I <script> <session ids to leave out>`.

**What was measured.** 60 sessions and their 211 subagent runs, 7,123 model calls, from the project's start to PH-10. The session that built the graph is left out, so that the build doesn't skew the numbers.

**"Cost"** below means tokens weighted by their relative price, in units of one uncached input token: a cache write costs 2 (1.25 for the 5-minute cache), a cache read 0.1 and an output token 5. Caching makes some kinds of tokens far cheaper than others, so raw counts would mislead.

## What graphify is and what it changed

### What it changed in the repository

| Path | Written by | What it is |
|---|---|---|
| `.claude/skills/graphify/` | `install --project` | The `/graphify` skill (version 0.9.92), with 9 reference files it loads when needed. |
| `.claude/CLAUDE.md` | `install --project` | A 3-line note that points `/graphify` to the skill. |
| `.claude/settings.json` | `install --project` | Two `PreToolUse` hooks: `graphify hook-guard search` runs before Bash/Grep and `graphify hook-guard read` before Read/Glob. They only print a reminder to use the graph and never block a call. It also deleted the file's final newline. |
| `.claude/settings.json.graphify-bak` | `install --project` | A backup of `settings.json` from before the install. |
| `CLAUDE.md`, new `## graphify` section | install | Rules: query the graph before grepping, run `graphify update .` after code changes, and expect large `graph.json` diffs. That last rule assumes the graph is committed, which was not decided. |
| `graphify-out/` (4.7 MB) | `/graphify .` | `graph.json` (1.6 MB), `graph.html` (1.6 MB), `GRAPH_REPORT.md`, `manifest.json` and labels. `.graphify_python` and `.graphify_root` hold paths specific to one machine (`/home/<user>/...`); the other outputs use repo-relative paths. |
| `.gitignore` | the owner | Ignores `graphify-out/cache` and `cost.json`. |

**Not installed:**
- graphify's git hooks (post-commit, post-checkout, post-merge) and its `graph.json` merge driver.
- Automatic rebuilds would have to go through Husky, because `core.hooksPath` is `.husky/_`.

**Would break CI as is:** `prettier --check` flagged 5 files, so `pnpm format:check` would fail:
- `.claude/settings.json`, because of the missing newline;
- 4 generated files in `graphify-out/`, which would need a `.prettierignore` entry.

### What its page says about the goal

The goal was fewer tokens.

- **Code is free; docs cost tokens.**
  - tree-sitter parses code locally, so `graphify update .` costs nothing.
  - Docs go through the large language model (LLM). The first build spent about 1.38M subagent input tokens on 223 doc files.
  - Szop is mostly documentation, and docs change in almost every PR. Keeping the doc side of the graph current is therefore a recurring cost, not a one-off.
- **The "80% fewer tokens" claim is for Graphify Cloud**, not the open-source tool. The open-source benchmarks measure retrieval quality, not token savings. The savings for Szop are unproven until measured.
- **Stale graphs mislead.** Each `graphify update .` also undoes the ADR comment-node merge.
- **Privacy:** every `query`, `path` and `explain` call is logged to `~/.cache/graphify-queries.log`. Setting `GRAPHIFY_QUERY_LOG_DISABLE=1` turns that off.
- **Querying:** graphify can also run as a Model Context Protocol (MCP) server. The page advises choosing either the CLI or MCP for queries, not both.
- **Teams:** the project recommends committing the graph so everyone queries the same thing, and keeping it current with the hooks or the merge driver.

## How graphify handles documentation changes

The question: does `graphify update` use a cache or an incremental approach for documentation changes, or is it always a full rebuild? Read from the installed source (graphify 0.9.92). The short answer is that `graphify update .` never updates documentation. Doc changes are handled by a different, incremental path, `/graphify --update`, which runs inside Claude Code.

### graphify update

The CLI command, in `cli.py` and `watch.py`:

- **It only processes code.** It calls `_rebuild_code(..., changed_paths=None)`, and the docstring says that means "the full code corpus is re-extracted". It also prints "For doc/paper/image changes run /graphify --update in your AI assistant."
- **For code it's a full pass, but a cached one.** Every code file is re-read, but each file's parse result is stored in `graphify-out/cache/ast/` under a hash of its content (`load_cached` and `save_cached`). Unchanged files come back from that cache, so the run is fast and uses no LLM.
- **Docs that already went through the LLM are kept exactly as they were** (`semantic_doc_files`, graphify issue #1915). It never sends them to the LLM again, even if they were edited. An edited ADR keeps its old nodes until a `/graphify --update` runs.
- **New docs get only a cheap structural scan** (headings, no LLM), so they appear in the graph with no real meaning attached.

### The /graphify --update skill

The skill's `references/update.md`. This path is incremental at the file level, in three layers:

1. **Change detection:** `detect_incremental` compares each file against `manifest.json`, which records an `ast_hash` and a `semantic_hash` per file. Only new, changed or deleted files go through.
2. **Semantic cache:** `check_semantic_cache` looks up each changed doc in `graphify-out/cache/semantic/` by a hash of its body and of the extraction prompt.
   - Front matter is left out of the hash, so editing only the front matter doesn't trigger re-extraction.
   - A graphify upgrade that changes the prompt does re-extract everything.
3. **Merge:** `build_merge` replaces only the nodes from the files it re-extracted and keeps everything else.

So editing 3 ADRs costs LLM tokens for those 3 files, not for the 223 doc files.

### What it means for Szop

1. **There are two update paths with different costs.** The code side can be refreshed cheaply after every change. The doc side, which is most of the repo, goes stale until someone runs `/graphify --update`, and that costs tokens each time.
2. **The manual ADR merge doesn't survive an update.** Because `graphify update .` re-reads every code file, a single run brings back all 61 comment nodes at once. Not run to confirm, because it would have undone the merge.
3. **The semantic cache had 126 entries for 223 doc files.** Not looked into. It doesn't matter while `manifest.json` drives change detection, but a lost manifest would mean paying for about 97 docs again.

## How a Claude Code session finds its way around

Claude doesn't scan anything in full and keeps no index between sessions. Each session starts from scratch and reads files only when it needs them, following links and searching.

**How a session finds its way around**

1. **Always loaded:** the owner's global and project `CLAUDE.md` files and the memory index. The project `CLAUDE.md` alone is 16 KB, about 4k tokens, paid at the start of every session.
2. **When a task arrives, for example "next phase from the roadmap":** Claude opens `roadmap.md`, follows its links to the phase issue, the ADRs and the specs it names, and then searches with grep or file-name patterns for anything the links don't reach.
3. **Reads are mostly whole files.** Most docs here are small enough to read whole, so Claude reads the whole file even when it needs one section. `roadmap.md` is 46 KB (about 11k tokens) and `architecture.md` is 39 KB.
4. **What has been read stays in the conversation.** That context is re-sent on every turn. Caching makes the re-sends cheaper but not free, and once the conversation fills up it gets summarized.
5. **Subagents start empty.** Every subagent re-reads what it needs, so one review with three agents can read the same ADR three times.

**Why the worry about the docs was reasonable**

- **The repo is mostly docs.** Tracked Markdown totals 2.4 MB, about 600k tokens. The app code (`.ts`, `.tsx`, `.tf`) is only 100 KB.
- **The cost doesn't come from scanning everything.** It comes from reading big files whole, re-reading the same files across sessions and subagents, and following ADR chains several hops deep.

## What the sessions actually cost

### Where the cost comes from

| What | Tokens | Share of cost |
|---|---|---|
| Re-reading cached context on every call | 1,162M cache reads | 61% |
| Writing new context to the cache | 31.6M cache writes | 28% |
| Output, mostly tool calls and edits | 4.4M | 12% |
| Uncached input | 0.02M | 0% |

The total is 190.8M weighted tokens.

The cost doesn't come from what Claude reads. It comes from **how many calls a session makes, multiplied by how big the context already is**. On average, every call re-sends about 160k tokens.

- **Every session and every subagent starts at about 45k tokens** before doing anything (median 45,254 at a session's first call). That covers the system prompt, the tool list, the `CLAUDE.md` files and the skill list.
- **A phase usually costs 9–12M** of these weighted tokens, and the most expensive (PH-07) cost 25M. Those sessions run 400–800 calls with 15–35 subagents, and each subagent pays the 45k start again.

### How much goes to finding the way around

Tool results returned 5.3M tokens in all: Bash 57%, Read 39%, everything else 4%.

| Source | Tokens returned |
|---|---|
| grep or rg through Bash | 1.06M |
| `git diff`, `show` and `log`, mostly for reviews | 0.61M |
| `cat`, `sed` and `head` through Bash | 0.55M |
| Reading plan-execution notes in `.superpowers/` (constraints, review diffs) | 1.07M |
| Reading docs: specs and plans 175k, living docs 127k, ADRs 55k | 0.36M |
| Reading code | 0.01M |

- **The docs aren't where the tokens go.** Reading `docs/` directly is about 1.5% of the cost.
- **Searching is what graphify could cut.** grep plus `cat`/`sed` is about 1.6M tokens returned, under 10% of the cost even counting the re-sends. That share is the ceiling on what graphify could save, and the graph queries themselves cost tokens too.
- **Reads are mostly whole files:** 540 whole-file reads against 129 with an offset or a limit.

What fills the context, estimated from the transcript text, as tokens added and their weighted cost including the re-sending on later calls:

| Content | Tokens added | Share of the estimated cost |
|---|---|---|
| Attachments: reminders, hook output, file references, the skill list and `CLAUDE.md` | 11.4M | 48% |
| Bash results | 3.1M | 19% |
| Claude's tool calls (their inputs, edits included) | 2.0M | 13% |
| Read results | 2.1M | 8% |
| Claude's text | 0.5M | 4% |
| Skill bodies and slash commands | 0.3M | 4% |
| The owner's messages and reminders | 0.6M | 3% |

The attachments row is overstated: most of it (6.6M) is `prompt_snapshot` records, which the transcript keeps but which are most likely not sent to the model again. The ranking of the other rows holds either way.

### Most-read files and most expensive sessions

The most-read files are the plan-execution notes in `.superpowers/sdd/`, not docs:

| Reads / sessions | File |
|---|---|
| 16 / 1 | `.superpowers/sdd/2026-10-05-PH-03-api-skeleton/global-constraints.md` |
| 11 / 1 | `docs/superpowers/plans/2026-10-02-PH-01-monorepo-and-toolchain.md` |
| 10 / 1 | `szop-ring-tail` checkout: `.superpowers/sdd/2026-10-07-ring-tail-redesign/constraints.md` |
| 10 / 1 | `.superpowers/sdd/2026-10-11-PH-07-first-e2e-journey/global-constraints.md` |
| 9 / 1 | `szop-ring-tail` checkout: `docs/open-points.md` |
| 8 / 2 | `.superpowers/sdd/2026-10-02-PH-01-monorepo-and-toolchain/review-c7f00d2..526e629.diff` |
| 6 / 4 | `docs/open-points.md` |
| 6 / 3 | `docs/roadmap.md` |
| 5 / 5 | `CLAUDE.md` |

| Session | Cost | Calls | Subagents | Tool results |
|---|---|---|---|---|
| PH-07 First E2E journey | 25.2M | 836 | 34 | 713k |
| PH-07 First E2E journey (2) | 18.8M | 352 | 0 | 92k |
| PH-02 CI checks | 12.6M | 476 | 18 | 341k |
| PH-06b Web security baseline | 10.4M | 416 | 15 | 373k |
| Szop redesign | 10.2M | 443 | 13 | 355k |
| The Next Big Thing | 10.2M | 493 | 23 | 347k |
| PH-05 SPA skeleton | 9.7M | 450 | 17 | 385k |
| PH-03 API skeleton | 9.1M | 479 | 20 | 433k |
| PH-10 Domain and base infrastructure | 8.8M | 445 | 22 | 308k |
| PH-04 Database | 8.8M | 427 | 18 | 398k |
| PH-08 Container image | 8.7M | 256 | 1 | 112k |
| PH-09 AWS account and Terraform bootstrap | 8.3M | 202 | 1 | 87k |

The median session, short ones included, cost 0.74M.

**Caveats.**
- The breakdown by content type is an estimate from the transcript text (4 characters per token), and it ignores context summarization. The totals come straight from the recorded usage numbers.
- The transcripts can undercount output: in the build session's subagents, the recorded output was about 17k tokens against about 67k tokens of text and tool calls they wrote. If that held everywhere, output would be a larger share than 12%; the conclusion doesn't change.
- The data shows what sessions did without the graph. It can't show whether the graph would have cut the number of searches and reads; that needs the same tasks run with and without it.

## What building the graph cost

From the transcript of the session that built it, weighted the same way:

| Step | Cost |
|---|---|
| 18 extraction subagents, reading the 223 doc files | 2.3M |
| Claude running the build | 0.7M |
| **The first build** | **about 3.0M** |
| The update after the Terraform parser was installed | 0.4M |

**About 3M weighted tokens, a third of a typical phase (9–12M).** Against that, the most graphify could save is the search share, under 10% of a phase: under 1M per phase, and less in practice, since graph queries cost tokens too and searches don't all go away. The build alone is worth at least three phases of the best-case savings, before any `/graphify --update` to keep the doc side current.

## Conclusion

The data doesn't support the worry that the docs are scanned expensively. Navigating the docs is a small, link-driven cost. The bigger factors are long sessions, the number of subagents and the 45k starting context, and graphify touches none of them. Its realistic gain is a slice of the under-10% search share, while keeping the doc side of the graph current costs tokens on every update.

The owner decided not to adopt graphify for now, while the code base is small: [ADR 0031](../decisions/0031-graphify-not-adopted.md).
