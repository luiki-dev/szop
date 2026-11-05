# ADR 0068 — A mockup before any UI is built

- **Status:** ✅ Accepted
- **Date:** 2026-11-05
- **Refines:** [ADR 0013](0013-visual-design.md), decision 21 (mockups for every UI or UX decision, not only a phase's screens, and before the spec describes it, see decisions 1 to 3)

## Context

[ADR 0013](0013-visual-design.md), decision 21, has a phase's brainstorm design its screens as mockups. In practice it was read as "new screens": PH-16c's selection mode, a change to the existing lists page, was agreed in text only, and its spec described the selection bar replacing the page's header. Built, the whole list of lists jumped up when selecting started; the owner saw it only at the demo check of [#384](https://github.com/luiki-dev/szop/pull/384), and it became [OP-131](https://github.com/luiki-dev/szop/issues/385). A picture of the page before and after selecting starts would have shown the jump in the brainstorm. The owner asked that, from now on, whatever UI or UX is agreed is shown on a mockup first, as early as possible.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Which UI work gets a mockup | New screens only (ADR 0013, decision 21, as practiced); every UI or UX element being decided | **Every UI or UX element being decided, designed or agreed**: a new screen, a change to an existing one, a control, a state, an interaction, a message's place. It applies wherever the decision is taken: a phase's brainstorm, while building, a review's triage, an open point or a bug fix. The owner chose it. |
| 2 | When the mockup is shown | After the spec, before the code; before the spec describes it | **Before implementation, as early as possible**: in a brainstorm, before the spec describes the element, so the spec's text follows the approved mockup; a UI decision taken later (while building, at the finishing triage) gets its mockup before the code changes. A design agreed in text only is not approved. The owner chose it. |
| 3 | What a mockup holds | A clickable or animated prototype; a static mockup with the dynamic changes described | **A static mockup of each state, plus a description of the dynamic changes**: what appears, disappears or moves, and what triggers it. A change between states (a mode starting, a bar appearing) is shown as a before-and-after pair at the same scale and position, so whatever moves is visible; phone and desktop both when their layouts differ. Mockups use the real tokens, in the visual companion, as in ADR 0013, decision 21. A prototype costs more than the decision needs. The owner chose a static mockup with the changes described; Claude proposed the before-and-after pairs, after OP-131. |
| 4 | Where approved mockups are kept | As in ADR 0013, decision 21; also in the visual design doc | **As in ADR 0013, decision 21**: screenshots in the folder next to the phase's spec, which links them; one approved outside a phase goes next to the ADR that needed it, or into the issue as an attachment. The visual design doc changes only when the design system does. Proposed by Claude; the owner approves it with this ADR's PR. |

## Consequences

- **[`visual-design.md`](../architecture/visual-design.md), section 7, follows decisions 1 to 3**, and [`CLAUDE.md`](../../CLAUDE.md) states the rule among the ways of working.
- **The [definition of done](../development/definition-of-done.md), item 11**, asks for the approved mockups of every UI decision the PR built, not only of new screens.
- **A brainstorm that touches the UI takes longer**: each element waits for the owner's comments on its mockup before the spec is written. That is the point: a comment on a mockup costs less than an open point after the demo check.
