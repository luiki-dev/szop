# ADR 0017 — A roadmap diagram in the README

- **Status:** ✅ Accepted
- **Date:** 2026-10-02
- **Refines:** [ADR 0014](0014-roadmap.md), decision 4 (where a phase's status is kept: the stage tables stay the source, the README's diagram mirrors them)

## Context

The README describes what Szop does, but not how far along it is: that lives in the stage tables of `docs/roadmap.md`, one click and a long page away. The owner wants the progress visible at a glance on the repository's front page, as a simple ASCII diagram of the stages, the phase IDs, their status and "the road" between them.

[ADR 0014](0014-roadmap.md), decision 4 made each stage's table "the one place where a phase's status is kept". A diagram in the README is a second place, so that rule needs refining.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Showing progress in the README | A link to the roadmap only; a Mermaid diagram; an ASCII diagram | **An ASCII diagram in a `## Roadmap` section, before "Features".** A link alone shows nothing at a glance. Mermaid renders on GitHub, but its layout is automatic and hard to control, and it shows only as source in plain editors. A plain-text diagram reads the same everywhere. |
| 2 | Its shape | Straight rows that each restart on the left; a road that snakes | **A road that snakes:** each row of phases runs the opposite way to the one before, joined by a bend three lines tall (an empty line, the stage title and the IDs, or two empty lines and the IDs when a stage continues on a second row). A row holds at most nine phases, so the diagram stays about 75 characters wide. It starts at `START` and ends at `DONE`. |
| 3 | Statuses | The status icons (✅ 🚧 ⬜ ✖️); one-width symbols | **One-width symbols:** `●` done, `◐` in progress, `○` not started, `✕` dropped, explained by a legend at the bottom of the diagram. **The road travelled so far is a double line** (`═ ║ ╔ ╗ ╚ ╝`), up to the last done or in-progress phase. Emoji are twice as wide as other characters in most monospace fonts and push the rest of the line out of alignment; the owner chose a legend with only the diagram's own symbols, an exception to the rule that every written status gets its icon. |
| 4 | Keeping it in sync | Generate it from the stage tables with a script, checked in CI; update it by hand | **By hand, in the same commit as the stage table, on the same occasions:** a phase starts, is done, is dropped, or the roadmap gains, splits or reorders phases. The stage tables stay the source; the diagram mirrors them. A generator and its CI check would be more than a 30-line diagram changed a few times per phase needs. It is not an item of the definition of done: it follows the roadmap, which is. |

## Consequences

- **Every status change in `docs/roadmap.md` touches the README too.** "How it works" in the roadmap and `CLAUDE.md` say so.
- **A drifted diagram is caught by review only,** since nothing checks it. If it drifts in practice, a generator is the fix (decision 4).
- **Gaps show between the vertical lines at the bends**, in editors and on GitHub alike: the line height is taller than the box-drawing characters. It cannot be fixed in the content.
