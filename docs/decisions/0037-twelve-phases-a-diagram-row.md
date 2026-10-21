# ADR 0037 — Twelve phases a diagram row

- **Status:** ✅ Accepted — decision 1 refined by [ADR 0038](0038-app-on-ecs-and-rds-details.md), decision 2 (at most ten phases a row, so the diagram is about 84 characters wide)
- **Date:** 2026-10-20
- **Refines:** [ADR 0035](0035-wider-roadmap-diagram.md), decision 1 (a row of the README's roadmap diagram holds at most eleven phases, so the diagram is about 91 characters wide)

## Context

[ADR 0036](0036-scalability-and-isolation.md) adds PH-37 Two tasks and PH-38 Autoscaling to Stage 3, which then holds twelve phases, one more than a row of the README's diagram holds since [ADR 0035](0035-wider-roadmap-diagram.md). Three other ways were offered to the owner: moving PH-38 to the start of Stage 5 (autoscaling is not part of Stage 3's exit criterion), or to the start of Stage 4, or wrapping Stage 3 onto a second row with PH-38 alone on it, as PH-34 was before ADR 0035.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | How many phases a row holds | Eleven, with PH-38 moved to Stage 4 or 5; eleven, with Stage 3 wrapped; twelve, 8 characters wider | **At most twelve, so the diagram is about 99 characters wide** *(the owner's choice)*. Stage 3 keeps PH-38 where ADR 0036 placed it and stays on one row. The block still fits GitHub's README column on a desktop; on a phone it scrolls sideways, as before. A stage fills a row before continuing on the next, so Stage 4's nineteen phases are twelve and seven. The rest of [ADR 0017](0017-readme-roadmap-diagram.md), decision 2 stays. <br>✏️ **Refined by [ADR 0038](0038-app-on-ecs-and-rds-details.md), decision 2:** at most ten phases a row, about 84 characters wide; Stage 3 wraps after PH-35, and Stage 4's nineteen phases are ten and nine. |

## Consequences

- **The README's diagram is redrawn** at the new width, in the same PR as ADR 0036's roadmap changes.
- **A stage that grows past twelve phases wraps again**, like Stage 4. Widening once more would be a decision of its own: each widening makes the diagram harder to read on narrow screens.
