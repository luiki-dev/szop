# ADR 0047 — Drop the README's roadmap diagram

- **Status:** ✅ Accepted
- **Date:** 2026-10-24
- **Supersedes:** [ADR 0017](0017-readme-roadmap-diagram.md) (the diagram, all four decisions); [ADR 0035](0035-wider-roadmap-diagram.md) and [ADR 0037](0037-twelve-phases-a-diagram-row.md) (its width); [ADR 0027](0027-open-points-on-github.md), decision 1 (only its sentence "The README's diagram stays") and decision 4 (only the diagram as a mirror of the status)

## Context

[ADR 0017](0017-readme-roadmap-diagram.md) put an ASCII diagram of the stages and phases in the README, so the progress was visible at a glance. Since then the status moved to the GitHub project ([ADR 0027](0027-open-points-on-github.md)), which shows it live, with the open points and what comes next. The diagram stayed as a third copy of the status, drawn by hand in the same commit as the stage tables, and it grew with the roadmap: three ADRs ([0035](0035-wider-roadmap-diagram.md), [0037](0037-twelve-phases-a-diagram-row.md), [0038](0038-app-on-ecs-and-rds-details.md)) only changed how wide it is. Nothing checks it, and the owner no longer wants to maintain it.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | The diagram | Keep it; generate it from the stage tables; drop it | **Drop it,** the owner's choice. The project board shows the status live, and the roadmap has the plan; a hand-drawn copy of the status costs an edit in every phase and adds nothing they lack. A generator would keep a copy that nobody reads. What is lost: progress at a glance on the repository's front page. The README's `## Roadmap` section stays, with links to the roadmap and the board. |
| 2 | Where the status is kept | — | **On GitHub, mirrored in the stage tables of `roadmap.md` only.** The rest of [ADR 0027](0027-open-points-on-github.md), decision 4 stays. Phase starts, PRs and merges no longer touch the README. |

## Consequences

- **The README's diagram is removed,** and so are the mentions of it in `CLAUDE.md`, `roadmap.md`, the definition of done and the project-tracking guide.
- **Accepted ADRs, specs and plans keep their mentions of the diagram** as the record of what was true then; ADRs 0017, 0035 and 0037 and the two decisions of ADR 0027 carry a note pointing here.
