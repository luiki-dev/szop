# Open points on GitHub, plans in the roadmap — design

- **Topic:** how the GitHub tracking trial of [ADR 0024](../../decisions/0024-github-project-tracking.md) ends ([OP-086](https://github.com/luiki-dev/szop/issues/156))
- **Date:** 2026-10-11
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8; documentation and GitHub only, no application code
- **Issues:** OP-086 ([#156](https://github.com/luiki-dev/szop/issues/156)) and ADR 0027 ([#166](https://github.com/luiki-dev/szop/issues/166)), both closed by this work's PR; OP-067 ([#27](https://github.com/luiki-dev/szop/issues/27)), already closed on GitHub, mirrored one last time

The trial ran for PH-06b and PH-07 with GitHub as the source and the docs as its mirror (ADR 0024, decisions 2 and 14). It worked: a drift check on 2026-10-11 found every one of the 60 open open-point issues matching its register entry. But every change was made twice, and the owner read only one side of each pair: **GitHub for status and what comes next, `roadmap.md` for a phase's scope.** Nobody read `open-points.md`. This design ends the trial accordingly: each fact gets one home, open points move to GitHub for good, the register is archived, and a phase's plan returns to `roadmap.md`. The result is ADR 0027.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Evidence from the trial](#evidence-from-the-trial)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Who owns what](#who-owns-what)
  - [How work runs day to day](#how-work-runs-day-to-day)
  - [The closed open points become issues](#the-closed-open-points-become-issues)
  - [The archive](#the-archive)
  - [Links in the living docs](#links-in-the-living-docs)
  - [Wording in the docs](#wording-in-the-docs)
  - [ADR 0027 and the decisions it changes](#adr-0027-and-the-decisions-it-changes)
- [Tasks](#tasks)
- [Checks](#checks)

## Goal and success criteria

Every open point, open or closed, is a GitHub issue, and no living document needs editing when one is added, moved or closed. `roadmap.md` is the source of each phase's plan; GitHub is the source of status and of what comes next.

The work is done when:

- every register entry, OP-001 to OP-088, has an issue labelled `open-point`, closed for the 29 entries closed by then (OP-086 included; 25 of the issues are new) and open for the 59 others;
- `docs/open-points.md` no longer exists; `docs/archive/open-points.md` holds the register as it was on the day, with OP-067 and OP-086 in Closed, under a banner saying it is frozen; `docs/archive/CLAUDE.md` says the folder is never a source;
- the specs, plans and the audit link to `archive/open-points.md` with their anchors unchanged, and every one of those links resolves;
- the living docs (the README, `CLAUDE.md`, `.github/`, and `docs/` outside `superpowers/`, `audits/` and `archive/`) contain no link to `open-points.md`; their `#op-N` links point to the issue whose title starts with that ID, their phase-group links to the phase issue, and the ADRs' three links to "the open points register" to the board's Open Points view;
- `CLAUDE.md`, `project-tracking.md` (including all seven views as they are set now), `roadmap.md`'s "How it works" and "Open points:" lines, the definition of done, the PR template, the open-point issue form and `phase-walkthrough.md` describe the rules of [Who owns what](#who-owns-what), with nothing left of the trial rule;
- ADR 0027 exists, with the three-place notes on every decision it changes;
- the PR closes #156 and #166.

## Out of scope

- **The phase issues' bodies** are not changed: they keep their copy of the plan (decision 3).
- **The README's diagram** stays as it is ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)).
- **Automation** that syncs the docs and GitHub: still a rule, as in ADR 0024, decision 14.
- **The wording of accepted ADRs, specs, plans and the audit.** Only their links change, a mechanical change `CLAUDE.md` allows.
- **`~/.claude/CLAUDE.md`** (the owner's global notes about WSL's networking) is outside the repository.

## Evidence from the trial

- **Drift:** none. On 2026-10-11 every open open-point issue matched its register entry in phase, status and issue number; the only differences were two edits made that day and not yet mirrored.
- **Cost:** every open-point change happened twice. PH-07 alone made about 20 issue edits (statuses, re-parents, new issues, ticked parts), each mirrored by hand in `open-points.md` and `roadmap.md`.
- **One mistake, caught by GitHub:** Claude misread the register's grouping and believed OP-086 sat under PH-07; re-parenting it on GitHub failed because it already sat under PH-08.
- **What the owner used:** GitHub for status and what comes next (the board's Todo column prompted a question on 2026-10-11), `roadmap.md` for a phase's scope, the README's diagram. Not `open-points.md`.
- **What dropping the register costs:** 282 mentions of `open-points.md` in living docs, among them 217 links to an entry and the links to a phase's group (38 in all docs); 241 link targets in 10 specs, 10 plans and the audit.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | Which side the owner reads | — | **Both, for different things:** GitHub for status and what comes next, `roadmap.md` for a phase's scope. The README's diagram stays. The decisions below follow from this. |
| 2 | `open-points.md` | Drop it, the issues being the only place; keep it as the mirror; keep a slim index | **Drop it: open points live only on GitHub.** The links to its entries in living docs, ADRs included, are rewritten to the issues once, by script. Keeping the mirror keeps the double bookkeeping for nothing anyone reads; a slim index still needs an edit for every add, move or close. What is lost: reading open points offline or without GitHub. |
| 3 | Where a phase's plan lives | `roadmap.md` is the source; the issue stays the source and `roadmap.md` its mirror; the issue is the only place | **`roadmap.md` is the source of each phase's plan; the phase issue keeps its body as a copy** synced from it, the owner's choice: the issue reads on its own on the board without a jump to the roadmap. The duplication is accepted; the direction is fixed (docs to issue). The issue keeps what only GitHub does well: sub-issues, blocking links, status and fields. A scope change is a docs change again, reviewed in the PR's diff. |
| 4 | Phase status in `roadmap.md` | Keep the stage tables with their Status column; drop the column; drop the tables | **Keep the tables as they are, Status column included,** mirroring GitHub. It changes at the same three moments as the diagram (work starts, the PR opens, the merge) and in the same commit, so it costs almost nothing and keeps `roadmap.md` readable on its own. |
| 5 | The register's closed entries | Freeze them in an archive document; make each a closed issue; let git history keep them | **Each becomes a closed issue,** the owner's choice: every open point then lives on GitHub, closed or open, and every link in a living doc goes to an issue. 25 new issues; OP-012, OP-057 and OP-067 already have one. |
| 6 | What happens to the file | A stub with a frozen index, at the same path; move it whole to an archive folder | **Moved whole to `docs/archive/open-points.md`,** the owner's proposal, with a `CLAUDE.md` in the folder saying nothing there is a source. The records (specs, plans, the audit) keep their anchors, re-pointed to the archive by a path substitution, so each still shows the register as it was. A stub would break those anchors. |
| 7 | Where ADRs link | To the archive, like the records; to GitHub, like the living docs | **To GitHub,** the owner's choice: ADRs are read for current state, so their links go to the issues, and their three links to "the open points register" to the board's Open Points view. Their wording stays. |

## Design

### Who owns what

| Fact | Source | Mirrored in | When the mirror changes |
|---|---|---|---|
| A phase's plan (goal, delivers, depends on, owner steps, expected path) | `roadmap.md`'s phase entry | the phase issue's body | when the PR that changes the entry opens; the PR lists the bodies it updated |
| Phase status | the project's Status field | the stage tables' Status column and the README's diagram | work starts, the PR opens, the merge (in the PR, before it), in one commit |
| Spec, plan and PR links of a phase | the stage tables | the project's Spec and Plan fields | when each is committed or opened |
| Open points, open and closed: text, parts, history, status, phase | issues labelled `open-point` | nowhere | — |
| What comes next | the board's 📌 Todo | nowhere | — |
| Owner steps | issues labelled `owner` | the phase entry's "Owner steps" | with the phase's plan |
| New phases, splits, reorders | a brainstorm, then `roadmap.md` (and an ADR when significant) | new issues, the diagram | in the same PR |

### How work runs day to day

- **A brainstorm** starts from its phase issue's sub-issues and the open points that list the phase among their parts, read with `gh`.
- **Something deferred** becomes an issue with the next free `OP-` ID (the highest ID among issues labelled `open-point`, plus one), a sub-issue of the phase that settles it, and is mentioned where it came up, as a link to the issue.
- **A part done:** ticked on the issue with its PR; the issue is re-parented to the next phase and set to ⬜ Backlog, or 📌 Todo if that phase is picked.
- **Closing:** the issue is closed as completed with what settled it (an ADR, a PR, a commit) as a comment, or as not planned with the reason.
- **The PR description** lists the issue changes it relied on; it is the review trail the register's diff used to be.
- **The definition of done, item 9,** means open points closed, re-assigned or added on GitHub.

### The closed open points become issues

For each of the 25 closed entries without an issue (OP-001 to OP-009, OP-011, OP-022, OP-024, OP-031, OP-034 to OP-037, OP-042, OP-050, OP-058, OP-059, OP-061, OP-062, OP-065, OP-073):

- **Title and body** in the open-point issue format of [project tracking](../../development/project-tracking.md): the title is the ID and the bold lead, cut to 80 characters; the body starts with "Closed before the register moved to GitHub ([ADR 0027](…))" instead of the register link, then the entry's text, **Parts** as a ticked checklist, **Source** and **History**, with links rewritten for an issue body.
- **Closed as completed** right after creation, with the entry's "settled by" line as the closing comment. The project's workflows add it and set ✅ Done.
- **Parent:** the issue of what settled it, when the "settled by" line makes it clear: a PR maps to its phase through `roadmap.md`'s PR column; an ADR maps to its `adr` issue, or to the phase that made it. Otherwise no parent. **The mapping table is shown to the owner before any issue is created.**

### The archive

- `git mv docs/open-points.md docs/archive/open-points.md`, after one last mirror edit, so the snapshot matches GitHub on the day: OP-067 and OP-086 move to Closed with what settled them.
- **A banner** under the title: frozen on the day of ADR 0027, not maintained; the source is the GitHub issues labelled `open-point`, with a link to the board's Open Points view. Its own relative links are re-pointed one level up, so they keep working.
- **`docs/archive/CLAUDE.md`:** the folder holds frozen records; never read them for current state, never edit them except to fix a link; for open points use `gh issue list --label open-point` and the board. Claude Code loads it when it reads a file in the folder.
- **The records' links:** `../../open-points.md` becomes `../../archive/open-points.md` in `docs/superpowers/specs/` and `plans/` (189 targets in 20 files), and `../open-points.md` becomes `../archive/open-points.md` in `docs/audits/` (52 targets). Anchors are unchanged. Plain-text mentions such as `docs/open-points.md` inside a plan's commands stay as written.

### Links in the living docs

Rewritten by a throwaway script from an OP → issue map read from GitHub, then checked:

| Link | Becomes |
|---|---|
| `open-points.md#op-053` (relative, any depth) | `https://github.com/luiki-dev/szop/issues/26`, the link text unchanged |
| `open-points.md#ph-07-first-e2e-journey` (a phase's group) | the phase issue, `https://github.com/luiki-dev/szop/issues/36` |
| `open-points.md` without an anchor, in the three ADRs (0011, 0014, 0024) | the board's Open Points view, `https://github.com/users/luiki-dev/projects/3/views/5` |
| `open-points.md` without an anchor, elsewhere | reworded by hand (next section) |

### Wording in the docs

- **`CLAUDE.md`:** "Track what is deferred in `docs/open-points.md`" becomes "Track what is deferred as `open-point` issues"; the documentation list loses `open-points.md` and gains `docs/archive/` (frozen records, never a source); `project-tracking.md`'s line loses "during the trial".
- **`docs/development/project-tracking.md`:** "The trial rule" becomes the rules of [Who owns what](#who-owns-what); "What lives where" and "How items move" lose the register; **the views table documents all seven views as they are set now, read from the API** (the owner changed their settings, and added Owner Steps).
- **`docs/roadmap.md`:** "How it works" (the GitHub paragraph and the "Open points" item); each phase entry's "Open points:" line points to its phase issue's sub-issues.
- **`definition-of-done.md`** item 9, **`.github/pull_request_template.md`**'s open points line, **`.github/ISSUE_TEMPLATE/open-point.yml`**, **`phase-walkthrough.md`**, and any guide or tool page that tells the reader to edit the register.
- **`docs/glossary.md`:** the register's entry, if any, says it is archived.

### ADR 0027 and the decisions it changes

`docs/decisions/0027-open-points-on-github.md`, in the shape of ADR 0024, with this design's decisions 1 to 7. Each change below gets the three-place notes (the new ADR's header, the earlier ADR's status line, a line at the bottom of the decision's cell):

| Earlier decision | ADR 0027 |
|---|---|
| ADR 0024, decision 2 (the trial) | completes it: the outcome |
| ADR 0024, decision 1 (GitHub the source, the docs its mirror) | refines it: GitHub for status and open points, `roadmap.md` for a phase's plan |
| ADR 0024, decision 3 (closed open points not made issues) | revisits it: they become closed issues |
| ADR 0024, decision 11 (the whole plan in the issue) | refines it: the body stays, a copy synced from `roadmap.md` |
| ADR 0024, decision 14 (the trial rule) | supersedes it |
| [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 1 (one central register) | supersedes it |
| ADR 0011, decision 4 (the document roles table) | refines it: the register's row goes; the issues and `docs/archive/` get rows |
| [ADR 0014](../../decisions/0014-roadmap.md), decision 4, and ADR 0017, decision 4 (revisited for the trial) | refines them: what held for the trial is permanent |

## Tasks

1. **The 25 closed issues:** build the mapping table and show it to the owner; create, close and parent the issues; check that every register entry has an issue.
2. **The archive:** the last mirror edit, the move, the banner, `docs/archive/CLAUDE.md`, and the records' links re-pointed.
3. **The living docs' links:** the script, its run, and the checks.
4. **The wording:** `CLAUDE.md`, `project-tracking.md` with the seven views, `roadmap.md`, the definition of done, the PR template, the issue form, `phase-walkthrough.md`, the glossary.
5. **ADR 0027,** its notes, and #166's body.

## Checks

- No link to `open-points.md` in the living docs; no link in the records to `open-points.md` outside `archive/`.
- Every `issues/N` link added by the rewrite opens an issue whose title starts with the OP ID of its link text, or, for phase-group links, the phase's ID.
- Every register entry, OP-001 to OP-088, has exactly one issue labelled `open-point`, closed if and only if the entry is in Closed.
- The repository's relative-link check finds nothing broken in `docs/`, the README and `CLAUDE.md`.
- `pnpm lint` and `pnpm format:check` pass.
