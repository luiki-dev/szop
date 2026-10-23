# ADR 0045 — Autoscaling in Stage 5

- **Status:** ✅ Accepted
- **Date:** 2026-10-24
- **Refines:** [ADR 0036](0036-scalability-and-isolation.md), decision 17 (PH-38 Autoscaling at the end of Stage 3, see decision 1); [ADR 0037](0037-twelve-phases-a-diagram-row.md), decision 1 (Stage 3 keeps PH-38 where ADR 0036 placed it, see decision 1)

## Context

[ADR 0036](0036-scalability-and-isolation.md), decision 17 placed [PH-38 Autoscaling](../roadmap.md#ph-38-autoscaling) at the end of Stage 3, right after the other scaling work, and [ADR 0037](0037-twelve-phases-a-diagram-row.md), decision 1 kept it there, for the width of the README's diagram rather than for a technical reason. With [PH-13](../roadmap.md#ph-13-releases) and [PH-34](../roadmap.md#ph-34-landing-page-and-demo-status) merged, PH-38 is the only phase of Stage 3 left, and it is not part of the stage's exit criterion: the demo button, the nightly teardown, the landing page and `v0.1.0` are all done. No phase of Stage 4 depends on it: they are built for several tasks against [PH-37](../roadmap.md#ph-37-two-tasks)'s two fixed tasks, `demo-up` owns the service's count until autoscaling takes it over ([ADR 0040](0040-two-tasks-details.md), decision 10), and the connection budget already allows four tasks ([ADR 0040](0040-two-tasks-details.md), decision 7). Done now, its load test could only reach `/api/health` and an empty app.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Where PH-38 sits | Last in Stage 3, as now; first in Stage 4; last in Stage 5; a candidate, together with load testing ([OP-029](https://github.com/luiki-dev/szop/issues/114)) | **Last in Stage 5** *(the owner's choice)*, after [PH-33 Live updates](../roadmap.md#ph-33-live-updates). Stage 3 ends with its exit criterion met, and the MVP's features start one phase sooner. By then the app has real routes to load (lists, items, login, live updates over WebSockets), so the choice between average CPU and requests per target, left to PH-38's brainstorm by ADR 0036, decision 13, is made against real traffic. Its plan does not change: two to four tasks with target tracking, the deploy role's permissions, a load script, the runbook's section and the connection budget checked again. Unlike a candidate, it stays a committed phase. |
| 2 | Stage 5's exit criterion *(Claude's call)* | Unchanged ("every 🔜 requirement is delivered"); extended with autoscaling | **Extended:** "every 🔜 requirement is delivered, and the demo's service scales with its load". PH-38 delivers no requirement, so without it the stage could end with PH-38 undone. |

## Consequences

- **Stage 3 is complete** with PH-34; its milestone is closed, and its table and the README's diagram show every phase done.
- **PH-38 moves to Stage 5 on GitHub too:** its issue ([#234](https://github.com/luiki-dev/szop/issues/234)) moves to the `Stage 5: Later` milestone and its Order to 360, after PH-33's 350. Its body is unchanged, since its plan is.
- **Stage 5's note on rough phases** names PH-32 and PH-33 only: PH-38 is planned and is not split first.
- **The demo runs two fixed tasks** until PH-38, as since PH-37.
- **PH-38's brainstorm should look at [OP-029](https://github.com/luiki-dev/szop/issues/114)**, the load-testing candidate (k6 against the demo), since its load script could be the first step of it.
