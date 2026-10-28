# Documentation volume per phase

- **Date:** 2026-10-28
- **Status:** a point-in-time record. It describes what phases produced up to PH-15a's open PR and stays as written; the decisions taken from it go into an ADR of their own.

The owner had the impression that each phase produces more and more documentation, some of it unnecessary (for example the PR's "How it was tested"). This audit lists what a phase writes, where, how often and when; finds the facts written in more than one place; and names candidates for removal. It is the input for a brainstorm on leaner documentation.

## Contents

- [Method](#method)
- [What grew and what did not](#what-grew-and-what-did-not)
- [What a phase writes](#what-a-phase-writes)
  - [In the repo](#in-the-repo)
  - [On GitHub](#on-github)
  - [In the PR description](#in-the-pr-description)
- [Duplicates](#duplicates)
- [Candidates for removal](#candidates-for-removal)
- [Rules that would change](#rules-that-would-change)

## Method

- **In depth:** one full-path phase, [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only): its branch diff against `main` (34 files under `docs/` and `CLAUDE.md`), PR [#306](https://github.com/luiki-dev/szop/pull/306), its phase issue [#287](https://github.com/luiki-dev/szop/issues/287) and the open-point issues it touched (for example [OP-071](https://github.com/luiki-dev/szop/issues/94), [OP-010](https://github.com/luiki-dev/szop/issues/63)). PH-14b's PR [#285](https://github.com/luiki-dev/szop/pull/285) as a comparison.
- **By size only:** the word counts of every spec, plan and phase ADR, the PR description lengths of the last 30 PRs, and the Markdown files and lines of 12 phase PRs.
- **Not covered:** bounded-path phases and non-phase PRs (ADRs outside phases, Dependabot, releases) section by section.
- **Sources of the rules:** the [PR template](../../.github/pull_request_template.md), the [definition of done](../development/definition-of-done.md), [ADR 0004](../decisions/0004-implementation-process.md), [project tracking](../development/project-tracking.md), `CLAUDE.md`, and `docs/superpowers/plans/CLAUDE.md`.

## What grew and what did not

| Measure | Early phases (PH-05 to PH-07) | Recent (PH-14b, PH-15a) |
|---|---|---|
| Plan | 7–10k words | 3.5–5k words, smaller |
| Spec | 3–4.5k words | 3.4–5k words, about the same |
| Phase ADR | 1.4–2.3k words | 1.2–2.5k words, about the same |
| Markdown lines added per phase PR | about 1,500–1,700 | about 460–700, smaller |
| **PR description** | about 5.5k characters (PH-12c, #246) | **9.5k (#285) and 13k (#306)**, larger |

The documents in the repo have not grown. Two things have:

- **The PR description**, through the demo check's fixed fields (#286), the acceptance criteria ([ADR 0051](../decisions/0051-acceptance-criteria.md)), the token usage section ([ADR 0052](../decisions/0052-working-with-claude.md)), and a "Rulings I made" section that no template asks for.
- **The number of copies of one fact:** up to five or six places for a criterion's status (see [Duplicates](#duplicates)).

## What a phase writes

### In the repo

| Target and section | How often | When |
|---|---|---|
| **Spec:** Goal, Changes to the roadmap, Decisions, Design, Documentation, Acceptance criteria, Tests, Definition of done for this phase, Order of work, Risks, Out of scope | Every phase | Full path |
| **Plan:** header, Global Constraints, Review Focus, File Structure, Tasks with ticked steps | Every phase | Full path |
| **Phase ADR** (`NNNN-…-details.md`): Context, Changes to the roadmap, Decisions, Consequences, Settled while building | Every phase | Always, in recent phases |
| **Notes in earlier ADRs**, each in three places: the new ADR's header, the earlier ADR's status line, the decision's cell | Most phases (four ADRs in PH-15a) | A decision is refined, extended, completed or revisited |
| **Requirement file:** the criterion rows, the requirement's status line (`✅ Done (12 of 12) · ✅ Criteria finalized`) | Twice per phase: the criteria review in the brainstorm, then the PR | Criteria reviewed or delivered |
| **Requirements index** (`functional-requirements.md`): one row per requirement with its status and count | Twice per phase | As above |
| **Roadmap phase entry:** Goal, Delivers, Split from, Depends on, Owner steps, Expected path | Often | The phase's plan changes |
| **Roadmap stage table row:** status, Spec, Plan, PR, issue | Three or four commits per phase | Work starts; spec, plan, PR |
| Architecture, stack overview, visual design, threat model, glossary | Nearly every phase | When affected (the threat model got one line in PH-15a) |
| Guides (testing, scripts, CI) and tool pages | Most phases | A new tool or test layer |
| Mockups (three PNGs) and **built screenshots** (six PNGs, about 600 KB) under the spec's folder | Phases that change the UI | A UI change |
| `CLAUDE.md` | Sometimes | A process rule changes |

Commit messages are short (seven words of trailers in most, 30 to 60 words in a few) and are not a problem.

### On GitHub

| Target | How often | When |
|---|---|---|
| Phase issue fields: Status, Started, Spec, Plan; Finished on the previous phase | Every phase | Always |
| **Phase issue body: a full copy of the roadmap entry** | Every PR that changes the entry | The entry changed |
| Open point settled: a "settled by" comment, then `Closes #N` in the PR | About four per phase | Per open point |
| Open point partly done: part ticked, History line, re-parented, Status reset | About two per phase | Per open point |
| New open-point issue | One or two per phase | Something left for later |
| Owner-step issues | Some phases | The phase has owner steps |

### In the PR description

PH-15a's, about 13k characters:

| Section | Size | When |
|---|---|---|
| What and why: the feature as bullets, a summary of the decisions | about 2.3k | Always |
| Screenshot table | about 1.5k | A UI change |
| Links: roadmap, spec, plan; criteria in ✅ and 🚧 lists; ADRs with their notes; **Issues changed** (every open-point edit); `Closes #N` lines | about 4k | Always |
| **How it was tested:** unit and E2E cases with counts, by hand, the review's findings, the JavaScript budget | about 1.5k | Always |
| **Rulings I made** (not in the template) | about 0.9k | Ad hoc |
| Definition of done: 11 items with their full text; the demo block with its fixed checks, four Lighthouse scores per page, three Core Web Vitals and this PR's checks | about 2.5k | Always |
| Token usage: an eight-row table with Baseline and Target columns | about 1k | Phases since ADR 0052 |

## Duplicates

| # | Fact | Written in | Copies |
|---|---|---|---|
| D1 | **Decisions and their alternatives** | The spec's Decisions table; **the ADR's Decisions table**, whose rows 1–14 repeat the spec's almost word for word (about 1,500 words in PH-15a); the PR's "What and why" summary; the PR's "Rulings", which repeat ADR rows 15–21 and "Settled while building" (for example the counts during a search) | 3–4 |
| D2 | **A phase's plan** (goal, delivers, split) | The roadmap entry; **the phase issue body**, a full copy kept in sync; the spec's Goal and "Changes to the roadmap"; the ADR's "Changes to the roadmap" | 4 |
| D3 | **A phase's status and links** | The stage table row; the project's Status, Spec and Plan fields; the PR's Links (roadmap, spec, plan) | 3 |
| D4 | **A criterion's status** | The criterion row; the requirement's status line (a count); the index's row (the same count); the spec's criteria table; the PR's "Requirements and criteria"; the plan's step listing them | 5–6, and the counts can be derived from the rows |
| D5 | **Open-point changes** | The issue itself (comment, tick, History; GitHub's timeline logs the re-parent too); the PR's "Issues changed"; the plan's list of them; the `Closes #N` lines | 3–4 |
| D6 | **The definition of done** | `definition-of-done.md`; the PR template's 11 items with their full text; the spec's "Definition of done for this phase"; ADR 0004, decision 7 | 4 |
| D7 | **The docs to update** | The spec's "Documentation"; the plan's documentation step (the same list again); the definition of done, items 6 and 7; the PR's checkbox | 3–4 |
| D8 | **What is tested** | The spec's "Tests"; the plan's steps per task; **the PR's "How it was tested"**; the test code, named by criterion ID; CI's results | 4–5 |
| D9 | **Process rules** | `CLAUDE.md`'s "Project tracking", which mirrors `project-tracking.md`'s "How items move" on purpose; the plan's Global Constraints (commit trailers, doc style, the after-each-task rule, never merge), which also repeat `plans/CLAUDE.md` | 3 |
| D10 | **Fixed thresholds** | The [NFR-3](../requirements/NFR-non-functional-requirements.md#nfr-3) limits and the Lighthouse format in every PR; the token usage table's Baseline and Target columns (constants in the script) in every PR | One per PR |
| D11 | **Notes between ADRs** | The header, the status line and the decision's cell | 3 per note |

## Candidates for removal

The audit's view, strongest first. Each needs the owner's decision in the brainstorm.

1. **The PR's "How it was tested".** Its case lists repeat the spec's Tests and the test names, and CI shows they pass. Possibly worth keeping: what was checked by hand outside the demo checks, and anything surprising found on the way.
2. **The spec's decisions copied into the ADR (D1)**, the largest block of duplicated text in the repo. Either the ADR holds the decisions and the spec links to it, or the reverse.
3. **The PR's "Rulings I made"**, which land in the ADR anyway: a link would do.
4. **The phase issue body as a copy of the roadmap entry (D2)**: a link plus the **Also** section would remove a sync step from every phase.
5. **A requirement's count in two places (D4)**: the index's row repeats the requirement's status line. One of them could go, or a script could generate it.
6. **The PR's Links and "Issues changed" (D3, D5)**: the stage table already holds the roadmap, spec and plan links, and GitHub's timeline logs the issue edits. Possibly only `Closes #N` and the open points created would stay.
7. **The PR's definition of done block (D6, D10)**: the item texts repeat the definition of done page; the thresholds and the Baseline and Target columns are the same every time; some items (Conventional Commits) are already checked by CI and the git hooks.
8. **The spec's "Definition of done for this phase", "Order of work" and "Documentation" (D6, D7)**, which the plan repeats. Only the demo-check list is unique to the spec.
9. **The plan's Global Constraints (D9)**: some lines are rules for the whole repo. They are there for subagents, which see only their task, but they could point to one shared file.
10. **Built screenshots committed to the repo**: they serve only the PR. Images attached to the PR would do, though GitHub then holds them outside the repo.

## Rules that would change

Removing any of the above touches decisions and documents that the brainstorm has to revisit:

- [ADR 0004](../decisions/0004-implementation-process.md), decisions 7 to 9 (the definition of done, process weight, document roles), and [ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decisions 3 and 4
- [ADR 0027](../decisions/0027-open-points-on-github.md) (the phase issue body as a copy; the PR lists the issue changes)
- [ADR 0051](../decisions/0051-acceptance-criteria.md) (where a criterion's status is written)
- [ADR 0052](../decisions/0052-working-with-claude.md) (the PR's token usage section)
- the [PR template](../../.github/pull_request_template.md), the [definition of done](../development/definition-of-done.md), [project tracking](../development/project-tracking.md), `CLAUDE.md`, `docs/superpowers/plans/CLAUDE.md`
