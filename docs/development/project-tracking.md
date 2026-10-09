# Project tracking

How Szop's work is tracked on GitHub: the roadmap's phases, the open points and the decision work as issues, the stages as milestones, and all of them on the [Szop project](https://github.com/users/luiki-dev/projects/3). The decisions are in [ADR 0024](../decisions/0024-github-project-tracking.md). For now this is a **trial**: the issues are the source of truth, and the [roadmap](../roadmap.md) and the [open points register](../open-points.md) mirror them; [OP-086](../open-points.md#op-086) decides after PH-06b and PH-07 whether the register is dropped and the roadmap stays as a view updated from the issues.

## Contents

- [What lives where](#what-lives-where)
- [Milestones](#milestones)
- [Labels](#labels)
- [Issues](#issues)
  - [Phase issues](#phase-issues)
  - [Open-point issues](#open-point-issues)
  - [ADR issues](#adr-issues)
  - [Owner-step issues](#owner-step-issues)
  - [Links inside issue bodies](#links-inside-issue-bodies)
- [Relationships](#relationships)
- [The project](#the-project)
  - [Fields](#fields)
  - [Statuses](#statuses)
  - [Views](#views)
  - [Workflows](#workflows)
- [How items move](#how-items-move)
- [The trial rule](#the-trial-rule)
- [Setting up the project](#setting-up-the-project)
- [Checking with gh](#checking-with-gh)

## What lives where

| Szop concept | On GitHub | In the docs |
|---|---|---|
| Stage | Milestone `Stage N: <title>`, its exit criterion as the description | The stage's section and table in [`roadmap.md`](../roadmap.md) |
| Decision work before PH-01 | Milestone `Definition` | — |
| Phase | Issue `PH-NN <name>`, label `phase`, the stage's milestone | The phase entry in `roadmap.md`, with its issue in the stage table |
| Owner step of a phase | Issue `PH-NN owner step K: <step>`, label `owner`, sub-issue of its phase; only while the phase is not done | The phase entry's **Owner steps** in `roadmap.md` |
| Open point | Issue `OP-NNN <lead>`, label `open-point`, sub-issue of its phase | The entry in [`open-points.md`](../open-points.md), with its **Issue** line |
| Spike | Its open point's issue, also labelled `spike`, blocking its phase | The open point; the phase's "Depends on" |
| Candidate | Its open point's issue, also labelled `candidate`, no parent, no milestone | The open point under "Candidates" |
| ADR made outside a phase | Issue `ADR NNNN <title>`, label `adr` | The ADR in [`docs/decisions/`](../decisions/) |
| Requirements, use cases | — (linked from a phase's "Delivers") | [`functional-requirements.md`](../requirements/functional-requirements.md) |
| Status | The project's Status field | The stage tables (⬜ 🚧 ✅ ✖️) and the register's status lines |

## Milestones

One per stage, named after the stage's heading, with its **Exit:** line as the description, and `Definition` for ADR 0001 to 0015. No due dates: the roadmap has none. A stage's milestone is closed when its last phase is done, in the same session that sets the last row of its table to ✅. Closed today: `Definition` and `Stage 1: Local foundations`.

## Labels

| Label | Meaning |
|---|---|
| `phase` | A roadmap phase: one brainstorm, one branch, one PR |
| `open-point` | An entry of the open points register |
| `spike` | An open point answered by a spike before its phase |
| `candidate` | Optional work, not scheduled: a candidate phase or an upgrade waiting for its moment |
| `owner` | Only the owner can do it: an AWS, domain or GitHub setting, a manual check, a purchase |
| `adr` | Decision work whose result is one ADR, made outside a phase |

No other labels are used. Dependabot creates `dependencies` and one label per ecosystem on its own pull requests.

## Issues

### Phase issues

Title: the roadmap heading, `PH-06b Web security baseline`. The body starts with a link to the roadmap entry and copies the entry, section by section: **Goal**, **Delivers**, any extra field such as **Split from**, **Depends on**, **Owner steps**, **Expected path**, and **Also**, the open points of other phases it does a part of. Its own open points are its sub-issues, so they are not listed. A phase that is not done lists its owner steps as references to their [owner-step issues](#owner-step-issues); a done phase has them as a ticked checklist.

### Open-point issues

Title: the ID and the entry's bold lead, cut to 80 characters. The body starts with a link to the register entry, then the entry's text, then **Parts** as a checklist (a done part ticked, with its PR), **Source**, and **History** for "Moved from" notes. The status line is not copied: Status is the project's.

### ADR issues

Title: `ADR 0008 Hosting: an on-demand demo environment on AWS`. The body links the ADR and says where it landed: a commit for ADR 0001 to 0008, which went straight to `main`, a PR since. Only the ADR's creation counts. ADRs made inside a phase have no issue of their own: the phase's issue covers them.

### Owner-step issues

Every owner step of a phase that is not done is an issue of its own, so the owner sees on the board what waits on them. Title: `PH-10 owner step 1: Choose the name and buy the domain`, the step as the roadmap words it, capitalised, cut to 100 characters in all; the steps of an entry are numbered from 1 in the roadmap's order. Label `owner`, no milestone, a sub-issue of its phase. The body says which phase's step it is, with a link to the roadmap entry, and gives the step's text. The phase's **Owner steps** section lists the issues. The owner closes a step when it is done (or Claude does, when the owner says so), and the workflow sets ✅ Done. A done phase has no step issues: its steps stay a ticked checklist.

### Links inside issue bodies

Relative links do not work in issues. A link to a phase or an open point that has an issue is written as `PH-13 (#40)`, which GitHub shows with the title and state and records on the other issue as "mentioned"; every other link points to the file on `main`.

## Relationships

- **Sub-issue:** an open point sits under the phase that settles it. One with parts sits under the phase doing the current part, and moves to the next phase when that part is done. An owner step sits under its phase.
- **Blocked by:** a phase is blocked by its spike (PH-13 by OP-025, PH-16 by OP-038) and by any issue its "Depends on" names. The issue and its board card show a blocked marker.
- **Relates to:** a split phase relates to the phases it was split into. This link has no API yet: the owner adds it in the issue's sidebar.
- **`Closes #N`:** a PR closes its phase's issue, each open point it settles and, for an ADR made outside a phase, its `adr` issue.

## The project

The [Szop project](https://github.com/users/luiki-dev/projects/3) is public; only the owner can edit it.

### Fields

| Field | Values |
|---|---|
| Status | The six statuses below |
| Order | Phases: the roadmap position in steps of 10 (PH-01 is 10, the retired PH-06 is 60, PH-06a is 70). A new phase takes a free number between its neighbours. |
| Path | Phases: `Full` or `Bounded` |
| Spec, Plan | Phases: links to the files on `main` |
| Started | Phases: the day the brainstorm started (for done phases, the PR's first commit); `adr` issues: the day the work started |
| Finished | The merge date |

### Statuses

| Status | Means | In `roadmap.md` |
|---|---|---|
| ⬜ Backlog | Planned further down the line | ⬜ Not started |
| 📌 Todo | Picked next: the next phase, its open points and the owner's items it needs | ⬜ Not started |
| ⏳ Blocked | Would be Todo or In progress but cannot move; a blocked-by link names the blocker when it is an issue | ⬜ Not started |
| 🚧 In progress | From the start of the brainstorm, or of the work on an open point | 🚧 In progress |
| ✅ Done | Closed as completed | ✅ Done |
| ✖️ Dropped | Closed as not planned | ✖️ Dropped |

A far-off phase behind a spike stays ⬜ Backlog and keeps its blocked-by link; ⏳ Blocked is for an item that would otherwise be worked on.

### Views

| View | Layout | Filter | Grouping and sorting |
|---|---|---|---|
| Board | Board | `label:phase` | Columns by Status, swimlanes by Milestone, sorted by Order |
| Roadmap | Table | `label:phase` | Grouped by Milestone, sorted by Order; shows Status, Path, Spec, Plan, Linked pull requests, Sub-issues progress |
| Open points | Table | `label:open-point is:open` | Grouped by Parent issue, sorted by Title |
| Next up | Table | `status:"📌 Todo","⏳ Blocked","🚧 In progress"` | Grouped by Status; shows Labels, Parent issue, Milestone |
| Timeline | Roadmap | `label:phase,adr` | Started to Finished, milestones as markers, sorted by Started |

The Timeline is a record of what happened when: future phases have no dates yet.

### Workflows

| Workflow | Setting |
|---|---|
| Item added to project | Status `⬜ Backlog` |
| Item closed | Status `✅ Done` |
| Item reopened | Status `📌 Todo` |
| Auto-add to project | Repository `luiki-dev/szop`, filter `is:issue label:phase,open-point,adr,owner` |
| Pull request workflows, Auto-archive items | Off: pull requests are not on the project, and done items stay visible |

## How items move

| Event | On GitHub | Who |
|---|---|---|
| A phase is picked next | Phase and its open points → 📌 Todo | Owner (Claude proposes at the end of a phase) |
| A phase's brainstorm starts | Phase → 🚧 In progress, Started set; the previous phase's Finished set | Claude |
| Its spec or plan is committed | Spec, Plan set | Claude |
| Its PR opens | The description says `Closes #<phase>` and `Closes #<OP>` for each open point it settles | Claude |
| Its PR is merged | Those issues close; the workflow sets ✅ Done | Owner, by merging |
| An open point's part is done | The part ticked with its PR; the issue re-parented to the next phase, still open | Claude |
| An open point is added | An issue with the next free ID, under its phase, label `open-point` | Claude |
| An open point moves | Re-parented; a History line added | Claude |
| An item is dropped | Closed as not planned with the reason as a comment; Status → ✖️ Dropped | Claude |
| A phase is split | New phase issues; the old one closed as not planned with a comment; its open points re-parented | Claude; the owner adds *Relates to* |
| A candidate is picked up | `candidate` removed; a phase issue created | Claude |
| An ADR is made outside a phase | An `adr` issue, closed by its PR | Claude |
| An owner step is done | Its issue closed; the workflow sets ✅ Done | Owner, or Claude when the owner says so |
| A phase's owner steps change | Step issues added, or closed as not planned with the reason; the phase's list updated | Claude |
| An item cannot move | Status → ⏳ Blocked, with a blocked-by link when the blocker is an issue | Owner or Claude |
| Before a PR, and at the start of a phase | The docs brought in line with GitHub: `roadmap.md`, the README's diagram, `open-points.md` | Claude |

## The trial rule

For PH-06b and PH-07, until [OP-086](../open-points.md#op-086) is settled:

- **GitHub is the source of truth.** Changes are made on the issues first: bodies, statuses, parents, blocking links, new and closed issues. The docs follow.
- **The docs are brought in line** before each PR and at the start of each phase: the phase entries and stage tables in `roadmap.md`, the README's diagram, and `open-points.md`, the owner's own edits in the project included. The PR lists the issue changes it mirrors, and its doc diff is where they are reviewed.
- **When both sides were edited, GitHub wins.**
- **Statuses map onto the docs:** ⬜ Backlog, 📌 Todo and ⏳ Blocked read ⬜ Not started in the stage tables and ⬜ Open in the register; 🚧 In progress, ✅ Done and ✖️ Dropped read the same.
- **Significant plan changes** (a new phase, a split, a reorder) still go through a brainstorm, and through an ADR when they are significant.

## Setting up the project

The owner's steps, which GitHub offers only in the web UI:

1. **Statuses:** *project → ⋯ → Settings → Status*: replace the options with `⬜ Backlog`, `📌 Todo`, `⏳ Blocked`, `🚧 In progress`, `✅ Done`, `✖️ Dropped`.
2. **Workflows:** *project → ⋯ → Workflows*: set each workflow as in [Workflows](#workflows), then *Save and turn on workflow*.
3. **Views:** for each row of [Views](#views): *New view*, choose the layout, type the filter, then set grouping, sorting and the fields shown from the view's menu, and *Save*.
4. **Relates to:** on PH-06's issue, *Relationships → Relates to*, add PH-06a's and PH-06b's issues.
5. **Label colors:** *Issues → Labels → Edit*.

## Checking with gh

```bash
gh label list --repo luiki-dev/szop
gh api "repos/luiki-dev/szop/milestones?state=all"
gh project view 3 --owner luiki-dev
gh project field-list 3 --owner luiki-dev
gh issue list --repo luiki-dev/szop --label phase --state all --limit 100
gh issue view 57 --repo luiki-dev/szop
```
