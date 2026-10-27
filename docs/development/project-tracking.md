# Project tracking

How Szop's work is tracked on GitHub: the roadmap's phases, the open points and the decision work as issues, the stages as milestones, and all of them on the [Szop project](https://github.com/users/luiki-dev/projects/3). The decisions are in [ADR 0024](../decisions/0024-github-project-tracking.md) and [ADR 0027](../decisions/0027-open-points-on-github.md). GitHub is the source of status, of the open points and of what comes next; the [roadmap](../roadmap.md) is the source of each phase's plan, and its stage tables mirror the status (see [Keeping GitHub and the docs in step](#keeping-github-and-the-docs-in-step)). The old open points register is archived in `docs/archive/` and is never a source.

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
- [Keeping GitHub and the docs in step](#keeping-github-and-the-docs-in-step)
- [Setting up the project](#setting-up-the-project)
- [Checking with gh](#checking-with-gh)

## What lives where

| Szop concept | On GitHub | In the docs |
|---|---|---|
| Stage | Milestone `Stage N: <title>`, its exit criterion as the description | The stage's section and table in [`roadmap.md`](../roadmap.md) |
| Decision work before PH-01 | Milestone `Definition` | — |
| Phase | Issue `PH-NN <name>`, label `phase`, the stage's milestone | The phase entry in `roadmap.md`, the source of its plan, with its issue in the stage table; the issue's body is a copy |
| Owner step of a phase | Issue `PH-NN owner step K: <step>`, label `owner`, sub-issue of its phase; only while the phase is not done | The phase entry's **Owner steps** in `roadmap.md` |
| Open point | Issue `OP-NNN <lead>`, label `open-point`, sub-issue of its phase | — (the issue is the only home) |
| Spike | Its open point's issue, also labelled `spike`, blocking its phase | The phase's "Depends on" |
| Candidate | Its open point's issue, also labelled `candidate`, no parent, no milestone | — |
| ADR made outside a phase | Issue `ADR NNNN <title>`, label `adr` | The ADR in [`docs/decisions/`](../decisions/) |
| Requirements, use cases | — (linked from a phase's "Delivers") | [`functional-requirements.md`](../requirements/functional-requirements.md) |
| Status | The project's Status field | The stage tables (⬜ 🚧 ✅ ✖️) |

## Milestones

One per stage, named after the stage's heading, with its **Exit:** line as the description, and `Definition` for ADR 0001 to 0015. No due dates: the roadmap has none. A stage's milestone is closed when its last phase is done, in the same session that sets the last row of its table to ✅. Closed today: `Definition`, `Stage 1: Local foundations` and `Stage 3: Walking skeleton, deployed and released`.

## Labels

| Label | Meaning |
|---|---|
| `phase` | A roadmap phase: one brainstorm, one branch, one PR |
| `open-point` | Something undecided or undone, left to a later phase |
| `spike` | An open point answered by a spike before its phase |
| `candidate` | Optional work, not scheduled: a candidate phase or an upgrade waiting for its moment |
| `owner` | Only the owner can do it: an AWS, domain or GitHub setting, a manual check, a purchase |
| `adr` | Decision work whose result is one ADR, made outside a phase |

No other labels are used on issues. On pull requests, `skip-changelog` leaves a PR out of the release notes ([release-please](tools/release-please.md#release-notes)), and Dependabot creates `dependencies` and one label per ecosystem on its own.

## Issues

### Phase issues

Title: the roadmap heading, `PH-06b Web security baseline`. The body starts with a link to its roadmap entry and holds the phase's plan, section by section: **Goal**, **Delivers**, any extra field such as **Split from**, **Depends on**, **Owner steps**, **Expected path**, plus **Also**, which lives only in the issue: the open points of other phases it does a part of. The roadmap entry is the source of the rest and the body a copy of it, updated when the PR that changes the entry opens. Its own open points are its sub-issues, so they are not listed. A phase that is not done lists its owner steps as references to their [owner-step issues](#owner-step-issues); a done phase has them as a ticked checklist.

### Open-point issues

Title: the ID and the open point's bold lead, cut to 80 characters. The body starts with the open point's text, then **Parts** as a checklist (a done part ticked, with its PR), **Source**, and **History** for "Moved from" notes. The issue is the only home of the open point. Issues created before ADR 0027 start instead with a link to their entry in the archived register (`docs/archive/open-points.md`); new issues start with the open point's text. The status lives in the project, so the body has no status line. A closed open point keeps a "settled by" comment, naming the ADR, PR or commit that settled it, or the reason it was dropped. The 25 entries closed before the register moved to GitHub are closed issues whose body starts with "Closed before the register moved to GitHub" and a link to ADR 0027.

### ADR issues

Title: `ADR 0008 Hosting: an on-demand demo environment on AWS`. The body links the ADR and says where it landed: a commit for ADR 0001 to 0008, which went straight to `main`, a PR since. Only the ADR's creation counts. ADRs made inside a phase have no issue of their own: the phase's issue covers them.

### Owner-step issues

Every owner step of a phase that is not done is an issue of its own, so the owner sees on the board what waits on them. Title: `PH-10 owner step 1: Choose the name and buy the domain`, the step, capitalised, cut to 100 characters in all; a phase's steps are numbered from 1 in the order of its **Owner steps**. Label `owner`, no milestone, a sub-issue of its phase. The body says which phase's step it is, with a link to the roadmap entry, and gives the step's text. The phase's **Owner steps** section lists the issues, and the roadmap's **Owner steps** repeat them. The owner closes a step when it is done (or Claude does, when the owner says so), and the workflow sets ✅ Done. A done phase has no step issues: its steps stay a ticked checklist.

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
| Started | Phases: the date of the phase branch's first commit; `adr` issues: the day the work started |
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

Six views, as built by the owner in the UI and read back through the API. The first three rows are the plan and the board, the rest answer one question each.

| View | Layout | Filter | Grouping and sorting | Fields shown |
|---|---|---|---|---|
| Timeline | Roadmap | `label:phase,adr` | Grouped by Milestone, sorted by Started, then Order; the date range and the milestone markers are as built in the UI (not readable through the API) | Title, Assignees, Status |
| Backlog | Table | none | Grouped by Milestone, sorted by Started, then Order | Title, Status, Labels, Linked pull requests, Sub-issues progress, Started, Finished |
| Board | Board | none | Columns by Status, swimlanes by Milestone, sorted by Started, then Order | Title, Status, Labels, Linked pull requests, Parent issue, Sub-issues progress, Finished |
| Open Points | Table | `label:open-point is:open` | Grouped by Parent issue, sorted by Title | Title, Status, Labels |
| Next Up | Table | `status:"📌 Todo","⏳ Blocked","🚧 In progress"` | Grouped by Status, not sorted | Title, Labels, Milestone, Parent issue, Sub-issues progress |
| Owner Steps | Table | `label:owner` | Grouped by Parent issue, sorted by Title | Title, Status, Labels |

What each is for:

- **Timeline** is a record of what happened when: phases and `adr` issues from Started to Finished. Future phases have no dates yet.
- **Backlog** is the whole plan as a table: every item grouped by milestone.
- **Board** is the same items as cards in a column per status, a swimlane per milestone.
- **Open Points** is the open points grouped by the phase that settles them. It shows open ones only; closed ones are found with `gh issue list --repo luiki-dev/szop --label open-point --state closed` or GitHub's issue search (`label:open-point is:closed`).
- **Next Up** is what is picked, blocked or under way, by status.
- **Owner Steps** is every item only the owner can do (label `owner`), grouped by phase.

Backlog and Board have no filter, so they also hold the open points and the owner steps.

### Workflows

Five workflows are on and three are off, as read through the API. Their settings (the status a workflow sets, the auto-add filter) cannot be read through it: they are as the owner configured them in the UI.

| Workflow | State | Setting |
|---|---|---|
| Item added to project | On | Status `⬜ Backlog` |
| Item closed | On | Status `✅ Done` |
| Item reopened | On | Status `📌 Todo` |
| Auto-add to project | On | Repository `luiki-dev/szop`, filter `is:issue label:phase,open-point,adr,owner` |
| Auto-add sub-issues to project | On | Sub-issues of an item already on the project are added to it |
| Auto-close issue, Pull request linked to issue, Pull request merged | Off | Pull requests are not on the project; a PR closes its issues with `Closes #N` |
| Auto-archive items | Not listed by the API | Meant to be off, so that done items stay visible |

## How items move

The project's `CLAUDE.md` repeats the events Claude handles most often, as steps in its "Project tracking" section; a change to this table changes that section in the same commit.

| Event | On GitHub | Who |
|---|---|---|
| A phase is picked next | Phase and its open points → 📌 Todo | Owner (Claude proposes at the end of a phase) |
| A phase's brainstorm starts | Phase → 🚧 In progress, Started set (the date of the phase branch's first commit); Finished set for the previous phase and for any `adr` issue closed since | Claude |
| Its spec or plan is committed | Spec, Plan set | Claude |
| Its PR opens | The description says `Closes #<phase>` and `Closes #<OP>` for each open point it settles | Claude |
| Its PR is merged | Those issues close; the workflow sets ✅ Done | Owner, by merging |
| An open point's part is done | The part ticked with its PR; the issue re-parented to the next phase, still open, and its Status set to ⬜ Backlog, or 📌 Todo if that phase is already picked: no workflow changes it on a re-parent | Claude |
| An open point is added | An issue with the next free ID (the highest `OP-` among the issues labelled `open-point`, plus one; the command is in [Checking with gh](#checking-with-gh)), under its phase, label `open-point`; mentioned, as a link, where it came up | Claude |
| An open point moves | Re-parented; a History line added | Claude |
| An open point gains or loses a part in another phase | That phase issue's **Also** section updated | Claude |
| An item is dropped | Closed as not planned with the reason as a comment; Status → ✖️ Dropped | Claude |
| A phase is split | New phase issues; the old one closed as not planned with a comment; its open points re-parented | Claude; the owner adds *Relates to* |
| A candidate is picked up | `candidate` removed; a phase issue created | Claude |
| An ADR is made outside a phase | An `adr` issue, closed by its PR | Claude |
| An owner step is done | Its issue closed; the workflow sets ✅ Done | Owner, or Claude when the owner says so |
| A phase's owner steps change | Step issues added, or closed as not planned with the reason; the phase's list updated | Claude |
| An item cannot move | Status → ⏳ Blocked, with a blocked-by link when the blocker is an issue | Owner or Claude |
| An acceptance criterion is finalized, added, moved, dropped or delivered | Nothing on GitHub: the criterion's status, its requirement's line and the index's table in `docs/requirements/`, in the phase's branch: finalized at the brainstorm, ✅ in the PR ([ADR 0051](../decisions/0051-acceptance-criteria.md)) | Claude |
| Before a PR, and at the start of a phase | The stage tables, the phase entries' copies in the issues brought in line | Claude |

## Keeping GitHub and the docs in step

Each fact has one source; the other place only copies it, and changes when the table says so ([ADR 0027](../decisions/0027-open-points-on-github.md)).

| Fact | Source | Copied in | When the copy changes |
|---|---|---|---|
| A phase's plan (goal, delivers, depends on, expected path, and the wording of its owner steps) | `roadmap.md`'s phase entry | the phase issue's body | when the PR that changes the entry opens; the PR lists the bodies it updated |
| Phase status | the project's Status field | the stage tables' Status column | work starts, the PR opens, the merge (in the PR, before it), in one commit |
| Spec, plan and PR links of a phase | the stage tables | the project's Spec and Plan fields | when each is committed or opened |
| Open points, open and closed: text, parts, history, status, phase | issues labelled `open-point` | nowhere | — |
| What comes next | the board's 📌 Todo | nowhere | — |
| Whether an owner step is done | the `owner` issue | nowhere | — |
| Also (the open points of other phases a phase does a part of) | the phase issue's body | nowhere | when the part is added, done or moved |
| New phases, splits, reorders | a brainstorm, then `roadmap.md` (and an ADR when significant) | new issues | in the same PR |
| A requirement's acceptance criteria and their status | the requirement's file in `docs/requirements/` | the index's status table | in the PR that changes a criterion ([ADR 0051](../decisions/0051-acceptance-criteria.md)) |

The rules that follow from it:

- **Open points are issues only.** They are added, re-parented, ticked and closed on GitHub; no document keeps a list of them.
- **The PR description lists the issue changes** the PR made or relied on (open points closed, re-assigned or added, phase bodies updated, statuses set). It is the review trail; the stage tables' diff shows the status changes.
- **When both sides were edited, GitHub wins** for status and open points, and `roadmap.md` wins for a phase's plan.
- **Statuses map onto the stage tables:** ⬜ Backlog, 📌 Todo and ⏳ Blocked read ⬜ Not started; 🚧 In progress, ✅ Done and ✖️ Dropped read the same.
- **Significant plan changes** (a new phase, a split, a reorder) go through a brainstorm, and through an ADR when they are significant.

## Setting up the project

Done on 2026-10-10; kept as the reference for rebuilding the project.

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

The next free open-point ID is one more than the highest `OP-` ID, which this prints:

```bash
gh issue list --repo luiki-dev/szop --label open-point --state all --limit 500 --json title --jq '[.[].title | capture("^OP-(?<n>[0-9]+)").n | tonumber] | max'
```

`gh` lists issues by creation, and the back-filled closed ones are the newest, so the top row is not the highest ID.
