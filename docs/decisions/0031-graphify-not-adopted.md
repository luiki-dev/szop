# ADR 0031 — graphify not adopted for now

- **Status:** ✅ Accepted
- **Date:** 2026-10-17

## Context

Szop is built almost entirely in Claude Code sessions, and the repository is mostly documentation: 2.4 MB of tracked Markdown, about 600k tokens, against 100 KB of application code. The owner worried that sessions spend too many tokens finding their way through the docs, without a way to tell.

[graphify](https://github.com/Graphify-Labs/graphify) turns a repository into a knowledge graph that an AI coding assistant queries instead of searching and reading raw files. Code is parsed locally at no cost; docs go through a large language model (LLM). The owner installed it (graphify 0.9.92, as a `uv` tool and in the project with `graphify install --project`) and built a graph of Szop, to map the connections between code and docs and so make sessions cheaper.

Before deciding, Claude assessed the tool and measured what the project's past sessions actually cost, from the transcripts Claude Code keeps. The full assessment is in [the graphify assessment](../audits/2026-10-17-graphify-assessment.md). In short:

- **Sessions cost what they cost because of their length, not their reading.** 61% of the cost is cached context re-sent on every call (about 160k tokens per call on average), and every session and subagent starts at about 45k tokens. A phase usually costs 9–12M weighted tokens.
- **Finding the way around is a small share.** Search output (grep, `cat`, `sed`) is under 10% of the cost, and reading `docs/` directly about 1.5%. That share is the most graphify could save.
- **The graph needs upkeep in tokens.** `graphify update .` refreshes only the code, for free; doc changes need `/graphify --update`, which sends each changed doc through the LLM. Szop's PRs change docs almost every time.
- **graphify's own savings claim** ("80% fewer tokens") is for its hosted product; the open-source tool's benchmarks measure answer quality, not tokens.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Adopting graphify | Adopt it, the graph committed so every session queries the same one; adopt it per machine, the graph left out of git; don't adopt it now | **Don't adopt it now.** The cost of the graph is larger than what it could save. Building it cost about 3.0M weighted tokens (2.3M for the 18 subagents that read the 223 docs, 0.7M for running the build), plus 0.4M for one update: a third of a typical phase. Against that, the most it could save is the search share, under 10% of a phase, so under 1M per phase, and less in practice, since graph queries cost tokens too and not every search goes away. The build alone is worth at least three phases of the best case, before any doc update to keep it current. Committing the graph would also add about 3 MB of regenerated files to every PR; keeping it per machine would mean every machine, claude.ai/code sessions included, building and paying for its own. |
| 2 | The trial install | Keep it in the repository, unused; remove it | **Removed from the repository:** the skill in `.claude/skills/graphify/`, its note in `.claude/CLAUDE.md`, its two `PreToolUse` hooks in `.claude/settings.json`, its section in `CLAUDE.md`, its lines in `.gitignore` and the built graph in `graphify-out/`. None of it was committed. The hooks would have run before every search and read on any machine, failing where graphify isn't installed, and the `CLAUDE.md` rules would have told every session to query a graph that isn't there. The owner's global `uv` install is theirs to keep or remove. |
| 3 | Revisiting it | Close the question; revisit when something changes | **Revisit once the code base is larger,** the owner's choice, through [OP-095](https://github.com/luiki-dev/szop/issues/211), a candidate on the board. The triggers: the code grows well past its 100 KB of 2026-10-17, or search output becomes a large share of a session's cost, or sessions often lose their way in the code. The assessment's scripts measure the same numbers again; before adopting, a few tasks are run with and without the graph, which this assessment couldn't do. |

## Consequences

- **Sessions keep finding their way as before:** `CLAUDE.md`, links between the docs, search and reads. No tool or rule changes.
- **The assessment and its two scripts stay in `docs/audits/`** as a point-in-time record and a baseline for [OP-095](https://github.com/luiki-dev/szop/issues/211).
- **What the assessment showed but this ADR doesn't act on:** the bigger costs are long sessions, many subagents (each one starting at about 45k tokens) and the context every session starts with. Any work on them is its own decision.
- **This ADR's [issue](https://github.com/luiki-dev/szop/issues/210) is closed by the PR that merges it.**
