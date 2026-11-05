# Connectivity (NET)

How the app behaves when the connection is lost. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## NET-1

🎯 [MVP] · 🚧 In progress (0 of 8) · ❔ Criteria not finalized

When the connection is lost, the app clearly shows an offline state and blocks changes rather than silently losing them. This applies to guests and registered users alike.

| ID | Criterion | Status |
|---|---|---|
| NET-1.1 | While the connection is lost, an amber banner at the top says the app is offline. | ❔ Draft · in [PH-22](../roadmap.md#ph-22-offline-state) |
| NET-1.2 | While offline, controls that change data are disabled, with a visible reason. | ❔ Draft · in [PH-22](../roadmap.md#ph-22-offline-state) |
| NET-1.3 | A change is never queued to be sent later: it is saved, or the app shows it was not. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
| NET-1.4 | A request that gets no answer within about 10 seconds, as on a weak connection, is given up, and the app shows the change was not saved. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
| NET-1.5 | After a failed change, the app reloads the data from the server, so a change the server did apply shows as saved. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
| NET-1.6 | A create sent twice, for example after a lost answer, creates one record. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
| NET-1.7 | After a failed change, what the person entered stays in place, and the change is sent again only when they retry it. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
| NET-1.8 | While a change is being saved, the screen cannot be left from within the app. | 🚧 [PH-16d](../roadmap.md#ph-16d-resilient-changes) |
