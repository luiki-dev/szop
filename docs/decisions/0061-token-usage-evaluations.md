# ADR 0061 — Token usage evaluations: repeated, with the whole period, in a data file

- **Status:** ✅ Accepted
- **Date:** 2026-11-02
- **Extends:** [ADR 0052](0052-working-with-claude.md), decision 14 (evaluations repeat, and cover the whole period, see decisions 1 and 2); [ADR 0052](0052-working-with-claude.md), decision 3 (the threshold's reasoning, see decision 3)

## Context

[ADR 0052](0052-working-with-claude.md) changed how a phase is worked, to keep one Claude Pro account within its weekly limit, and set four targets to check after 3–4 phases ([OP-110](https://github.com/luiki-dev/szop/issues/298)). The first evaluation, on 2026-11-02, covered the week from 2026-10-27 to 2026-11-01: five phases (PH-41, PH-15A, PH-15B, PH-16A, PH-16B) and the work outside them. Three targets were met; the per-phase cost was 13–34% below the baseline median, depending on which phases count.

Three questions came with it. The owner plans to evaluate again from time to time and to chart the progress later, so the results need a form that grows and compares. The phases are 73% of the period's cost; the other 27% (ADRs, an audit, tooling) counts toward the weekly limit as much, and ADR 0052's targets do not see it. And the owner asked whether the 150–200k threshold for a restart is set where a smaller context per call and the cost of starting a session again balance.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | How evaluations are recorded | A Markdown page with a table extended each time; a data file and a page; a data file filled by a flag of `scripts/token-usage.py` | **A data file, [`docs/audits/token-usage/evaluations.csv`](../audits/token-usage/evaluations.csv), with one row per phase and one per period of each evaluation, the baseline included; and a page, [Token usage evaluations](../development/token-usage-evaluations.md), with the steps and each evaluation's findings, newest first** _(Claude's proposal, the owner's choice)_. The file can be charted without parsing Markdown; the page holds what the numbers do not say. A flag in the script is not added: the rows are copied from its reports by hand, which is enough for an evaluation every few phases. |
| 2 | What an evaluation covers | The phases only, as in ADR 0052; the phases and the whole period | **The phases and the whole period: its total cost, the share outside phases, the median context and the share above 200k over all main sessions, and the weekly limit used** _(Claude's proposal, the owner's choice)_. The phases show what a feature costs; the period shows how well the work with Claude goes overall, and the weekly limit is spent on both. |
| 3 | The restart threshold of 150–200k | Keep it; lower it (yellow from 120k, red from 160k) | **Kept, with its reasoning written down in [the guide](../development/working-with-claude.md#why-150200k)** _(Claude's proposal, the owner's choice)_. With a restart costing about 35–65k units and the context growing by about 2k per call, the cheapest restart is at about 90–130k of context; the curve is flat, and 150–200k costs about 7% more per call than its lowest point, against about 45% at 300k. A lower threshold would save a few percent and add hand-offs. |

## Consequences

- An evaluation runs every few phases, by the steps on the evaluations page, and appends its rows to the data file. A chart of the progress can be drawn from the file at any time.
- [OP-110](https://github.com/luiki-dev/szop/issues/298) is done by the first evaluation; the per-phase cost target is checked again at the next one.
- The period's split into phases and the rest is computed outside the script for now; if the evaluations become frequent, a flag that prints the period's rows is the next step.
