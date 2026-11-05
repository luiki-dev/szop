# ADR 0070 — Resilient changes phase details

- **Status:** ✅ Accepted
- **Date:** 2026-11-05

## Context

[PH-16d](../roadmap.md#ph-16d-resilient-changes) makes the SPA's changes hold up on a weak connection: a write that hangs is given up, a failed one says so and can be retried, a change goes out once, a guest's writes need no session check first, and two fresh tabs end in one anonymous session. It also carries two fixes of the lists screens found at PH-16c's demo check ([OP-131](https://github.com/luiki-dev/szop/issues/385), [OP-132](https://github.com/luiki-dev/szop/issues/386)).

At the brainstorm's start the owner asked for full offline editing: a banner while offline, changes kept locally and synced on reconnect. That contradicts [NET-1](../requirements/NET-connectivity.md#net-1).3 and [ADR 0014](0014-roadmap.md), decision 13; after weighing it the owner kept NET-1 as written (decision 1).

The [spec](../superpowers/specs/2026-11-05-PH-16d-resilient-changes-design.md) holds the design in full, with the approved mockups; this ADR records the decisions and the alternatives. All were settled in the brainstorm.

## Changes to the roadmap

- **PH-16d delivers [NET-1](../requirements/NET-connectivity.md#net-1).3 to NET-1.8**, OP-131 and OP-132, besides what it held; [PH-22](../roadmap.md#ph-22-offline-state) keeps NET-1.1, NET-1.2 and the end-to-end journey with the network cut or slowed (OP-040's last part).

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Offline editing | Full offline editing now (changes stored locally and synced on reconnect), reworking the roadmap; a new requirement with its own phase after PH-17a. | **No queue, now or later: [NET-1](../requirements/NET-connectivity.md#net-1) stays as written, and offline check-off and full offline editing stay 💡 future extensions ([ADR 0014](0014-roadmap.md), decision 13); no requirement or phase is added.** Syncing and resolving conflicts is a large concept the MVP does not need. The owner chose it. |
| 2 | The time limit on a request | No limit (a weak signal counts as online, and a request can hang for minutes); a limit on writes only; a longer one (30 s). | **About 10 seconds on every request the SPA sends, reads and writes; then the request is given up as a failure: a write shows "not saved", a read shows the existing error card with "Try again".** For a change, the 10 s cover the whole change (the write, the lock, the sign-in and the retry after a `401`), so the block of decision 5 never lasts longer. The owner chose 10 s for writes; the same limit on reads was Claude's proposal, accepted; the cap on the whole change is Claude's call, from the spec's builder check. |
| 3 | What stays after a failed change | Putting the old value back; sending it again when the field loses focus (today's behavior, [#320](https://github.com/luiki-dev/szop/issues/320)). | **What the person entered stays in place, and the change is sent again only when they retry it: "Try again" or Enter on a rename, Create on a new list, Delete in the dialog. Leaving the field after a failure sends nothing.** The owner chose to keep the text for a one-click retry; no resend on blur follows from it. |
| 4 | After a failed change | Rolling back only. | **The SPA reloads the data from the server after every failed change; when the server did apply it (the answer was lost), the message goes and the saved value shows.** A lost answer otherwise shows a change the server has as not saved. Claude's proposal, accepted. |
| 5 | Leaving a screen while a change is in flight | Cancelling the request (aborting a request does not undo it on the server, so the person would believe they cancelled what was saved); leaving with a "still saving" note (needs a message on another screen, a toast system that is PH-17a's); asking before the tab closes (`beforeunload`). | **Leaving from within the app is blocked until the change ends, at most the time limit: Esc, ← and the browser's Back do nothing, and ← is greyed out. Closing the tab is not blocked.** The owner asked whether blocking makes sense; Claude confirmed it with React Router's `useBlocker`, and the owner chose it. The 10 s limit keeps the wait short; a `beforeunload` prompt is too much for it. |
| 6 | How a change in flight and a failed one look | A toast; a banner. | **In place, as today's errors: "Saving…" under the list name while a rename runs, "Creating…" and "Deleting…" on the buttons; on a failure "Not saved." with "Try again" under the name, "Not saved. Check your connection and create again." on the new list's screen, and "Couldn't delete the list. Check your connection and try again." in the dialog.** No toast system before PH-17a ([APP-3](../requirements/APP-app-wide-behavior.md#app-3).1). The owner approved the mockups. |
| 7 | The session check before each write ([OP-116](https://github.com/luiki-dev/szop/issues/319)) | Remembering in the page that a session exists (state to keep in step, for the same saving). | **The write goes first; on a `401` the SPA signs in as a guest and sends it once more, never in a loop.** Every write but a guest's first is one request instead of two; the first stays three. Claude's proposal; the owner agreed. |
| 8 | One anonymous session across tabs ([OP-120](https://github.com/luiki-dev/szop/issues/329)) | A flag in `localStorage`; a check on the server. | **The guest sign-in runs under a Web Lock (`navigator.locks`) shared by the site's tabs; inside it the SPA asks for the session again and signs in only when there is none.** The cookie is shared, so the second tab uses the first tab's session. Supported by every browser Szop supports, nothing on the server. Claude's proposal; the owner agreed, and [ACC-1](../requirements/ACC-accounts-and-guest-mode.md#acc-1).6 keeps its wording. |
| 9 | NET-1's criteria | Keeping them as drafted. | **NET-1.4 names the 10 s limit, NET-1.5 says the applied change shows as saved, and two criteria are added: NET-1.7 (what was entered stays, sent again only on a retry) and NET-1.8 (the screen cannot be left from within the app while a change is saved).** They belong to NET-1, not to the lists' requirement, since items and check-off follow the same rules. Reviewed with the owner. |
| 10 | Selecting lists ([OP-131](https://github.com/luiki-dev/szop/issues/385)) | — | **Select disappears and the selection controls (✕, the count, Select all or Deselect all, Delete) take its row; the page's title stays, and the lists do not move. On a phone the bottom "New list" hides while selecting, as today; on a desktop "New list" stays in the header.** The owner approved the mockups. |
| 11 | The raccoon on a desktop ([OP-132](https://github.com/luiki-dev/szop/issues/386)) | — | **On a desktop, the empty list's raccoon peeks in from under the sidebar's right edge, with the rotation and offset it has at the window's left edge on a phone; the sidebar covers it.** The owner approved the mockup. |

## Consequences

- Every later change (items in PH-17a, check-off in the haul) inherits the time limit, the "not saved" state, the refetch, the retry and the blocked leaving.
- A guest's first write costs a `401` before the sign-in; the API's answer to a write without a session must stay `401`.
- PH-22 is left with the banner, the disabled controls and the journey with the network cut.

## Settled while building

- **The deadline is built with a timer, not `AbortSignal.timeout`** (Task 1). `deadline()` in `client.ts` is an `AbortController` aborted by `setTimeout` after `timeLimit` (10 000 ms), because Vitest's fake timers do not drive `AbortSignal.timeout`, which would leave the limit untestable. Aborting with our own `Error` makes `fetch` reject with it, so no conversion is needed.
- **The timeout's text** is "The server didn't answer in time." (`timeoutMessage`), the one message every request that waited for the limit rejects with.
