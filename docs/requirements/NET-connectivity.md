# Connectivity (NET)

How the app behaves when the connection is lost. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## NET-1

🎯 [MVP] · ❔ Draft (0 of 6) · ❔ Criteria not finalized

When the connection is lost, the app clearly shows an offline state and blocks changes rather than silently losing them. This applies to guests and registered users alike.

| ID | Criterion | Status |
|---|---|---|
| NET-1.1 | While the connection is lost, an amber banner at the top says the app is offline. | ❔ Draft |
| NET-1.2 | While offline, controls that change data are disabled, with a visible reason. | ❔ Draft |
| NET-1.3 | A change is never queued to be sent later: it is saved, or the app shows it was not. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
| NET-1.4 | A request that hangs on a weak connection is given up after a time limit, and the app shows the change was not saved. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
| NET-1.5 | After a failed change, the app reloads the data from the server, so a change the server did apply is not undone on screen. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
| NET-1.6 | A create sent twice, for example after a lost answer, creates one record. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
