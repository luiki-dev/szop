# Token usage evaluations

Each evaluation checks how well the habits of [working with Claude](working-with-claude.md) keep the work within the weekly limit: the phases and the whole period since the last evaluation, against the baseline of the [token usage audit](../audits/2026-10-26-token-usage.md) and the targets of [ADR 0052](../decisions/0052-working-with-claude.md), decision 14. The rules are in [ADR 0061](../decisions/0061-token-usage-evaluations.md). This page holds each evaluation's findings, newest first; the numbers are in [`evaluations.csv`](../audits/token-usage/evaluations.csv), one row per phase and per period, so evaluations can be compared and charted.

## Contents

- [Running an evaluation](#running-an-evaluation)
- [The data file](#the-data-file)
- [Evaluation 2026-11-02](#evaluation-2026-11-02)
  - [Phases](#phases)
  - [The period](#the-period)
  - [Targets](#targets)
  - [Findings](#findings)

## Running an evaluation

Every few phases, or when the weekly limit looks tight:

1. The period starts the day after the last evaluation's period ends. List the phases with calls in it: `python3 scripts/token-usage.py --by-phase`.
2. Run `python3 scripts/token-usage.py --phase PH-NN` for each of them, and `python3 scripts/token-usage.py --since <start> --until <end>` for the period.
3. Split the period's cost into phases and the rest: the sum of the phases' costs, against the period's total cost of all main sessions and their subagents. The script does not print the total yet, so it is computed from its `load_calls` function.
4. Read the weekly percentages of the period from `~/.claude/usage-log.csv`: where they start, where they end, and every reset.
5. Append the rows to `evaluations.csv` and add a section here, above the last one.

## The data file

`docs/audits/token-usage/evaluations.csv` has one row per phase and one per period of each evaluation. The baseline is evaluation `2026-10-26-baseline`; its phases are the 18 complete phases of the audit, and its period row is recomputed over the same transcripts.

| Column | What it holds |
|---|---|
| `evaluation` | the evaluation's date, or `2026-10-26-baseline` |
| `scope` | `phase` or `period` |
| `id` | the phase ID, or the period's dates |
| `first_call`, `last_call` | the dates of the first and the last call |
| `cost_units` | the cost in units; for a period, all its sessions |
| `nonphase_units` | for a period, the cost of the sessions on no phase branch |
| `median_context` | the median context per main-session call, in tokens |
| `share_above_200k_pct` | the share of main-session cost spent above 200k of context |
| `peak_context` | the largest context of one call, in tokens |
| `main_sessions` | the number of main sessions |
| `idle_rebuild_pct` | the share of cost spent rebuilding the cache after an hour idle |
| `opus_implementer_pct` | the Opus share of the implementer subagents' cost; empty when there were none |
| `weekly_limit_pct` | the weekly limit used, in percentage points, from the usage log; empty before the log existed |
| `plan_tasks` | the number of tasks in the phase's plan; empty without a plan |
| `note` | anything the numbers do not say |

## Evaluation 2026-11-02

The first evaluation, [OP-110](https://github.com/luiki-dev/szop/issues/298): the period from 2026-10-27 to 2026-11-01, the first week worked with the habits.

### Phases

| Indicator | PH-41 | PH-15A | PH-15B | PH-16A | PH-16B | Baseline | Target |
|---|---|---|---|---|---|---|---|
| Phase cost in units | 1.1M | 10.8M | 3.7M | 14.4M | 6.5M | 9.9M | at least 25% lower |
| Median context per main-session call | 110k | 107k | 92k | 124k | 116k | 202k | below 120k |
| Share of main-session cost above 200k | 0% | 2.4% | 0% | 9.0% | 0% | 66% | below 20% |
| Peak context | 146k | 209k | 156k | 232k | 157k | 396k | below 300k |
| Main sessions | 1 | 10 | 5 | 12 | 6 | 2.0 | 3 or more |
| Cache rebuilds after idle, share of cost | 0% | 1.6% | 0% | 0.8% | 2.3% | 4.9% | lower |
| Opus share of implementer subagents' cost | — | 0% | — | 0% | 0% | 46% | near 0 |
| Weekly limit used | 1% | 19% | 5% | 20% | 8% | — | informational |
| Plan tasks | — | 7 | 6 | 8 | 7 | 6.5 (median) | — |

PH-15A includes a 1.7M brainstorm on 2026-10-25, before the habits. PH-41 took the light path, without a plan.

### The period

| Indicator | 2026-10-27 to 2026-11-01 | Baseline period, up to 2026-10-26 |
|---|---|---|
| Cost in units, all sessions | 47.6M | 276M |
| Of which outside phases | 12.8M (27%) | 79.6M (29%) |
| Median context per main-session call | 107k | 198k |
| Share of main-session cost above 200k | 3.6% | 65% |
| Peak context | 232k | 700k |
| Cache rebuilds after idle, share of cost | 0.9% | 4.8% |
| Opus share of implementer subagents' cost | 0% | 45% |
| Weekly limit | from 11% to 75% in six days, no reset | ran out before its reset several weeks in a row |

The work outside phases: the security audit (3.95M), [ADR 0056](../decisions/0056-claude-code-tooling.md) (3.16M), [ADR 0054](../decisions/0054-leaner-documentation.md) (1.84M), sessions on `main` (1.76M), [ADR 0058](../decisions/0058-bug-reports.md) (1.00M) and [ADR 0059](../decisions/0059-session-skills.md) (0.99M).

### Targets

- ✅ **Median context per main-session call below 120k:** 107k over the period; four of five phases below it, PH-16A at 124k.
- ✅ **Share of main-session cost above 200k below 20%:** 3.6%, from 66%.
- ⏳ **Per-phase cost at least 25% below the baseline median:** depends on which phases count. The median of the four planned phases is 8.65M, 13% lower; without PH-15A's brainstorm from before the habits, 7.8M, 21% lower; with PH-41, 6.5M, 34% lower. The plans have 6 to 8 tasks, like the baseline's, so the phases compare. Left to the next evaluation.
- ✅ **The weekly limit not running out before its reset:** 75% at the last row, with a quarter left.

### Findings

- **Short sessions work.** The median context fell by almost half, and the cost spent above 200k nearly disappeared. Implementers run on Sonnet.
- **Phase cost fell less than context.** Each new session starts at about 53k and spends about 43k in its first 20 calls reading the spec, the plan and the code again; PH-16A ran in 12 main sessions and cost the most. The [threshold analysis](working-with-claude.md#why-150200k) puts the threshold within about 7% of the cheapest point, so the remaining gap is not the threshold.
- **A quarter of the cost is outside phases,** as in the baseline. The per-phase reports do not see it; the period rows and the weekly limit do.
- **The weekly percentages in the log are approximate.** On some days the weekly percentage dips and comes back (23, 19, 23), with the 5-hour percentage jumping with it; the cause is not known, possibly a second account writing to the same log.
