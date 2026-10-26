# Token usage baseline

- **Date:** 2026-10-26
- **Status:** a point-in-time record. It describes the transcripts up to the end of 2026-10-26 and stays as written; the decisions taken from it are in ADR 0052, and later measurements go in reports and in audits of their own.
- **Design:** [Working with Claude within the weekly limit](../superpowers/specs/2026-10-26-working-with-claude-design.md)

The owner's Claude Code Pro subscription ran out of its weekly limit several weeks in a row. This audit reads every Szop session transcript on the owner's machine to find out where the usage goes, and records a baseline: the value of each indicator that later phases are measured against. The findings feed the design above and ADR 0052. The anchors [`#baseline`](#baseline) and [`#baseline-phases`](#baseline-phases) are cited by `scripts/token-usage.py`, the ADR and the guide.

## Contents

- [Period and method](#period-and-method)
- [Findings](#findings)
- [The simulation](#the-simulation)
- [Baseline](#baseline)
- [Baseline phases](#baseline-phases)
- [The analysis scripts](#the-analysis-scripts)

## Period and method

**Period.** Every transcript in `~/.claude/projects/-home-lemekk-workspace-szop/`, subagent transcripts included: 86 main-session transcripts and 340 subagent transcripts. The calls carry timestamps from 2026-09-21 to 2026-10-26, the cut-off. The earliest transcript files date from 2026-09-27; the calls before that day are copies that resumed sessions made of earlier calls. The cut-off is the end of 2026-10-26 in UTC, so the baseline can be recomputed later from the same transcripts with `--until 2026-10-26`. Sessions kept running on 2026-10-26 while this audit was written, so a recomputation made later can differ from the baseline in the last digit of the idle and Opus shares. The design wrote the period as starting on 2026-09-27; the script reports 2026-09-21 as its first call date.

**Calls.** One call is one API call. Calls are counted once, deduplicated by `requestId`, or by the message `id` when the request ID is missing, across all files, since a resumed or forked session copies earlier calls into its own file. Records of the model `<synthetic>` are skipped. The period holds 11,787 calls.

**Cost units.** Tokens are weighted by list-price ratios, in units of one Opus input token: input 1, cache write 1.25, cache read 0.1, output 5. Sonnet counts 0.6 and Haiku 0.2 of Opus. The units only approximate how the subscription meters usage; the limit's own percentage is the ground truth, and the status line's comma-separated values (CSV) log records it from now on. The period totals 272.7M units.

**Main session and subagents.** A main-session call comes from a transcript outside a `subagents/` directory. The context of a call is its `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.

**Phase attribution.** Each main session goes to the phase whose `ph-NN` branch it was on most often, and its subagents go with it. A session with no `ph-NN` branch belongs to no phase: it counts in the totals but not in phase figures. A phase is **complete** when it was started after the first transcript and merged by 2026-10-26; only complete phases enter the median phase cost ([Baseline phases](#baseline-phases)).

## Findings

Shares are of the total cost unless the row says otherwise. The values come from the frozen scripts and from `scripts/token-usage.py`, run on 2026-10-26 over the whole period.

| Finding | Number |
|---|---|
| Total over the period | 272.7M units |
| Cost by kind of token | cache reads 67.2%, cache writes 20.6%, output 12.2%; thinking tokens (inside output) 3.3% |
| Main session vs subagents | 77.8% vs 22.2% |
| By model and effort | Opus high 62.7%, Opus medium 26.7%, Opus xhigh 0.8%, Sonnet 9.4%, Haiku 0.2% |
| Main session by active skill | subagent-driven development 35.8%, brainstorming 24.2%, test-driven development 10.4%, executing plans 8.0%, writing plans 8.0% (of the total; the main session is 77.8%) |
| Main sessions per phase | median 2 over the baseline phases, from 1 to 6; the longest sessions peak at 500–700k tokens of context |
| Median context per main-session call | 202k |
| Share of main-session cost spent at 200k of context or more | 66% |
| Median cost per call by context | 13k units below 100k, 20k at 100–200k, 30k at 200–300k, 42k at 300–500k, 62k above 500k |
| Cache rebuilds after more than 1 h idle | 73 rebuilds, 4.9% of total |
| Implementer subagents on Opus | 13 agents cost 4.0% of total; 79 on Sonnet cost 4.7% |
| A new session's first call | a median of 48k of context (the fifth call: 64k); after a compaction 57–68k in most cases |

Where these differ from the design's table, this audit's values stand: transcripts of 2026-10-26 were added after the design was written. The differences are the median context (202k, the design says 208k), the share above 200k (66%, the design says 58%), the share of the subagent-driven skill (35.8% of the total, the design says 40%), the number of sessions per phase (median 2, the design says almost always one) and the totals by a few tenths of a percent.

The conclusion holds: **cost tracks how long a session runs, not how big the phase is.** Every call re-reads the whole context from the cache, so a session's cost grows roughly with the square of its length. A main-session call above 500k of context costs about five times one below 100k. Other numbers that point the same way: 26% of the total was spent on main-session calls beyond the 150th call of their session, and the median main session has 33.5 calls but the longest has 349.

## The simulation

`sim.py` replays the main sessions with the context cut back at two kinds of points, and reports the cost that remains as a share of the main-session cost. It assumes a new stage starts from a base of 50k tokens plus 20k of hand-off, and that a cap restarts a session when it passes the cap. Both numbers are rough: the model ignores that a restart loses some working state, and it counts the cost of the restarts only partly.

| Variant | Output of `sim.py` | Saving the design uses |
|---|---|---|
| Restart at each stage boundary | 74% of main-session cost remains | about 20% |
| Also restart above 200k of context | 64% remains | about 30–35% |
| Also restart above 150k of context | 59% remains | about 30–35% |

The script's raw output saves more than the design's rounded figures. The design keeps the lower numbers to allow for the restarts' own cost (about 55k units for the first three calls of a session) and for the stage boundaries a real session would not hit cleanly.

## Baseline

The values that [`scripts/token-usage.py`](../../scripts/token-usage.py) stores as `BASELINE`. Each is computed over the period up to 2026-10-26. The first and the fourth and fifth rows use the complete baseline phases ([Baseline phases](#baseline-phases)); the others use all sessions of the period.

| Indicator | Baseline | Target |
|---|---|---|
| Phase cost in units | 9.9M (the median of the 18 complete phases) | at least 25% lower |
| Median context per main-session call | 202k | below 120k |
| Share of main-session cost above 200k | 66% | below 20% |
| Peak context | 396k (the median of the phases' peaks; single sessions peak at 193–700k) | below 300k (auto-compact) |
| Main sessions per phase | 2.0 (the median of the complete phases) | 3 or more |
| Cache rebuilds after idle, share of cost | 4.9% | lower |
| Opus share of implementer subagents' cost | 46% | near 0 |
| Weekly limit used during the phase | — (no log before) | from the CSV, informational |

The design's baseline column read 208k, 58% and 350–700k for rows two, three and four. The values here replace them ([Findings](#findings)).

## Baseline phases

A **baseline phase** is a phase with sessions in the period. Twenty phases qualify. Two are listed but left out of the median, so the median phase cost, the median peak context and the median main sessions per phase are taken over 18 complete phases.

How completeness was decided:

- **Started after the first transcript.** The earliest transcript files date from 2026-09-27. The first call of every phase below falls on 2026-10-05 or later, and each phase's first spec or roadmap commit in `git log` falls on the same day or one day earlier, so no phase lost sessions to deleted transcripts. PH-01 to PH-03 have no phase-attributed sessions and do not appear.
- **Merged by 2026-10-26.** [`roadmap.md`](../roadmap.md) shows ✅ Done with a pull request link for the 18 included phases, and `git log` shows their merge commits on or before 2026-10-26.

| Phase | Cost units | Main sessions | Peak context | First call | Last call | In the median |
|---|---|---|---|---|---|---|
| PH-07 | 21.9M | 4 | 693k | 2026-10-10 | 2026-10-12 | ✅ Included |
| PH-12C | 18.1M | 6 | 533k | 2026-10-20 | 2026-10-21 | ✅ Included |
| PH-12D | 17.1M | 5 | 524k | 2026-10-21 | 2026-10-22 | ✅ Included |
| PH-35 | 14.6M | 3 | 387k | 2026-10-22 | 2026-10-22 | ✅ Included |
| PH-05 | 14.5M | 2 | 444k | 2026-10-07 | 2026-10-07 | ✅ Included |
| PH-04 | 12.0M | 6 | 357k | 2026-10-05 | 2026-10-08 | ✅ Included |
| PH-14B | 10.8M | 1 | 504k | 2026-10-24 | 2026-10-25 | ✅ Included |
| PH-36 | 10.1M | 2 | 481k | 2026-10-18 | 2026-10-19 | ✅ Included |
| PH-11 | 10.1M | 1 | 346k | 2026-10-17 | 2026-10-18 | ✅ Included |
| PH-06B | 9.6M | 4 | 421k | 2026-10-10 | 2026-10-10 | ✅ Included |
| PH-08 | 8.1M | 2 | 405k | 2026-10-12 | 2026-10-12 | ✅ Included |
| PH-12B | 8.0M | 1 | 373k | 2026-10-18 | 2026-10-18 | ✅ Included |
| PH-09 | 7.4M | 1 | 419k | 2026-10-12 | 2026-10-15 | ✅ Included |
| PH-10 | 7.3M | 1 | 275k | 2026-10-15 | 2026-10-16 | ✅ Included |
| PH-06A | 7.2M | 4 | 258k | 2026-10-08 | 2026-10-08 | ✅ Included |
| PH-14A | 7.1M | 1 | 377k | 2026-10-24 | 2026-10-24 | ✅ Included |
| PH-12A | 6.1M | 3 | 283k | 2026-10-18 | 2026-10-18 | ✅ Included |
| PH-37 | 4.9M | 1 | 343k | 2026-10-21 | 2026-10-21 | ✅ Included |
| PH-15A | 1.7M | 1 | 193k | 2026-10-25 | 2026-10-25 | ✖️ Left out: not merged by 2026-10-26 (its branch `feat/ph-15a-seed-catalog` is open; PH-15 is ⬜ Not started on the roadmap), and the sessions are only a brainstorm |
| PH-40 | 0.9M | 0 | — | 2026-10-26 | 2026-10-26 | ✖️ Left out: merged on 2026-10-26, but it has no main sessions in the transcripts (its main session sat mostly on another branch), so only a few subagent calls are attributed to it |

**The median phase cost of the 18 complete phases is 9.9M units** (the mean of the 9th and 10th costs, 9.60M and 10.13M, is 9.86M). The median peak context is 396k and the median number of main sessions is 2.

## The analysis scripts

`docs/audits/2026-10-26-token-usage/` holds the scripts that produced the numbers above. They are **frozen** with this audit and never edited; `scripts/token-usage.py` is the maintained port, and it reproduces their numbers. They use only the Python standard library. Run each from its own folder, with the transcript directory as the argument, because `sim.py`, `extra.py` and `sub.py` read their sibling files by relative path:

```bash
cd docs/audits/2026-10-26-token-usage
python3 usage.py ~/.claude/projects/-home-lemekk-workspace-szop/
```

| File | What it computes |
|---|---|
| `usage.py` | Loads and deduplicates the calls and prints the main tables: cost by token kind, main session against subagents, model and effort, subagent task kinds, active skill, what each call did, branch type, context size per call, ISO weeks and the top sessions. The other scripts reuse its loading code. |
| `extra.py` | Median context of main-session and subagent calls, the share of cost in large cache writes, calls per session, and the cost of calls beyond the 150th in a session. |
| `phases.py` | The context of a session's first call, compactions with the context before and after, the per-phase table (share, peak context, cost by stage), the cost of each main session, the thinking share and the cache rebuilds after more than one hour idle. |
| `sim.py` | The restart simulation ([The simulation](#the-simulation)) and the median cost per call by context size. It reads `phases.py`, so it must run from the folder. |
| `sub.py` | The cost of subagents by task kind and model, which gives the Opus share of implementers. |

Because the frozen scripts take no date filter, they read whatever transcripts exist when they run; the figures in this audit come from a run on 2026-10-26.
