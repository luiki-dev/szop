# Writing a spec

Rules for the session that writes a spec in this folder ([ADR 0054](../../decisions/0054-leaner-documentation.md), decisions 3, 4 and 10).

## The phase ADR

The phase ADR is created in the same commit as the spec, at ✅ Accepted. It holds the phase's decisions and the "Changes to the roadmap"; decisions settled while building are added to its "Settled while building".

## A spec's sections

In this order:

1. **Goal:** one sentence and a link to the phase's entry in `docs/roadmap.md`.
2. **Decisions:** a link to the phase ADR's decisions, not a table.
3. **The design.**
4. **Acceptance criteria:** linked IDs, each marked whole or in part.
5. **Tests.**
6. **Documentation:** the living docs the phase changes.
7. **Demo check:** the behaviors to check at the demo, and the IDs (linked) of the criteria checked there, from which the PR's "Checked at the demo:" line is filled.
8. **Risks.**
9. **Out of scope.**
10. **Left to the builder.**

## What a spec does not hold

- A Decisions table: the ADR holds the decisions.
- "Changes to the roadmap": the ADR holds them.
- "Definition of done for this phase": [`definition-of-done.md`](../../development/definition-of-done.md) holds it.
- "Order of work": the plan holds it.
