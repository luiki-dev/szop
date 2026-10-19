# ADR 0035 — A wider roadmap diagram

- **Status:** ✅ Accepted — decision 1 refined by [ADR 0037](0037-twelve-phases-a-diagram-row.md) (a row holds at most twelve phases, so the diagram is about 99 characters wide)
- **Date:** 2026-10-19
- **Refines:** [ADR 0017](0017-readme-roadmap-diagram.md), decision 2 (a row of the README's roadmap diagram holds at most nine phases, so the diagram stays about 75 characters wide)

## Context

[PH-36](../roadmap.md#ph-36-scalability-and-isolation-analysis) brought Stage 3 to ten phases, one more than a row of the README's diagram holds. Its PR wrapped Stage 3 onto a second row with PH-34 alone on it, and turned every row after it around. The owner found a stage split for one phase harder to read than a wider diagram, and asked for the diagram to be 16 characters wider, so that Stage 3 fits on one row.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | How many phases a row holds | Nine, wrapping Stage 3 onto a second row; eleven, 16 characters wider | **At most eleven, so the diagram is about 91 characters wide.** Stage 3's ten phases fit on one row, and so does every stage but Stage 4. The owner's choice. The wider block still fits GitHub's README column on a desktop; on a phone it scrolls sideways, as the narrower one did. *(Claude's call:)* a stage fills a row before continuing on the next, as before, so Stage 4's eighteen phases are eleven and seven. The rest of [ADR 0017](0017-readme-roadmap-diagram.md), decision 2 stays: the road snakes, the bends are three lines tall, and it runs from `START` to `DONE`. <br>✏️ **Refined by [ADR 0037](0037-twelve-phases-a-diagram-row.md), decision 1:** a row holds at most twelve phases, so the diagram is about 99 characters wide. |

## Consequences

- **The README's diagram is redrawn** at the new width, with Stage 3 on one row. Each row turns the way it did before PH-36 was added.
- **A stage that grows past eleven phases wraps again**, like Stage 4.
- **This ADR's [issue](https://github.com/luiki-dev/szop/issues/231) is closed by the PR that merges it.**
