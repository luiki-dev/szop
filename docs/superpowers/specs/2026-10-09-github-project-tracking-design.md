# GitHub Issues and Projects as a tracker, in a trial — design

- **Topic:** tracking the roadmap's phases, the open points and the decision work in GitHub Issues and a GitHub Project, next to the docs, for a trial of a phase or two
- **Date:** 2026-10-09
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8; documentation and GitHub settings, no application code
- **Open points:** none settled; new OP-086 decides how the trial ends
- **Amended:** 2026-10-10 — the trial's source of truth reversed at the owner's request: GitHub is the source, the docs mirror it (decisions 1, 2, 11 and 14).

Today [`docs/roadmap.md`](../../roadmap.md) is the tracker: [ADR 0009](../../decisions/0009-git-workflow.md), decision 14 left GitHub Issues and Projects out of the process. The owner wants to learn the tool most projects plan with, and to see the project's progress on a board. This brainstorm maps the roadmap's stages and phases, the [open points register](../../open-points.md) and the ADRs onto milestones, labelled issues with sub-issues and blocking links, and the existing GitHub Project, and sets the rules for a trial in which both the docs and GitHub track the work. During the trial GitHub is the source of truth and the docs mirror it; OP-086 decides afterwards whether `open-points.md` is dropped and `roadmap.md` stays as a view updated from the issues. The result is ADR 0024, which supersedes the last sentence of ADR 0009, decision 14.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [What lives where](#what-lives-where)
  - [Milestones](#milestones)
  - [Labels](#labels)
  - [Phase issues](#phase-issues)
  - [Open-point issues](#open-point-issues)
  - [ADR issues](#adr-issues)
  - [Owner-step issues](#owner-step-issues)
  - [Relationships](#relationships)
  - [Links inside issue bodies](#links-inside-issue-bodies)
  - [The project: fields and statuses](#the-project-fields-and-statuses)
  - [Starting state](#starting-state)
  - [Built-in workflows](#built-in-workflows)
  - [Views](#views)
  - [Issue forms](#issue-forms)
  - [The trial rule](#the-trial-rule)
  - [How items move](#how-items-move)
  - [Owner steps](#owner-steps)
  - [Git](#git)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

**Goal:** every phase, every open point and every piece of decision work is an issue in `luiki-dev/szop`, on the public project "Szop Project", where the owner sees the roadmap as a board, a table, a timeline and the open points grouped by phase; the docs link each item to its issue, and a written rule keeps both sides in step for the trial.

Success means:

1. **132 issues exist**, each with the right label, milestone, parent, blocking links and project fields: 35 phase issues (PH-01 to PH-33 with PH-06a and PH-06b, and the retired PH-06), 61 open-point issues (the 60 open entries and OP-086), 18 `adr` issues (17 from the history and ADR 0024's own) and 18 owner-step issues (the open owner steps of the phases not yet done).
2. **Only six labels exist** (`phase`, `open-point`, `spike`, `candidate`, `owner`, `adr`), and six milestones (`Definition`, `Stage 1` to `Stage 5`), with `Definition` and `Stage 1` closed.
3. **The project is public**, keeping the owner's title "Szop Project", with the fields and the six statuses below, and no template fields left; the test issue #24 and the test milestone are gone.
4. **Every stage table row in `roadmap.md` and every open entry in `open-points.md` links its issue,** and a check script confirms that each link points to the issue with the matching ID.
5. **The guide `docs/development/project-tracking.md`** explains the model, how each item moves, the trial rule and the owner's setup steps; ADR 0024 records the decisions.
6. **The owner has built the five views and turned on the workflows** following the guide.

## Out of scope

- **Retiring any part of the docs.** `roadmap.md` stays as it is, apart from the links; OP-086 decides after the trial.
- **Closed and dropped open points** stay only in `open-points.md`, as history.
- **Issues for other work outside phases** (documentation fixes, the icon and link PRs, Dependabot updates). Only ADRs get issues.
- **ADRs written inside a phase** (0016, 0018 to 0021, 0023): the phase issue covers them.
- **Pull requests on the project.** Only issues are added; a phase's PR shows through "Linked pull requests".
- **Dependabot's labels.** Dependabot creates `dependencies` and its ecosystem labels by itself on its first PR; `dependabot.yml` is not changed.
- **Synchronisation automation** (a GitHub Action, a personal access token, a GitHub App).
- **The README's roadmap diagram** ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)) stays as it is; only a link to the board is added under it.
- **Label colors:** the owner sets them.

## Decisions taken in the brainstorm

ADR 0024 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Where tracking lives | The docs stay the tracker and GitHub mirrors them; GitHub tracks status and open points while the docs keep the plan; GitHub is the source and the docs mirror it; everything in GitHub at once | **GitHub is the tracker and the source of truth; the docs mirror it**, starting with a trial (decision 2). The issues hold the phases' plans (goal, delivers, owner steps), the open points with their parts and moves, the statuses and the relationships; `roadmap.md` and `open-points.md` are brought in line with them in every PR, so the PR's doc diff is the review trail of the issue edits. A trial with the docs as the source would leave the issues a read-only copy and prove little about tracking in GitHub: it was this brainstorm's first choice, reversed before the merge at the owner's request. Keeping the plan in the docs and only the status on GitHub would split one item across two sources. Everything in GitHub at once, without the mirror, would leave nothing to compare and nothing to fall back on. |
| 2 | The trial | Switch at once; run both for a phase or two | **Both run for two phases, PH-06b and PH-07, with GitHub as the source of truth and the docs as its mirror.** [OP-086](../../open-points.md#op-086), under PH-08, then decides whether `open-points.md` is dropped and `roadmap.md` stays as a view updated from the issues. The owner sees both before giving one up. |
| 3 | What becomes an issue now | All phases, open points and closed ones; all phases and open points; only work not yet done; a pilot with the next phase or two | **All phases, including the done ones and the retired PH-06, and every open point**, candidates and spikes included. Done phases make the milestones' progress true; closed open points would add some 45 issues of history that the register already holds. |
| 4 | Decision work | No issues for ADRs; an issue per ADR; an issue per ADR made outside a phase | **An issue per ADR made outside a phase, labelled `adr`:** ADR 0001 to 0015, the definition work up to PH-01, in a GitHub-only **`Definition` milestone**, and ADR 0017 and 0022, made between phases, without a milestone. Only an ADR's creation counts, not its later changes. ADRs made inside a phase are part of that phase's issue. From now on, an ADR made outside a phase gets an `adr` issue, starting with ADR 0024. `adr` fits better than `requirement`: only ADR 0001 is about requirements. |
| 5 | Kinds of issue | Issue types; labels | **Labels.** Issue types are defined by an organization, and `luiki-dev` is a personal account. |
| 6 | Labels | Keep GitHub's defaults and add ours; only the labels in use | **Only the six in use:** `phase`, `open-point`, `spike`, `candidate`, `owner`, `adr`. GitHub's ten defaults and `accessibility` are deleted. Dependabot's labels are left to Dependabot, which creates them when it needs them. |
| 7 | Statuses | GitHub's Todo, In progress, Done; the owner's six | **The owner's six, each with its icon:** `⬜ Backlog` (planned further down the line), `📌 Todo` (picked next, the owner's items included), `⏳ Blocked` (cannot move, for any reason), `🚧 In progress`, `✅ Done` (closed as completed), `✖️ Dropped` (closed as not planned). `📌` is new to the status vocabulary in `CLAUDE.md`. **No "In review" status:** the linked PR shows it. In `roadmap.md`, Backlog, Todo and Blocked all read ⬜ Not started. |
| 8 | Fields | — | **Order** (a number, the roadmap position in steps of 10, since a new phase takes the next free ID and IDs then stop sorting in roadmap order), **Path** (Full, Bounded), **Spec** and **Plan** (links), **Started** and **Finished** (dates, for the timeline). Team, Iteration, Quarter, Start date and Target date, left by the project's template, are deleted: a solo project paced by learning has no sprints or deadlines. |
| 9 | Relationships | — | **An open point is a sub-issue of the phase that settles it** (of the phase it sits under now, when it has parts; it is re-parented when a part is done, as the register moves it today). **A spike blocks its phase** (OP-025 blocks PH-13, OP-038 blocks PH-16), and a "Depends on" that names an issue becomes a blocked-by link. **A split phase** is closed as not planned with a comment linking the new phases, and is linked to each of them with *Relates to* (decision 10). |
| 10 | Linking a split phase to its successors | A comment only; sub-issues of the old phase; *Relates to* and a comment | ***Relates to* and a comment.** GitHub's *Relates to* relationship (in public preview since 2026-08-07) links two issues without meaning blocking or containment, and shows on both. It has no API yet, so the owner adds it in the issue sidebar; splits are rare. Making the new phases sub-issues of a closed, retired phase would read as if the old phase were still the container. |
| 11 | What a phase issue holds | A link to the roadmap only; a copy of the roadmap entry | **The whole plan in the issue** (goal, delivers, depends on, owner steps (a ticked checklist for a done phase, step issues otherwise), expected path, the "Also" open points), the owner's choice, so the issue reads on its own. The issue is the original and the roadmap entry its mirror (decision 14). **Owner steps of a phase not yet done are sub-issues of their own**, labelled `owner` (`PH-10 owner step 1: …`), and the phase issue lists them, so the owner sees every step waiting on them on the board; a done phase keeps its owner steps as a ticked checklist. A checklist alone would leave the owner's steps off the board, without a status. |
| 12 | How the GitHub side is built | A one-off run of `gh` commands, driven by the plan; a committed migration script; a GitHub Action that mirrors the docs on every merge | **A one-off run of `gh`, with a pilot first.** The issue bodies are generated from the docs into temporary files and created in batches; PH-06b with its open points goes first, the owner checks it, then the rest follows. A script would be a tested Markdown parser that loses its purpose when the trial ends, and a second new concept in one change. An Action needs a personal access token or a GitHub App to write to a user's project, a new credential under [ADR 0012](../../decisions/0012-security-baseline.md), and would tie the issues to the docs for good. |
| 13 | Visibility of the project | Public; private | **Public.** The issues are public with the repository anyway, and the README and `roadmap.md` can link a board visitors can open. Only the owner can edit it. |
| 14 | Keeping both sides in step | Automation; a rule | **A rule,** for the length of the trial: **GitHub is the source.** Claude makes changes on the issues first. Before each PR, and at the start of each phase, Claude brings `roadmap.md`, the README's diagram and `open-points.md` in line with GitHub, the owner's own edits in the project included; when both sides were edited, GitHub wins; the PR lists the issue changes it mirrors. The edits are live before the merge, and the mirrored doc diff is where the owner reviews them. A significant change to the plan (a new phase, a split, a reorder) still goes through a brainstorm, and through an ADR when it is significant. Drift that hurts is evidence for OP-086. |

## Design

### What lives where

| Szop concept | On GitHub | In the docs (unchanged, plus links) |
|---|---|---|
| Stage | Milestone `Stage N: <title>`, its exit criterion as the description | The stage's section and table in `roadmap.md` |
| Decision work before PH-01 | Milestone `Definition` | — |
| Phase | Issue `PH-NN <name>`, label `phase`, the stage's milestone | The phase entry in `roadmap.md` |
| Owner step of a phase | Issue `PH-NN owner step K: <step>`, label `owner`, sub-issue of its phase; only while the phase is not done | The phase entry's **Owner steps** in `roadmap.md` |
| Open point | Issue `OP-NNN <lead>`, label `open-point`, sub-issue of its phase | The entry in `open-points.md` |
| Spike | Its open point's issue, also labelled `spike`, blocking its phase | The open point; the phase's "Depends on" |
| Candidate | Its open point's issue, also labelled `candidate`, no parent, no milestone | The open point under "Candidates" |
| ADR made outside a phase | Issue `ADR NNNN <title>`, label `adr` | The ADR in `docs/decisions/` |
| Requirements, use cases | — (linked from the phase issue's "Delivers") | `functional-requirements.md` |
| Status | The project's Status field | The stage table (⬜ 🚧 ✅ ✖️) and the register's status lines |

### Milestones

Six milestones, no due dates:

| Milestone | Description | State |
|---|---|---|
| `Definition` | From the first requirements to the roadmap, before PH-01: ADR 0001 to 0015. | Closed |
| `Stage 1: Local foundations` | The stage's **Exit:** line from `roadmap.md` | Closed |
| `Stage 2: Walking skeleton, running locally` | ditto | Open |
| `Stage 3: Walking skeleton, deployed and released` | ditto | Open |
| `Stage 4: MVP` | ditto | Open |
| `Stage 5: Later` | ditto | Open |

The test milestone "Walking Skeleton" is deleted. A stage's milestone is closed when its last phase is done, at the same time as its table shows every row ✅.

### Labels

| Label | Description (shown on GitHub) |
|---|---|
| `phase` | A roadmap phase: one brainstorm, one branch, one PR |
| `open-point` | An entry of the open points register |
| `spike` | An open point answered by a spike before its phase |
| `candidate` | Optional work, not scheduled: a candidate phase or an upgrade waiting for its moment |
| `owner` | Only the owner can do it |
| `adr` | Decision work whose result is one ADR, made outside a phase |

Created in one neutral color; the owner paints them. The eleven existing labels are deleted.

`owner` goes on the open points that only the owner can carry out (an AWS or GitHub setting, a check on the demo, a manual step in the UI). Each is judged from its text when the issue is generated, and the list is shown to the owner with the pilot. Every owner-step issue carries `owner` too.

### Phase issues

**Title:** the roadmap heading, `PH-06b Web security baseline`. **Labels:** `phase`. **Milestone:** its stage. **Body:** the phase's plan, which the roadmap entry mirrors; for the issues created at the start of the trial it was generated from the entries, in this shape:

```markdown
Roadmap entry: [PH-06b Web security baseline](https://github.com/luiki-dev/szop/blob/main/docs/roadmap.md#ph-06b-web-security-baseline)

### Goal

<the entry's Goal>

### Delivers

<the entry's Delivers>

### Depends on

<the entry's Depends on, or "—">

### Owner steps

- <one line per step, `{{PH-06b owner step 1}}`, written as the step issue's number `#N`; or "None.">

### Expected path

<Full or Bounded, with any note the entry has>

### Also

<the open points of other phases it does a part of, as issue references, or "—">
```

A field the entry has beyond these (such as PH-06a's **Split from**) is kept as a section of the same name. The phase's own open points are not listed: they show as sub-issues. **A phase that is not done** lists its owner steps as references to their [owner-step issues](#owner-step-issues); **a done phase** is closed as completed, its owner steps a ticked checklist (`- [x] <step>`). **PH-06** is created with the entry text it had before the split, recovered from git history, and closed as not planned with the comment *"Split into #<PH-06a> and #<PH-06b>: it held two new concepts, the production build and the web security baseline ([ADR 0014](…), decision 6)."*

### Open-point issues

**Title:** `OP-053 ` followed by the open point's bold lead without its closing period, shortened at a word boundary to at most 80 characters. **Labels:** `open-point`, plus `spike`, `candidate` and `owner` where they apply. **Milestone:** none (the parent phase carries it). **Body:** the open point's text, which the register entry mirrors; for the issues created at the start of the trial it was generated from the entries, in this shape:

```markdown
Register entry: [OP-053](https://github.com/luiki-dev/szop/blob/main/docs/open-points.md#op-053)

<the entry's text, bold lead included>

### Parts

- [ ] **PH-06b:** everything except the demo check
- [ ] **PH-12:** the one-time check on the demo that the log shows the real address

### Source

<the entry's Source>

### History

- **Moved from PH-06:** PH-06 was split; the web baseline is PH-06b.
```

"Parts" and "History" appear only when the entry has parts or "Moved from" lines. A done part is ticked and keeps its PR link. The status lives in the project, so the body has no status line.

### ADR issues

**Title:** the ADR's heading with the dash dropped, `ADR 0008 Hosting: an on-demand demo environment on AWS`. **Labels:** `adr`. **Milestone:** `Definition` for 0001 to 0015, none for 0017 and 0022. **Body:**

```markdown
Decision record: [ADR 0008](https://github.com/luiki-dev/szop/blob/main/docs/decisions/0008-hosting.md)

Landed in: <commit `ac21e2f`, committed straight to main | PR #N>
```

| ADR | Landed in | Started | Finished |
|---|---|---|---|
| 0001 | commit `797a20e` | 2026-09-21 | 2026-09-21 |
| 0002 | commit `0bc715b` | 2026-09-22 | 2026-09-22 |
| 0003 | commit `3a71041` | 2026-09-27 | 2026-09-27 |
| 0004 | commit `a05cbea` | 2026-09-27 | 2026-09-27 |
| 0005 | commit `4e5c2f6` | 2026-09-27 | 2026-09-27 |
| 0006 | commit `40937ac` | 2026-09-27 | 2026-09-27 |
| 0007 | commit `228fe71` | 2026-09-27 | 2026-09-27 |
| 0008 | commit `ac21e2f` | 2026-09-28 | 2026-09-28 |
| 0009 | PR #1 | 2026-09-28 | 2026-09-28 |
| 0010 | PR #2 | 2026-09-29 | 2026-09-29 |
| 0011 | PR #3 | 2026-09-29 | 2026-09-30 |
| 0012 | PR #6 | 2026-10-01 | 2026-10-01 |
| 0013 | PR #8 | 2026-10-01 | 2026-10-01 |
| 0014 | PR #9 | 2026-10-01 | 2026-10-02 |
| 0015 | PR #10 | 2026-10-02 | 2026-10-02 |
| 0017 | PR #12 | 2026-10-02 | 2026-10-02 |
| 0022 | PR #21 | 2026-10-07 | 2026-10-07 |

All are closed as completed. **ADR 0024's issue** is created open, 🚧 In progress, Started 2026-10-09; this change's PR closes it.

### Owner-step issues

Every owner step of a phase that is not done becomes an issue, so the owner sees what waits on them on the board: 18 today (PH-09: 3, PH-10: 3, PH-11: 4, PH-12: 2, PH-13: 5, PH-18: 1). The steps were taken from the roadmap entry's **Owner steps** at creation, split on "; " and numbered from 1 in that order; from then on the issues are the original and the roadmap mirrors them.

**Title:** `PH-10 owner step 1: ` followed by the step, capitalised and without its final period, shortened at a word boundary to at most 100 characters in all, with `…`. **Labels:** `owner`. **Milestone:** none (the parent phase carries it). **Parent:** its phase. **Body:**

```markdown
Owner step of [PH-10 Domain and base infrastructure](https://github.com/luiki-dev/szop/blob/main/docs/roadmap.md#ph-10-domain-and-base-infrastructure), from its **Owner steps** in the roadmap.

Choose the name and buy the domain.
```

The step's text is the whole body, capitalised and with its period; a relative link in it is rewritten like any other. The phase's **Owner steps** section lists the issues (`- #57`). The owner closes a step when it is done, or Claude does when the owner says so; the workflow sets `✅ Done`. When a phase's owner steps change, the step issues are added, or closed as not planned (`✖️ Dropped`), and the roadmap's **Owner steps** follow. A phase's steps are not created before the phase is, and a done phase has none: its steps stay a ticked checklist.

### Relationships

- **Sub-issue:** each open point under the phase whose group it sits under in `open-points.md`, and each owner step under its phase. Candidates have no parent.
- **Blocked by:** PH-13 by OP-025 and PH-16 by OP-038; any other "Depends on" that names a phase or an open point. "Depends on: —" adds nothing: the order is the Order field.
- **Relates to:** PH-06 with PH-06a and PH-06b, added by the owner (no API).
- **Mentions:** issue references in bodies (next section) put a "mentioned this" line on the other issue, which is how the "Also" line of a phase shows on the open point.

### Links inside issue bodies

Relative links do not work in issues. When a body is generated:

- **A link to a phase or an open point that has an issue** becomes the issue reference (`#57`), which GitHub shows with the title and state.
- **Any other relative link** (ADRs, requirements, guides, closed open points) becomes an absolute `https://github.com/luiki-dev/szop/blob/main/docs/…` URL, anchor kept.

The pilot is created before most issues exist, so its references to them stay document links until the bulk run's second pass rewrites them.

### The project: fields and statuses

Project #3, keeping the owner's title **Szop Project**, public, description: *"Szop's roadmap phases, open points, decision work and owner steps. During a trial the issues are the source of truth; docs/roadmap.md and docs/open-points.md mirror them: https://github.com/luiki-dev/szop/blob/main/docs/roadmap.md"*. Every issue is added to it.

| Field | Type | Values and rules |
|---|---|---|
| Status | single select (built-in) | `⬜ Backlog`, `📌 Todo`, `⏳ Blocked`, `🚧 In progress`, `✅ Done`, `✖️ Dropped`, replacing Todo, In progress, Done, Blocked; set by the owner in the UI |
| Order | number | Phases only. 10, 20, 30 … in roadmap order at migration (PH-06 at 60 before PH-06a at 70); a phase added later takes a free number between its neighbours |
| Path | single select | `Full`, `Bounded`; phases only |
| Spec, Plan | text | Absolute URLs to the files on `main`; phases only, when they exist |
| Started | date | Phases: the date of the phase branch's first commit (for done phases, the PR's first commit); ADR issues: see the table above |
| Finished | date | The merge date |

Built-in fields used as they are: Title, Labels, Milestone, Parent issue, Sub-issues progress, Linked pull requests, Assignees. Deleted: Team, Iteration, Quarter, Start date, Target date.

**Status rules.** Backlog: planned further down the line. Todo: picked next, which is the next phase, its open points and the owner items it needs. Blocked: would be Todo or In progress but cannot move; set by hand, with a blocked-by link when the blocker is an issue (a far-off phase behind a spike stays Backlog and keeps its blocked-by link). In progress: from the start of a phase's brainstorm, or of the work on an open point. Done: set by the workflow when an issue is closed. Dropped: set by hand right after closing as not planned, since the workflow sets Done on any close.

### Starting state

| Items | State | Status |
|---|---|---|
| PH-01 to PH-05, PH-06a | closed, completed; Started and Finished from their PRs | ✅ Done |
| PH-06 | closed, not planned | ✖️ Dropped |
| PH-06b, OP-053, OP-067 | open | 📌 Todo |
| ADR 0024's issue | open | 🚧 In progress |
| The 17 historical `adr` issues | closed, completed | ✅ Done |
| The owner steps of PH-09 to PH-13 and PH-18 | open | ⬜ Backlog |
| Everything else | open | ⬜ Backlog |

### Built-in workflows

Configured by the owner in the project's *Workflows* page (no API to set them). **As built** (read back through the API on 2026-10-10; the settings behind each workflow cannot be read through it):

- **On:** Item added to project → `⬜ Backlog`; Item closed → `✅ Done`; Item reopened → `📌 Todo`; Auto-add to project (repository `luiki-dev/szop`, filter `is:issue label:phase,open-point,adr,owner`); **Auto-add sub-issues to project**, which the design had not listed: sub-issues of an item already on the project are added to it.
- **Off:** Auto-close issue, Pull request linked to issue and Pull request merged, since pull requests are not on the project.
- **Auto-archive items:** meant to be off, so that done items stay visible; the API does not list it.

### Views

Built by the owner in the UI (no API to create them). **As built** (read back through the API on 2026-10-10), which differs from the five views first designed (Board, Roadmap, Open points, Next up, Timeline) in names, filters and sorting:

| # | Name | Layout | Filter | Grouping and sorting | Fields shown |
|---|---|---|---|---|---|
| 1 | Timeline | Roadmap | `label:phase,adr` | Sort: Started, then Order; the date range (Started to Finished) and the milestone markers as built in the UI, not readable through the API | Title, Assignees, Status |
| 2 | Backlog | Table | none | Group: Milestone; sort: Started, then Order | Title, Status, Labels, Linked pull requests, Sub-issues progress |
| 3 | Board | Board | none | Columns: Status; swimlanes: Milestone; sort: Started, then Order | Title, Status, Labels, Linked pull requests, Parent issue, Sub-issues progress |
| 4 | Open Points | Table | `label:open-point is:open` | Group: Parent issue; sort: Title | Title, Status, Labels |
| 5 | Next Up | Table | `status:"📌 Todo","⏳ Blocked","🚧 In progress"` | Group: Status; no sorting | Title, Labels, Milestone, Parent issue, Sub-issues progress |

The Timeline is a record of what happened when: future phases have no dates and show without bars. Backlog and Board have no filter, so they also hold the open points and the owner steps. The guide ([project tracking](../../development/project-tracking.md#views)) describes what each view is for.

### Issue forms

Three forms in `.github/ISSUE_TEMPLATE/`, each applying its label, so the auto-add workflow puts the issue on the project:

- `phase.yml`: title prefix `PH-`; textareas Goal, Delivers, Depends on, Owner steps, Expected path (dropdown Full, Bounded), Also, and an input for the roadmap entry's link.
- `open-point.yml`: title prefix `OP-`; textareas What is open, Parts, Source; an input for the register entry's link.
- `adr.yml`: title prefix `ADR `; inputs for the ADR's link and where it landed.

Their headings match the bodies above, so issues created by `gh` and by the forms read the same. `config.yml` keeps blank issues allowed, for visitors.

### The trial rule

For PH-06b and PH-07, until OP-086 is settled:

- **GitHub is the source of truth.** Changes are made on the issues first: bodies, statuses, parents, blocking links, new and closed issues. The docs follow.
- **The docs are brought in line** before each PR and at the start of each phase: the phase entries and stage tables in `roadmap.md`, the README's diagram, and `open-points.md`, the owner's own edits in the project included. The PR lists the issue changes it mirrors, and its doc diff is where they are reviewed.
- **When both sides were edited, GitHub wins.**
- **Statuses map onto the docs:** ⬜ Backlog, 📌 Todo and ⏳ Blocked read ⬜ Not started in the stage tables and ⬜ Open in the register; 🚧 In progress, ✅ Done and ✖️ Dropped read the same.
- **Significant plan changes** (a new phase, a split, a reorder) still go through a brainstorm, and through an ADR when they are significant.
- **Who sets what:**
  - **Claude:** `🚧 In progress` and Started when a phase's brainstorm starts; Spec and Plan when they are committed; an open point's moves, ticks and re-parenting; new open points' issues; Finished for the previous phase and for any `adr` issue closed since, at the start of the next phase (no workflow sets dates); `✖️ Dropped` after closing as not planned.
  - **The owner:** `📌 Todo` when choosing what comes next (Claude proposes it at the end of a phase); the *Relates to* links.
  - **The owner or Claude:** `⏳ Blocked`, when an item cannot move.
  - **The merge:** closes the issues named with `Closes #N` in the PR's description, and the workflow sets `✅ Done`.

### How items move

| Event | On GitHub |
|---|---|
| A phase's brainstorm starts | Phase → 🚧, Started set (the date of the phase branch's first commit); Finished set for the previous phase and for any `adr` issue closed since |
| Its spec or plan is committed | Spec, Plan set |
| Its PR opens | The description says `Closes #<phase>` and `Closes #<OP>` for each open point it settles |
| Its PR is merged | Those issues close; the workflow sets ✅ |
| An open point's part is done | Its box ticked with the PR; re-parented to the next phase; stays open |
| An open point is added | Issue created with the next free ID, under its phase, label `open-point` |
| An open point moves to another phase | Re-parented; a History line added |
| An open point or phase is dropped | Closed as not planned, with the reason as a comment; Status → ✖️ |
| A phase is split | New phase issues created; the old one closed as not planned with the comment; its open points re-parented; the owner adds *Relates to* |
| A candidate is picked up | `candidate` label removed; a phase issue created for it |
| An ADR is made outside a phase | An `adr` issue, closed by its PR |
| An owner step is done | Its issue closed (by the owner, or by Claude when the owner says so); the workflow sets ✅ |
| A phase's owner steps change | Step issues added, or closed as not planned with the reason; the phase's list updated |
| Before a PR, and at the start of a phase | The docs brought in line with GitHub: `roadmap.md`, the README's diagram, `open-points.md` |

### Owner steps

1. Replace the Status options with the six above, in the project's settings, after the GitHub foundations and before the pilot.
2. Check the pilot (PH-06b, OP-053, OP-067, the `owner` label list) and say go or what to change.
3. Turn on the workflows and the auto-add filter.
4. Build the five views.
5. Add the *Relates to* links from PH-06 to PH-06a and PH-06b.
6. Set the label colors.
7. Review the PR, and merge it.

### Git

The work is on branch `docs/adr-0024-github-project-tracking`, pushed, in one PR titled `docs(adr): add ADR 0024 and track work in GitHub Projects`, whose description says `Closes #<ADR 0024's issue>`. It is work outside the phases, so it has no roadmap row, and lands before PH-06b, the trial's first phase. **This session works in a worktree** under `.claude/worktrees/`, an exception the owner agreed to for this background session, which cannot edit the main checkout; there is no local merge, so [ADR 0009](../../decisions/0009-git-workflow.md), decision 5 still holds in what matters. The GitHub changes of tasks 2 to 4 are live before the merge, like `infra/base` applied from a branch; the owner reviews them with the PR.

## Documentation and records

- **ADR 0024** — *GitHub Issues and Projects next to the docs, as a trial*: decisions 1 to 14 above. **Supersedes in part** [ADR 0009](../../decisions/0009-git-workflow.md), decision 14 ("The roadmap is the tracker: GitHub Issues and Projects are not part of the process"): 🔁 note in its cell and its status line. **Revisits, for the trial,** [ADR 0014](../../decisions/0014-roadmap.md), decision 4 and [ADR 0017](../../decisions/0017-readme-roadmap-diagram.md), decision 4 (the project's issues are the source of a phase's status; the stage tables and the README's diagram mirror them, and the stage tables gain an Issue column) and [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decisions 1 and 4 (the issues own what is still open; each open entry links its issue and mirrors it): 🔍 notes.
- **New guide `docs/development/project-tracking.md`:** what lives where, the labels, milestones, fields and statuses, relationships, links in bodies, how items move, the trial rule, and the owner's setup steps (workflows and views, step by step). With a Contents section.
- **`docs/roadmap.md`:** an **Issue** column, last, in every stage table; a "How it works" bullet on the project and its link; each candidate links its issue.
- **`docs/open-points.md`:** `- **Issue:** [#NN](https://github.com/luiki-dev/szop/issues/NN)` in every open entry, before its Status line; a "How it works" bullet; **OP-086** under PH-08: *after the trial (PH-06b and PH-07), decide whether to drop `open-points.md` and keep `roadmap.md` as a view updated from the issues, and what the roadmap keeps* (source: ADR 0024, decision 2).
- **`README.md`:** one line under the roadmap diagram linking the board.
- **`.github/ISSUE_TEMPLATE/`:** the three forms and `config.yml`.
- **`.github/pull_request_template.md`:** a Links line "Issues closed: `Closes #…`"; the open points item names their issues.
- **`docs/development/definition-of-done.md`:** item 6 (roadmap status *and the issues*), item 9 (open points *and their issues*), during the trial.
- **`docs/development/git-workflow.md`, `phase-walkthrough.md`:** `Closes #N` in PR descriptions; the issue steps in the walkthrough.
- **`docs/development/github-settings.md`:** "Features" rewritten; sections for the labels, the milestones and the project.
- **`docs/architecture/stack-overview.md`:** a short section on issues, sub-issues, milestones and projects.
- **`docs/glossary.md`:** *GitHub Projects*, *milestone*, *sub-issue*, *issue form*.
- **`CLAUDE.md`:** the status vocabulary gains `📌 todo` and names the project's statuses; the guide joins the Documentation list; a line on the trial rule under the roadmap's entry.

## Tasks

One commit per task that changes files; the GitHub-only tasks are recorded in the PR's description.

1. **ADR 0024 and its notes:** the ADR, the notes in ADR 0009, 0011 and 0014, the vocabulary in `CLAUDE.md`, the glossary. *Verify:* links resolve; Prettier passes.
2. **GitHub foundations:** labels (six created, eleven deleted), milestones (six created, the test one deleted), project #3 (public, description, template fields deleted, Order, Path, Spec, Plan, Started and Finished created), test issue #24 deleted. *Verify:* `gh label list`, the milestones API and `gh project field-list` show exactly the intended set. **Stop for the owner to replace the Status options.**
3. **Pilot:** once `gh project field-list` shows the six Status options, ADR 0024's issue; PH-06b, OP-053 and OP-067 with parents, fields and statuses; the proposed `owner` list. *Verify:* the issues render on GitHub as specified. **Stop for the owner's check.**
4. **Bulk:** the other 34 phase issues, 58 open-point issues, 17 `adr` issues and 18 owner-step issues with labels, milestones, parents, blocking links and fields; the second pass that rewrites references to issue numbers; closing the done ones and PH-06; closing `Definition` and `Stage 1`. Created in batches with a pause between requests. *Verify:* counts per label; every open point has a parent except the candidates.
5. **Guide and process files:** `project-tracking.md`, the issue forms, the PR template, the definition of done, `git-workflow.md`, `phase-walkthrough.md`, `github-settings.md`, `stack-overview.md`. *Verify:* the forms' YAML is read against GitHub's issue form schema (they load only from the default branch, so *New issue* shows them only after the merge, when they are checked once more); links resolve; Prettier passes.
6. **Links in the docs:** the Issue column, the Issue lines, OP-086 and its issue, the README line, the candidates' links. *Verify:* Prettier passes; the tables render.
7. **Verification and review:** the check script, the definition of done walked through, a self-review of the diff, the PR. *Verify:* the script reports no mismatch; every success criterion above is met, the owner's steps aside.

## To verify during implementation

- **Deleting template fields** (task 2): that `gh project field-delete` removes Team, Iteration, Quarter, Start date and Target date.
- **Making the project public** (task 2): `gh project edit --visibility PUBLIC`.
- **Sub-issues and dependencies from `gh`** (tasks 3 and 4): `gh issue create --parent` and `gh issue edit --add-blocked-by` in `gh` 2.96, including a closed parent.
- **Secondary rate limits** (task 4): GitHub limits how fast content is created; batches of about 20 with a pause, and a retry on a 403 that names the limit.
- **Issue forms load from the default branch** (task 5): they cannot be tried before the merge; their YAML is checked against GitHub's schema by reading it, and once more after the merge.
- **PH-06's entry before the split** (task 4): recovered from the roadmap as it was before PH-06a's PR.
- **Started dates of the done phases** (task 4): the first commit of each phase PR's branch, read from the PR's commits.
