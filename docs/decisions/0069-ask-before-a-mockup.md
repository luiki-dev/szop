# ADR 0069 — Asking before a mockup

- **Status:** ✅ Accepted
- **Date:** 2026-11-05
- **Extends:** [ADR 0068](0068-mockups-before-ui.md), decision 2 (Claude asks before making each mockup, and the owner may decline it, see decision 1)

## Context

[ADR 0068](0068-mockups-before-ui.md) has every UI or UX element being decided shown to the owner on a mockup before it is built, and a design agreed in text only is not approved. Right after it, the owner asked to be asked before each mockup is made: a mockup costs time and usage, and some changes are too small to need one.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Asking before a mockup is made | Make it without asking (ADR 0068 as accepted); ask each time, a refusal only postponing it; ask each time, a refusal skipping it | **Claude asks the owner before making each mockup**, naming what it would show. **A refusal skips it**: the element is then agreed in text, with the owner's explicit consent, and the spec (or the commit, outside a brainstorm) notes that it had no mockup. Postponing only would keep a mockup the owner judged unneeded. The owner chose it. |

## Consequences

- **[`visual-design.md`](../architecture/visual-design.md), section 7, [`CLAUDE.md`](../../CLAUDE.md)** and **the [definition of done](../development/definition-of-done.md), item 11** (no mockup committed for one the owner declined) follow it.
