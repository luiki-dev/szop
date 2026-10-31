# Session skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three project skills, `/handoff`, `/finish-phase` and `/demo-check`, make handing a stage to a new session, finishing a branch with one triage of the review findings, and the demo check work the same way every time.

**Architecture:** Markdown only: three `SKILL.md` files in `.claude/skills/<name>/`, in the shape of `/phase-tracking` and `/new-adr` (a frontmatter `name` and `description` naming when to run it, then the steps, pointing to the documents that hold the rules instead of repeating them); the findings list as a rule in `docs/superpowers/plans/CLAUDE.md`; `CLAUDE.md`, the guides and two earlier ADRs pointed to the skills.

**Tech Stack:** Markdown; Claude Code project skills; `gh`; Chrome DevTools MCP and the Lighthouse command-line tool (run by `/demo-check`, nothing installed in the repository).

**Spec:** [`docs/superpowers/specs/2026-10-31-session-skills-design.md`](../specs/2026-10-31-session-skills-design.md), with the decisions in [ADR 0059](../../decisions/0059-session-skills.md).

**Before your task:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md). It holds the repo-wide rules every task follows (git, commits and trailers, docs style, after each task).

## Order of work

1. [Task 1: The /handoff skill](#task-1-the-handoff-skill)
2. [Task 2: The findings list and the execution rules](#task-2-the-findings-list-and-the-execution-rules)
3. [Task 3: The /finish-phase skill](#task-3-the-finish-phase-skill)
4. [Task 4: The /demo-check skill](#task-4-the-demo-check-skill)
5. [Task 5: CLAUDE.md, the guides and the ADR notes](#task-5-claudemd-the-guides-and-the-adr-notes)
6. [Task 6: Review /finish-phase and /demo-check against the spec](#task-6-review-finish-phase-and-demo-check-against-the-spec)

## Global Constraints

- **Branch:** `chore/adr-0059-session-skills`, made outside a phase. Its `adr` issue is [#326](https://github.com/luiki-dev/szop/issues/326); the PR closes it and is labelled `skip-changelog`. An `adr` issue has no Plan field, so nothing is set on GitHub for this plan.
- **Commit scopes:** `claude` (`.claude/`, `CLAUDE.md`, `docs/superpowers/plans/CLAUDE.md`), `adr`, `plan`; the guides take no scope (`docs: …`).
- **Every numbered step of the spec's [The design](../specs/2026-10-31-session-skills-design.md#the-design) survives in its skill**, in that order; the wording is the builder's ([Left to the builder](../specs/2026-10-31-session-skills-design.md#left-to-the-builder)). A step marked _(Claude's call)_ in the spec is kept as written.
- **Skills point, they do not restate:** the demo check's list stays in [the definition of done](../../development/definition-of-done.md#the-demo-check), the tracking steps in `/phase-tracking`, the PR's items in `.github/pull_request_template.md`.
- **Severities:** a review finding is Critical, Important or Minor (the reviewer's words); in the triage message they show as 🔴 Critical, 🟠 Important, ⚪ Minor.
- **Nothing is added to the repository for Lighthouse:** no dependency, no script. `/demo-check` runs a one-off `npx` with a pinned version and saves the report in the scratchpad.
- **No skill merges, triggers `demo-up` or `demo-down`, force-pushes or removes a worktree.**
- **The criteria and the docs to update** are in the spec: [Acceptance criteria](../specs/2026-10-31-session-skills-design.md#acceptance-criteria) (none) and [Documentation](../specs/2026-10-31-session-skills-design.md#documentation).

## Review Focus

1. **A handoff written with an uncommitted edit in the tree.** Expected: `/handoff` commits it (as work in progress if half done) and pushes before writing the file; the file never names a head that is not pushed. Task 1, Step 2 checklist.
2. **A resume where the handoff file's head differs from `git log -1`, or the checkout is on another branch or dirty.** Expected: the session stops, says what the file and git each say, and waits; it never switches branches. Task 1, Step 4 (the owner's by-hand test).
3. **A branch name with `/`** (`feat/ph-16a-guests-first-list`). Expected: the file is `.superpowers/handoff/feat-ph-16a-guests-first-list.md`, and resume finds it from the branch given with `/`. Task 1, Step 2 checklist.
4. **`/finish-phase` on a branch outside a phase, or with no ledger.** Expected: the _phase only_ steps (declined findings in the phase ADR, token usage) are skipped, and the whole-branch review's findings go straight to the triage. Task 3, Step 2 checklist.
5. **A finding marked fixed in the list but still in the code.** Expected: the merge step checks the code and keeps it in the triage; only a fix confirmed in the code drops it. Task 3, Step 2 checklist.

---

### Task 1: The /handoff skill

**Files:**
- Create: `.claude/skills/handoff/SKILL.md`

**Interfaces:**
- Produces: the skill `/handoff` (no arguments: write; `resume <branch>`: resume) and the file `.superpowers/handoff/<branch with / replaced by ->.md` with the six sections of the spec, in its order: **Stage and next step**, **Branch and head**, **Read first**, **Decided in the conversation**, **Waiting on the owner**, **Rules for this stage**. Task 5 names these in the guides.

- [x] **Step 1: Write `.claude/skills/handoff/SKILL.md`**

Frontmatter `name: handoff` and a `description` saying: run by the owner to hand a stage over to a new session (writing), or as the first message of a new session with `resume <branch>`; Claude may suggest it at the end of a stage or at about 150–200k of context but does not start it (ADR 0059, decision 2). Then two sections, "Writing" and "Resuming", with every step of spec, [/handoff](../specs/2026-10-31-session-skills-design.md#handoff). The file's template goes inline in the skill as a fenced block with the six headings; no supporting file. The cloud signal: the owner's word, or an environment variable Claude Code sets in a cloud session (check Claude Code's docs for its name, such as `CLAUDE_CODE_REMOTE`; if none is documented, the owner's word only, noted in ADR 0059's "Settled while building" in this task's commit).

- [x] **Step 2: Check the skill against the spec**

Read the spec's /handoff section next to the skill. Checklist, each yes:
- the work is committed (work in progress allowed) and pushed before the file is written; the execution ledger is current;
- the path replaces `/` with `-` and overwrites;
- the six sections, in order; empty "Decided in the conversation" allowed;
- the prompt is a code block of two lines, `/handoff resume <branch>` and `<stage>; next: <next step>`;
- in the cloud: the whole file in the prompt, plus the ledger's finished tasks, rulings and findings, and no file written;
- the full path is said, and that the session can be closed;
- resume: `git status -sb` clean and on the branch, else stop; never switch branches; file or prompt content, else the second line and the stage's documents; head mismatch → stop, report both, wait; read **Read first**; confirm in two or three lines; wait for the go unless the rules say to go on.

- [x] **Step 3: Commit and push**

```bash
git add .claude/skills/handoff/SKILL.md docs/superpowers/plans/2026-10-31-session-skills.md
git commit -m "feat(claude): add the /handoff skill"
git push
```

- [x] **Step 4: The owner's by-hand test**

In the task summary, ask the owner to run the spec's [Tests](../specs/2026-10-31-session-skills-design.md#tests) for `/handoff` (a new session needs to see the skill): `/handoff` on this branch → `.superpowers/handoff/chore-adr-0059-session-skills.md` with every section and a two-line prompt; a new session with that prompt confirms stage and next step; a commit after the handoff, then resume again → the session stops on the head mismatch. A failure is fixed in this task with a new commit before Task 2.

---

### Task 2: The findings list and the execution rules

**Files:**
- Modify: `docs/superpowers/plans/CLAUDE.md` (the "Review findings" rule, line 18; a new rule after it)

**Interfaces:**
- Produces: the `## Findings` table in `.superpowers/sdd/<plan>/progress.md`, columns `# | Severity | Source | Where | Finding`, IDs `F1`, `F2`, …; Task 3 reads and merges it.

- [x] **Step 1: Replace the "Review findings" rule**

It says: every finding a task review or implementer reports and the task does not fix goes, in that task's turn, into the ledger's `## Findings` table (the columns above, with the example row of spec, [The findings list](../specs/2026-10-31-session-skills-design.md#the-findings-list)); the coordinating session writes it, implementers do not edit the ledger; a finding fixed later is marked fixed with the commit, not deleted; the log keeps its own lines but no longer lists deferred findings; the triage after the whole-branch review is `/finish-phase`'s ([ADR 0059](../../decisions/0059-session-skills.md), decisions 6 and 7; ADR 0054, decision 2).

- [x] **Step 2: Add the finishing rule**

A bullet "Finishing": when the last task is done, the branch is finished with `/finish-phase`, never `superpowers:finishing-a-development-branch`, even when the execution skill names it (ADR 0059, decision 8).

- [x] **Step 3: Verify**

Run: `pnpm format:check && git diff --stat`
Expected: passes; only `docs/superpowers/plans/CLAUDE.md` and this plan changed.

- [x] **Step 4: Commit and push**

```bash
git add docs/superpowers/plans/
git commit -m "docs(claude): keep the review findings in one list and finish with /finish-phase"
git push
```

---

### Task 3: The /finish-phase skill

**Files:**
- Create: `.claude/skills/finish-phase/SKILL.md`

**Interfaces:**
- Consumes: the `## Findings` table of Task 2; `/phase-tracking`, section "Before opening the PR"; `scripts/token-usage.py --branch <branch>`; the reviewer prompt `code-reviewer.md` of `superpowers:requesting-code-review`.
- Produces: the skill `/finish-phase`, whose last step offers `/demo-check` (Task 4).

- [x] **Step 1: Write `.claude/skills/finish-phase/SKILL.md`**

Frontmatter `name: finish-phase` and a `description` saying: finishes a phase branch, or any other branch such as an ADR made outside a phase, with the checks on the final head, the whole-branch review on Opus, one triage of the findings and the PR; run at the finishing stage by its opening prompt, by the owner, or by Claude when a plan's last task is done; replaces `superpowers:finishing-a-development-branch`. Then the nine steps of spec, [/finish-phase](../specs/2026-10-31-session-skills-design.md#finish-phase), with _phase only_ marked on steps 5 (the declined ones), 6 and 8 (token usage). The triage message format goes inline as a short example (groups, numbering, the closing "now: 1, 4; OP: 2; bug: 7; the rest dropped").

- [x] **Step 2: Check the skill against the spec**

Checklist, each yes:
- checks on the final head: pushed, clean, `pnpm check`, plus `pnpm test:e2e` when the diff from the merge base touches `apps/`, `packages/` or `e2e/`; a failure stops everything; an earlier green run does not count;
- the review is dispatched with `model: opus`, merge base to head, told to read `docs/superpowers/plans/CLAUDE.md` first;
- merge: duplicates become one line; a finding marked fixed is checked in the code and dropped only if fixed (Review Focus 5);
- no ledger → the review's findings go straight to the triage; not a phase → _phase only_ steps skipped (Review Focus 4);
- one triage message, 🔴 🟠 ⚪ groups, each with what, where, recommendation (fix now, open point, bug, drop), one-sentence reason, ending with how to answer; nothing found → say so and go on;
- fixes in one round by an implementer on Sonnet with its review, committed and pushed; open points and bugs through `/phase-tracking` as sub-issues of the phase that settles them, with their source; dropped ones declined in the phase ADR's "Settled while building";
- `/phase-tracking` "Before opening the PR", then the PR from the template, "Checked at the demo:" left for `/demo-check`, `skip-changelog` when fitting; never merge, never force-push a rejected push;
- wrap-up: a worktree is named, not removed; `/demo-check` offered when the definition of done needs one.

- [x] **Step 3: Commit and push**

```bash
git add .claude/skills/finish-phase/SKILL.md docs/superpowers/plans/2026-10-31-session-skills.md
git commit -m "feat(claude): add the /finish-phase skill"
git push
```

---

### Task 4: The /demo-check skill

**Files:**
- Create: `.claude/skills/demo-check/SKILL.md`

**Interfaces:**
- Consumes: [the demo check](../../development/definition-of-done.md#the-demo-check); the runbook anchors `#5-sign-in-from-the-cli`, `#applying-base`, `#pressing-the-button`, `#with-the-button`, `#debugging` of `docs/operations/demo-environment.md`; the spec's "Demo check" section of the phase.

- [x] **Step 1: Pin the Lighthouse version**

Run: `npm view lighthouse version` and `npm view lighthouse time --json | tail -5`
Pick the newest version published at least two weeks ago; it goes in the skill as `npx --yes lighthouse@<version> https://szop.dzwoniec.com/ --output=json --output-path=<scratchpad>/lighthouse.json --chrome-flags="--headless"` (default mobile profile). Do not run it against the demo now.

- [x] **Step 2: Write `.claude/skills/demo-check/SKILL.md`**

Frontmatter `name: demo-check` and a `description` saying: runs the demo check of the definition of done on a PR's final head as one list of who does what; run after the PR opens, by the owner or offered by `/finish-phase`; Claude never triggers `demo-up` or `demo-down`. Then the four steps of spec, [/demo-check](../specs/2026-10-31-session-skills-design.md#demo-check), with the table template of the spec inline (columns `# | Who | Where | Check | Reply`), the runbook links in **Where**, the two replies Claude waits for ("demo is up"; the behaviors done and `demo-down` run), and the "owner does everything" variant. Lighthouse: the command of Step 1; if it cannot run, the owner saves the report from Chrome and Claude reads the file (ADR 0059, Consequences).

- [x] **Step 3: Check the skill against the spec**

Checklist, each yes:
- the list is worked out from the definition of done, `infra/base` in the diff (sign-in and apply first), UI changes (Lighthouse), the spec's demo behaviors;
- one message, at most three exchanges;
- after "demo is up": `gh run watch` if running; health `ok` with the head commit; `http://` → `https://`; no console messages on `/` and the phase's screens (Chrome DevTools MCP); Lighthouse LCP ≤ 2.5 s, CLS ≤ 0.1, TBT reported, only for a UI change; one line per check; on a failure, the runbook's debugging section before reporting;
- after the second reply: ✅ or ❌ per check, the "Checked at the demo:" line filled from the spec; the owner ticks `Demo check`;
- `demo-up` and `demo-down` are never triggered by Claude.

- [x] **Step 4: Commit and push**

```bash
git add .claude/skills/demo-check/SKILL.md docs/superpowers/plans/2026-10-31-session-skills.md
git commit -m "feat(claude): add the /demo-check skill"
git push
```

---

### Task 5: CLAUDE.md, the guides and the ADR notes

**Files:**
- Modify: `CLAUDE.md` (line 33, the worktree bullet; "Working with Claude", line 52; the severity icon line, line 103)
- Modify: `docs/development/working-with-claude.md` (opening prompts table, lines 96–101; the ledger paragraph, line 103; "Restart or compact", lines 105–109)
- Modify: `docs/development/definition-of-done.md` (item 4, line 21; "The demo check", line 34)
- Modify: `docs/development/phase-walkthrough.md` (only where it describes finishing or the demo check)
- Modify: `docs/decisions/0052-working-with-claude.md` (decision 2's cell)
- Modify: `docs/decisions/0054-leaner-documentation.md` (decision 2's cell)
- Modify: `docs/glossary.md` (only if "handoff" is used as a term)

**Interfaces:**
- Consumes: the skill names and modes of Tasks 1, 3 and 4; the `## Findings` table of Task 2.

- [x] **Step 1: CLAUDE.md**

Following spec, [CLAUDE.md and the execution rules](../specs/2026-10-31-session-skills-design.md#claudemd-and-the-execution-rules): the worktree bullet ends "finish a branch with `/finish-phase`, not the superpowers finishing skill"; a "Working with Claude" bullet naming `/handoff` (the owner runs it to end a stage; `/handoff resume <branch>` opens the next), `/finish-phase` (the finishing stage) and `/demo-check` (after the PR opens) (`[ADR 0059](docs/decisions/0059-session-skills.md)`); the severity line becomes "a bug's severity, the project's Severity field, and a review finding's severity (🟠 for Important)".

- [x] **Step 2: The guides**

Following spec, [Documentation](../specs/2026-10-31-session-skills-design.md#documentation):
- `working-with-claude.md`: the "Execution, continued" row (and any continued stage) uses `/handoff resume <branch>` with the second line, reading the handoff file first; the "Finishing" row is `/finish-phase`; the ledger paragraph names the `## Findings` list and the one triage of `/finish-phase` in place of today's listing; "Restart or compact" says a stage boundary ends with `/handoff`. Keep `## Contents` in sync.
- `definition-of-done.md`: "The demo check" opens with a line that it is run with `/demo-check`; item 4 adds that Claude may run the checks that need no owner (health, redirect, console, Lighthouse).
- `phase-walkthrough.md`: name `/finish-phase` and `/demo-check` where it describes those steps; no new sections.
- `glossary.md`: add "handoff" only if the changed docs use it as a term.

- [x] **Step 3: The ADR notes**

At the bottom of decision 2's cell, after any existing note: in ADR 0052, `<br>➕ **Extended by [ADR 0059](0059-session-skills.md), decisions 2 to 5:** <one clause: a stage hands over with /handoff>`; in ADR 0054, `<br>✏️ **Refined by [ADR 0059](0059-session-skills.md), decisions 6 and 7:** <one clause: one findings list, triaged once with a recommendation each, bugs included>`. Run `/new-adr` for the note's rules first; the status lines stay.

- [x] **Step 4: Verify**

Run: `pnpm check && git status --short`
Expected: passes; only the files above and this plan changed.

- [x] **Step 5: Commit and push**

```bash
git add CLAUDE.md docs/ 
git commit -m "docs: point the guides to /handoff, /finish-phase and /demo-check"
git push
```

---

### Task 6: Review /finish-phase and /demo-check against the spec

**Files:**
- Modify (only to fix what the review finds): `.claude/skills/finish-phase/SKILL.md`, `.claude/skills/demo-check/SKILL.md`, `.claude/skills/handoff/SKILL.md`

This is the spec's test for the two skills that cannot run before the next phase ([Tests](../specs/2026-10-31-session-skills-design.md#tests)).

- [x] **Step 1: Read each skill next to the spec, step by step**

For `/finish-phase` and `/demo-check`, a table in the task summary: the spec's step, where the skill holds it (heading), ✅ kept or ❌ missing or changed. Also check: every _(Claude's call)_ kept; nothing the spec puts out of scope (`/start-phase`, a committed handoff file, a changed demo list); the [Risks](../specs/2026-10-31-session-skills-design.md#risks) each answered; the three skills use the same names for the ledger, the findings table and the handoff file. Fix every ❌ in the skill.

- [x] **Step 2: Check the links**

Run, from the repository root (relative links in the changed files point to existing files):

```bash
for f in $(git diff --name-only main... -- '*.md'); do d=$(dirname "$f"); grep -oE '\]\(([^)#]+)' "$f" | sed 's/](//' | grep -vE '^(https?:|mailto:)' | while read -r l; do [ -e "$d/$l" ] || echo "$f: $l"; done; done
```

Expected: no output. Check each `#anchor` added in this branch by hand against its target heading.

- [x] **Step 3: Verify**

Run: `pnpm check`
Expected: passes.

- [x] **Step 4: Commit and push**

Only if Step 1 or 2 changed a file:

```bash
git add .claude/skills/ docs/superpowers/plans/2026-10-31-session-skills.md
git commit -m "fix(claude): align the session skills with the spec"
git push
```

Otherwise tick the boxes in a `docs(plan): …` commit. Then the branch is finished with `/finish-phase` (its first run; a branch outside a phase, so the _phase only_ steps are skipped).
