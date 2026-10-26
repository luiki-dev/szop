# PH-40 Acceptance criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every requirement carries acceptance criteria with a status. The requirements are split into an index and one file per area. Delivered criteria are ✅, and their tests carry the criterion's ID.

**Architecture:** Documentation only, plus test titles. The tasks run in this order: the method (ADR 0051 and process docs), a pure move of `functional-requirements.md` into area files with every link rewritten, the criteria area by area, then the roadmap. Four scripts in the session's scratch directory, never committed, rewrite and check the links, the ✅ rule and the index.

**Tech Stack:** Markdown; Python 3 for the scratch scripts; `gh` for issue bodies; the existing Vitest and Playwright suites (titles only).

**Spec:** [`docs/superpowers/specs/2026-10-26-PH-40-acceptance-criteria-design.md`](../specs/2026-10-26-PH-40-acceptance-criteria-design.md)

## Global Constraints

- **Files:** `docs/requirements/functional-requirements.md` (the index, name kept); the area files are `ACC-accounts-and-guest-mode.md`, `LST-shopping-lists.md`, `ITM-list-items.md`, `ORD-list-display-and-ordering.md`, `CAT-categories.md`, `PRD-catalog.md`, `UNT-units.md`, `TPL-templates.md`, `SHR-sharing.md`, `SYN-live-updates.md`, `LIM-limits.md`, `NET-connectivity.md`, `APR-appearance.md`, `APP-app-wide-behavior.md`, `NFR-non-functional-requirements.md`, plus `UC-use-cases.md`.
- **Requirement headings** are `## ACC-1` (anchor `#acc-1`). **Use case headings** keep their text (`## UC-3 Shop in a store`).
- **Criterion IDs** are `ACC-1.1`, numbered from 1 per requirement, never reused. Criteria are rows of `| ID | Criterion | Status |`, never headings.
- **Criterion statuses**, exactly: `❔ Draft`, `❔ Draft · [OP-NNN](https://github.com/luiki-dev/szop/issues/N)`, `⬜ Not started · [PH-NN](../roadmap.md#…)`, `🚧 [PH-NN](…)`, `🚧 [PH-NN](…) · no test yet`, `✅ [PH-NN](…)`, `✅ [PH-NN](…) · checked at the demo`, `➡️ Moved to [ID](FILE#anchor)`, `✖️ Dropped: <reason>`.
- **Requirement line:** `🎯 [MVP] · <status> (<done> of <total>) · <list state>`. The status is `✅ Done`, `🚧 In progress`, `⬜ Not started` or `❔ Draft`. The list state is `❔ Criteria not finalized` or `✅ Criteria finalized ([PH-NN](…))`. The rules are in the spec, [Statuses](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#statuses). Every requirement leaves this phase `❔ Criteria not finalized` unless the owner finalizes it at the review after Task 3.
- **The ✅ rule:** a criterion is ✅ only if a phase delivered it and a test's name (an `it`/`test`/`describe` title) starts with its ID and a colon, or lists it (`'APR-1.2, APR-1.3: …'`). A check that is not a test carries the ID in a comment at its assertion. A criterion checked by hand says `· checked at the demo`.
- **A criterion is observable from outside** (a user, or a request to the API), one checkable statement in plain present-tense English, decided or a stated direction. Never a candidate open point, the landing page or `/design`.
- **Sources:** ADRs; `architecture.md`, `visual-design.md` (with its mockups), `threat-model.md`; the specs of finished phases and PH-15a's spec on `feat/ph-15a-seed-catalog`; every `open-point` issue, open and closed (`gh issue list --label open-point --state all --limit 300`). A closed one counts by what settled it. Never `docs/archive/` or `docs/audits/`.
- **No behavior changes.** Test changes are title renames only, except tests the owner approves after Task 3.
- **Docs style:** niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon, no icons in headings; requirements, use cases and areas linked, never plain IDs (headings, code and the criteria tables' ID column stay plain); long docs keep a `## Contents` in sync; ADR notes in three places (`CLAUDE.md`, "Documentation").
- **Git:** branch `docs/ph-40-acceptance-criteria`. Never commit to `main`, never merge, never trigger `demo-up` or `demo-down`. Commits follow Conventional Commits (scope `requirements`, `adr`, `docs` or `test` as fits; header at most 100 characters) and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013pCg35LC2zysPHNamQjpo7`.
- `pnpm check` and `pnpm test:e2e` pass after every task that touches tests.
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit and `git push` the phase branch. **Stop for the owner only after Task 3** (the review the spec's decisions 12, 14 and 15 ask for) **and at Task 8, Step 1** (the roadmap's restructuring); otherwise go on to the next task. This is the owner's exception, for this phase, to the stop after every task in `docs/superpowers/plans/CLAUDE.md`.

## Review Focus

1. **A link written in a form the rewrite misses**, such as a `blob/main` URL, a link inside a table cell or code span, `../../requirements/…` from a plan, or a same-file `](#acc-7)` that leaves with its requirement. Expected: none is left broken. `check-links.py` (Task 2) resolves every link into `docs/requirements/`, including `https://github.com/luiki-dev/szop/blob/main/docs/requirements/…`, and runs at the end of Tasks 2 to 8.
2. **A criterion ID that is a prefix of another** (`APR-1.2` against `APR-1.20`, `ACC-1.1` against `ACC-11.1`). Expected: the ✅ check counts only real matches. `check-done.py` (Task 3) matches `\bID[:,]`.
3. **A requirement's line, its criteria and the index disagreeing** after an edit, for example a 🚧 row added without updating "2 of 4". Expected: caught before the commit. `check-index.py` (Task 3) runs at the end of Tasks 3 to 8.
4. **A test that covers a criterion but is renamed so it no longer says what it tests.** Expected: the title keeps its words after the ID (`'APR-1.2: follows the system while System is chosen'`). Task 3's step reads each renamed diff line.
5. **An issue body rewritten wrongly.** Such a write is hard to undo by hand. Expected: no body changes except the links. Task 8 runs `rewrite-issue-links.py` in dry-run mode first, saves every original body under `scratchpad/issue-bodies/`, and diffs before writing.

---

## File Structure

| Path | Change |
|---|---|
| `docs/decisions/0051-acceptance-criteria.md` | Create (Task 1) |
| `docs/decisions/0004-implementation-process.md`, `0024-github-project-tracking.md`, `0027-open-points-on-github.md` | Status line and decision-cell notes only (Task 1) |
| `docs/development/definition-of-done.md`, `testing.md`, `project-tracking.md`, `.github/pull_request_template.md`, `CLAUDE.md`, `docs/glossary.md` | Modify (Task 1; paths and examples finished in Task 2) |
| `docs/requirements/functional-requirements.md` | Becomes the index (Task 2; tables filled in Tasks 3 to 7) |
| `docs/requirements/<AREA>-<name>.md` (16 files) | Create (Task 2), criteria added (Tasks 3 to 7) |
| Every `.md` with a link to `functional-requirements.md#…`, the PR template | Links rewritten (Task 2) |
| Test files of delivered criteria (Task 3 lists them) and `apps/web/vite.config.ts` (the budget comment) | Titles and comments only (Task 3) |
| `docs/roadmap.md` | "How it works", Delivers notes, the PH-40 row (Task 8) |
| `scratchpad/rewrite-links.py`, `check-links.py`, `check-done.py`, `check-index.py`, `rewrite-issue-links.py` | Scratch only, under `/tmp/claude-1000/-home-lemekk-workspace-szop/e5305505-c67a-4e7f-820a-f86f3dde7adb/scratchpad/`, never committed |

---

### Task 1: The method

**Files:**
- Create: `docs/decisions/0051-acceptance-criteria.md`
- Modify: `docs/decisions/0004-implementation-process.md`, `docs/decisions/0024-github-project-tracking.md`, `docs/decisions/0027-open-points-on-github.md` (notes only), `docs/development/definition-of-done.md`, `docs/development/testing.md`, `docs/development/project-tracking.md`, `.github/pull_request_template.md`, `CLAUDE.md`, `docs/glossary.md`

**Interfaces:**
- Produces: the rules every later task follows, under these exact names. Later tasks link to `docs/decisions/0051-acceptance-criteria.md` and to `testing.md#rules`.

- [x] **Step 1: Write ADR 0051, "Acceptance criteria and their status"**, in the format of ADR 0048 (Status, Date `2026-10-26`, header notes, Context, a Decisions table with `# | Topic | Options considered | Decision and reasoning`, Consequences). It holds the spec's decisions 1 to 15 with their alternatives and reasons, condensed, keeping the owner's and Claude's attributions. Header:
  - `Refines:` [ADR 0024](…), decision 1 and [ADR 0027](…), decision 1 (GitHub stays the source of status for phases and open points; requirement status lives in the requirements); [ADR 0004](…), decision 9 (the requirements also answer how far along each requirement is).
  - `Extends:` [ADR 0004](…), decision 7 (the definition of done gains the ✅ rule) and decision 8 (a phase's brainstorm finalizes the criteria of the requirements it delivers).

  Before writing each note, read the target decision cell, and name the decision whose words actually say it.

- [x] **Step 2: Add the notes in the three places** `CLAUDE.md` names: each earlier ADR's status line, and a line at the bottom of each named decision's cell (`<br>✏️ **Refined by [ADR 0051](0051-acceptance-criteria.md), decision N:** …` or `➕ **Extended by …`), oldest first.

- [x] **Step 3: Update the process documents**, with the wording of the spec's [Documentation](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#documentation) and [The process after this phase](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#the-process-after-this-phase):
  - **`definition-of-done.md`:**
    - item 1 gains "every criterion the PR marks ✅ has a test whose name carries its ID, or is marked checked at the demo";
    - item 6 names the criteria's statuses, the requirement's line and the index;
    - the ADR column cites ADR 0051.
  - **PR template:** the matching lines, and "Requirement IDs:" becomes "Requirements and criteria:".
  - **`testing.md`:** a new rule in "Rules", "**A test that covers an acceptance criterion starts its name with the criterion's ID and a colon** (`it('APR-1.2: …')`), or lists several (`'APR-1.2, APR-1.3: …'`); a `describe` can carry it for every test inside. A check that is not a test names the ID in a comment at its assertion. `grep -rn 'APR-1.2[:,]'` finds them ([ADR 0051](../decisions/0051-acceptance-criteria.md))."
  - **`project-tracking.md`:** requirement status lives in `docs/requirements/` ([ADR 0051](…)), beside the phase and open-point status on GitHub; the two moments (the brainstorm finalizes; the PR sets ✅); a row in "How items move" for a criterion added, moved or dropped (in the requirements, by Claude, in the phase's PR).
  - **`CLAUDE.md`:**
    - "During a phase" gains, under "When a phase's brainstorm starts", "In the repo: the criteria of every requirement the phase delivers reviewed with the owner and finalized", and under "Before opening the PR", "In the repo: every criterion the PR delivers ✅ with a test carrying its ID; the requirement's line and the index updated";
    - the icon vocabulary gains `➡️ moved: an acceptance criterion moved to another requirement`, and ❔'s line gains `a draft acceptance criterion, a list of criteria not finalized`.
  - **`glossary.md`:** "Acceptance criterion: a short, checkable statement of what must be true for a requirement to be met; written out, never abbreviated ([ADR 0051](…))."

  The file paths in `CLAUDE.md`'s Documentation entry and link-rule examples change in Task 2, together with the files.

- [x] **Step 4: Verify**
  Run: `pnpm check`. Expected: PASS (Prettier formats the Markdown).
  Run: `grep -n "0051" docs/decisions/0004-implementation-process.md docs/decisions/0024-github-project-tracking.md docs/decisions/0027-open-points-on-github.md`. Expected: a status-line note and a cell note in each.

- [x] **Step 5: Commit**: `docs(adr): add ADR 0051, acceptance criteria and their status`, with the ticked boxes. Push.

---

### Task 2: The split

**Files:**
- Modify: `docs/requirements/functional-requirements.md` (becomes the index)
- Create: the 14 functional area files, `NFR-non-functional-requirements.md`, `UC-use-cases.md`
- Modify: every Markdown file linking `functional-requirements.md#…` (376 links today), `.github/pull_request_template.md`, `CLAUDE.md` (Documentation entry, link-rule examples), `README.md` if its line needs the new structure
- Scratch: `rewrite-links.py`, `check-links.py`

**Interfaces:**
- Produces: the files and anchors every later task writes into. **Index headings, exactly:**
  - `# Szop — Functional Requirements`
  - `## Contents`
  - `## How requirements are written`
  - `## Requirements by area`, with one `### <area heading as today>` per area, plus `### Non-functional requirements (NFR)`
  - `## General assumptions, actors, domain concepts`, with `### Assumptions`, `### Actors`, `### Domain concepts`
  - `## Release slicing and future extensions`, with `### MVP`, `### Later (planned core functionality)`, `### Future extensions (ideas, not committed)`, `### Explicitly out of scope for now`

  The `###` anchors of today stay valid.
- Produces: `check-links.py`, run by every later task. It exits non-zero and prints `file:line target` for each broken link.

- [x] **Step 1: Write `check-links.py`** and run it on today's tree. It reads every tracked `.md` file (`git ls-files '*.md'`) and every link `](target)` whose target resolves to `docs/requirements/*.md` (a relative path, or `https://github.com/luiki-dev/szop/blob/main/docs/requirements/…`). It checks that the file exists and that the anchor equals the GitHub slug of one of its headings. Slug: lowercase; drop every character that is not a letter, digit, space or hyphen; spaces become hyphens.
  Expected now: only the link with anchor `#nfr-` fails. Note its file; Step 4 repairs it as a mechanical link fix.

- [x] **Step 2: Write the new files by moving today's text unchanged.** Each requirement becomes `## <ID>` followed by today's line (`🎯 [MVP] …`). Each area file starts with this header, one sentence per area saying what it covers:

  ```markdown
  # Accounts and guest mode (ACC)

  Guest mode, registration, logging in and out, passwords and account data. Part of the [functional requirements](functional-requirements.md), which explain how criteria and statuses work and show the status of every requirement.
  ```

  - LIM's shared sentence ("All values below are configurable defaults…") stays under its title.
  - The NFR file carries today's section 3 introduction.
  - The use cases' file carries the use cases.
  - The index holds the sections above. "How requirements are written" holds today's legend of release tags; Task 3 extends it. "Requirements by area" holds, per area, a table `| Requirement | Release |` with each requirement linked to its file; Tasks 3 to 7 add the remaining columns.
  - Same-file links that now cross files point at the right file. Index-internal links point at the new anchors.

- [x] **Step 3: Write `rewrite-links.py`** with the spec's mapping ([Moving the links](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#moving-the-links)), extended for the index's old numbered anchors:
  - `1-general-assumptions-actors-domain-concepts` → `functional-requirements.md#general-assumptions-actors-domain-concepts`
  - `2-functional-requirements` → `functional-requirements.md#requirements-by-area`
  - `5-release-slicing-and-future-extensions` → `functional-requirements.md#release-slicing-and-future-extensions`
  - the area anchors → the area's file, with no anchor
  - `assumptions`, `mvp`, `future-extensions-ideas-not-committed`, … unchanged

  It keeps each link's path prefix (`../`, `../../`, the `blob/main/` URL) and changes only the file name and anchor. It prints the count per file and every anchor it does not know, and it changes nothing for an unknown anchor.

- [x] **Step 4: Run `rewrite-links.py` on the repo**, then `check-links.py`.
  Expected: about 376 links rewritten, no unknown anchor except `#nfr-`, which is repaired by hand to the link its sentence means. `check-links.py` exits 0.

- [x] **Step 5: Update `CLAUDE.md`'s Documentation entry for `docs/requirements/`** (the index, the area files, the use cases, the criteria and their status) and the link rule's examples (`[ACC-1](../requirements/ACC-accounts-and-guest-mode.md#acc-1)`, `[UC-3](../requirements/UC-use-cases.md#uc-3-shop-in-a-store)`, `[SHR](../requirements/SHR-sharing.md)`). Update `README.md`'s line only if it describes the single file.

- [x] **Step 6: Verify it is a move**
  Run: `git diff --stat` and `git diff --word-diff docs/requirements/`. Expected: the requirement texts are unchanged words; the other files change only inside link targets.
  Run: `pnpm check`. Expected: PASS.

- [x] **Step 7: Commit**: `docs(requirements): split the requirements into one file per area`, with the ticked boxes. Push.

---

### Task 3: What exists

**Files:**
- Modify: `APP-app-wide-behavior.md` (new requirements), `NFR-non-functional-requirements.md` (NFR-4 added; criteria for NFR-1 to NFR-4), `APR-appearance.md`, the index ("How requirements are written" completed; the APP, APR and NFR tables)
- Modify (titles only): the tests that cover delivered criteria, among `apps/web/src/shell/*.test.ts(x)`, `e2e/tests/shell.spec.ts`, `e2e/tests/design.spec.ts`, `e2e/tests/csp-guard.spec.ts`, `apps/api/src/security/*.test.ts`, `apps/api/src/web/routes.test.ts`, `apps/api/src/health/routes.test.ts`; comments in `apps/web/vite.config.ts` (the first-screen budget) and `e2e/playwright.config.ts` (the three projects)
- Scratch: `check-done.py`, `check-index.py`

**Interfaces:**
- Consumes: Task 2's files and headings.
- Produces: `check-done.py` (prints every ✅ criterion without a matching test name or comment, and exits non-zero if there is one; lists `· checked at the demo` criteria separately) and `check-index.py` (prints every mismatch between a requirement's line, its criteria table and its index row; exits non-zero on any). Both are run by Tasks 4 to 8.

- [x] **Step 1: Write `check-done.py` and `check-index.py`.**
  - `check-done.py` reads every criteria table row, and for each ✅ row not marked `checked at the demo`, greps `git ls-files` outside `docs/` for `\b<ID>[:,]`.
  - `check-index.py` recomputes each requirement's status, count and list state from its rows, using the rules in Global Constraints, and compares them with the requirement's line and its index row.

  Run both now. Expected: both exit 0 (no criteria yet).

- [x] **Step 2: Complete the index's "How requirements are written"**:
  - the release tags;
  - what a criterion is;
  - the ID format;
  - the criterion statuses, as the spec's [Statuses](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#statuses) table, with a legend of each icon and its word;
  - the list states and how a requirement's status follows;
  - the test rule, linking `testing.md#rules`;
  - how phases change criteria, linking ADR 0051.

- [x] **Step 3: Write APP and NFR-4.**
  - **APP:** requirements cut along the spec's [The new areas](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#the-new-areas) list, each `🎯 [MVP]`, with a statement and criteria.
  - **NFR-4 (security):** its statement and criteria from ADR 0012, decisions 7 to 9 and 12, ADR 0025, and `threat-model.md`. Also the access rule ("a reference to another workspace's record answers 404 like a missing record", from closed OP-034 and ADR 0012, decision 3), drafted ❔ for PH-16.
  - **Cross-cutting criteria:** general rules ([decision 13](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#decisions)).

- [x] **Step 4: Write the criteria of APR-1 and NFR-1 to NFR-3** from ADR 0013, 0023, 0026, 0048 and 0049, and visual-design.md.

- [x] **Step 5: Find the tests of every delivered criterion and rename them.** For each criterion delivered by PH-06a, PH-06b, PH-07, PH-14a or PH-14b, find the tests that prove it, put its ID at the start of their titles, and keep the rest of each title. Then mark the criterion `✅ [PH-NN](…)`.
  - The budget comment in `vite.config.ts` and the projects in `playwright.config.ts` get the ID in a comment.
  - A criterion checked only at the demo (the Core Web Vitals) is `✅ … · checked at the demo`.
  - A criterion delivered with no test is `🚧 [PH-NN](…) · no test yet` and goes on the gap list.

- [x] **Step 6: Fill the APP, APR and NFR tables of the index**: `| Requirement | Release | Status | Criteria done | Criteria list |`.

- [x] **Step 7: Verify**
  Run: `pnpm check && pnpm test:e2e`. Expected: PASS, same counts of tests as before.
  Run: `python3 scratchpad/check-done.py && python3 scratchpad/check-index.py && python3 scratchpad/check-links.py`. Expected: all exit 0.
  Read `git diff -U0 -- '*.test.ts' '*.test.tsx' '*.spec.ts'`. Expected: only titles change, each keeps its words after the ID.

- [x] **Step 8: Commit**: `docs(requirements): add the criteria of what is built, with APP and NFR-4`, with the ticked boxes. Push, stop, and give the owner the review of decisions 12, 14 and 15:
  - the criteria written, so their style and granularity can be corrected before Tasks 4 to 7;
  - the gap list, for the decision on missing tests (in this phase, a phase of their own, or open points);
  - the requirements the owner may finalize now.

  Apply corrections in a follow-up commit before Task 4. **If the owner decides tests are added in this phase**, they come in their own commit, `test: cover the delivered criteria without a test`, following [testing.md](../../development/testing.md) (lowest layer, TDD does not apply to existing code), and their criteria turn ✅. **If the owner decides on a phase of its own**, Task 8 adds it to the roadmap.

---

### Task 4: ACC, LIM and NET

**Files:**
- Modify: `ACC-accounts-and-guest-mode.md`, `LIM-limits.md`, `NET-connectivity.md`, the index (their tables)

**Interfaces:**
- Consumes: the style the owner approved after Task 3; `check-done.py`, `check-index.py`, `check-links.py`.

- [x] **Step 1: Write the criteria of ACC-1 to ACC-8.** Main sources:
  - ADR 0002, 0003 and 0012, decisions 9 to 12 and 14;
  - architecture.md's "Anonymous guests" and "Web security";
  - open points [OP-038](https://github.com/luiki-dev/szop/issues/97), [OP-039](https://github.com/luiki-dev/szop/issues/98), [OP-044](https://github.com/luiki-dev/szop/issues/76), [OP-048](https://github.com/luiki-dev/szop/issues/101), [OP-055](https://github.com/luiki-dev/szop/issues/109), and the ACC part of [OP-041](https://github.com/luiki-dev/szop/issues/100) (category matching, currency) and [OP-047](https://github.com/luiki-dev/szop/issues/111);
  - PH-15a's spec for ACC-1's seed part.

  Directions are `❔ Draft · [OP-…]`. Questions left open get no criterion.

- [x] **Step 2: Write the criteria of LIM-1 to LIM-4**: one per quota row and rate-limit row, the IPv6 grouping, the silent per-email limits, the messages, and the all-or-nothing direction for bulk actions ([OP-047](https://github.com/luiki-dev/szop/issues/111)). Sources: ADR 0003, ADR 0012, decisions 13 and 14, ADR 0036, decision 8, architecture.md's "Abuse protection" and "Errors".

- [x] **Step 3: Write the criteria of NET-1** from ADR 0013, visual-design.md ("Offline") and [OP-040](https://github.com/luiki-dev/szop/issues/99) (timeouts, "not saved", refetch, an explicit checked value).

- [x] **Step 4: Update the requirement statements** where a criterion now holds the detail or the statement is out of date. Fill the three areas' index tables.

- [x] **Step 5: Verify**
  Run: `python3 scratchpad/check-done.py && python3 scratchpad/check-index.py && python3 scratchpad/check-links.py && pnpm check`. Expected: all pass.

- [x] **Step 6: Commit**: `docs(requirements): add the criteria of ACC, LIM and NET`, with the ticked boxes and a list of the sweep's findings (contradictions, behaviors that fit no requirement) kept for the PR. Push.

---

### Task 5: LST, ITM and ORD

**Files:**
- Modify: `LST-shopping-lists.md`, `ITM-list-items.md`, `ORD-list-display-and-ordering.md`, the index

- [ ] **Step 1: Write the criteria of LST-1 to LST-6.** Sources: ADR 0001; visual-design.md (the lists home, "Put all back"); [OP-047](https://github.com/luiki-dev/szop/issues/111) (what an archived list allows, bulk actions); [OP-051](https://github.com/luiki-dev/szop/issues/103) (undo).

- [ ] **Step 2: Write the criteria of ITM-1 to ITM-8.** Sources:
  - ADR 0001;
  - ADR 0022 (the drawer's rows, amounts);
  - visual-design.md's "Amounts";
  - [OP-041](https://github.com/luiki-dev/szop/issues/100) (decimal comma, "same name", rounding);
  - [OP-045](https://github.com/luiki-dev/szop/issues/112) (an increase is never lost);
  - [OP-047](https://github.com/luiki-dev/szop/issues/111) (different units);
  - [OP-040](https://github.com/luiki-dev/szop/issues/99) (checking sends a value).

- [ ] **Step 3: Write the criteria of ORD-1 to ORD-5.**
  - **Sources:** ADR 0022, decisions 3 to 8 and 13; visual-design.md's "The list and the haul" (the chips, "+N more", the drawer and its opening and closing, ↶, folding while typing, the states table, the accessible names); [OP-041](https://github.com/luiki-dev/szop/issues/100) (`position` for "order added"); PH-15a's spec for the category order rule.
  - **ORD-4** keeps its dropped line.
  - **Screen-specific criteria** stay here, not in APP ([decision 13](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#decisions)).

- [ ] **Step 4: Statements and index tables**, as in Task 4.

- [ ] **Step 5: Verify**: the same commands as Task 4, Step 5.

- [ ] **Step 6: Commit**: `docs(requirements): add the criteria of LST, ITM and ORD`, with the ticked boxes. Push.

---

### Task 6: CAT, PRD, UNT and TPL

**Files:**
- Modify: `CAT-categories.md`, `PRD-catalog.md`, `UNT-units.md`, `TPL-templates.md`, the index

- [ ] **Step 1: Write the criteria of CAT-1 to CAT-3.** Sources: ADR 0001; ADR 0012, decision 6 (a deleted category leaves items uncategorized); [OP-041](https://github.com/luiki-dev/szop/issues/100) (moves refuse a descendant, depth with the subtree, `template_items` uncategorized too); LIM-1's depth.

- [ ] **Step 2: Write the criteria of PRD-1 to PRD-3.** Sources: PH-15a's spec for PRD-2: browsing collapsed and indented by level, "Expand all" and "Collapse all", search by product and category name with the path shown and the match highlighted, a matching category showing its contents, products alphabetical, the loading and error states. Also architecture.md (items are copies).

- [ ] **Step 3: Write the criteria of UNT-1 and TPL-1 to TPL-3.** Sources: ADR 0001; [OP-041](https://github.com/luiki-dev/szop/issues/100) (units: label copied, product's default unit cleared); [OP-047](https://github.com/luiki-dev/szop/issues/111) (templates against quotas).

- [ ] **Step 4: Statements and index tables.** **Step 5: Verify**, as in Task 4.

- [ ] **Step 6: Commit**: `docs(requirements): add the criteria of CAT, PRD, UNT and TPL`, with the ticked boxes. Push.

---

### Task 7: SHR and SYN

**Files:**
- Modify: `SHR-sharing.md`, `SYN-live-updates.md`, the index

- [ ] **Step 1: Write the criteria of SHR-1 to SHR-5** (🔜 [Later]). Sources: ADR 0001, decisions 2, 3 and 6; ADR 0012, decisions 4 and 12 (invitations reveal nothing); architecture.md's "Sharing"; [OP-049](https://github.com/luiki-dev/szop/issues/113)'s directions (redeeming a link is a guest's first change; a shopper editing gets 403); [OP-041](https://github.com/luiki-dev/szop/issues/100) (matching by full path). Questions OP-049 leaves open get no criterion.

- [ ] **Step 2: Write the criteria of SYN-1 and SYN-2.** Sources: ADR 0001, decision 4; ADR 0036, decisions 5 and 7; architecture.md's "Live updates"; [OP-045](https://github.com/luiki-dev/szop/issues/112)'s directions (refetch after a reconnect, one's own change never overwritten by its echo).

- [ ] **Step 3: Statements and index tables.** **Step 4: Verify**, as in Task 4.

- [ ] **Step 5: Commit**: `docs(requirements): add the criteria of SHR and SYN`, with the ticked boxes. Push.

---

### Task 8: The roadmap and the index

**Files:**
- Modify: `docs/roadmap.md`, the index, phase issue bodies on GitHub where their entry changes
- Scratch: `rewrite-issue-links.py`

- [ ] **Step 1: List the findings that touch later phases**, from Tasks 3 to 7, for the owner:
  - a phase whose criteria pass its size;
  - a requirement or criterion no phase delivers (such as APP's not-found page, or NFR-4's session cookie if PH-18's entry does not name it);
  - a phase whose order no longer fits;
  - and, if the owner chose it after Task 3, the phase for missing tests.

  Stop, and ask the owner which restructuring to do here.

- [ ] **Step 2: Apply the small changes and what the owner approved.**
  - "How it works" says a "(part: …)" note may name criteria.
  - "Delivers" lines gain APP and NFR-4 links where a phase delivers them, and criterion IDs in "(part: …)" notes where that makes the part clearer.
  - New phases get issues as `project-tracking.md`'s "How items move" says.
  - The phase issue bodies of every changed entry are updated.

- [ ] **Step 3: Write the open points** for every finding that needs a decision, with the next free `OP-` ID, labelled `open-point`, as a sub-issue of the phase that settles it.

- [ ] **Step 4: Rewrite the links in issue bodies.**
  - Write `rewrite-issue-links.py`. It lists every issue in `luiki-dev/szop` (`gh issue list --state all --limit 400 --json number,body`) whose body contains `docs/requirements/functional-requirements.md#`, and applies `rewrite-links.py`'s mapping to those URLs only.
  - **Dry run:** save each original body to `scratchpad/issue-bodies/<n>.md`, and print a diff per issue.
  - Read the diffs. Expected: only link targets change.
  - **Write:** `gh issue edit <n> --body-file …`. Then run the script again. Expected: no issue left to change.

  Run this step when the PR is about to open.

- [ ] **Step 5: Final checks**
  Run: `python3 scratchpad/check-links.py && python3 scratchpad/check-done.py && python3 scratchpad/check-index.py && pnpm check && pnpm test:e2e`. Expected: all pass. `check-done.py`'s list of criteria checked at the demo goes into the PR.
  Run: `grep -c "❔ Criteria not finalized" docs/requirements/*.md` and count the criteria per status. These counts go into the PR description.

- [ ] **Step 6: Commit**: `docs(roadmap): apply what the acceptance criteria show`, with the ticked boxes. Set the PH-40 row's Plan link (already set when this plan was committed) and the PR link when the PR opens. Push.

- [ ] **Step 7: Open the PR** when the owner says so:
  - title `docs(requirements): add acceptance criteria to every requirement`;
  - label `skip-changelog`;
  - the template filled, with `Closes #289`, the issue changes, the findings, the counts and the demo-check list;
  - the definition of done items N/A as the spec's [Definition of done](../specs/2026-10-26-PH-40-acceptance-criteria-design.md#definition-of-done-for-this-phase) says;
  - the self-review done first.
