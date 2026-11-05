# PH-16d Resilient changes: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [The time limit](#the-time-limit)
  - [A change in flight](#a-change-in-flight)
  - [A failed change](#a-failed-change)
  - [Reloading after a failure](#reloading-after-a-failure)
  - [The session before a write](#the-session-before-a-write)
  - [One session across tabs](#one-session-across-tabs)
  - [Selecting lists](#selecting-lists)
  - [The raccoon on a desktop](#the-raccoon-on-a-desktop)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

A change sent on a weak connection fails visibly instead of hanging or being lost, is sent once and only retried on purpose, a guest's writes need no session check first, two fresh tabs end up in one anonymous session, and the lists page and the empty list get their two fixes from PH-16c's demo check ([PH-16d](../../roadmap.md#ph-16d-resilient-changes)).

## Decisions

[ADR 0070](../../decisions/0070-resilient-changes-phase-details.md#decisions).

## The design

The UI's words are English, as everywhere in Szop. Every new control has a 48 px tap target, a visible focus ring, and works with the keyboard alone, like the existing ones. There is no queue: a change is saved, or the SPA shows it was not ([NET-1](../../requirements/NET-connectivity.md#net-1).3). The mockups approved in the brainstorm are in [`2026-11-05-PH-16d-resilient-changes/`](2026-11-05-PH-16d-resilient-changes/); they are screenshots of the running app, changed only where a new state comes in.

Today's writes (`createList`, `renameList`, `deleteList`, `deleteLists` in `apps/web/src/api/client.ts`) already run with `networkMode: "always"` and wait for the server's answer before the screen changes (no optimistic update); a new list's ID is made in the browser, so a create sent twice makes one list (NET-1.6, since PH-16a). This phase keeps both.

### The time limit

Every request the SPA sends (`apps/web/src/api/client.ts`: reads, writes, the session and sign-in calls, the health check) is given up after about **10 seconds** without an answer, and the give-up is an error like any other failure ([NET-1](../../requirements/NET-connectivity.md#net-1).4). A write then shows its "not saved" state; a read shows the error card with "Try again" that pages have today. One place sets the limit for all of them.

**For a change, the 10 seconds cover the whole change**, not each request: one signal is shared by the write, the waiting for the lock, the sign-in, the session check and the retried write after a `401`, so a change is never in flight for longer than the limit _(Claude's call, from the builder check)_. A sign-in or session check that fails or hangs has no screen of its own: it ends as the change's "not saved".

Reads keep TanStack Query's default `networkMode` (`"online"`): a read started while the browser says it is offline waits for the connection, which is not a queue of changes; offline reads are PH-22's ([NET-1](../../requirements/NET-connectivity.md#net-1).1) _(Claude's call)_.

### A change in flight

While a change is being saved:

- **Rename** (the list's screen): the name field is read-only, as today, and "Saving…" shows under it in the muted text colour (mockup `save-phone-2-rename-saving.png`).
- **Create** (the new list's screen): the Create button is disabled and reads "Creating…" (`save-phone-4-create-saving.png`).
- **Delete** (the confirmation dialog, from the list's screen or the selection): Delete is disabled and reads "Deleting…"; Cancel and Esc are off, as today (`save-phone-6-delete-saving.png`).
- **Leaving is blocked** ([NET-1](../../requirements/NET-connectivity.md#net-1).8): ← is greyed out and does nothing, Esc does nothing, and the browser's Back is held with React Router's `useBlocker` (the app uses `createBrowserRouter`, which it needs). The block ends when the change ends, at most the time limit. Closing the tab or the browser is not blocked, and no `beforeunload` prompt is shown.

When the change succeeds, the screen goes on as today: the rename's "Saving…" goes and ← comes back, a new list opens, the dialog closes.

### A failed change

A failure is any error: the time limit, no network, a `5xx` or another refusal. Then ([NET-1](../../requirements/NET-connectivity.md#net-1).7):

- **Rename:** "Not saved." in the destructive colour under the name, followed by a "Try again" link-style button (`save-phone-3-rename-not-saved.png`). The typed name stays in the field. "Try again" or Enter sends it again; leaving the field sends nothing (today `saveOnBlur` sends it again, [#320](https://github.com/luiki-dev/szop/issues/320)); Esc puts the saved name back and clears the message, as it does today.
- **Create:** "Not saved. Check your connection and create again." under the field; the name stays, and Create (or Enter) sends it again with the same list ID (`save-phone-5-create-not-saved.png`).
- **Delete:** "Couldn't delete the list. Check your connection and try again." in the dialog ("…the lists…" for several); Delete sends it again, Cancel closes the dialog (`save-phone-7-delete-not-saved.png`).

A server message that already has its own meaning (such as a too long name, `400`) keeps today's text in the same place; the texts above are for failures where the change may not have reached the server or the server failed.

### Reloading after a failure

After every failed change the SPA refetches the data the change touched from the server: the list and the lists for a rename, the lists for a create and a delete ([NET-1](../../requirements/NET-connectivity.md#net-1).5). A create refetches only the lists, never the new list by its ID, since a `404` there is the expected answer and must not replace the screen with the not-found page _(Claude's call)_. When the refetch shows the change was applied (the answer was lost on the way back), the "not saved" state goes and the screen shows the saved state:

- a rename whose name is now the server's: the message goes;
- a create whose list ID is now among the lists: the new list's screen goes on to the list, as after a success;
- a delete whose lists are gone: the dialog closes and the page goes on as after a success.

A refetch that fails itself changes nothing on screen. A retried delete of a list that is already gone is a success, as today (`remove` in `use-lists.ts` takes a `404` as done, and `POST /api/lists/delete` skips missing IDs); a retried rename of a list that is gone shows the list's not-found message, as today.

### The session before a write

[OP-116](https://github.com/luiki-dev/szop/issues/319): `withSession` stops asking `GET /api/auth/get-session` before each write. The write goes first; on a `401` the SPA signs in as a guest (under the lock below) and sends the write once more; a second `401` is a failure, never a loop. Every list write answers `401` without a session today (`apps/api/src/lists/routes.ts`, `apps/api/src/access/workspace.ts`). A guest's first write costs three requests, as today; every later one costs one instead of two.

A `401` after a session existed (a guest's cookie expired or was cleared) also signs in as a new guest, as `withSession` does today: there are only guest accounts until [PH-18](../../roadmap.md#ph-18-registration-and-login), and a guest whose session is gone has lost the workspace anyway ([ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).7, ACC-1.8). PH-18 decides what a `401` means for a registered user, who must not be moved into a new guest workspace _(Claude's call)_.

### One session across tabs

[OP-120](https://github.com/luiki-dev/szop/issues/329), [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).6: the guest sign-in runs under a Web Lock (`navigator.locks.request` with one lock name for the site). Inside the lock the SPA asks `GET /api/auth/get-session`; when a session is there (another tab signed in while this one waited, and the cookie is shared), it does not sign in again. So two tabs whose first changes meet both end up in one session and one workspace. The time limit applies to the requests inside the lock, so a hung sign-in cannot hold the lock longer than that.

### Selecting lists

[OP-131](https://github.com/luiki-dev/szop/issues/385): starting the selection no longer replaces the page's header. The page keeps its title ("Lists", with ☰ on a phone and "New list" beside it on a desktop); Select disappears, and the selection controls (✕, the count, Select all or Deselect all, Delete) take the row where Select was. The list cards stay where they were: the first card's top is at the same position before and while selecting, on a phone and on a desktop. On a phone the bottom "New list" hides while selecting, as today. Mockups: `op131-phone-1-before.png`, `op131-phone-2-today-selecting.png`, `op131-phone-3-proposed-selecting.png` and the `op131-desktop-*` set. Everything else about selecting (the long press, Back, Esc, the counts) stays as PH-16c built it.

### The raccoon on a desktop

[OP-132](https://github.com/luiki-dev/szop/issues/386): from `lg`, the empty list's raccoon peeks in from under the sidebar's right edge, with the rotation (90°), offset (65 px under the edge), opacity and grey it has at the window's left edge on a phone; the sidebar stays on top of it. The `lg:right-[calc(-65px-(100vw-100%))]` placement in `apps/web/src/lists/list-screen.tsx` goes, and the scrollbar gutter no longer matters. Mockups: `op132-desktop-1-today.png`, `op132-desktop-2-proposed.png`.

## Acceptance criteria

The wording below is the reviewed one; the criteria are ✅ in this phase. [NET-1](../../requirements/NET-connectivity.md#net-1)'s list stays ❔ Criteria not finalized: NET-1.1 and NET-1.2 are PH-22's, which reviews the whole list.

- [NET-1](../../requirements/NET-connectivity.md#net-1).3, whole: no queue.
- [NET-1](../../requirements/NET-connectivity.md#net-1).4, whole: the 10 s limit.
- [NET-1](../../requirements/NET-connectivity.md#net-1).5, whole: reloading after a failure.
- [NET-1](../../requirements/NET-connectivity.md#net-1).6, whole: a create sent twice makes one list (built in PH-16a; this phase adds its test name).
- [NET-1](../../requirements/NET-connectivity.md#net-1).7, whole: what was entered stays, sent again only on a retry.
- [NET-1](../../requirements/NET-connectivity.md#net-1).8, whole: no leaving while a change is saved.
- [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).6, whole: two tabs, one workspace.

## Tests

Each criterion's test name starts with its ID.

- **Web (Vitest, Testing Library, MSW):**
  - NET-1.4: a request with no answer (MSW `delay("infinite")`, fake timers) fails after the limit; a rename then shows "Not saved." and a list read shows its error card;
  - NET-1.3: a write started while `navigator.onLine` is false is sent at once and its failure shown; nothing is sent later on its own (after `online` fires, no request goes out);
  - NET-1.5: a rename whose answer is a network error while the server's list has the new name ends with no message and the new name; a delete that fails while the list is gone closes the dialog;
  - NET-1.6: Create after a failed Create sends the same ID;
  - NET-1.7: after a failed rename the typed name stays; blur sends no request; "Try again" and Enter send one; Esc puts the saved name back; on the new list's screen the name stays and Create sends again; the dialog keeps its message and Delete sends again;
  - NET-1.8: while a rename, a create and a delete are in flight, ← is disabled, Esc does nothing and a navigation is blocked; after the answer it works again;
  - OP-116: a write with a session sends one request; a `401` makes one sign-in and one retry; a second `401` is an error with no third try;
  - ACC-1.6: two sign-ins started together with a fake `navigator.locks` and a session that appears after the first make one sign-in request;
  - OP-131: selecting keeps the page's heading and puts the controls where Select was.
- **E2E (Playwright):**
  - ACC-1.6: two pages in one fresh context create a list at the same moment; both lists are in one workspace (each page's lists page shows both after a reload);
  - NET-1.8 and NET-1.7: a rename with the API route held (`page.route` never answering) shows "Saving…", Back does not leave, and after the limit "Not saved." with the name kept; "Try again" with the route released saves it;
  - OP-131: on a phone-sized and a desktop-sized window, the first list card's top is the same before and while selecting;
  - OP-132: `frame.spec.ts`'s raccoon check becomes: on a desktop-sized window, the raccoon's left part is under the sidebar and its right part shows past the sidebar's edge; the phone check stays.
- **Mutation testing:** the run over the changed logic (the time limit, `withSession`, the lock, the retry and refetch handling, the blocker), each survivor killed or accepted with a reason ([definition of done](../../development/definition-of-done.md), item 2).

## Documentation

- `docs/architecture/architecture.md`: the section on offline (NET-1) gains the time limit, the "not saved" state, the refetch, the retry and the blocked leaving; the frontend's session handling (write first, the lock).
- `docs/architecture/visual-design.md`: the "Saving…" and "not saved" states and where their messages go; the selection bar in Select's row; the raccoon under the sidebar on a desktop.
- `docs/architecture/stack-overview.md`: `AbortSignal.timeout` and why a weak connection needs it, React Router's `useBlocker`, the Web Locks API.
- `docs/glossary.md`: Web Locks API.
- `docs/requirements/`: NET-1's reviewed criteria and the new NET-1.7 and NET-1.8 at 🚧, ACC-1.6 unchanged. Done in the spec's commit, except the ✅s.
- `docs/roadmap.md`: PH-16d's **Delivers**, PH-22's **Delivers**, the PH-16d row 🚧 with the spec ([ADR 0070](../../decisions/0070-resilient-changes-phase-details.md#changes-to-the-roadmap)). Done in the spec's commit.

## Demo check

All local, in the production-like environment; nothing needs AWS.

- With DevTools' network set to offline, then to a throttled profile with a held request: rename, create and delete a list; "Saving…", "Creating…" and "Deleting…"; ← greyed out, Esc and Back held; after about 10 s the "not saved" states with the text kept; a retry after the network is back saves it.
- A lost answer: block the response, not the request (for example a breakpoint or a proxy that drops it), then see the change shown as saved after the refetch.
- Two fresh tabs (a private window) creating a list at the same moment: both lists on one lists page.
- Selecting on a phone-sized and a desktop-sized window: nothing moves.
- The raccoon on a desktop in Firefox and Chromium, light and dark.

Checked by hand: [NET-1](../../requirements/NET-connectivity.md#net-1).4, [NET-1](../../requirements/NET-connectivity.md#net-1).5, [NET-1](../../requirements/NET-connectivity.md#net-1).8, [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).6.

## Risks

- **A limit that is too short for a slow but working connection** gives up a change the server then applies. The refetch (NET-1.5) shows it as saved, so the cost is a moment of "not saved". The limit is one constant; the demo check on a throttled profile tells whether 10 s holds.
- **`useBlocker` and the selection mode's Back:** the lists page pushes a history entry while selecting, and Back stops the mode. The block applies only while a change is in flight, but a delete from the selection runs in that mode. The block is lifted as soon as the change ends, before the SPA's own navigation after it (the delete's exit from the selection, a new list's opening), so the SPA never blocks itself _(Claude's call)_; a test covers Back during a delete from the selection (held) and the exit after it (not held).
- **The lock and a hung tab:** a tab holding the lock blocks the others' sign-in until the time limit ends its requests; the lock must be released when its callback ends, success or failure.

## Out of scope

- The offline banner and disabled controls ([NET-1](../../requirements/NET-connectivity.md#net-1).1 and NET-1.2) and the E2E journey with the network cut ([PH-22](../../roadmap.md#ph-22-offline-state)).
- A queue, offline check-off, full offline editing (💡 future extensions, [ADR 0070](../../decisions/0070-resilient-changes-phase-details.md), decision 1).
- A toast system ([APP-3](../../requirements/APP-app-wide-behavior.md#app-3).1, PH-17a).
- Checking and unchecking with an explicit value (OP-040's PH-17a part).
- Retrying on its own: every retry is the person's.

## Left to the builder

- How the limit is attached (`AbortSignal.timeout` on each `fetch`, or a small wrapper in `client.ts`), and the error a timeout becomes, as long as pages tell it from a refusal only where the texts above differ.
- How a failure is told from a server answer with its own message (a `4xx` with an API error body keeps its text).
- The lock's name, and the fallback when `navigator.locks` is missing (jsdom): run without the lock.
- Where the refetch is wired (the mutations' `onError` with `invalidateQueries`, or the pages).
- The exact delay of "about 10 seconds" (10 000 ms unless a test shows a reason).
