# ADR 0073 — List items polish phase details

- **Status:** ✅ Accepted
- **Date:** 2026-11-07
- **Refines:** [ADR 0013](0013-visual-design.md), decision 1 (Firefox for Android joins the supported browsers); [ADR 0070](0070-resilient-changes-phase-details.md), decision 6 (a rename in flight and a failed one); [ADR 0071](0071-list-items-phase-details.md), decision 23 (a toast's width)

## Context

[PH-46](../roadmap.md#ph-46-list-items-polish) fixes what the hand checks of [PH-17](../roadmap.md#ph-17-list-items) found on the list screen: the list jumps when the phone's keyboard opens ([#412](https://github.com/luiki-dev/szop/issues/412)), the haul folds even when the keyboard is closed ([OP-138](https://github.com/luiki-dev/szop/issues/408)), Quantity is shorter than the other fields ([#413](https://github.com/luiki-dev/szop/issues/413)), the toast is not over the haul ([#414](https://github.com/luiki-dev/szop/issues/414)), a closed edit form leaves a focus ring ([#415](https://github.com/luiki-dev/szop/issues/415)), Enter does not end a rename ([#416](https://github.com/luiki-dev/szop/issues/416)), and the category picker scrolls as a whole ([#417](https://github.com/luiki-dev/szop/issues/417)). The owner took [OP-139](https://github.com/luiki-dev/szop/issues/409) (where and when a save's state shows) into the phase, since it shapes the messages of every later screen.

The phase takes the bounded path: the design was agreed in the brainstorm, with mockups for the haul's fold, the toasts and the picker, and this ADR holds it in place of a spec and a plan ([ADR 0072](0072-phase-approach-per-phase.md), decision 1).

## Changes to the roadmap

- **PH-46 also delivers** the fixes of [#417](https://github.com/luiki-dev/szop/issues/417) and [OP-139](https://github.com/luiki-dev/szop/issues/409), and the new criterion [APP-3](../requirements/APP-app-wide-behavior.md#app-3).4.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | The phase's approach | The full path. | **Bounded; one small new concept, `visualViewport` (telling that the phone's keyboard is open); seven tasks; one stop, after Task 1, for the owner's check on a phone.** Claude's recommendation; the owner chose it. |
| 2 | Firefox for Android | Kept unsupported; supported with a Playwright project of its own (a narrow Firefox window). | **Firefox for Android joins the supported browsers ([NFR-1](../requirements/NFR-non-functional-requirements.md#nfr-1)), with no new Playwright project: `/demo-check` gets hand checks of the keyboard and gestures in Firefox for Android.** The owner shops with it. Playwright's phone emulation (`isMobile`) works in Chromium only, so a Firefox project would be a narrow desktop window that adds little and about a third more E2E time. Claude's recommendation; the owner chose it. |
| 3 | When the haul folds ([OP-138](https://github.com/luiki-dev/szop/issues/408)) | While the add bar has focus (PH-17). | **Only while the phone's keyboard is open for the add bar: the visual viewport is at least about 150 px shorter than the window. With the field focused and the keyboard closed the haul stays open; on a desktop it never folds. Leaving the field keeps PH-17's unfold after a tap.** [ORD-1](../requirements/ORD-list-display-and-ordering.md#ord-1).8 is reworded. The threshold is Claude's call, checked on the owner's phone at the stop; the owner approved the mockup. |
| 4 | Saving a rename ([OP-139](https://github.com/luiki-dev/szop/issues/409)) | "Saving…" and "Not saved. Try again" under the name, as since PH-16d. | **A rename is optimistic, as items are: no "Saving…", no "Not saved"; a failure puts the old name back and shows the error toast.** The owner chose it. It becomes an app-wide rule in the [visual design](../architecture/visual-design.md): a change that can be undone is silent while in flight and speaks only on a failure, through a toast; an action the person waits for (create, delete) shows its state in its own button; a message about a save's state never moves the content. |
| 5 | The toasts' width and place ([#414](https://github.com/luiki-dev/szop/issues/414)) | 75 % of the screen, centered (PH-17). | **75 % of the haul's width on a phone and 60 % on a desktop, centered on the haul.** The owner approved the mockup with this change. |
| 6 | Error toasts | The same look as the Undo toast. | **The destructive color (light: `red-600` with white text; dark: `red-400` with `gray-950`), a warning icon first and `role="alert"`; the Undo toast is unchanged.** The owner asked that errors look like errors; approved on the mockup. It adds [APP-3](../requirements/APP-app-wide-behavior.md#app-3).4. |
| 7 | Quantity's height ([#413](https://github.com/luiki-dev/szop/issues/413)) | — | **48 px, like the other fields.** Agreed in text without a mockup, with the owner's explicit consent ([ADR 0069](0069-ask-before-a-mockup.md)), as were decisions 5's widths, 8 and 9. |
| 8 | Focus after the edit form closes ([#415](https://github.com/luiki-dev/szop/issues/415)) | — | **Focus returns to the item; its ring shows only when the item was opened from the keyboard.** |
| 9 | Enter in the list name ([#416](https://github.com/luiki-dev/szop/issues/416)) | — | **Enter saves and leaves the field.** |
| 10 | The category picker's scrolling ([#417](https://github.com/luiki-dev/szop/issues/417)) | The whole dialog scrolls. | **The title and the search stay put; only the bordered list of categories scrolls, with a thin browser scroll bar inside its border (`scrollbar-width: thin`), in the desktop dialog and the phone sheet.** The owner chose option a) on the mockup. |
| 11 | The acceptance criteria | — | **ORD-1.8 reads "While the phone's keyboard is open for the add bar, the haul folds to one line …"; the new APP-3.4: "A message about a failure is told apart by its color and an icon and is announced at once; a message about a save's state never moves the content."** The owner approved both. |

## Consequences

- Every later screen follows decision 4's rule: no "Saving…" lines, failures as toasts.
- The supported browsers include a second phone browser, checked by hand at each demo check.
- A haul that folds only with the keyboard depends on the browser reporting its visual viewport; a browser that does not keeps the haul open.

## Settled while building

- ✏️ **The list jumped for two reasons (#412, Task 1).** First, without `interactive-widget=resizes-content` in the viewport meta tag the keyboard covers the sticky add bar and the browser pans the page to show it; with it, the page is laid out again above the keyboard. Second, PH-17's `scroll-padding-bottom` (the bottom block's height, so a focused row stops above the block) also counts the add bar's own field as hidden under the block, and scrolling it into view sent the list to its end in Chromium; the padding is now 0 while the focus is inside the block (`html:has([data-bottom-block] :focus)`). The E2E tests show the keyboard by shortening the viewport at the same width and scrolling the focused field into view, as the phone does.
- ✏️ **Keyboard open is measured against the tallest viewport at the same width (Task 1).** With `resizes-content` the window shrinks with the keyboard too, so the visual viewport cannot be compared with the window as the brainstorm had it; it is compared with the tallest height seen at its current width instead, which a turned phone or a zoom resets.
