# ADR 0067 — `/session-handoff` and a table of criteria in the PR

- **Status:** ✅ Accepted
- **Date:** 2026-11-05
- **Refines:** [ADR 0059](0059-session-skills.md), decision 1 (`/handoff` is renamed `/session-handoff`, see decision 1); [ADR 0054](0054-leaner-documentation.md), decision 6 (the PR's acceptance criteria become a table, see decision 2)

## Context

The owner asked for two changes to the session skills. The first renames `/handoff` to `/session-handoff`, with "Session Handoff" as the skill's title. The second asked `/demo-check` for a table of every acceptance criterion the phase delivers or starts, before its list of checks, even when no check is proposed. While choosing where that list would come from, the owner noted that the PR's Links section already lists those criteria, as a bulleted line of linked IDs, and chose to turn that line into a table instead of adding a second one to `/demo-check`.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | The handoff skill's name | `/handoff`; `/session-handoff` | **`/session-handoff`, titled "Session Handoff"** _(the owner's choice)_. The handoff file keeps its place, `.superpowers/handoff/<branch>.md`. |
| 2 | Where the phase's criteria are shown as a table | A table in `/demo-check`'s message, from the PR's list; the PR's list turned into a table | **The PR's "Acceptance criteria" is a table with the columns ID (linked), Criterion and Status, as in the requirement files; "none" when there are none. `/demo-check` is unchanged** _(the owner's choice)_. The PR already holds the list, so a second table in `/demo-check` would repeat it. |

## Consequences

- **`CLAUDE.md`, [working with Claude](../development/working-with-claude.md) and the skill** name `/session-handoff`. Earlier ADRs, specs and plans keep `/handoff` as written.
- **The PR template** (`.github/pull_request_template.md`) holds the table's header and says how to fill it. A PR's description is longer by each criterion's text, which the owner reads anyway.
