# Documentation volume: a simulation of the leaner rules

- **Date:** 2026-10-28
- **Status:** a point-in-time record. It describes one simulation of [ADR 0054](../decisions/0054-leaner-documentation.md) on PH-15a and stays as written.

The [first audit](2026-10-28-documentation-volume.md) found what a phase writes more than once. [ADR 0054](../decisions/0054-leaner-documentation.md), decision 15, asked for a measurement: PH-15a's artifacts rewritten under the new rules, with the words and tokens counted before and after.

## Method

- **Sample:** [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only)'s spec, plan and ADR 0050 at the PR's final head, `9e7c4dd` (the branch itself was deleted at the merge), the body of the phase issue [#287](https://github.com/luiki-dev/szop/issues/287) and the description of PR [#306](https://github.com/luiki-dev/szop/pull/306), as they are today.
- **Rewrite:** each artifact under the rules this branch wrote, and only those. The spec has the sections of `docs/superpowers/specs/CLAUDE.md`: its Decisions table moves to the ADR, which already held all 14 decisions and "Changes to the roadmap", so the ADR is unchanged; Goal is one sentence with the roadmap link; the criteria are a list of linked IDs. The plan gets "Order of work" and a pointer to `plans/CLAUDE.md`, loses the repo-wide rules from its Global Constraints and links the spec for the criteria and docs it listed; its tasks' steps are as they were. The issue body is the link and **Also**. The PR description has the four sections of the new template. Nothing was shortened beyond the rules: decisions moved, they were not condensed.
- **Counting:** words are `len(text.split())`. Tokens are characters divided by four, rounded, since no API key was set; they are an estimate, good for the ratio and not for the absolute figure.

## Result

| Artifact | Words before | Words after | Tokens before | Tokens after | Change |
|---|---|---|---|---|---|
| Spec | 5043 | 3484 | 9057 | 6393 | -29% |
| ADR 0050 | 2472 | 2472 | 4093 | 4093 | +0% |
| Plan | 4922 | 4668 | 9076 | 8552 | -6% |
| Phase issue #287 | 192 | 9 | 580 | 38 | -93% |
| PR #306 | 1401 | 600 | 3214 | 1636 | -49% |
| **Total** | 14030 | 11233 | 26020 | 20712 | -20% |

## Edits no longer made

- **The phase issue's body sync:** 4 for PH-15a (3 during the phase), from the issue's edit history.
- **The third place of an ADR note:** 3, the status lines of ADR 0014, 0022 and 0051 that ADR 0050 changed.
- **Repo-wide rules in the plan's Global Constraints:** 5 bullets and about 180 words, now in `plans/CLAUDE.md`.

## What the numbers do not show

- **Decisions are moved, not removed.** The spec lost its Decisions table, but the ADR keeps every decision, so the saving is the duplicate, not the content.
- **One phase only.** PH-15a is a full-path phase with a long spec; a smaller phase would save less in absolute terms.
- **Reading time and attention.** The PR's description shrank by half, and the owner's check moved to the definition of done's demo list; neither is a word count.
- **The plan barely changed (-6%).** Its length is its tasks, which this work leaves alone.
