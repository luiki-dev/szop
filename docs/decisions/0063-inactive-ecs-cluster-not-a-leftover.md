# ADR 0063 — An inactive ECS cluster is not a leftover

- **Status:** ✅ Accepted
- **Date:** 2026-11-03
- **Refines:** [ADR 0062](0062-urgent-security-fixes.md), decision 9; [ADR 0038](0038-app-on-ecs-and-rds-details.md), decision 15

## Context

Since PH-42, `demo-down` fails when anything tagged `group` = `demo` is still listed by the tagging API ten minutes after the destroy. Inactive task definition revisions are not counted ([ADR 0062](0062-urgent-security-fixes.md), decision 9).

On 2026-11-03 the nightly run failed with nothing of the demo left ([#373](https://github.com/luiki-dev/szop/issues/373)). The destroy of the evening before had deleted the ECS cluster `szop-demo`. More than 11 hours later the tagging API still listed it, and `aws ecs describe-clusters` reported it as `INACTIVE`, with no tasks, services or container instances. ECS keeps a deleted cluster as `INACTIVE` for a while. Such a cluster costs nothing and cannot run a task. The runbook expected the index to catch up within the hour, so every nightly run failed until it did.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | What the leftovers check does with a listed ECS cluster | Count it, as now; skip every cluster ARN, like task definitions; ask ECS for its status and skip only an `INACTIVE` one | **The check asks ECS (`describe-clusters`) for the status of each listed ECS cluster and skips an `INACTIVE` one.** An active cluster, or one whose status cannot be read, is still reported, so the check fails safe. Skipping every cluster would hide a cluster left outside the state, which could hold services. The deploy role already allows `ecs:Describe*`. Chosen by the owner, 2026-11-03. |

## Consequences

- `demo-down` no longer fails on a cluster that the destroy has already deleted. Inactive task definition revisions and an `INACTIVE` cluster are the expected entries in the list. The runbook ([Checking that nothing is left](../operations/demo-environment.md#checking-that-nothing-is-left)) names both.
- A denied or failed `describe-clusters` shows up only in the step's log. The run still ends with "Resources tagged group=demo are left".
