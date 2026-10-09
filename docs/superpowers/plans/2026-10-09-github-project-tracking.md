# GitHub Issues and Projects as a tracker — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every phase, every open point and every ADR made outside a phase becomes an issue in `luiki-dev/szop` on the public project "Szop", the docs link each one, and ADR 0024 with a new guide records the model and the rule that keeps both sides in step during the trial.

**Architecture:** documentation changes on branch `docs/adr-0024-github-project-tracking`, plus GitHub state created live with `gh`. The issues are generated from `docs/roadmap.md` and `docs/open-points.md` by throwaway Python scripts kept outside the repository (`TOOLS`, below); they are idempotent, keyed by the ID at the start of each issue title, and record what they created in `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/issues.json`.

**Tech Stack:** GitHub CLI (`gh` 2.96), GitHub GraphQL API (for the check only), Python 3 standard library, Markdown, GitHub issue forms (YAML).

**Spec:** [`docs/superpowers/specs/2026-10-09-github-project-tracking-design.md`](../specs/2026-10-09-github-project-tracking-design.md)

## Global Constraints

- Repository `luiki-dev/szop`; project number `3`, owner `luiki-dev` (a personal account), project ID `PVT_kwHOEVZTps4BmW8P`.
- Labels, exactly: `phase`, `open-point`, `spike`, `candidate`, `owner`, `adr`. Created in color `ededed`; the owner paints them.
- Milestones, exactly: `Definition`, `Stage 1: Local foundations`, `Stage 2: Walking skeleton, running locally`, `Stage 3: Walking skeleton, deployed and released`, `Stage 4: MVP`, `Stage 5: Later`; no due dates.
- Statuses, exactly: `⬜ Backlog`, `📌 Todo`, `⏳ Blocked`, `🚧 In progress`, `✅ Done`, `✖️ Dropped`. **The owner creates them in the UI** (spec, owner step 1); nothing in this plan touches the Status options.
- Fields created: `Order` (NUMBER), `Path` (SINGLE_SELECT: `Full`, `Bounded`), `Spec` (TEXT), `Plan` (TEXT), `Started` (DATE), `Finished` (DATE). Deleted: `Team`, `Iteration`, `Quarter`, `Start date`, `Target date`.
- Issue titles: `PH-06b Web security baseline`, `OP-053 <bold lead without its final period or colon>` cut at a word boundary to at most 80 characters with `…`, `ADR 0008 <ADR title after the dash>`.
- Totals: 35 phase issues, 61 open-point issues (60 open entries and OP-086), 18 `adr` issues (ADR 0001 to 0015, 0017, 0022 and 0024), 18 owner-step issues (the open owner steps of PH-09 to PH-13 and PH-18): **132**.
- Absolute links in issue bodies start with `https://github.com/luiki-dev/szop/blob/main/`.
- Never merge, never trigger `demo-up` or `demo-down`, never delete anything not named in this plan.
- **Shell commands run one at a time, in plain form**, from the worktree `/home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`: this session's guard refuses loops, `$(…)` substitutions and `gh … --jq` programs inside larger constructs. Anything with a loop is a Python script in `TOOLS`, run as `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/<script>.py …` (no `-I`: the scripts import `ghlib.py` from their own folder).
- `TOOLS` below means the folder `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking`, written out in full in every command (it is not a shell variable). The Write tool creates it with the first file. Nothing in it is committed.
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out, every status with its icon, requirements linked, Contents kept in sync.
- Commits follow Conventional Commits and end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XpJBovDkQJo6jkinUn2nia
  ```

## Review Focus

1. **A re-run after a partial failure** (a rate limit, a network error) must not create a second issue for the same ID: `create.py` looks up `issues.json` and the existing titles first. Pinned by Task 3, step 9 (the pilot run twice).
2. **Links to a phase group in the register** (`open-points.md#ph-13-releases`) and **to split phases** (`#ph-06a-…` versus `#ph-06-…`) must reach the right issue, and links to closed open points must stay document links. Pinned by `test_tracking.py`'s render tests (Task 3).
3. **An open point with two paragraphs** (OP-084), a lead with a link or code, and a lead longer than 80 characters must produce a complete body and a readable title. Pinned by `test_tracking.py`'s parse tests (Task 3).
4. **Closing as not planned while the "Item closed" workflow is on** would leave the status `✅ Done`: `create.py` sets fields after closing, and `check.py` asserts `✖️ Dropped` for PH-06 (Tasks 3, 4, 7).
5. **The Issue column and Issue lines** must point to the issue with the same ID, including OP-086 added late. Pinned by `check.py` (Task 7).

---

## File structure

**In the repository (committed):**

| File | Change |
|---|---|
| `docs/decisions/0024-github-project-tracking.md` | New: ADR 0024 |
| `docs/decisions/0009-git-workflow.md`, `0011-design-sanity-check-follow-ups.md`, `0014-roadmap.md` | Status lines and decision-cell notes |
| `CLAUDE.md` | Status vocabulary; Documentation list; the trial rule |
| `docs/glossary.md` | Four terms |
| `docs/development/project-tracking.md` | New: the guide |
| `.github/ISSUE_TEMPLATE/phase.yml`, `open-point.yml`, `adr.yml`, `config.yml` | New: issue forms |
| `.github/pull_request_template.md` | Issues closed; open points and roadmap lines |
| `docs/development/definition-of-done.md` | Items 6 and 9 |
| `docs/development/git-workflow.md`, `phase-walkthrough.md`, `github-settings.md` | Issue steps; settings sections |
| `docs/architecture/stack-overview.md` | Section 18 |
| `README.md` | Board link; Documentation list |
| `docs/roadmap.md` | Issue columns; a "How it works" bullet |
| `docs/open-points.md` | Issue lines; a "How it works" bullet; OP-086 |

**In `TOOLS` (throwaway, not committed):**

| File | Responsibility |
|---|---|
| `ghlib.py` | Constants, the `gh` runner with pacing and retry, `issues.json` state, project field lookup, `render()` for links |
| `parse.py` | Reads the two docs (and PH-06's pre-split entry) into `manifest.json` |
| `create.py` | Creates and updates issues from `manifest.json`, idempotently |
| `relink.py` | Re-renders every body once all numbers are known |
| `link_docs.py` | Writes the Issue column and Issue lines into the docs |
| `check.py` | Compares the docs, the manifest and GitHub |
| `test_tracking.py` | Tests for `parse.py` and `render()` |
| `roadmap-before-split.md` | `docs/roadmap.md` at `bffb63b3c4951bc02e3ce2bb1c13e892c7d8c7a1`, the last version with PH-06 |
| `owner.json` | The open points labelled `owner`, with a one-line reason each |

---

### Task 1: ADR 0024 and its notes

**Files:**
- Create: `docs/decisions/0024-github-project-tracking.md`
- Modify: `docs/decisions/0009-git-workflow.md` (status line, line 3; decision 14's cell, line 37)
- Modify: `docs/decisions/0011-design-sanity-check-follow-ups.md` (status line, line 3; decision 1's cell, line 23)
- Modify: `docs/decisions/0014-roadmap.md` (status line, line 3; decision 4's cell)
- Modify: `CLAUDE.md` (the status vocabulary list)
- Modify: `docs/glossary.md` (the Terms table)

**Interfaces:**
- Produces: the file name `0024-github-project-tracking.md`, which later tasks link as `decisions/0024-github-project-tracking.md` (from `docs/`), `../decisions/0024-github-project-tracking.md` (from `docs/development/`) and `docs/decisions/0024-github-project-tracking.md` (from the root).

- [x] **Step 1: Write ADR 0024**

Create `docs/decisions/0024-github-project-tracking.md` with exactly:

```markdown
# ADR 0024 — GitHub Issues and Projects next to the docs, as a trial

- **Status:** ✅ Accepted
- **Date:** 2026-10-09
- **Supersedes in part:** [ADR 0009](0009-git-workflow.md), decision 14 (its last sentence: "The roadmap is the tracker: GitHub Issues and Projects are not part of the process")
- **Extends:** [ADR 0014](0014-roadmap.md), decision 4 (the stage tables link each phase's issue, and the project holds a finer status); [ADR 0011](0011-design-sanity-check-follow-ups.md), decision 1 (each open entry links its issue)

## Context

[ADR 0009](0009-git-workflow.md), decision 14 made the [roadmap](../roadmap.md) the tracker and left GitHub Issues and Projects out of the process. Since then the roadmap has gained 34 phases in five stages, the [open points register](../open-points.md) about 60 open entries that move between phases, and the stage tables, the register and the README's diagram are all kept by hand.

The owner wants to learn the tool most projects plan with, and to see the project's progress on a board. GitHub offers milestones, labels, sub-issues (a parent with up to 100 children), blocking links, and Projects with custom fields and board, table and roadmap views. Issue types are not available: they are defined by an organization, and `luiki-dev` is a personal account. A *Relates to* link between issues is in public preview since 2026-08-07, without an API yet.

The design was brainstormed and written as a [spec](../superpowers/specs/2026-10-09-github-project-tracking-design.md), which holds the details: issue bodies, fields, views, workflows and how each item moves. The day-to-day guide is [project tracking](../development/project-tracking.md).

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Where tracking lives | The docs stay the tracker and GitHub mirrors them; GitHub tracks status and open points while the docs keep the plan; everything in GitHub | **GitHub tracks status and open points, the docs keep the plan**, starting as a trial in which both track (decision 2). `roadmap.md` keeps the order, goals, deliverables and owner steps, reviewed in PRs next to the ADRs that justify them; the register, a list of statuses, moves and parts, fits issues better than a document. A plain mirror would be two places to update with nothing keeping them in step. Everything in GitHub is the common setup, but changes to the plan would no longer be reviewed in PRs. |
| 2 | The trial | Switch at once; run both for a phase or two | **Both run for two phases, PH-06b and PH-07, with the docs as the source of truth.** [OP-086](../open-points.md#op-086), under PH-08, then decides whether GitHub becomes the only tracker and what the docs keep. The owner sees both before giving one up. |
| 3 | What becomes an issue | All phases, open points and closed ones; all phases and open points; only work not yet done; a pilot with the next phase or two | **All phases, including the done ones and the retired PH-06, and every open point**, candidates and spikes included. Done phases make the milestones' progress true; closed open points would add some 45 issues of history that the register already holds. |
| 4 | Decision work | No issues for ADRs; an issue per ADR; an issue per ADR made outside a phase | **An issue per ADR made outside a phase, labelled `adr`:** ADR 0001 to 0015, the definition work up to PH-01, in a GitHub-only **`Definition` milestone**, and ADR 0017 and 0022, made between phases, without a milestone. Only an ADR's creation counts, not its later changes. ADRs made inside a phase are part of that phase's issue. From now on, an ADR made outside a phase gets an `adr` issue, starting with this one. `adr` fits better than `requirement`: only ADR 0001 is about requirements. |
| 5 | Kinds of issue | Issue types; labels | **Labels.** Issue types are defined by an organization, and `luiki-dev` is a personal account. |
| 6 | Labels | Keep GitHub's defaults and add ours; only the labels in use | **Only the six in use:** `phase`, `open-point`, `spike`, `candidate`, `owner`, `adr`. GitHub's ten defaults and `accessibility` are deleted. Dependabot's labels are left to Dependabot, which creates them when it needs them. |
| 7 | Statuses | GitHub's Todo, In progress, Done; the owner's six | **The owner's six, each with its icon:** `⬜ Backlog` (planned further down the line), `📌 Todo` (picked next, the owner's items included), `⏳ Blocked` (cannot move, for any reason), `🚧 In progress`, `✅ Done` (closed as completed), `✖️ Dropped` (closed as not planned). `📌` joins the status vocabulary in `CLAUDE.md`. **No "In review" status:** the linked PR shows it. In `roadmap.md`, Backlog, Todo and Blocked all read ⬜ Not started. |
| 8 | Fields | — | **Order** (a number, the roadmap position in steps of 10, since a new phase takes the next free ID and IDs then stop sorting in roadmap order), **Path** (Full, Bounded), **Spec** and **Plan** (links), **Started** and **Finished** (dates, for the timeline). Team, Iteration, Quarter, Start date and Target date, left by the project's template, are deleted: a solo project paced by learning has no sprints or deadlines. |
| 9 | Relationships | — | **An open point is a sub-issue of the phase that settles it** (of the phase it sits under now, when it has parts; it is re-parented when a part is done, as the register moves it). **A spike blocks its phase** (OP-025 blocks PH-13, OP-038 blocks PH-16), and a "Depends on" that names an issue becomes a blocked-by link. **A split phase** is closed as not planned with a comment linking the new phases, and is linked to each of them with *Relates to* (decision 10). |
| 10 | Linking a split phase to its successors | A comment only; sub-issues of the old phase; *Relates to* and a comment | ***Relates to* and a comment.** *Relates to* links two issues without meaning blocking or containment, and shows on both. It has no API yet, so the owner adds it in the issue sidebar; splits are rare. Making the new phases sub-issues of a closed, retired phase would read as if the old phase were still the container. |
| 11 | What a phase issue holds | A link to the roadmap only; a copy of the roadmap entry | **A copy of the entry** (goal, delivers, depends on, owner steps as a checklist, expected path, the "Also" open points), the owner's choice, so the issue reads on its own. The copy can drift; the trial rule (decision 14) handles it. **Owner steps of a phase not yet done are sub-issues of their own**, labelled `owner` (`PH-10 owner step 1: …`), and the phase issue lists them, so the owner sees every step waiting on them on the board; a done phase keeps its owner steps as a ticked checklist. A checklist alone would leave the owner's steps off the board, without a status. |
| 12 | How the GitHub side is built | A one-off run of `gh` commands, driven by the plan; a committed migration script; a GitHub Action that mirrors the docs on every merge | **A one-off run of `gh`, with a pilot first.** The issue bodies are generated from the docs by throwaway scripts and created in batches; PH-06b with its open points goes first, the owner checks it, then the rest follows. A committed script would be a tested Markdown parser that loses its purpose when the trial ends, and a second new concept in one change. An Action needs a personal access token or a GitHub App to write to a user's project, a new credential under [ADR 0012](0012-security-baseline.md), and would make the docs the permanent source. |
| 13 | Visibility of the project | Public; private | **Public.** The issues are public with the repository anyway, and the README and `roadmap.md` can link a board visitors can open. Only the owner can edit it. |
| 14 | Keeping both sides in step | Automation; a rule | **A rule,** for the length of the trial: the docs are the source; a change to a roadmap entry or an open point updates its issue in the same working session, and the PR says so. Drift that hurts is evidence for OP-086. |

## Consequences

- **132 issues exist** on the [Szop project](https://github.com/users/luiki-dev/projects/3): 35 phases, 61 open points, 18 `adr` issues and 18 owner steps, in six milestones, with six labels.
- **The stage tables gain an Issue column, and every open entry an Issue line.** The README links the board under its diagram, which stays as it is ([ADR 0017](0017-readme-roadmap-diagram.md)).
- **A new guide**, [project tracking](../development/project-tracking.md), explains the model, how items move and the owner's setup steps; issue forms in `.github/ISSUE_TEMPLATE/` give new issues the same shape.
- **The PR template and the [definition of done](../development/definition-of-done.md)** (items 6 and 9) name the issues during the trial, and a PR closes its issues with `Closes #N`.
- **`CLAUDE.md`'s status vocabulary gains `📌`**, and names the project's statuses.
- **Some GitHub changes have no API** (the Status options, the workflows, the views, *Relates to*): they are the owner's steps, listed in the guide.
- **[OP-086](../open-points.md#op-086)** decides after PH-07 how the trial ends.
```

- [x] **Step 2: Add the notes to ADR 0009**

In `docs/decisions/0009-git-workflow.md`:
- At the end of the status line (line 3), after `decision 9 refined by [ADR 0016](0016-toolchain-details.md) (an allow-list of scopes)`, append: `; decision 14 superseded in part by [ADR 0024](0024-github-project-tracking.md) (GitHub Issues and a GitHub Project track the work, in a trial next to the roadmap)`
- In decision 14's row, replace `**The roadmap is the tracker:** GitHub Issues and Projects are not part of the process. |` with `**The roadmap is the tracker:** GitHub Issues and Projects are not part of the process. <br>🔁 **Superseded in part by [ADR 0024](0024-github-project-tracking.md), decisions 1 and 2:** GitHub Issues and a GitHub Project track the phases, open points and decision work, in a trial next to the roadmap. |`

- [x] **Step 3: Add the notes to ADR 0011 and ADR 0014**

In `docs/decisions/0011-design-sanity-check-follow-ups.md`:
- Status line: append `; decision 1 extended by [ADR 0024](0024-github-project-tracking.md) (each open entry links its GitHub issue)` after `(the visual design doc)`.
- Decision 1's row ends with `A triage file next to the audit would have covered only the audit's findings. |`; replace with `A triage file next to the audit would have covered only the audit's findings. <br>➕ **Extended by [ADR 0024](0024-github-project-tracking.md), decision 1:** each open entry links its GitHub issue, which mirrors it during the trial. |`

In `docs/decisions/0014-roadmap.md`:
- Status line: replace `(the README's roadmap diagram mirrors the stage tables)` with `(the README's roadmap diagram mirrors the stage tables) and extended by [ADR 0024](0024-github-project-tracking.md) (the stage tables link each phase's issue, and the GitHub Project holds a finer status)`.
- Decision 4's row: replace `the README's roadmap diagram mirrors the stage tables. |` with `the README's roadmap diagram mirrors the stage tables. <br>➕ **Extended by [ADR 0024](0024-github-project-tracking.md), decisions 1 and 7:** each stage table links its phases' issues, and the GitHub Project holds a finer status. |`

- [x] **Step 4: Extend the status vocabulary in `CLAUDE.md`**

In the list under "Every written status or outcome gets its icon", replace these lines:

```markdown
  - ✅ done or in force: ADR accepted, open point closed, finding fixed, phase done
  - ⬜ open or not started: open point open, phase not started
  - 🚧 in progress: open point or phase being worked on
  - ⏳ deferred or waiting: finding deferred to an open point
  - ✖️ rejected or dropped: finding rejected, open point dropped without being done
```

with:

```markdown
  - ✅ done or in force: ADR accepted, open point closed, finding fixed, phase done, `✅ Done` on the project
  - ⬜ open or not started: open point open, phase not started, `⬜ Backlog` on the project
  - 📌 to do next: `📌 Todo` on the project, an item picked to be done next
  - 🚧 in progress: open point or phase being worked on, `🚧 In progress` on the project
  - ⏳ deferred or waiting: finding deferred to an open point, `⏳ Blocked` on the project
  - ✖️ rejected or dropped: finding rejected, open point dropped without being done, `✖️ Dropped` on the project
```

- [x] **Step 5: Add four terms to the glossary**

In `docs/glossary.md`, `## Terms` table, insert each row at its alphabetical place:

```markdown
| **GitHub Projects** | GitHub's planning tool: a project collects issues from one or more repositories and shows them as a table, a board or a timeline, with custom fields such as a status. Szop's project tracks its phases, open points and decision work (see ADR 0024). |
| **Issue form** | A YAML file in `.github/ISSUE_TEMPLATE/` that turns GitHub's "new issue" page into a form with labelled fields, so issues of one kind share one shape. |
| **Milestone** | On GitHub, a named group of issues with a progress bar of how many are closed. Szop has one per roadmap stage, and one for the definition work before the first phase (see ADR 0024). |
| **Sub-issue** | An issue placed under a parent issue on GitHub; the parent shows its sub-issues and how many are closed. In Szop, each open point is a sub-issue of the phase that settles it (see ADR 0024). |
```

- [x] **Step 6: Check the formatting and links**

Run: `pnpm exec prettier --check docs/decisions/0024-github-project-tracking.md docs/decisions/0009-git-workflow.md docs/decisions/0011-design-sanity-check-follow-ups.md docs/decisions/0014-roadmap.md docs/glossary.md CLAUDE.md`
Expected: `All matched files use Prettier code style!` (Markdown is ignored by Prettier in this repository, so this mostly confirms no other file was touched; if a file is reported, run `pnpm exec prettier --write` on it.)

Run: `grep -c "0024-github-project-tracking.md" docs/decisions/0009-git-workflow.md docs/decisions/0011-design-sanity-check-follow-ups.md docs/decisions/0014-roadmap.md`
Expected: `2` for each file.

Note: ADR 0024 links `../open-points.md#op-086`, which Task 6 creates.

- [x] **Step 7: Commit**

```bash
git add docs/decisions/0024-github-project-tracking.md docs/decisions/0009-git-workflow.md docs/decisions/0011-design-sanity-check-follow-ups.md docs/decisions/0014-roadmap.md CLAUDE.md docs/glossary.md
git commit -F /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task1.txt
```

with `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task1.txt` (written with the Write tool first):

```
docs(adr): add ADR 0024 GitHub Issues and Projects as a trial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpJBovDkQJo6jkinUn2nia
```

---

### Task 2: GitHub foundations

No repository files change; the PR description records this task.

**Interfaces:**
- Produces: the six labels, the six milestones (all open for now), project #3 with the six new fields; `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/ghlib.py` (used by every later task).

- [x] **Step 1: Write `ghlib.py`**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/ghlib.py`:

```python
"""Helpers for the one-off GitHub tracking migration (throwaway, not committed)."""
import json
import pathlib
import posixpath
import re
import subprocess
import time

REPO = "luiki-dev/szop"
OWNER = "luiki-dev"
PROJECT = "3"
PROJECT_ID = "PVT_kwHOEVZTps4BmW8P"
BLOB = "https://github.com/luiki-dev/szop/blob/main/"
ISSUE_URL = "https://github.com/luiki-dev/szop/issues/"
HERE = pathlib.Path(__file__).resolve().parent
STATE = HERE / "issues.json"


def gh(*args, json_out=False, pause=1.0):
    """Runs gh; retries on GitHub's secondary rate limit; pauses after each call."""
    for attempt in range(6):
        p = subprocess.run(["gh", *args], capture_output=True, text=True)
        if p.returncode == 0:
            time.sleep(pause)
            return json.loads(p.stdout) if json_out else p.stdout
        if "rate limit" in p.stderr.lower():
            time.sleep(60 * (attempt + 1))
            continue
        raise RuntimeError(f"gh {' '.join(args)}\n{p.stderr}")
    raise RuntimeError("gave up after repeated rate limits")


def load_state():
    """key -> {"number": int, "item": project item ID or None, "done": [step names]}"""
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save_state(state):
    STATE.write_text(json.dumps(state, indent=2, sort_keys=True))


def numbers(state):
    return {k: v["number"] for k, v in state.items()}


def fields():
    """Field name -> {"id": field ID, "type": type, "options": {option name: option ID}}."""
    data = gh("project", "field-list", PROJECT, "--owner", OWNER, "--format", "json", "--limit", "50", json_out=True, pause=0)
    return {
        f["name"]: {"id": f["id"], "type": f["type"], "options": {o["name"]: o["id"] for o in f.get("options", [])}}
        for f in data["fields"]
    }


LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")


def key_for(path, anchor):
    """The issue key a docs link points to, or None."""
    a = anchor.lower()
    m = re.match(r"op-(\d+)$", a)
    if m and path.endswith("open-points.md"):
        return f"OP-{m.group(1)}"
    m = re.match(r"ph-(\d+[ab]?)(-|$)", a)
    if m and path.endswith(("roadmap.md", "open-points.md")):
        return f"PH-{m.group(1)}"
    return None


def render(md, source, nums):
    """Rewrites relative links in Markdown taken from `source` (a repo-relative path).

    A `{{KEY}}` placeholder becomes `#N` when KEY has an issue, else KEY itself.
    A link to a phase or an open point that has an issue becomes `text (#N)`;
    any other relative link becomes an absolute URL on main.
    """
    base = posixpath.dirname(source)
    md = re.sub(r"\{\{(PH-\d+[ab]? owner step \d+)\}\}", lambda m: f"#{nums[m.group(1)]}" if m.group(1) in nums else m.group(1), md)

    def sub(m):
        text, target = m.group(1), m.group(2)
        if re.match(r"[a-z]+:", target):
            return m.group(0)
        path, _, anchor = target.partition("#")
        full = posixpath.normpath(posixpath.join(base, path)) if path else source
        key = key_for(full, anchor)
        if key and key in nums:
            return f"{text} (#{nums[key]})"
        return f"[{text}]({BLOB}{full}{'#' + anchor if anchor else ''})"

    return LINK.sub(sub, md)
```

- [x] **Step 2: Replace the labels**

Run each command on its own:

```bash
gh label delete accessibility --repo luiki-dev/szop --yes
gh label delete bug --repo luiki-dev/szop --yes
gh label delete documentation --repo luiki-dev/szop --yes
gh label delete duplicate --repo luiki-dev/szop --yes
gh label delete enhancement --repo luiki-dev/szop --yes
gh label delete "good first issue" --repo luiki-dev/szop --yes
gh label delete "help wanted" --repo luiki-dev/szop --yes
gh label delete invalid --repo luiki-dev/szop --yes
gh label delete question --repo luiki-dev/szop --yes
gh label delete wontfix --repo luiki-dev/szop --yes
gh label create phase --repo luiki-dev/szop --color ededed --description "A roadmap phase: one brainstorm, one branch, one PR"
gh label create open-point --repo luiki-dev/szop --color ededed --description "An entry of the open points register"
gh label create spike --repo luiki-dev/szop --color ededed --description "An open point answered by a spike before its phase"
gh label create candidate --repo luiki-dev/szop --color ededed --description "Optional work, not scheduled: a candidate phase or an upgrade waiting for its moment"
gh label create owner --repo luiki-dev/szop --color ededed --description "Only the owner can do it"
gh label create adr --repo luiki-dev/szop --color ededed --description "Decision work whose result is one ADR, made outside a phase"
```

- [x] **Step 3: Replace the milestones**

The test milestone is number 1 (`Walking Skeleton`); check with `gh api repos/luiki-dev/szop/milestones?state=all` that its title matches before deleting. Then, one command at a time:

```bash
gh api -X DELETE repos/luiki-dev/szop/milestones/1
gh api repos/luiki-dev/szop/milestones -f title="Definition" -f description="From the first requirements to the roadmap, before PH-01: ADR 0001 to 0015."
```

Create the five stage milestones with `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/milestones.py`:

```python
"""Creates one milestone per roadmap stage, its exit criterion as the description."""
import re
import sys
import pathlib
from ghlib import gh, render

root = pathlib.Path(sys.argv[1])
text = (root / "docs/roadmap.md").read_text(encoding="utf-8")
for m in re.finditer(r"^## (Stage \d+: .+)\n\n\*\*Exit:\*\* (.+)$", text, re.M):
    title, exit_text = m.group(1), render(m.group(2), "docs/roadmap.md", {})
    gh("api", "repos/luiki-dev/szop/milestones", "-f", f"title={title}", "-f", f"description=Exit: {exit_text}")
    print("created", title)
```

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/milestones.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: five `created Stage …` lines.

- [x] **Step 4: Delete test issue #24**

Check first: `gh issue view 24 --repo luiki-dev/szop --json title` shows `Test item 1`. Then: `gh issue delete 24 --repo luiki-dev/szop --yes`

- [x] **Step 5: Update the project**

```bash
gh project edit 3 --owner luiki-dev --title "Szop" --visibility PUBLIC --description "Szop's roadmap phases, open points and decision work. The plan lives in docs/roadmap.md: https://github.com/luiki-dev/szop/blob/main/docs/roadmap.md"
gh project field-list 3 --owner luiki-dev
```

Take the IDs of `Team`, `Iteration`, `Quarter`, `Start date` and `Target date` from the list, and delete each: `gh project field-delete --id <ID>`.

Then create the fields:

```bash
gh project field-create 3 --owner luiki-dev --name "Order" --data-type NUMBER
gh project field-create 3 --owner luiki-dev --name "Path" --data-type SINGLE_SELECT --single-select-options "Full,Bounded"
gh project field-create 3 --owner luiki-dev --name "Spec" --data-type TEXT
gh project field-create 3 --owner luiki-dev --name "Plan" --data-type TEXT
gh project field-create 3 --owner luiki-dev --name "Started" --data-type DATE
gh project field-create 3 --owner luiki-dev --name "Finished" --data-type DATE
```

- [x] **Step 6: Verify**

Run: `gh label list --repo luiki-dev/szop`
Expected: exactly the six labels.

Run: `gh api repos/luiki-dev/szop/milestones?state=all`
Expected: exactly six milestones, all open, titles as in Global Constraints.

Run: `gh project field-list 3 --owner luiki-dev`
Expected: Title, Assignees, Status, Labels, Linked pull requests, Milestone, Repository, Reviewers, Parent issue, Sub-issues progress, Created, Updated, Closed, Order, Path, Spec, Plan, Started, Finished; no Team, Iteration, Quarter, Start date or Target date.

Run: `gh project view 3 --owner luiki-dev`
Expected: title `Szop`, public.

- [x] **Step 7: Stop for the owner**

Report the results and ask the owner to replace the Status options in the UI (*project → ⋯ → Settings → Status*) with exactly `⬜ Backlog`, `📌 Todo`, `⏳ Blocked`, `🚧 In progress`, `✅ Done`, `✖️ Dropped`. Wait for the owner's reply.

---

### Task 3: Generator and pilot

No repository files change; the PR description records this task.

**Interfaces:**
- Consumes: `ghlib.py` (`gh`, `load_state`, `save_state`, `numbers`, `fields`, `render`, `BLOB`, `REPO`, `OWNER`, `PROJECT`, `PROJECT_ID`, `HERE`).
- Produces: `manifest.json` (a list of items, schema below), `issues.json`, `parse.py`, `create.py`, `owner.json`.

**`manifest.json` item schema:**

```json
{
  "key": "PH-06b",
  "kind": "phase | open-point | adr",
  "title": "PH-06b Web security baseline",
  "labels": ["phase"],
  "milestone": "Stage 2: Walking skeleton, running locally",
  "parent": null,
  "blocked_by": [],
  "source": "docs/roadmap.md",
  "body": "Markdown with the doc's relative links",
  "close": null,
  "close_comment": null,
  "fields": {"Status": "📌 Todo", "Order": 80, "Path": "Full", "Spec": null, "Plan": null, "Started": null, "Finished": null}
}
```

`close` is `null`, `"completed"` or `"not planned"`; `close_comment` may hold `{PH-06a}`-style placeholders filled with issue numbers.

- [x] **Step 1: Check the Status options**

Run: `gh project field-list 3 --owner luiki-dev --format json`
Expected: the Status field's options are exactly the six of Global Constraints. If not, stop and ask the owner.

- [x] **Step 2: Save PH-06's pre-split roadmap**

Run: `git show bffb63b3c4951bc02e3ce2bb1c13e892c7d8c7a1:docs/roadmap.md` and save its output to `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/roadmap-before-split.md` with the Write tool (or redirect: `git show bffb63b3c4951bc02e3ce2bb1c13e892c7d8c7a1:docs/roadmap.md > /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/roadmap-before-split.md`).

- [x] **Step 3: Write the failing tests**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/test_tracking.py`:

```python
"""Tests for the throwaway tracking scripts. Run: python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/test_tracking.py <worktree>"""
import sys
import unittest
import pathlib

ROOT = pathlib.Path(sys.argv.pop(1))
from ghlib import render, BLOB  # noqa: E402
import parse  # noqa: E402

ITEMS = {i["key"]: i for i in parse.build(ROOT)}


class Render(unittest.TestCase):
    def test_phase_group_in_register_maps_to_phase(self):
        out = render("[PH-13](open-points.md#ph-13-releases)", "docs/roadmap.md", {"PH-13": 40})
        self.assertEqual(out, "PH-13 (#40)")

    def test_split_ids_do_not_collide(self):
        nums = {"PH-06": 1, "PH-06a": 2}
        self.assertEqual(render("[x](#ph-06a-production-build-and-serving)", "docs/roadmap.md", nums), "x (#2)")
        self.assertEqual(render("[x](open-points.md#ph-06-production-build-and-web-baseline)", "docs/roadmap.md", nums), "x (#1)")

    def test_open_point_with_issue_and_without(self):
        self.assertEqual(render("[OP-038](open-points.md#op-038)", "docs/roadmap.md", {"OP-038": 7}), "OP-038 (#7)")
        self.assertEqual(render("[OP-001](#op-001)", "docs/open-points.md", {}), f"[OP-001]({BLOB}docs/open-points.md#op-001)")

    def test_other_relative_and_absolute_links(self):
        self.assertEqual(render("[ADR 0012](decisions/0012-security-baseline.md)", "docs/roadmap.md", {}),
                         f"[ADR 0012]({BLOB}docs/decisions/0012-security-baseline.md)")
        self.assertEqual(render("[r](../README.md#roadmap)", "docs/roadmap.md", {}), f"[r]({BLOB}README.md#roadmap)")
        self.assertEqual(render("[g](https://example.com/a)", "docs/roadmap.md", {}), "[g](https://example.com/a)")


class Placeholders(unittest.TestCase):
    def test_placeholder_with_and_without_number(self):
        md = "- {{PH-10 owner step 1}}"
        self.assertEqual(render(md, "docs/roadmap.md", {"PH-10 owner step 1": 40}), "- #40")
        self.assertEqual(render(md, "docs/roadmap.md", {}), "- PH-10 owner step 1")

    def test_github_expressions_stay_intact(self):
        expr = "`${{ github.event.pull_request.title }}`"
        self.assertEqual(render(expr, "docs/open-points.md", {}), expr)
        self.assertIn("${{ github.event.pull_request.title }}", render(ITEMS["OP-070"]["body"], "docs/open-points.md", {}))


class Parse(unittest.TestCase):
    def test_owner_steps(self):
        steps = [i for i in ITEMS.values() if i["kind"] == "owner-step"]
        self.assertEqual(len(steps), 18)
        ph10 = [i for i in steps if i["parent"] == "PH-10"]
        self.assertEqual(len(ph10), 3)
        self.assertTrue(all(i["labels"] == ["owner"] for i in steps))
        self.assertTrue(ph10[0]["title"].startswith("PH-10 owner step 1: Choose the name and buy the domain"))
        self.assertTrue(all(len(i["title"]) <= 100 for i in steps))
        self.assertIn("{{PH-10 owner step 1}}", ITEMS["PH-10"]["body"])
        self.assertEqual(ITEMS["PH-10 owner step 1"]["fields"]["Status"], "⬜ Backlog")
        self.assertFalse([i for i in steps if i["parent"] == "PH-02"])
        self.assertIn("- [x]", ITEMS["PH-02"]["body"])
        self.assertNotIn("{{", ITEMS["PH-02"]["body"])

    def test_counts(self):
        kinds = [i["kind"] for i in ITEMS.values()]
        self.assertEqual(kinds.count("phase"), 35)
        self.assertEqual(kinds.count("adr"), 18)
        self.assertGreaterEqual(kinds.count("open-point"), 60)

    def test_two_paragraph_entry_keeps_both(self):
        body = ITEMS["OP-084"]["body"]
        self.assertIn("Keep the symlinked workspace in the container image.", body)
        self.assertIn("Check the pages, not only the API, at startup.", body)

    def test_titles(self):
        for item in ITEMS.values():
            if item["kind"] == "open-point":
                self.assertLessEqual(len(item["title"]), 80, item["title"])
            sep = ": " if item["kind"] == "owner-step" else " "
            self.assertTrue(item["title"].startswith(item["key"] + sep), item["title"])
            self.assertNotIn("](", item["title"])
        self.assertEqual(ITEMS["OP-053"]["title"], "OP-053 Build the app-wide web baseline")

    def test_relationships(self):
        self.assertEqual(ITEMS["OP-053"]["parent"], "PH-06b")
        self.assertIsNone(ITEMS["OP-029"]["parent"])
        self.assertIn("candidate", ITEMS["OP-029"]["labels"])
        self.assertIn("OP-025", ITEMS["PH-13"]["blocked_by"])
        self.assertIn("OP-038", ITEMS["PH-16"]["blocked_by"])
        self.assertIn("spike", ITEMS["OP-038"]["labels"])
        self.assertIn("PH-11", ITEMS["PH-12"]["blocked_by"])

    def test_states_and_order(self):
        self.assertEqual(ITEMS["PH-06"]["close"], "not planned")
        self.assertEqual(ITEMS["PH-06"]["fields"]["Status"], "✖️ Dropped")
        self.assertEqual(ITEMS["PH-01"]["close"], "completed")
        self.assertEqual(ITEMS["PH-06b"]["fields"]["Status"], "📌 Todo")
        self.assertEqual(ITEMS["ADR 0024"]["fields"]["Status"], "🚧 In progress")
        self.assertEqual(ITEMS["PH-01"]["fields"]["Order"], 10)
        self.assertEqual(ITEMS["PH-06"]["fields"]["Order"], 60)
        self.assertEqual(ITEMS["PH-06a"]["fields"]["Order"], 70)
        self.assertEqual(ITEMS["PH-01"]["fields"]["Started"], "2026-10-02")

    def test_phase_body_sections(self):
        body = ITEMS["PH-13"]["body"]
        for heading in ("### Goal", "### Delivers", "### Depends on", "### Owner steps", "### Expected path", "### Also"):
            self.assertIn(heading, body)
        self.assertIn("- {{PH-13 owner step 1}}", body)
        self.assertIn("- [x]", ITEMS["PH-02"]["body"])

    def test_parts_are_a_checklist(self):
        body = ITEMS["OP-010"]["body"]
        self.assertIn("### Parts", body)
        self.assertIn("- [x] **PH-03:**", body)
        self.assertIn("- [ ] **PH-07:**", body)


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 4: Run the tests to see them fail**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/test_tracking.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: an error, `ModuleNotFoundError: No module named 'parse'`.

- [x] **Step 5: Write `parse.py`**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/parse.py`:

```python
"""Reads docs/roadmap.md and docs/open-points.md into manifest.json (throwaway)."""
import json
import re
import sys
import pathlib
from ghlib import BLOB, HERE

BULLET = re.compile(r"^- \*\*(.+?)\*\*:?\s*(.*)$")
ROW = re.compile(r"^\| \[(PH-\d+[ab]?) [^\]]*\]\(#([^)]+)\) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|")
CELL_LINK = re.compile(r"\]\(([^)]+)\)")
TODO = {"PH-06b", "OP-053", "OP-067"}
SPIKES = {"OP-025": "PH-13", "OP-038": "PH-16"}
PRE_SPLIT = "bffb63b3c4951bc02e3ce2bb1c13e892c7d8c7a1"
DONE_DATES = {  # phase: (first commit of its PR, merge date), from the PRs
    "PH-01": ("2026-10-02", "2026-10-02"), "PH-02": ("2026-10-04", "2026-10-04"),
    "PH-03": ("2026-10-05", "2026-10-05"), "PH-04": ("2026-10-05", "2026-10-06"),
    "PH-05": ("2026-10-07", "2026-10-07"), "PH-06a": ("2026-10-08", "2026-10-08"),
}
ADRS = [  # number, file, title, landed in, started, finished, milestone
    ("0001", "0001-functional-requirements-scope.md", "Functional requirements scope", "commit 797a20e, committed straight to main", "2026-09-21", "2026-09-21", "Definition"),
    ("0002", "0002-technical-architecture.md", "Technical architecture and technology choices", "commit 0bc715b, committed straight to main", "2026-09-22", "2026-09-22", "Definition"),
    ("0003", "0003-abuse-protection.md", "Abuse protection: lazy guest workspaces, rate limits and quotas", "commit 3a71041, committed straight to main", "2026-09-27", "2026-09-27", "Definition"),
    ("0004", "0004-implementation-process.md", "Implementation process: foundation topics, roadmap and phases", "commit a05cbea, committed straight to main", "2026-09-27", "2026-09-27", "Definition"),
    ("0005", "0005-development-environment.md", "Development environment and tooling", "commit 4e5c2f6, committed straight to main", "2026-09-27", "2026-09-27", "Definition"),
    ("0006", "0006-git-workflow-topic.md", "Git workflow as a foundation topic", "commit 40937ac, committed straight to main", "2026-09-27", "2026-09-27", "Definition"),
    ("0007", "0007-testing-strategy.md", "Testing strategy", "commit 228fe71, committed straight to main", "2026-09-27", "2026-09-27", "Definition"),
    ("0008", "0008-hosting.md", "Hosting: an on-demand demo environment on AWS", "commit ac21e2f, committed straight to main", "2026-09-28", "2026-09-28", "Definition"),
    ("0009", "0009-git-workflow.md", "Git workflow", "PR #1", "2026-09-28", "2026-09-28", "Definition"),
    ("0010", "0010-ci-cd.md", "CI/CD: GitHub Actions checks and push-button demo environments", "PR #2", "2026-09-29", "2026-09-29", "Definition"),
    ("0011", "0011-design-sanity-check-follow-ups.md", "Follow-ups to the 2026-09-29 design sanity check", "PR #3", "2026-09-29", "2026-09-30", "Definition"),
    ("0012", "0012-security-baseline.md", "Security baseline: threat model, access control, web baseline, rate limits and delivery", "PR #6", "2026-10-01", "2026-10-01", "Definition"),
    ("0013", "0013-visual-design.md", "Visual design: look, components, styling, tokens and non-functional requirements", "PR #8", "2026-10-01", "2026-10-01", "Definition"),
    ("0014", "0014-roadmap.md", "Roadmap: stages, phases and their order", "PR #9", "2026-10-01", "2026-10-02", "Definition"),
    ("0015", "0015-git-push-guard-hook.md", "A Claude Code hook that guards git push", "PR #10", "2026-10-02", "2026-10-02", "Definition"),
    ("0017", "0017-readme-roadmap-diagram.md", "A roadmap diagram in the README", "PR #12", "2026-10-02", "2026-10-02", None),
    ("0022", "0022-ring-tail-redesign.md", "\"Ring tail\" visual redesign", "PR #21", "2026-10-07", "2026-10-07", None),
    ("0024", "0024-github-project-tracking.md", "GitHub Issues and Projects next to the docs, as a trial", "the PR that closes this issue", "2026-10-09", None, None),
]
OWNER_FILE = HERE / "owner.json"


def cap(s):
    return s[:1].upper() + s[1:]


def short_title(key, lead):
    lead = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", lead).strip().rstrip(".:")
    title = f"{key} {lead}"
    if len(title) <= 80:
        return title
    return title[:79].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def phase_entries(text):
    out = {}
    for m in re.finditer(r"^### (PH-\d+[ab]?) ([^\n]+)\n(.*?)(?=^#{2,3} |\Z)", text, re.M | re.S):
        fields = {}
        for line in m.group(3).splitlines():
            b = BULLET.match(line)
            if b:
                fields[b.group(1).rstrip(":")] = b.group(2).strip()
        out[m.group(1)] = {"name": m.group(2).strip(), "fields": fields}
    return out


def step_list(text):
    """The owner steps of a roadmap entry, capitalised, without the final period; [] for "none"."""
    t = text.strip()
    if t.lower().startswith("none"):
        return []
    return [cap(s.strip().rstrip(".")) for s in t.split("; ")]


def owner_steps(key, text, done):
    steps = step_list(text)
    if not steps:
        return cap(text.strip())
    if done:
        return "\n".join(f"- [x] {s}" for s in steps)
    return "\n".join(f"- {{{{{key} owner step {i}}}}}" for i in range(1, len(steps) + 1))


def step_title(prefix, text):
    title = f"{prefix}: {text}"
    if len(title) <= 100:
        return title
    return title[:99].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def path_value(text):
    t = text.lower()
    return "Full" if t.startswith("full") else "Bounded" if t.startswith("bounded") else None


def phase_body(key, name, f, entry_url, also, done):
    out = [f"Roadmap entry: [{key} {name}]({entry_url})", ""]

    def sec(title, text):
        out.extend([f"### {title}", "", cap(text), ""])

    sec("Goal", f["Goal"])
    sec("Delivers", f["Delivers"])
    for k, v in f.items():
        if k not in ("Goal", "Delivers", "Depends on", "Owner steps", "Expected path", "Open points"):
            sec(k, v)
    sec("Depends on", f.get("Depends on", "—"))
    sec("Owner steps", owner_steps(key, f.get("Owner steps", "none."), done))
    sec("Expected path", cap(f["Expected path"]))
    sec("Also", ", ".join(f"[OP-{n}](open-points.md#op-{n})" for n in also) if also else "—")
    return "\n".join(out).rstrip() + "\n"


def phases(roadmap, before_split, also):
    entries = phase_entries(roadmap)
    order = list(entries)
    order.insert(order.index("PH-06a"), "PH-06")
    rows, stage_of, stage = {}, {}, None
    for line in roadmap.splitlines():
        m = re.match(r"^## (Stage \d+: .+)$", line)
        if m:
            stage = m.group(1)
        elif line.startswith("## "):
            stage = None
        r = ROW.match(line)
        if r and stage:
            rows[r.group(1)] = r.groups()
            stage_of[r.group(1)] = stage
    old = phase_entries(before_split)["PH-06"]
    items, steps = [], []
    for i, key in enumerate(order):
        if key == "PH-06":
            e, url, done = old, f"https://github.com/luiki-dev/szop/blob/{PRE_SPLIT}/docs/roadmap.md#ph-06-production-build-and-web-baseline", False
            status, close, milestone = "✖️ Dropped", "not planned", "Stage 2: Walking skeleton, running locally"
            spec = plan = None
        else:
            e = entries[key]
            _, anchor, st, spec_cell, plan_cell, _ = rows[key]
            url = f"{BLOB}docs/roadmap.md#{anchor}"
            done = st.startswith("✅")
            status = "✅ Done" if done else "📌 Todo" if key in TODO else "⬜ Backlog"
            close = "completed" if done else None
            milestone = stage_of[key]
            spec = BLOB + "docs/" + CELL_LINK.search(spec_cell).group(1) if "](" in spec_cell else None
            plan = BLOB + "docs/" + CELL_LINK.search(plan_cell).group(1) if "](" in plan_cell else None
        f = e["fields"]
        blocked = sorted(set(re.findall(r"open-points\.md#(op-\d+)", f.get("Depends on", ""))))
        dep = f.get("Depends on", "")
        dep_phases = set(re.findall(r"\bPH-\d+[ab]?\b", dep)) | {
            "PH-" + n for n in re.findall(r"\]\([^)#]*#ph-(\d+[ab]?)(?:-[^)]*)?\)", dep)}
        blocked = [b.upper() for b in blocked] + [op for op, ph in SPIKES.items() if ph == key]
        blocked += sorted(dep_phases - {key})
        started, finished = DONE_DATES.get(key, (None, None))
        items.append({
            "key": key, "kind": "phase", "title": f"{key} {e['name']}", "labels": ["phase"],
            "milestone": milestone, "parent": None, "blocked_by": sorted(set(blocked)),
            "source": "docs/roadmap.md", "body": phase_body(key, e["name"], f, url, also.get(key, []), done),
            "close": close,
            "close_comment": "Split into {PH-06a} and {PH-06b}: it held two new concepts, the production build and the web security baseline ([ADR 0014](decisions/0014-roadmap.md), decision 6)." if key == "PH-06" else None,
            "fields": {"Status": status, "Order": 10 * (i + 1), "Path": path_value(f["Expected path"]),
                       "Spec": spec, "Plan": plan, "Started": started, "Finished": finished},
        })
        if not done:  # a done phase keeps its steps as a ticked checklist
            for n, step in enumerate(step_list(f.get("Owner steps", "none.")), 1):
                steps.append({
                    "key": f"{key} owner step {n}", "kind": "owner-step",
                    "title": step_title(f"{key} owner step {n}", step), "labels": ["owner"],
                    "milestone": None, "parent": key, "blocked_by": [], "source": "docs/roadmap.md",
                    "body": f"Owner step of [{key} {e['name']}]({url}), from its **Owner steps** in the roadmap.\n\n{step}.\n",
                    "close": None, "close_comment": None,
                    "fields": {"Status": "📌 Todo" if key in TODO else "⬜ Backlog"},
                })
    return items, steps


def open_points(register):
    owner = set(json.loads(OWNER_FILE.read_text())) if OWNER_FILE.exists() else set()
    body = register.split("\n## Closed")[0]
    group, also, entries, cur = None, {}, [], None
    for line in body.splitlines():
        m = re.match(r"^### (PH-\d+[ab]?) ", line)
        if m or line.startswith("## "):
            group = m.group(1) if m else ("Candidates" if line.startswith("## Candidates") else None)
            cur = None
            continue
        if line.startswith("Also:") and group:
            also[group] = re.findall(r"#op-(\d+)", line)
            continue
        m = re.match(r"^#### (OP-\d+)$", line)
        if m:
            cur = {"key": m.group(1), "group": group, "lines": []}
            entries.append(cur)
            continue
        if cur is not None:
            cur["lines"].append(line)
    items = []
    for e in entries:
        lines = e["lines"]
        i = 0
        while i < len(lines) and not lines[i].startswith("- "):
            i += 1
        text = "\n".join(lines[:i]).strip()
        bullets = []
        for line in lines[i:]:
            b = BULLET.match(line)
            if b:
                bullets.append([b.group(1).rstrip(":"), b.group(2).strip(), []])
            elif line.startswith("  - ") and bullets:
                bullets[-1][2].append(line[4:])
            elif line.strip() and bullets:
                bullets[-1][1] += " " + line.strip()
        key = e["key"]
        out = [f"Register entry: [{key}]({BLOB}docs/open-points.md#{key.lower()})", "", text, ""]
        source = next((v for k, v, _ in bullets if k == "Source"), "—")
        parts = next((s for k, _, s in bullets if k == "Parts"), None)
        history = [(k, v) for k, v, _ in bullets if k not in ("Source", "Status", "Parts", "Issue")]
        if parts:
            out += ["### Parts", ""] + [f"- [{'x' if '✅' in p else ' '}] {p}" for p in parts] + [""]
        out += ["### Source", "", source, ""]
        if history:
            out += ["### History", ""] + [f"- **{k}:** {v}" for k, v in history] + [""]
        lead = re.match(r"\*\*(.+?)\*\*", text).group(1)
        labels = ["open-point"]
        if key in SPIKES:
            labels.append("spike")
        if e["group"] == "Candidates":
            labels.append("candidate")
        if key in owner:
            labels.append("owner")
        items.append({
            "key": key, "kind": "open-point", "title": short_title(key, lead), "labels": labels,
            "milestone": None, "parent": e["group"] if e["group"] != "Candidates" else None, "blocked_by": [],
            "source": "docs/open-points.md", "body": "\n".join(out).rstrip() + "\n", "close": None, "close_comment": None,
            "fields": {"Status": "📌 Todo" if key in TODO else "⬜ Backlog"},
        })
    return items, also


def adrs():
    items = []
    for num, file, title, landed, started, finished, milestone in ADRS:
        open_ = num == "0024"
        landed_md = f"commit `{landed.split()[1].rstrip(',')}`, committed straight to main" if landed.startswith("commit") else landed
        body = f"Decision record: [ADR {num}]({BLOB}docs/decisions/{file})\n\nLanded in: {landed_md}\n"
        items.append({
            "key": f"ADR {num}", "kind": "adr", "title": f"ADR {num} {title}", "labels": ["adr"],
            "milestone": milestone, "parent": None, "blocked_by": [], "source": f"docs/decisions/{file}",
            "body": body, "close": None if open_ else "completed", "close_comment": None,
            "fields": {"Status": "🚧 In progress" if open_ else "✅ Done", "Started": started, "Finished": finished},
        })
    return items


def build(root):
    roadmap = (root / "docs/roadmap.md").read_text(encoding="utf-8")
    register = (root / "docs/open-points.md").read_text(encoding="utf-8")
    before = (HERE / "roadmap-before-split.md").read_text(encoding="utf-8")
    ops, also = open_points(register)
    phase_items, steps = phases(roadmap, before, also)
    return phase_items + ops + adrs() + steps


if __name__ == "__main__":
    items = build(pathlib.Path(sys.argv[1]))
    (HERE / "manifest.json").write_text(json.dumps(items, indent=2, ensure_ascii=False))
    kinds = {}
    for i in items:
        kinds[i["kind"]] = kinds.get(i["kind"], 0) + 1
    print(kinds)
```

- [x] **Step 6: Run the tests to see them pass**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/test_tracking.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: `OK`. If an assertion about the docs fails (for example a "Depends on" format that the regex misses), fix `parse.py`, not the test, unless the test contradicts the spec.

- [x] **Step 7: Judge the `owner` labels**

Read all 60 open entries in `docs/open-points.md`. An entry gets `owner` when only the owner can carry it out: an AWS, domain or GitHub setting, a manual check on the demo or in the UI, a purchase, a decision reserved to the owner. Write `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/owner.json` as a JSON list of keys, and `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/owner-reasons.md` with one line per key: `- OP-NNN: <reason>`. Re-run step 6 (still `OK`), then:

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/parse.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: `{'phase': 35, 'open-point': 60, 'adr': 18, 'owner-step': 18}` (the 17 historical ADRs and ADR 0024).

- [x] **Step 8: Write `create.py`**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/create.py`:

```python
"""Creates or updates the issues of manifest.json, idempotently (throwaway).

python3 create.py --only KEY [KEY ...]   or   python3 create.py --all
"""
import argparse
import json
import tempfile
from ghlib import gh, load_state, save_state, numbers, fields, render, HERE, REPO, OWNER, PROJECT, PROJECT_ID, ISSUE_URL

ap = argparse.ArgumentParser()
ap.add_argument("--only", nargs="*")
ap.add_argument("--all", action="store_true")
args = ap.parse_args()
items = json.loads((HERE / "manifest.json").read_text())
todo = items if args.all else [i for i in items if i["key"] in (args.only or [])]
state = load_state()
existing = gh("issue", "list", "--repo", REPO, "--state", "all", "--limit", "500", "--json", "number,title", json_out=True)


def body_file(text):
    f = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8")
    f.write(text)
    f.close()
    return f.name


def done(key, step):
    return step in state[key].setdefault("done", [])


def mark(key, step):
    state[key]["done"].append(step)
    save_state(state)


def option_id(field, value):
    """The option's ID by exact name, or by the name without its leading icon."""
    opts = field["options"]
    return opts.get(value) or opts[value.split(" ", 1)[1]]


# 1. Create the issues and add them to the project.
for it in todo:
    k = it["key"]
    if k not in state:
        # An exact title first. The prefix fallback (for a title the owner has edited) is never used
        # for an owner step, and a key's prefix never matches an owner-step title, so "PH-10 " cannot
        # match "PH-10 owner step 1: ...".
        match = [e["number"] for e in existing if e["title"] == it["title"]]
        if not match and it["kind"] != "owner-step":
            match = [e["number"] for e in existing if e["title"].startswith(k + " ") and " owner step " not in e["title"]]
        if match:
            state[k] = {"number": match[0], "item": None, "done": []}
        else:
            cmd = ["issue", "create", "--repo", REPO, "--title", it["title"],
                   "--body-file", body_file(render(it["body"], it["source"], numbers(state))),
                   "--label", ",".join(it["labels"])]
            if it["milestone"]:
                cmd += ["--milestone", it["milestone"]]
            url = gh(*cmd).strip().splitlines()[-1]
            state[k] = {"number": int(url.rsplit("/", 1)[1]), "item": None, "done": []}
        save_state(state)
        print("issue", k, state[k]["number"])
    if not state[k]["item"]:
        res = gh("project", "item-add", PROJECT, "--owner", OWNER, "--url", ISSUE_URL + str(state[k]["number"]), "--format", "json", json_out=True)
        state[k]["item"] = res["id"]
        save_state(state)

# 2. Relationships, once every issue of this run exists.
nums = numbers(state)
for it in todo:
    k, n = it["key"], str(state[it["key"]]["number"])
    if it["parent"] and it["parent"] in nums and not done(k, "parent"):
        gh("issue", "edit", n, "--repo", REPO, "--parent", str(nums[it["parent"]]))
        mark(k, "parent")
    for b in it["blocked_by"]:
        if b in nums and not done(k, "blocked:" + b):
            gh("issue", "edit", n, "--repo", REPO, "--add-blocked-by", str(nums[b]))
            mark(k, "blocked:" + b)

# 3. Close what is done or dropped.
for it in todo:
    k, n = it["key"], str(state[it["key"]]["number"])
    if it["close"] and not done(k, "closed"):
        cmd = ["issue", "close", n, "--repo", REPO, "--reason", it["close"]]
        if it["close_comment"]:
            comment = it["close_comment"]
            for key, num in nums.items():
                comment = comment.replace("{" + key + "}", f"#{num}")
            cmd += ["--comment", render(comment, "docs/roadmap.md", nums)]
        gh(*cmd)
        mark(k, "closed")

# 4. Fields last, so a workflow reacting to a close cannot overwrite the Status.
fs = fields()
for it in todo:
    k = it["key"]
    for name, value in it["fields"].items():
        if value is None:
            continue
        f = fs[name]
        cmd = ["project", "item-edit", "--id", state[k]["item"], "--project-id", PROJECT_ID, "--field-id", f["id"]]
        if f["options"]:
            cmd += ["--single-select-option-id", option_id(f, value)]
        elif name == "Order":
            cmd += ["--number", str(value)]
        elif name in ("Started", "Finished"):
            cmd += ["--date", value]
        else:
            cmd += ["--text", value]
        gh(*cmd, pause=0.5)
    print("fields", k)
```

- [x] **Step 9: Run the pilot, twice**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/create.py --only "ADR 0024" PH-06b OP-053 OP-067`
Expected: four `issue …` lines and four `fields …` lines.

Run the same command again.
Expected: no `issue …` lines (nothing new created), four `fields …` lines. Then `gh issue list --repo luiki-dev/szop --state all` shows exactly four issues.

- [x] **Step 10: Verify the pilot on GitHub**

Run: `gh issue view <PH-06b's number> --repo luiki-dev/szop` and the same for OP-053, OP-067 and ADR 0024.
Expected: titles, labels and milestone as in the spec; PH-06b shows OP-053 and OP-067 as sub-issues; links in the bodies are absolute; OP-053 has a Parts checklist and a History line; the project shows PH-06b, OP-053 and OP-067 as `📌 Todo` with Order 80 on PH-06b, and ADR 0024 as `🚧 In progress`.

- [x] **Step 11: Stop for the owner**

Report the four issue links, `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/owner-reasons.md` (the proposed `owner` labels) and the count of issues the bulk run will create (phases 34, open points 58, `adr` 17, owner steps 18). Wait for the owner's go or changes. Apply any change to `parse.py` or `owner.json` and re-run steps 6 and 7; Task 4's `relink.py` then brings the pilot's bodies up to date, and its `create.py --all` adds any new label (re-run `gh issue edit <n> --add-label owner` by hand for a pilot issue that gains one).

---

### Task 4: Bulk creation

No repository files change; the PR description records this task.

**Interfaces:**
- Consumes: `manifest.json`, `issues.json`, `create.py`, `ghlib.py`.
- Produces: all issues except OP-086; `relink.py`.

- [x] **Step 1: Create everything**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/create.py --all`
Expected: 127 `issue …` lines (34 phases, 58 open points, 17 `adr`, 18 owner steps), then `fields …` for all 131 items. It takes several minutes. If it stops with an error, read it, fix the cause, and run the same command again: it continues where it stopped.

- [x] **Step 2: Write `relink.py`**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/relink.py`:

```python
"""Re-renders every body with all issue numbers known, and updates the changed ones (throwaway)."""
import json
import tempfile
from ghlib import gh, load_state, numbers, render, HERE, REPO

items = json.loads((HERE / "manifest.json").read_text())
state = load_state()
nums = numbers(state)
for it in items:
    if it["key"] not in state:
        continue
    n = str(state[it["key"]]["number"])
    want = render(it["body"], it["source"], nums)
    have = gh("issue", "view", n, "--repo", REPO, "--json", "body", json_out=True, pause=0.2)["body"]
    if have.strip() == want.strip():
        continue
    f = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8")
    f.write(want)
    f.close()
    gh("issue", "edit", n, "--repo", REPO, "--body-file", f.name)
    print("relinked", it["key"], n)
```

- [x] **Step 3: Relink**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/relink.py`
Expected: `relinked …` lines, among them the pilot's four. Run it again: no output.

- [x] **Step 4: Close the finished milestones**

Run: `gh api repos/luiki-dev/szop/milestones?state=all` and note the numbers of `Definition` and `Stage 1: Local foundations`. Then, for each: `gh api -X PATCH repos/luiki-dev/szop/milestones/<number> -f state=closed`

- [x] **Step 5: Spot-check**

Run: `gh issue view <PH-06's number> --repo luiki-dev/szop --comments`
Expected: closed as not planned, with the comment linking PH-06a and PH-06b by number; the project shows `✖️ Dropped`.

Run: `gh issue view <PH-16's number> --repo luiki-dev/szop`
Expected: OP-038 among its blockers; its open points as sub-issues.

Run: `gh issue list --repo luiki-dev/szop --label open-point --state all --limit 200` and `--label phase`, `--label adr`
Expected: 60, 35 and 18 issues.

Run: `gh issue list --repo luiki-dev/szop --label owner --state all --limit 200`
Expected: 23 issues (5 open points and 18 owner steps).

Run: `gh issue view <PH-10's number> --repo luiki-dev/szop`
Expected: its three owner steps as sub-issues (`PH-10 owner step 1: Choose the name and buy the domain` among them), and its **Owner steps** section listing them as `#N` references.

---

### Task 5: Guide and process files

**Files:**
- Create: `docs/development/project-tracking.md`
- Create: `.github/ISSUE_TEMPLATE/phase.yml`, `.github/ISSUE_TEMPLATE/open-point.yml`, `.github/ISSUE_TEMPLATE/adr.yml`, `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `.github/pull_request_template.md`, `docs/development/definition-of-done.md`, `docs/development/git-workflow.md`, `docs/development/phase-walkthrough.md`, `docs/development/github-settings.md`, `docs/architecture/stack-overview.md`, `CLAUDE.md`, `README.md` (Documentation list)

**Interfaces:**
- Consumes: ADR 0024's file name (Task 1); the project URL `https://github.com/users/luiki-dev/projects/3`.
- Produces: the guide's anchors used by later links: `project-tracking.md#the-trial-rule`, `#setting-up-the-project`, `#how-items-move`.

- [x] **Step 1: Write the guide**

Create `docs/development/project-tracking.md` with exactly:

````markdown
# Project tracking

How Szop's work is tracked on GitHub: the roadmap's phases, the open points and the decision work as issues, the stages as milestones, and all of them on the [Szop project](https://github.com/users/luiki-dev/projects/3). The decisions are in [ADR 0024](../decisions/0024-github-project-tracking.md). For now this is a **trial**: the [roadmap](../roadmap.md) and the [open points register](../open-points.md) stay the source of truth, and [OP-086](../open-points.md#op-086) decides after PH-06b and PH-07 whether GitHub becomes the only tracker.

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

## The trial rule

For PH-06b and PH-07, until [OP-086](../open-points.md#op-086) is settled:

- **The docs are the source of truth.** A PR that changes a roadmap entry, a stage table row or an open point also updates its issue during the same working session. The GitHub change is live at once, before the merge, and the PR's description lists it.
- **Status is kept in both:** the stage tables and the register's status lines as before, and the project's finer Status.
- **Bodies are copies.** When an entry's text changes, its issue body is edited to match.

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
````

- [x] **Step 2: Write the issue forms**

Create `.github/ISSUE_TEMPLATE/phase.yml`:

```yaml
name: Phase
description: A roadmap phase, mirroring its entry in docs/roadmap.md
title: "PH-"
labels: [phase]
body:
  - type: input
    id: entry
    attributes:
      label: Roadmap entry
      description: Link to the phase's entry in docs/roadmap.md
    validations:
      required: true
  - type: textarea
    id: goal
    attributes:
      label: Goal
    validations:
      required: true
  - type: textarea
    id: delivers
    attributes:
      label: Delivers
  - type: textarea
    id: depends-on
    attributes:
      label: Depends on
      value: "—"
  - type: textarea
    id: owner-steps
    attributes:
      label: Owner steps
      description: One line per step (each becomes an owner-step issue, see the guide), or "None."
      value: "- "
  - type: dropdown
    id: path
    attributes:
      label: Expected path
      options:
        - Full
        - Bounded
  - type: textarea
    id: also
    attributes:
      label: Also
      description: Open points of other phases this phase does a part of, as issue references
      value: "—"
```

Create `.github/ISSUE_TEMPLATE/open-point.yml`:

```yaml
name: Open point
description: An entry of the open points register, mirroring docs/open-points.md
title: "OP-"
labels: [open-point]
body:
  - type: input
    id: entry
    attributes:
      label: Register entry
      description: Link to the entry in docs/open-points.md
    validations:
      required: true
  - type: textarea
    id: what
    attributes:
      label: What is open
      description: The entry's text, its bold lead first
    validations:
      required: true
  - type: textarea
    id: parts
    attributes:
      label: Parts
      description: One checkbox per phase's part, or leave empty
  - type: textarea
    id: source
    attributes:
      label: Source
    validations:
      required: true
```

Create `.github/ISSUE_TEMPLATE/adr.yml`:

```yaml
name: ADR
description: Decision work outside a phase, whose result is one ADR
title: "ADR "
labels: [adr]
body:
  - type: input
    id: record
    attributes:
      label: Decision record
      description: Link to the ADR in docs/decisions/
    validations:
      required: true
  - type: input
    id: landed
    attributes:
      label: Landed in
      description: The PR that adds the ADR
```

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: true
```

- [x] **Step 3: Update the PR template**

In `.github/pull_request_template.md`:
- After the line `- Open points (closed, re-assigned or added):` add this line:

  ```markdown
  - Issues closed (`Closes #N`, one per line):
  ```
- Replace `roadmap status (Claude)` with `roadmap status and the issues (Claude)`
- Replace ``Open points closed, re-assigned or added in `docs/open-points.md` (Claude)`` with ``Open points closed, re-assigned or added in `docs/open-points.md` and their issues (Claude)``

- [x] **Step 4: Update the definition of done**

In `docs/development/definition-of-done.md`, table rows 6 and 9:
- Item 6, *What it means*: replace `the functional requirements when behavior changed; the roadmap status.` with `the functional requirements when behavior changed; the roadmap status, and during the GitHub tracking trial the phase's issue and its project fields.` *Source*: append `; ADR 0024, decision 14`.
- Item 9, *What it means*: replace `are closed or re-assigned with a reason, and anything newly deferred is added.` with `are closed or re-assigned with a reason, and anything newly deferred is added; during the GitHub tracking trial their issues are closed, re-parented or created to match.` *Source*: append `; ADR 0024, decision 14`.

- [x] **Step 5: Update the git workflow guide and the walkthrough**

In `docs/development/git-workflow.md`, section "3. Open a pull request", after the bullet starting `- **The description follows the PR template**`, add:

```markdown
- **The description closes the PR's issues** with `Closes #N`, one per line: a phase's issue, each open point it settles and, for an ADR made outside a phase, its `adr` issue. The merge closes them, and the project marks them ✅ Done ([project tracking](project-tracking.md)).
```

In `docs/development/phase-walkthrough.md`:
- Step 1, after the bullet starting `- A small, well-scoped phase may skip`, add: `- When the brainstorm starts, the phase's issue moves to 🚧 In progress with its Started date, and the spec and plan links go into its Spec and Plan fields as they are committed ([project tracking](project-tracking.md#how-items-move)).`
- Step 4, after the bullet starting `- Claude reviews its own diff first`, add:

  ```markdown
  - The description closes the phase's issue and each open point it settles with `Closes #N`.
  ```

- Step 9, before the line `Locally, afterwards:`, add this paragraph and an empty line:

  ```markdown
  The merge also closes the issues named with `Closes #N`, and the project sets them to ✅ Done.
  ```
- "Where each thing lives", after the row starting `| Spec / plan |`, add:

```markdown
| Phase issue | GitHub Issues, on the Szop project | `PH-12 First deploy`, label `phase` |
| Open-point issue | GitHub Issues, a sub-issue of its phase | `OP-053 Build the app-wide web baseline`, label `open-point` |
```

- [x] **Step 6: Update the GitHub settings page**

In `docs/development/github-settings.md`:
- Contents: after `- [Features](#features)` add `- [Labels](#labels)`, `- [Milestones](#milestones)` and `- [Project](#project)`, one per line.
- "Order of applying": insert a new item before `4. Check the result`, and renumber that item to 5:
  `4. The labels, milestones and project, with [ADR 0024](../decisions/0024-github-project-tracking.md): see [Labels](#labels), [Milestones](#milestones) and [Project](#project).`
- Replace the "Features" section's paragraph with:

```markdown
*Settings → General* → section **Features**. Nothing is changed. **Issues** are used: since [ADR 0024](../decisions/0024-github-project-tracking.md) they track the phases, open points and decision work, next to the [roadmap](../roadmap.md), in a trial. **Projects** stays on; the project itself belongs to the owner's account (see [Project](#project)).
```

- After the "Features" section, before "Checking the settings", add:

```markdown
## Labels

*Issues → Labels.* Only `phase`, `open-point`, `spike`, `candidate`, `owner` and `adr`; GitHub's default labels are deleted. Dependabot creates its own labels when it opens its first PR. What each label means is in [project tracking](project-tracking.md#labels). ADR 0024, decision 6.

## Milestones

*Issues → Milestones.* One per roadmap stage, `Stage 1: Local foundations` to `Stage 5: Later`, and `Definition` for the decision work before PH-01; no due dates. ADR 0024, decision 4.

## Project

The [Szop project](https://github.com/users/luiki-dev/projects/3), owned by the `luiki-dev` account, not the repository.

| Setting | Value | Why |
|---|---|---|
| **Visibility** | Public | The README and the roadmap link it. ADR 0024, decision 13. |
| **Fields** | Status (six options), Order, Path, Spec, Plan, Started, Finished | See [project tracking](project-tracking.md#fields). ADR 0024, decisions 7 and 8. |
| **Workflows** | Item added → ⬜ Backlog; Item closed → ✅ Done; Item reopened → 📌 Todo; auto-add `is:issue label:phase,open-point,adr,owner` | See [project tracking](project-tracking.md#workflows). |
| **Views** | Board, Roadmap, Open points, Next up, Timeline | See [project tracking](project-tracking.md#views). |
```

- In "Checking the settings", at the end of its first code block, add:

```bash
# Labels, milestones and the project
gh label list --repo luiki-dev/szop
gh api "repos/luiki-dev/szop/milestones?state=all"
gh project view 3 --owner luiki-dev
```

- [x] **Step 7: Add the stack overview section**

In `docs/architecture/stack-overview.md`, add to Contents: `- [18. Tracking the work: issues, milestones and projects](#18-tracking-the-work-issues-milestones-and-projects)`, and append the section at the end of the file:

```markdown
## 18. Tracking the work: issues, milestones and projects

Most teams plan on the same site that holds their code. On GitHub that means three pieces, which Szop uses next to its roadmap ([ADR 0024](../decisions/0024-github-project-tracking.md); the day-to-day guide is [project tracking](../development/project-tracking.md)):

- **An issue** is one piece of work with a number, a title, a body, labels and a state, open or closed. Closing records why: *completed* or *not planned*. A pull request whose description says `Closes #12` closes issue 12 when it is merged, which ties the work to the change that did it.
- **Issues relate to each other.** A **sub-issue** sits under a parent, which shows how many of its children are closed; an issue can be **blocked by** another; and any mention of `#12` leaves a note on issue 12. Szop puts each open point under the phase that settles it, and lets a spike block its phase.
- **A milestone** groups issues towards one goal and shows a progress bar. Szop's milestones are its roadmap stages.
- **A project** collects issues into one table with custom fields, such as a status or a position, and shows them as **views**: a table, a **board** of columns (a kanban board, from the Japanese for "signboard", where cards move from column to column as work progresses) or a **roadmap**, a timeline drawn from date fields. Built-in **workflows** update the fields on events, such as setting the status to done when an issue closes.
```

- [x] **Step 8: Update `CLAUDE.md` and the README's documentation list**

In `CLAUDE.md`, section "Documentation":
- After the bullet for `docs/open-points.md`, add: ``- `docs/development/project-tracking.md` — how the phases, open points and decision work are tracked as GitHub issues on the Szop project: labels, milestones, fields, statuses, how items move. During the trial ([ADR 0024](docs/decisions/0024-github-project-tracking.md)), a change to a roadmap entry or an open point also updates its issue in the same working session.``

In `README.md`, section "Documentation", after the `Open points` bullet, add: `- [Project tracking](docs/development/project-tracking.md) — how the phases, open points and decisions are tracked as GitHub issues and on the [project board](https://github.com/users/luiki-dev/projects/3)`

- [x] **Step 9: Check**

Run: `pnpm exec prettier --check .github/ISSUE_TEMPLATE docs/development docs/architecture/stack-overview.md README.md CLAUDE.md .github/pull_request_template.md`
Expected: `All matched files use Prettier code style!` If the YAML files are reported, run `pnpm exec prettier --write .github/ISSUE_TEMPLATE` and re-check.

Read each form against GitHub's issue form schema (top-level `name`, `description`, `body`; each element `type` among `input`, `textarea`, `dropdown`, `markdown`, `checkboxes`; `id` unique; `options` only on `dropdown`). They load only from `main`, so *New issue* shows them only after the merge.

Run: `grep -n "\](#" docs/development/project-tracking.md` and compare each anchor with a heading of the file.
Expected: every anchor matches a heading (`#what-lives-where`, `#milestones`, … `#checking-with-gh`).

- [x] **Step 10: Commit**

```bash
git add docs/development/project-tracking.md .github/ISSUE_TEMPLATE .github/pull_request_template.md docs/development/definition-of-done.md docs/development/git-workflow.md docs/development/phase-walkthrough.md docs/development/github-settings.md docs/architecture/stack-overview.md CLAUDE.md README.md
git commit -F /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task5.txt
```

with `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task5.txt`:

```
docs: add the project tracking guide and issue forms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpJBovDkQJo6jkinUn2nia
```

---

### Task 6: Links in the docs, and OP-086

**Files:**
- Modify: `docs/open-points.md` (OP-086 at the end of the PH-08 group; an Issue line in every open entry; a "How it works" bullet)
- Modify: `docs/roadmap.md` (an Issue column in the five stage tables and the Candidates table; a "How it works" bullet)
- Modify: `README.md` (a line under the diagram)

**Interfaces:**
- Consumes: `issues.json`, `parse.py`, `create.py`, `relink.py`.
- Produces: `link_docs.py`; OP-086's issue.

- [x] **Step 1: Add OP-086 to the register**

In `docs/open-points.md`, at the end of the `### PH-08 Container image` group (just before `## Stage 3: Walking skeleton, deployed and released`), add:

```markdown
#### OP-086

**Decide how the GitHub tracking trial ends.** After PH-06b and PH-07, decide whether GitHub Issues and the Szop project become the only tracker, and what `roadmap.md` and `open-points.md` keep: the phase entries, the stage tables, the README's diagram ([ADR 0017](decisions/0017-readme-roadmap-diagram.md)) and the register's entries. Look back at how often the two sides drifted, and which views were used.

- **Source:** [ADR 0024](decisions/0024-github-project-tracking.md), decision 2
- **Status:** ⬜ Open
```

- [x] **Step 2: Create OP-086's issue**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/parse.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: `{'phase': 35, 'open-point': 61, 'adr': 18, 'owner-step': 18}`.

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/create.py --only OP-086`
Expected: one `issue OP-086 <n>` line; the issue is a sub-issue of PH-08 with Status `⬜ Backlog`.

- [x] **Step 3: Write `link_docs.py`**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/link_docs.py`:

```python
"""Adds the Issue column to the roadmap's tables and an Issue line to each open entry (throwaway)."""
import re
import sys
import pathlib
from ghlib import load_state, numbers, ISSUE_URL

root = pathlib.Path(sys.argv[1])
nums = numbers(load_state())


def link(key):
    return f"[#{nums[key]}]({ISSUE_URL}{nums[key]})"


# roadmap.md
path = root / "docs/roadmap.md"
lines = path.read_text(encoding="utf-8").split("\n")
out, expect_sep = [], False
for line in lines:
    if line == "| Phase | Status | Spec | Plan | PR |":
        out.append("| Phase | Status | Spec | Plan | PR | Issue |"); expect_sep = True; continue
    if line == "| Candidate | What it would bring | Open point |":
        out.append("| Candidate | What it would bring | Open point | Issue |"); expect_sep = True; continue
    if expect_sep and re.fullmatch(r"(\|---)+\|", line):
        out.append(line + "---|"); expect_sep = False; continue
    m = re.match(r"^\| \[(PH-\d+[ab]?) ", line)
    if m:
        out.append(f"{line} {link(m.group(1))} |"); continue
    m = re.match(r"^\| [^|]+ \| [^|]+ \| \[(OP-\d+)\]\(open-points\.md#op-\d+\) \|$", line)
    if m:
        out.append(f"{line} {link(m.group(1))} |"); continue
    out.append(line)
path.write_text("\n".join(out), encoding="utf-8")

# open-points.md
path = root / "docs/open-points.md"
text = path.read_text(encoding="utf-8")
head, sep, closed = text.partition("\n## Closed")
lines, out, cur = head.split("\n"), [], None
for line in lines:
    m = re.match(r"^#### (OP-\d+)$", line)
    if m:
        cur = m.group(1)
    if cur and line.startswith("- **Status:**"):
        out.append(f"- **Issue:** {link(cur)}")
        cur = None
    out.append(line)
path.write_text("\n".join(out) + sep + closed, encoding="utf-8")
print("linked")
```

- [x] **Step 4: Run it**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/link_docs.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: `linked`. Then `git diff --stat` shows only `docs/roadmap.md` and `docs/open-points.md` changed (besides step 1's OP-086).

Run: `grep -c "^- \*\*Issue:\*\*" docs/open-points.md`
Expected: `61`.

Run: `grep -c "| \[#[0-9]*\](https://github.com/luiki-dev/szop/issues/[0-9]*) |$" docs/roadmap.md`
Expected: `38` (34 phase rows and 4 candidate rows).

- [x] **Step 5: Add the "How it works" bullets and the README line**

In `docs/roadmap.md`, "How it works", after the bullet starting `- **Not on the roadmap:**`, add:

```markdown
- **On GitHub** ([ADR 0024](decisions/0024-github-project-tracking.md)): each phase, each open point and each ADR made outside a phase is also an issue on the [Szop project](https://github.com/users/luiki-dev/projects/3), and the stage tables link each phase's issue. During the trial ([OP-086](open-points.md#op-086)) this page stays the source: a change to an entry updates its issue in the same working session, as [project tracking](development/project-tracking.md#the-trial-rule) describes.
```

In `docs/open-points.md`, "How it works", after the bullet starting `- **Closing:**`, add:

```markdown
- **Each open entry has an issue** on GitHub ([ADR 0024](decisions/0024-github-project-tracking.md)), named on its **Issue** line: a sub-issue of its phase's issue, on the [Szop project](https://github.com/users/luiki-dev/projects/3). During the trial ([OP-086](#op-086)) this page stays the source; adding, moving or closing an entry updates its issue too ([project tracking](development/project-tracking.md#how-items-move)).
```

In `README.md`, section "Roadmap", after the closing fence of the diagram, add an empty line and:

```markdown
The [project board](https://github.com/users/luiki-dev/projects/3) shows the same phases as GitHub issues, with their open points and what comes next.
```

- [x] **Step 6: Relink the issue bodies**

The register entries did not change except for their new Issue lines, which `parse.py` ignores. Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/relink.py`
Expected: no output, or only OP-086's neighbours if a body referenced it.

- [x] **Step 7: Check and commit**

Run: `pnpm exec prettier --check docs/roadmap.md docs/open-points.md README.md`
Expected: all files pass.

```bash
git add docs/roadmap.md docs/open-points.md README.md
git commit -F /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task6.txt
```

with `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/msg-task6.txt`:

```
docs: link the roadmap and open points to their GitHub issues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpJBovDkQJo6jkinUn2nia
```

---

### Task 6b: GitHub as the source of truth (amendment)

Added on 2026-10-10 at the owner's request: the trial's source of truth is reversed. Brief: the SDD workspace's `task-6b-brief.md`.

- [x] **Step 1:** ADR 0024, decisions 1, 2, 11 and 14, and a Consequences bullet
- [x] **Step 2:** the spec, with an amendment note
- [x] **Step 3:** the guide's intro, trial rule and "How items move"
- [x] **Step 4:** the "How it works" bullets, OP-086's text in the register and on issue #156 (relink.py is not run any more: it would overwrite edits made on GitHub)
- [x] **Step 5:** `CLAUDE.md` and the definition of done, items 6 and 9
- [x] **Step 6:** this record

---

### Task 7: Verification, review and the PR

**Files:**
- Create: `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/check.py`, `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/issues.graphql` (not committed)

**Interfaces:**
- Consumes: `manifest.json`, `issues.json`, the docs.

- [x] **Step 1: Write the check**

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/issues.graphql`:

```graphql
query ($cursor: String) {
  repository(owner: "luiki-dev", name: "szop") {
    issues(first: 50, after: $cursor, states: [OPEN, CLOSED]) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        stateReason
        milestone { title }
        labels(first: 10) { nodes { name } }
        parent { number }
        blockedBy(first: 10) { nodes { number } }
        projectItems(first: 5) {
          nodes {
            project { number }
            status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
          }
        }
      }
    }
  }
}
```

Create `/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/check.py`:

```python
"""Compares the manifest, issues.json, GitHub and the docs; prints every mismatch (throwaway)."""
import json
import re
import sys
import pathlib
from ghlib import gh, load_state, numbers, HERE

root = pathlib.Path(sys.argv[1])
items = json.loads((HERE / "manifest.json").read_text())
nums = numbers(load_state())
problems = []

nodes, cursor = [], None
while True:
    args = ["api", "graphql", "-F", f"query=@{HERE / 'issues.graphql'}"]
    if cursor:
        args += ["-f", f"cursor={cursor}"]
    page = gh(*args, json_out=True, pause=0)["data"]["repository"]["issues"]
    nodes += page["nodes"]
    if not page["pageInfo"]["hasNextPage"]:
        break
    cursor = page["pageInfo"]["endCursor"]
by_number = {n["number"]: n for n in nodes}

kinds = {}
for it in items:
    kinds[it["kind"]] = kinds.get(it["kind"], 0) + 1
if kinds != {"phase": 35, "open-point": 61, "adr": 18, "owner-step": 18}:
    problems.append(f"manifest counts {kinds}")
if len(nodes) != 132:
    problems.append(f"{len(nodes)} issues on GitHub, expected 132")

for it in items:
    k = it["key"]
    if k not in nums:
        problems.append(f"{k}: no issue"); continue
    n = by_number.get(nums[k])
    if not n:
        problems.append(f"{k}: #{nums[k]} not found"); continue
    if not n["title"].startswith(k + (": " if it["kind"] == "owner-step" else " ")):
        problems.append(f"{k}: title {n['title']!r}")
    if sorted(l["name"] for l in n["labels"]["nodes"]) != sorted(it["labels"]):
        problems.append(f"{k}: labels {n['labels']['nodes']}")
    if (n["milestone"] or {}).get("title") != it["milestone"]:
        problems.append(f"{k}: milestone {n['milestone']}")
    want_parent = nums.get(it["parent"]) if it["parent"] else None
    if (n["parent"] or {}).get("number") != want_parent:
        problems.append(f"{k}: parent {n['parent']}, expected #{want_parent}")
    blockers = sorted(b["number"] for b in n["blockedBy"]["nodes"])
    if blockers != sorted(nums[b] for b in it["blocked_by"]):
        problems.append(f"{k}: blocked by {blockers}")
    want_state = {"completed": ("CLOSED", "COMPLETED"), "not planned": ("CLOSED", "NOT_PLANNED")}.get(it["close"], ("OPEN", None))
    if (n["state"], n["stateReason"] if n["state"] == "CLOSED" else None) != want_state:
        problems.append(f"{k}: state {n['state']} {n['stateReason']}")
    proj = [p for p in n["projectItems"]["nodes"] if p["project"]["number"] == 3]
    if not proj:
        problems.append(f"{k}: not on the project")
    elif (proj[0]["status"] or {}).get("name") != it["fields"]["Status"]:
        problems.append(f"{k}: status {proj[0]['status']}, expected {it['fields']['Status']}")

roadmap = (root / "docs/roadmap.md").read_text(encoding="utf-8")
for m in re.finditer(r"^\| \[(PH-\d+[ab]?) .*\| \[#(\d+)\]\(https://github\.com/luiki-dev/szop/issues/(\d+)\) \|$", roadmap, re.M):
    if int(m.group(2)) != nums.get(m.group(1)) or m.group(2) != m.group(3):
        problems.append(f"roadmap row {m.group(1)} links #{m.group(2)}")
rows = len(re.findall(r"^\| \[PH-\d+[ab]? ", roadmap, re.M))
if rows != 34:
    problems.append(f"{rows} phase rows in roadmap.md, expected 34")
register = (root / "docs/open-points.md").read_text(encoding="utf-8").split("\n## Closed")[0]
for m in re.finditer(r"^#### (OP-\d+)\n(.*?)^- \*\*Issue:\*\* \[#(\d+)\]\(https://github\.com/luiki-dev/szop/issues/(\d+)\)$", register, re.M | re.S):
    if int(m.group(3)) != nums.get(m.group(1)) or m.group(3) != m.group(4):
        problems.append(f"register {m.group(1)} links #{m.group(3)}")
if len(re.findall(r"^- \*\*Issue:\*\*", register, re.M)) != 61:
    problems.append("not 61 Issue lines in the register")

print("\n".join(problems) if problems else "no mismatch")
```

- [x] **Step 2: Run the check**

Run: `python3 /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/check.py /home/lemekk/workspace/szop/.claude/worktrees/adr-0024-github-project-tracking`
Expected: `no mismatch`. Fix every mismatch at its cause (a manifest rule, a missed `gh` call) and run it again. If GraphQL reports that a field does not exist (`blockedBy`, `parent`), look it up with `gh api graphql -f query='{ __type(name: "Issue") { fields { name } } }'` and adjust the query.

- [x] **Step 3: Walk the definition of done and review the diff**

Run: `git diff main --stat` and read `git diff main` in full. Check each changed doc against the spec's "Documentation and records", the writing style rules in `CLAUDE.md` (acronyms, icons, linked requirements, Contents in sync) and that no relative link points to a missing file or heading.

Run: `pnpm lint` and `pnpm format:check`
Expected: both pass.

- [ ] **Step 4: Push and open the PR**

```bash
git push
gh pr create --repo luiki-dev/szop --base main --title "docs(adr): add ADR 0024 and track work in GitHub Projects" --body-file /home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/pr-body.md
```

`/home/lemekk/.claude/jobs/a874b5ec/tmp/tracking/pr-body.md` follows `.github/pull_request_template.md` as updated in Task 5: *What and why* (the trial, the 132 issues, the public project); *Links* (Roadmap phase: none, work outside phases; Spec and Plan; ADRs: 0024, with notes in 0009, 0011 and 0014; Open points: OP-086 added; Issues closed: `Closes #<ADR 0024's number>`); a section **GitHub changes made from this branch**: the labels, milestones, project settings and fields, test issue #24 and the test milestone deleted, the 131 issues created before this PR and OP-086's; *How it was tested*: `test_tracking.py`, `check.py` reporting no mismatch, the pilot reviewed by the owner; the definition of done with ➖ N/A reasons (tests: no code; mutants: no domain rules; demo: no image or infrastructure change; `infra/base`: no change; UI: none); and **Owner steps left**: the workflows, the five views, *Relates to* on PH-06, the label colors, checking the issue forms after the merge. End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XpJBovDkQJo6jkinUn2nia
```

- [ ] **Step 5: Report**

Tell the owner the PR link, the project link, the check's result and the owner steps left. Do not merge.
