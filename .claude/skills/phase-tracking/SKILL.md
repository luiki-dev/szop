---
name: phase-tracking
description: The steps and `gh` commands that keep GitHub, roadmap.md and the requirements in line during a phase and for open points. Run it when a phase's brainstorm starts, at the phase branch's first commit, when a spec or plan is committed, when the phase's owner steps change, when a decision is taken while building, before a phase PR opens, at the end of a phase, on any open-point change (added, part done, moved, gains or loses a part, dropped), and when a bug is found, filed or triaged.
---

# Phase tracking

Follow [ADR 0024](../../../docs/decisions/0024-github-project-tracking.md), [ADR 0027](../../../docs/decisions/0027-open-points-on-github.md), [ADR 0058](../../../docs/decisions/0058-bug-reports.md) (bugs) and [project tracking](../../../docs/development/project-tracking.md), which hold the reasons and [How items move](../../../docs/development/project-tracking.md#how-items-move). **GitHub** (the issues and the fields of the [Szop project](https://github.com/users/luiki-dev/projects/3)) holds the status and the open points; **`roadmap.md`** holds each phase's plan and mirrors the status in its stage tables; **`docs/requirements/`** holds each requirement's acceptance criteria and their status ([ADR 0051](../../../docs/decisions/0051-acceptance-criteria.md)). Every step below says which side it changes.

Reading the issues needs no command beyond `gh issue view <N> --repo luiki-dev/szop` and `gh issue list --repo luiki-dev/szop --label open-point`.

## Commands

IDs of the project (looked up with `gh project view 3 --owner luiki-dev --format json --jq .id` and `gh project field-list 3 --owner luiki-dev --format json`; look them up again if a command says an ID does not exist):

| What | ID |
|---|---|
| Project | `PVT_kwHOEVZTps4BmW8P` |
| Field Status | `PVTSSF_lAHOEVZTps4BmW8PzhlAT9c` |
| Field Started | `PVTF_lAHOEVZTps4BmW8PzhlCq5o` |
| Field Finished | `PVTF_lAHOEVZTps4BmW8PzhlCq5s` |
| Field Spec | `PVTF_lAHOEVZTps4BmW8PzhlCq4o` |
| Field Plan | `PVTF_lAHOEVZTps4BmW8PzhlCq5k` |
| Field Severity | `PVTSSF_lAHOEVZTps4BmW8PzhoClbY` |
| Status ❔ New | `7ed3d47c` (set by the project's workflow on every added item) |
| Status ⬜ Backlog | `9700a2cc` |
| Status 📌 Todo | `d4b70e5b` |
| Status ⏳ Blocked | `3e03373b` |
| Status 🚧 In progress | `84e02996` |
| Status ✅ Done | `e68fbead` (set by the project's workflow, never by hand) |
| Status ✖️ Dropped | `dafaf4a5` |
| Severity 🔴 Critical | `4a56f6b7` |
| Severity 🟠 Major | `9a5eab53` |
| Severity ⚪ Minor | `6c9e8810` |

The ID of an issue's item on the project (returns the existing item's ID when the issue is already on it):

```bash
gh project item-add 3 --owner luiki-dev --url https://github.com/luiki-dev/szop/issues/<N> --format json --jq .id
```

Set a field of that item, with one of the three value flags:

```bash
gh project item-edit --project-id PVT_kwHOEVZTps4BmW8P --id <item> --field-id <field> --single-select-option-id <option>
gh project item-edit --project-id PVT_kwHOEVZTps4BmW8P --id <item> --field-id <field> --date YYYY-MM-DD
gh project item-edit --project-id PVT_kwHOEVZTps4BmW8P --id <item> --field-id <field> --text <url>
```

**Every issue Claude creates gets its Status set right after `item-add`** (⬜ Backlog unless a step says otherwise): the workflow puts every new item in ❔ New, which is left for the items to triage.

Status and Severity take `--single-select-option-id`, Started and Finished `--date`, Spec and Plan `--text` (the link to the document).

The next free open-point ID is one more than the highest `OP-` ID, which this prints ([Checking with gh](../../../docs/development/project-tracking.md#checking-with-gh)):

```bash
gh issue list --repo luiki-dev/szop --label open-point --state all --limit 500 --json title --jq '[.[].title | capture("^OP-(?<n>[0-9]+)").n | tonumber] | max'
```

Create an open point, then make it a sub-issue of the phase that will settle it (the issue's own ID, not its number, goes in `sub_issue_id`); add `-F replace_parent=true` to re-parent one that already has a parent:

```bash
gh issue create --repo luiki-dev/szop --label open-point --title "OP-<n> <title>" --body "<body>"
gh api repos/luiki-dev/szop/issues/<N> --jq .id
gh api repos/luiki-dev/szop/issues/<phase>/sub_issues -F sub_issue_id=<id from the line above>
```

The items waiting for the triage (Status ❔ New):

```bash
gh project item-list 3 --owner luiki-dev --limit 500 --format json --jq '.items[] | select(.status == "❔ New") | "\(.content.number) \(.content.title)"'
```

Close as not planned:

```bash
gh issue close <N> --repo luiki-dev/szop --reason "not planned" --comment "<reason>"
```

## During a phase

### When a phase's brainstorm starts, before the first question

- On GitHub: the phase issue's Status → 🚧 In progress (`item-add` for its item, then `item-edit` with the Status field and the 🚧 option); Finished (the merge date, `--date`) set on the previous phase's issue and on every `adr` issue closed since.
- On GitHub: read the phase's open-point issues (its sub-issues and the issues its **Also** section lists).
- On GitHub: the triage of every item in ❔ New (the query above), with the owner; see [Bugs](#bugs).

### During the brainstorm

Review with the owner the acceptance criteria the phase delivers of every requirement, and the whole list of a requirement whose last part the phase delivers and that is still ❔ Criteria not finalized; an earlier phase does not finalize a list ([ADR 0051](../../../docs/decisions/0051-acceptance-criteria.md), decision 15, refined by [ADR 0050](../../../docs/decisions/0050-seed-catalog-phase-details.md), decision 14).

### In the phase branch's first commit

- In the repo: the phase's row in the `roadmap.md` stage table → 🚧.
- On GitHub: the phase issue's Started field → that commit's date (`--date`).

### When the spec or plan is committed

- In the repo: the phase's ADR is created in the spec's commit, at ✅ Accepted ([ADR 0054](../../../docs/decisions/0054-leaner-documentation.md), decisions 3 and 4).
- In the repo: its link in the phase's row of the `roadmap.md` stage table; with the spec (or a bounded phase's first commit after its design), the criteria the phase delivers set to 🚧, the requirements it reviewed marked ✅ Criteria finalized, and the index updated.
- On GitHub: the phase issue's Spec or Plan field (`--text`, the document's link).

### When the phase's owner steps change

- On GitHub: owner-step issues added, or closed as not planned with the reason (the close command above).
- In the repo: the phase entry's **Owner steps** in `roadmap.md` updated.

### During execution

A decision taken while building goes into the phase ADR's "Settled while building", in the commit of the task that took it. ADR numbers are checked against `main` and the open branches when the ADR is created and again before the PR.

### Before opening the PR

- On GitHub: every open-point issue of the phase closed (with a "settled by" comment) or re-assigned; every whole-branch-review finding not fixed was listed to the owner, and each one the owner chose is an open-point issue by now (the rest are noted as declined in the phase ADR's "Settled while building"); the phase issue's body updated only when its **Also** changed.
- In the repo: the stage table row in line with GitHub, with the PR link; every criterion the PR delivers ✅, with a test whose name starts with its ID; each requirement's line and the index updated.
- In the PR description: `Closes #<phase issue>`, `Closes #<open-point issue>` for each one it settles and `Closes #<bug issue>` for each bug it fixes.
- In the PR description: a "Token usage" section with the output of `scripts/token-usage.py --branch <the phase branch>`.

### At the end of a phase

Check for a 🔴 Critical bug not triaged yet (in ❔ New, its body's **Severity** critical): it blocks the next phase. Propose the next phase. The owner moves its issue and its open-point issues to 📌 Todo on GitHub.

### Never set Done by hand

Merging the PR closes the issues, and the project's workflow sets ✅ Done on GitHub.

## Open points

All on GitHub; no document lists them.

- **Something is left to a later phase or topic:** a new open-point issue with the next free `OP-` ID (the lookup above), labelled `open-point`, a sub-issue of the phase that will settle it (a candidate has none), and mentioned as a link where it came up.
- **Part of an open point is done:** the part ticked in the issue with its PR; the issue re-parented to the phase doing the next part (`replace_parent=true`), its Status set to ⬜ Backlog, or 📌 Todo if that phase is already picked.
- **An open point moves to another phase:** re-parented (`replace_parent=true`), with a History line in its body.
- **An open point gains or loses a part in another phase:** that phase issue's **Also** section updated.
- **An open point is dropped:** closed as not planned, with the reason as a comment.
- **Anything else** (a phase split, a candidate picked up, an item blocked, an ADR made outside a phase): look up its row in [How items move](../../../docs/development/project-tracking.md#how-items-move).

## Bugs

On GitHub only, as issues labelled `bug` ([Bug issues](../../../docs/development/project-tracking.md#bug-issues)).

- **A bug is found** (a review finding, something seen while building): it is a bug when delivered work behaves otherwise than the requirements, the design or common sense say; otherwise an open point. A critical one is fixed in the phase. Otherwise file it with the form's headings and triage it at once with the owner:

  ```bash
  gh issue create --repo luiki-dev/szop --label bug --title "<lead>" --body "### What happens
  …
  ### What was expected
  …
  ### Where
  …
  ### Steps to reproduce
  …
  ### Severity
  …
  ### Area
  <a scope from commitlint.config.js>
  ### Evidence
  …"
  ```

- **The triage** (at a brainstorm's start, or at once for Claude's own): set Severity from the body's **Severity**; when Claude disagrees, say so in a comment and set the outcome. Then one of:
  - **this phase**, when it touches code the phase changes anyway: a sub-issue of the phase, a task of its plan, Status 🚧 In progress;
  - **a later phase** of its area: a sub-issue of it, Status ⬜ Backlog (📌 Todo if that phase is picked);
  - **a bug-fix phase:** when several bugs have no natural home, propose one on the roadmap (a new phase goes through a brainstorm);
  - **can't be reproduced:** label `cannot-reproduce`, no parent, Status ⬜ Backlog; triaged again when someone adds steps or sees it again (the label removed, Status ❔ New).
- **A 🔴 Critical bug:** a sub-issue of the phase in progress; with none, the next phase gets a blocked-by link to it.
- **A bug moves:** re-parented (`replace_parent=true`), with a History line in its body.
- **A bug is fixed:** the PR says `Closes #<bug>`; the fix's commit scope is its **Area**.
