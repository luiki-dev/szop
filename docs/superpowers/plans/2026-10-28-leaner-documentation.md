# Leaner documentation per phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each phase writes every fact once, in the place the owner reads it, and the PR description holds only what the owner reviews.

**Architecture:** Documentation and process changes only: the PR template, the definition of done, the tracking and workflow guides, `CLAUDE.md`, the rules files next to the plans and specs, and notes in three earlier ADRs. Two one-off scripts in the scratchpad, never committed: one rewrites the open phase issues' bodies, one counts the simulation.

**Tech Stack:** Markdown; `gh` for the issues; Python 3 (standard library) for the scratch scripts.

**Spec:** [`docs/superpowers/specs/2026-10-28-leaner-documentation-design.md`](../specs/2026-10-28-leaner-documentation-design.md), with the decisions in [ADR 0054](../../decisions/0054-leaner-documentation.md).

**Before your task:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md). It holds the repo-wide rules every task follows (git, commits and trailers, docs style, after each task). Task 1 rewrites it; from Task 2 on, read the version Task 1 wrote.

## Order of work

1. [Task 1: The rules for plans and specs](#task-1-the-rules-for-plans-and-specs)
2. [Task 2: The PR template and the definition of done](#task-2-the-pr-template-and-the-definition-of-done)
3. [Task 3: Project tracking and CLAUDE.md](#task-3-project-tracking-and-claudemd)
4. [Task 4: The other guides](#task-4-the-other-guides)
5. [Task 5: Notes in the earlier ADRs](#task-5-notes-in-the-earlier-adrs)
6. [Task 6: Rewrite the open phase issues' bodies](#task-6-rewrite-the-open-phase-issues-bodies)
7. [Task 7: The simulation](#task-7-the-simulation)

## Global Constraints

- **Branch:** `docs/leaner-documentation`. Its `adr` issue is [#308](https://github.com/luiki-dev/szop/issues/308); the PR closes it and is labelled `skip-changelog`.
- **Commit scopes for this work:** `claude` (the rules files and `CLAUDE.md`), `adr`, `audit`, `plan`; the template, the definition of done and the guides take no scope (`docs: …`).
- **Out of scope** (spec, [Out of scope](../specs/2026-10-28-leaner-documentation-design.md#out-of-scope)): finished specs, plans and ADRs are not rewritten; PH-15a's branch and PR #306 are not touched; the token usage section stays as it is; no script for the criteria counts.
- **Scratch files** (the rewrite script, the rewritten bodies, the simulation's rewritten artifacts and counts) live in the executing session's scratchpad and are never committed.
- **Change a rule only where a file states it.** A guide that only links the changed page needs no edit (spec, [Other guides](../specs/2026-10-28-leaner-documentation-design.md#other-guides)).
- **Contents sections:** every changed heading in a long document is updated in its `## Contents`.

## Review Focus

1. **A phase issue whose body says something its roadmap entry does not** (a field edited on GitHub only, an owner step not mirrored). Expected: the script writes nothing for that issue and shows the difference; the owner decides. Task 6, Step 2.
2. **A phase issue with owner steps, or an Also section with links** ([#234](https://github.com/luiki-dev/szop/issues/234), [#235](https://github.com/luiki-dev/szop/issues/235), [#47](https://github.com/luiki-dev/szop/issues/47) have owner steps). Expected: the owner-step references compare equal to the roadmap's when they name the same issues, and the Also section is kept byte for byte. Task 6, Step 2.
3. **A PR outside a phase filling the new template** (this branch's own PR). Expected: "none" for a link that does not apply, `➖ N/A` items, no "Token usage", the ADR linked from "What and why". Task 2, Step 3.
4. **An old phrase left in a file the spec does not list** (for example "the body a copy", "lists the issue changes", "Plans repeat these rules"). Expected: the grep in Task 4, Step 3 finds none outside frozen records (ADRs, specs, plans, audits, `docs/archive/`).
5. **An anchor that changed with a heading** (a section renamed in `definition-of-done.md` or `project-tracking.md` and linked from elsewhere). Expected: every `#anchor` pointing to a changed heading is updated. Task 4, Step 3.

---

### Task 1: The rules for plans and specs

**Files:**
- Modify: `docs/superpowers/plans/CLAUDE.md`
- Create: `docs/superpowers/specs/CLAUDE.md`

**Interfaces:**
- Produces: `plans/CLAUDE.md` as the one home of the repo-wide rules, which every later task's implementer reads; `specs/CLAUDE.md`, linked from Tasks 3 and 4.

- [x] **Step 1: Rewrite `docs/superpowers/plans/CLAUDE.md`**

Following spec, [Plans and their rules](../specs/2026-10-28-leaner-documentation-design.md#plans-and-their-rules). Keep the three current rules (after each task, tick the boxes, never merge). Add the repo-wide rules, each in a line with a link to its home instead of restating the home's detail:
- **Git:** never commit to `main`; a phase is one branch `type/ph-NN-short-description`; never merge; never trigger `demo-up` or `demo-down`; don't work around the deny rules in `.claude/settings.json` or the push hook ([ADR 0009](../../decisions/0009-git-workflow.md), [ADR 0012](../../decisions/0012-security-baseline.md), decision 19; [ADR 0015](../../decisions/0015-git-push-guard-hook.md)).
- **Commits:** Conventional Commits with a scope from `commitlint.config.js`, header at most 100 characters, ending with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and the executing session's `Claude-Session:` line.
- **Docs style:** the "Writing style for docs and explanations" section of the root `CLAUDE.md`, by link; no jokes in docs, commits or PRs.
- **Review findings:** every finding of the whole-branch review that is not fixed becomes an open-point issue in that review's session, before the PR opens ([ADR 0054](../../decisions/0054-leaner-documentation.md), decision 2).
- **Settled while building:** a decision taken during a task goes into the phase ADR's "Settled while building" in that task's commit.

Replace "Plans repeat these rules" with: the session that dispatches an implementer tells it, in its prompt, to read this file before its task (decision 11).

Add a section **What a plan holds**: "Order of work" at the top, each task linking its section; Global Constraints with only this phase's constraints; the criteria and the docs to update linked from the spec, not listed again; a line telling implementers to read this file.

- [x] **Step 2: Create `docs/superpowers/specs/CLAUDE.md`**

Following spec, [Specs](../specs/2026-10-28-leaner-documentation-design.md#specs). An introduction (rules for the session that writes a spec in this folder), then a spec's sections in order: Goal (one sentence and a link to the roadmap entry), a link to the phase ADR's decisions, the design, Acceptance criteria (linked IDs, each whole or in part), Tests, Documentation, Demo check, Risks, Out of scope, Left to the builder. State what a spec does not hold: a Decisions table, "Changes to the roadmap", "Definition of done for this phase", "Order of work" (decision 10). And that the phase ADR is created in the same commit as the spec, at ✅ Accepted (decisions 3 and 4).

- [x] **Step 3: Verify**

Run: `grep -n "Plans repeat" docs/superpowers/plans/CLAUDE.md; grep -c "" docs/superpowers/specs/CLAUDE.md`
Expected: no match for the first; the second file exists. Read both files once against the spec's two sections: every bullet there has a line here.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/CLAUDE.md docs/superpowers/specs/CLAUDE.md docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs(claude): gather the repo-wide rules for plans and add the spec rules"
```

---

### Task 2: The PR template and the definition of done

**Files:**
- Modify: `.github/pull_request_template.md`
- Modify: `docs/development/definition-of-done.md`

**Interfaces:**
- Produces: the item labels, used by Task 4 when a guide names an item: `Tests`, `Mutants`, `CI green`, `Demo check`, `infra/base applied`, `Living docs`, `Guides`, `ADRs`, `Open points`, `Conventional Commits`, `Screenshots` (items 1 to 11, in order).

- [x] **Step 1: Rewrite the PR template**

Following spec, [The PR template](../specs/2026-10-28-leaner-documentation-design.md#the-pr-template): four sections, **What and why**, **Links**, **Definition of done**, **Token usage**. "How it was tested" and the demo block's fixed fields go. Exact shape of the two middle sections:

```markdown
## Links

- Acceptance criteria:
- Closes:

<!-- Acceptance criteria: each delivered (✅) or started (🚧) criterion, linked; "none" when there are none. Closes: one `Closes #N` per line. -->

## Definition of done

<!-- Each item: docs/development/definition-of-done.md. An item that does not apply replaces its box with ➖ N/A, as in "- ➖ N/A Mutants". When criteria are checked at the demo, add under Demo check: "Checked at the demo:" with their linked IDs, from the spec. -->

- [ ] Tests
- [ ] Mutants
- [ ] CI green
- [ ] Demo check
- [ ] infra/base applied
- [ ] Living docs
- [ ] Guides
- [ ] ADRs
- [ ] Open points
- [ ] Conventional Commits
- [ ] Screenshots
```

The "What and why" comment keeps the Conventional Commits and `skip-changelog` guidance and asks for bullets plus a link to the phase ADR or the ADR the PR adds. The "Token usage" comment says it is for phase PRs, and a PR outside a phase leaves the section out. The definition-of-done link in the comment is a relative or repo URL that works from a PR page; keep whatever form the current template uses.

- [x] **Step 2: Update `docs/development/definition-of-done.md`**

Following spec, [The definition of done](../specs/2026-10-28-leaner-documentation-design.md#the-definition-of-done):
- Each item's **Item** cell gets its label from Task 2's Interfaces, for example `**CI is green** (`CI green`)`.
- Item 4 holds the demo check as a list the owner follows: the `demo-up` run, the deployed commit is the final head, `/api/health` answers `ok` with that commit, `http://` redirects to `https://` ([NFR-4](../requirements/NFR-non-functional-requirements.md#nfr-4)), the console has no CSP errors or other messages, Lighthouse on a phone profile on `/` with LCP ≤ 2.5 s, CLS ≤ 0.1 and TBT standing in for INP ([NFR-3](../requirements/NFR-non-functional-requirements.md#nfr-3)), the spec's demo check list, `demo-down`. If a list does not fit the table cell, put it in a section of its own after the table and link it from the cell. The PR records only the ticked item, plus the "Checked at the demo:" line when it applies.
- Item 6 drops the phase issue's body; a criterion marked "to check at the next demo" turns ✅ once it is listed under the PR's ticked demo item.
- Item 9 drops "the PR description lists the changes" and adds that every review finding not fixed is an open-point issue.
- "Items that don't apply": `➖ N/A` replaces the checkbox, without a reason, with one example (`- ➖ N/A Mutants`). Rename the heading if it says "with a reason", and update its anchor wherever it is linked.
- "When the demo check must be repeated": relies on the `demo-up` run, which the owner checks, instead of the PR naming the deployed commit; "The PR's link is updated to the new run" goes.
- The header's history line adds ADR 0054.

- [x] **Step 3: Check the template on a PR outside a phase**

Write this branch's PR description into `<scratchpad>/pr-body.md` from the new template: "What and why" links ADR 0054; "Acceptance criteria: none"; `Closes #308`; every item that does not apply marked `➖ N/A`; no "Token usage". Expected: every section can be filled without a field left over. Keep the file; it is the draft for the PR.

- [x] **Step 4: Verify**

Run: `grep -n -E "How it was tested|Lighthouse|Deployed commit|Issues changed" .github/pull_request_template.md; grep -n -E "names the commit|lists the changes|never a bare|a copy of the roadmap" docs/development/definition-of-done.md`
Expected: no matches.

- [x] **Step 5: Commit**

```bash
git add .github/pull_request_template.md docs/development/definition-of-done.md docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs: shorten the PR template and label the definition of done items"
```

---

### Task 3: Project tracking and CLAUDE.md

**Files:**
- Modify: `docs/development/project-tracking.md` (around lines 33, 63, 67, the "How items move" table, 181–198)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/CLAUDE.md` (Task 1), linked from the implementation process line.
- Produces: the new phase issue body, which Task 6 writes:

```markdown
Roadmap entry: [PH-NN Name](https://github.com/luiki-dev/szop/blob/main/docs/roadmap.md#ph-nn-name)

### Also

<the Also section, or —>
```

- [ ] **Step 1: Update `docs/development/project-tracking.md`**

Following spec, [Project tracking](../specs/2026-10-28-leaner-documentation-design.md#project-tracking):
- **Phase issue body** (line 63 and the table at line 33): the body above; the copy and the rule that it is updated when the PR opens go. Owner steps stay sub-issues; "Depends on" stays a "Blocked by" link. Say that the bodies were rewritten once by ADR 0054.
- **"How items move":** the rows that update a phase body when its entry changes go; the **Also** row (line 168) stays.
- **The facts table** (line 185): the phase's plan has no copy; the row says so or goes.
- **Line 198:** "The PR description lists the issue changes" goes; `Closes #N` stays where it is stated.
- **Open-point issues** (line 67): **Source** names the phase, and for a deferred review finding, the review.
- The criteria's statuses: no change.

- [ ] **Step 2: Update `CLAUDE.md`**

Following spec, [CLAUDE.md](../specs/2026-10-28-leaner-documentation-design.md#claudemd), each bullet in the section it names:
- **Project purpose,** the ADR 0004 line: a phase's ADR is created with its spec, with a link to `docs/superpowers/specs/CLAUDE.md`.
- **Project tracking, "When the spec or plan is committed":** the phase ADR is created in the spec's commit, at ✅ Accepted. Stage table and project fields unchanged.
- **Project tracking, "Before opening the PR":** the phase body updated only for **Also**; "a list of every issue change the PR made" goes; every review finding not fixed is an open-point issue before the PR opens.
- **Project tracking, a new bullet "During execution":** a decision taken during execution goes into the ADR's "Settled while building" in the commit of the task that took it; ADR numbers are checked against `main` and the open branches when the ADR is created and again before the PR.
- **Documentation, `docs/roadmap.md`:** "the phase issue's body is a copy, updated when the PR that changes the entry opens" becomes "the phase issue's body links it".
- **Documentation, `docs/decisions/`:** notes go in two places, the new ADR's header and the decision's cell; the earlier ADR's status line only when the whole ADR is superseded or deprecated.
- **Documentation:** add `docs/superpowers/specs/CLAUDE.md` and `docs/superpowers/plans/CLAUDE.md` where the list fits, one line each.

- [ ] **Step 3: Verify**

Run: `grep -n -E "a copy|lists the issue changes|every issue change|three places|status line, and" CLAUDE.md docs/development/project-tracking.md`
Expected: no match that states the old rule (a match that describes history, such as "was a copy until ADR 0054", is fine). `## Contents` of `project-tracking.md` matches its headings.

- [ ] **Step 4: Commit**

```bash
git add docs/development/project-tracking.md CLAUDE.md docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs(claude): link the roadmap from phase issues and create the phase ADR with the spec"
```

---

### Task 4: The other guides

**Files:**
- Modify: `docs/development/phase-walkthrough.md` (Step 1, line 78 on; Step 4, line 133 on)
- Modify: `docs/development/git-workflow.md:102`
- Modify: `docs/development/working-with-claude.md` (line 99, line 103, the model choice around 170)

**Interfaces:**
- Consumes: the item labels (Task 2); `plans/CLAUDE.md` (Task 1).

- [ ] **Step 1: Update the three guides**

Following spec, [Other guides](../specs/2026-10-28-leaner-documentation-design.md#other-guides), only where they restate a changed rule:
- `phase-walkthrough.md`: the phase ADR is committed with the spec (Step 1 and the commit table at line 62); the PR's sections are the template's four (Step 4).
- `git-workflow.md`, line 102: the description's sections are what and why (with the ADR link), the criteria and `Closes #N`, the definition-of-done labels, and token usage for phase PRs.
- `working-with-claude.md`: the execution row at line 99 reads the plan and `plans/CLAUDE.md`, the plan no longer carries the repo rules in its Global Constraints; the dispatching session tells each implementer to read `plans/CLAUDE.md` before its task; the whole-branch review's findings that are not fixed become open-point issues in the review's session (line 103 says the ledger holds the deferred findings; keep the ledger, add where they end up).

- [ ] **Step 2: Sweep for old phrases and changed anchors**

Run: `grep -rn -E "How it was tested|issue changes|body (is )?a copy|Plans repeat|Rulings|names the commit it deployed|N/A: <reason>|N/A with a reason" --include=*.md . | grep -v -E "^\./docs/(decisions|superpowers/(specs|plans)/20|audits|archive)/"`
Expected: no match that states an old rule. Fix any in a file the spec does not list only if it restates the rule; mention it in the task summary.

Then, for each heading Tasks 2–4 renamed, run `grep -rn "<old-anchor>" --include=*.md .` and update every link outside frozen records.

- [ ] **Step 3: Commit**

```bash
git add docs/development/ docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs: align the walkthrough, git workflow and Claude guide with ADR 0054"
```

---

### Task 5: Notes in the earlier ADRs

**Files:**
- Modify: `docs/decisions/0004-implementation-process.md` (decision 9's cell)
- Modify: `docs/decisions/0011-design-sanity-check-follow-ups.md` (decisions 3 and 4)
- Modify: `docs/decisions/0027-open-points-on-github.md` (decision 3)

- [ ] **Step 1: Add the notes**

At the bottom of each cell, after any existing note (oldest first), in the form CLAUDE.md gives: `<br>✏️ **Refined by [ADR 0054](0054-leaner-documentation.md), decisions …:** <one clause>`. Which decisions, from spec, [Earlier ADRs](../specs/2026-10-28-leaner-documentation-design.md#earlier-adrs):
- ADR 0004, decision 9: decisions 3, 10, 11 and 13 (decisions live in the phase ADR, created with the spec; the spec and plan hold less; notes in two places).
- ADR 0011, decision 3: decision 8 (short labels, a bare `➖ N/A`, one demo item).
- ADR 0011, decision 4: decisions 3, 10, 11 and 13.
- ADR 0027, decision 3: decision 5 (the phase issue's body links the roadmap entry).

Status lines stay as they are (decision 13).

- [ ] **Step 2: Verify**

Run: `git diff --stat docs/decisions/ && git diff docs/decisions/ | grep -c "^+.*ADR 0054"`
Expected: three files changed, 4 added notes, no status line in the diff.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0004-implementation-process.md docs/decisions/0011-design-sanity-check-follow-ups.md docs/decisions/0027-open-points-on-github.md docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs(adr): note ADR 0054 in the decisions it refines"
```

---

### Task 6: Rewrite the open phase issues' bodies

**Files:**
- Scratch: `<scratchpad>/rewrite-phase-issues.py`, `<scratchpad>/phase-bodies/<N>.md`, `<scratchpad>/phase-bodies/<N>.diff`
- Modify: this plan's boxes only (the issues change on GitHub)

**Interfaces:**
- Consumes: the body shape from Task 3's Interfaces.

The open phase issues today are 22 (`gh issue list --label phase --state open`); closed ones are left as they are.

- [ ] **Step 1: Write `<scratchpad>/rewrite-phase-issues.py [--apply]`**

For each open issue labelled `phase`:
- Read its body (`gh issue view N --json body`). Take the first line, `Roadmap entry: [...](…#anchor)`, and the `### Also` section to the end of the body, verbatim.
- Find the entry in `docs/roadmap.md` on the current branch by the anchor's heading, and read its `- **Field:** text` bullets.
- Compare each `### Field` section of the body, other than Also, with the entry's field of the same name, after normalizing both: `[text](…/issues/N)` and `text (#N)` become `#N`; other links become their text; lower case; whitespace collapsed; a trailing period dropped. For **Owner steps**, two lists are equal when they name the same issue numbers, or both say none. A roadmap field missing from the body (such as **Open points**) is ignored; a body section missing from the roadmap is a difference.
- Write the new body to `phase-bodies/<N>.md`. On a difference, write `phase-bodies/<N>.diff` instead and do not edit that issue, even with `--apply`.
- Without `--apply`, print one line per issue: `#N ok` or `#N DIFF <fields>`. With `--apply`, run `gh issue edit N --body-file phase-bodies/<N>.md` for each `ok` issue.

- [ ] **Step 2: Dry run**

Run: `python3 -I <scratchpad>/rewrite-phase-issues.py`
Expected: 22 lines. [#234](https://github.com/luiki-dev/szop/issues/234), [#235](https://github.com/luiki-dev/szop/issues/235) and [#47](https://github.com/luiki-dev/szop/issues/47) (owner steps) come out `ok` unless their steps differ from the roadmap. Read every `.diff`; a difference from a normalization the script missed is a script fix, rerun.

- [ ] **Step 3: Show the owner one rewritten body, then stop**

Show the owner `phase-bodies/45.md` (PH-16) next to its current body, and every remaining `.diff`. Wait for the owner's go-ahead; a `.diff` issue is rewritten only as the owner says (the roadmap or the body corrected first).

- [ ] **Step 4: Apply and check**

Run: `python3 -I <scratchpad>/rewrite-phase-issues.py --apply`, then `gh issue list --label phase --state open --limit 100 --json number,body -q '.[] | select(.body | test("### Goal")) | .number'`
Expected: no output (no open phase body still holds a Goal section, except any the owner kept back).

- [ ] **Step 5: Commit**

Tick this task's boxes in the plan.

```bash
git add docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs(plan): record the phase issues rewritten to the roadmap link"
```

---

### Task 7: The simulation

**Files:**
- Create: `docs/audits/2026-10-28-documentation-volume-simulation.md`
- Modify: `docs/decisions/0054-leaner-documentation.md` ("Settled while building")
- Scratch: `<scratchpad>/simulation/before/`, `<scratchpad>/simulation/after/`, `<scratchpad>/count.py`

**Interfaces:**
- Consumes: the rules as Tasks 1–3 wrote them; the audit [`docs/audits/2026-10-28-documentation-volume.md`](../../audits/2026-10-28-documentation-volume.md), whose format the new audit follows (date, status line, Contents, Method).

Following spec, [The simulation](../specs/2026-10-28-leaner-documentation-design.md#the-simulation).

- [ ] **Step 1: Copy the sample into `before/`**

From `origin/feat/ph-15a-seed-catalog` (fetch it first): `docs/superpowers/specs/2026-10-25-PH-15a-seed-catalog-design.md`, `docs/superpowers/plans/2026-10-27-PH-15a-seed-catalog.md`, `docs/decisions/0050-seed-catalog-phase-details.md`. From GitHub: issue #287's body and PR #306's description. Five files, as they are today; note the branch head's commit for the record.

- [ ] **Step 2: Rewrite each into `after/` under the new rules**

- **Spec:** the sections of `specs/CLAUDE.md`; its decisions move to the ADR (a decision in both is kept once, in the ADR); Goal one sentence with the roadmap link; criteria as linked IDs.
- **ADR 0050:** unchanged in its decisions, plus any decision that was only in the spec, and "Changes to the roadmap".
- **Plan:** only Global Constraints (this phase's only), Order of work, and the criteria and docs lists (linked to the spec) change; the tasks' steps stay as they are.
- **Issue #287:** the body of Task 3's Interfaces.
- **PR #306:** the template of Task 2: bullets with the ADR 0050 link, the criteria and `Closes` lines, the labels with `➖ N/A` and the "Checked at the demo:" line, token usage unchanged.

Nothing is shortened beyond the rules: decisions move, they are not condensed.

- [ ] **Step 3: Count**

`<scratchpad>/count.py before/ after/` prints, per artifact and in total, words (`len(text.split())`) and tokens, before and after, and the change in percent. Tokens: the Claude API's token counting endpoint (`POST /v1/messages/count_tokens`, model `claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set; otherwise characters ÷ 4, rounded. The method goes in the record.

Also count, per phase, the edits it no longer makes, from PH-15a: the phase issue body syncs (the number of times #287's body was edited after creation, from its timeline, or 1 per PR that changed the entry when the timeline does not show it); the third place of each ADR note (the earlier ADRs whose status line ADR 0050 changed); the plan's lines of repo-wide rules in its Global Constraints.

- [ ] **Step 4: Write the audit**

`docs/audits/2026-10-28-documentation-volume-simulation.md`: date, status (a point-in-time record), what was simulated and how (the sample with the PH-15a head commit, the rewrite rules, the counting method), one table `| Artifact | Words before | Words after | Tokens before | Tokens after | Change |` with a total row, the edits no longer made as a short list, and what the numbers do not show (the decisions are moved, not removed; one phase only). No Contents needed if it stays under about 100 lines. Link the first audit; the first audit is not edited.

In ADR 0054, under "Settled while building", add one bullet linking the new audit with its headline result (the total change in tokens).

- [ ] **Step 5: Verify**

Run: `git status --short`
Expected: only the audit, ADR 0054 and this plan changed; nothing from the scratchpad. The table's totals equal the sums of its rows.

- [ ] **Step 6: Commit**

```bash
git add docs/audits/2026-10-28-documentation-volume-simulation.md docs/decisions/0054-leaner-documentation.md docs/superpowers/plans/2026-10-28-leaner-documentation.md
git commit -m "docs(audit): simulate the leaner documentation on PH-15a"
```
