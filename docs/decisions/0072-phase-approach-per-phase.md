# ADR 0072 — Deciding a phase's approach in its brainstorm

- **Status:** ✅ Accepted
- **Date:** 2026-11-07
- **Refines:** [ADR 0004](0004-implementation-process.md), decision 8 (the path is chosen per phase, see decision 1); [ADR 0014](0014-roadmap.md), decision 6 (the limits on new concepts and tasks become defaults, see decision 1); [ADR 0009](0009-git-workflow.md), decision 5 (worktrees allowed, see decision 4)
- **Extends:** [ADR 0052](0052-working-with-claude.md), decision 3 (Claude stops and reminds the owner at 150k, see decision 3)

## Context

The owner reviewed the rules that shape how a phase is implemented. Several of them were fixed for every phase, although the right answer differs from phase to phase: the path (full or bounded), how many concepts new to the project a phase brings, how many tasks its plan has, and whether the execution stops after each task for the owner's review. The stop after each task had no ADR of its own: it lived only in [`docs/superpowers/plans/CLAUDE.md`](../superpowers/plans/CLAUDE.md), and PH-17's [context experiment](../audits/2026-11-06-ph-17-context-experiment.md#rules) already set it aside for one phase. Mockups were already decided element by element ([ADR 0069](0069-ask-before-a-mockup.md)) and stay so.

The owner also sometimes runs a second Claude Code session at the same time and wants it kept apart from the first, which the rule against worktrees forbade.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | The phase's approach | Fixed rules for every phase (today); decided in each phase's brainstorm | **Decided at the start of each phase's brainstorm, before its details: the path (full or bounded), how many concepts new to the project the phase brings, about how many tasks its plan has, and the execution's rhythm (decision 2). Claude recommends each with a one-sentence reason, and the owner chooses.** The earlier limits stay as the starting point of Claude's recommendation: one big new concept, about 3 to 8 tasks; past about 10 tasks or a second new concept Claude recommends a split, and the owner decides. The choices go into the phase ADR's decisions, or, for a bounded phase without one, into its design in chat and its PR description. Mockups are not part of it: they stay decided element by element ([ADR 0069](0069-ask-before-a-mockup.md)). The owner chose it. |
| 2 | The execution's rhythm | Always a stop after each task (today); always no stop; chosen per phase | **Chosen per phase (decision 1): a stop after each task, stops after the tasks the owner names, or no stop until the last task.** The plan's Global Constraints state the rhythm chosen; a plan that states none stops after each task. Every task is still committed and pushed when it is done, so the owner can follow the branch. The owner chose it. |
| 3 | A reminder at 150k | None beyond the status line's color (today); a reminder at 150k | **In any stage and any rhythm, when the main session's context passes 150k at the end of a step (a task, in the execution), Claude stops and reminds the owner to run `/compact` or `/session-handoff`.** Claude cannot run either itself, and with no stops between tasks nothing else would bring the threshold of [ADR 0052](0052-working-with-claude.md), decision 3, to the owner's attention. The owner asked for the reminder; stopping with it is Claude's call, since only the owner can run the commands. |
| 4 | Worktrees | A plain branch in the main checkout only (today); worktrees allowed | **Allowed, not the default.** A plain branch in the main checkout stays the default. A worktree is used when the owner asks for one or runs a second session at the same time; Claude may propose one then, and takes one a superpowers skill offers only with the owner's yes. A worktree needs its own `pnpm install`, `.env` and Docker Compose ports. A local merge is still never taken, and `/finish-phase` already leaves a worktree in place for removal after the merge. The owner chose it. |

## Consequences

- **[`CLAUDE.md`](../../CLAUDE.md)** ("Keep phases small" and the worktree rule), **[`docs/superpowers/plans/CLAUDE.md`](../superpowers/plans/CLAUDE.md)** (the rhythm and the reminder), **[`docs/superpowers/specs/CLAUDE.md`](../superpowers/specs/CLAUDE.md)** (the approach in the phase ADR), **[`docs/roadmap.md`](../roadmap.md)** (the size of a phase) and **[`git-workflow.md`](../development/git-workflow.md)** (worktrees) follow it.
- Plans written before this ADR keep their own "After each task" rule.
