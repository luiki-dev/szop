# Live updates (SYN)

Changes to a shared list reaching everyone who has it open. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## SYN-1

🔜 [Later] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Changes to a shared list appear for everyone viewing it within a few seconds, without reloading.

| ID | Criterion | Status |
|---|---|---|
| SYN-1.1 | A change to a shared list appears for everyone viewing it within a few seconds, without reloading. | ❔ Draft |
| SYN-1.2 | After the connection drops and comes back, the list catches up with every change made meanwhile. | ❔ Draft |
| SYN-1.3 | A user's own change is never overwritten on their screen by the echo of that change. | ❔ Draft · [OP-045](https://github.com/luiki-dev/szop/issues/112) |
| SYN-1.4 | A user who loses access to the list, removed or holding a revoked link, stops receiving its changes. | ❔ Draft · [OP-045](https://github.com/luiki-dev/szop/issues/112) |

## SYN-2

🔜 [Later] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

For concurrent edits, the last change wins, per item field.

| ID | Criterion | Status |
|---|---|---|
| SYN-2.1 | When two people change different fields of the same item at the same time, both changes stay. | ❔ Draft |
| SYN-2.2 | When two people change the same field, the last change wins. | ❔ Draft |
