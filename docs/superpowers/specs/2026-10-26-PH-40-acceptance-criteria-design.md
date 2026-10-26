# PH-40 Acceptance criteria: design

The spec of [PH-40](../../roadmap.md#ph-40-acceptance-criteria). The decisions it settles go into ADR 0051 (Acceptance criteria and their status), written in the phase. This document holds the design they were taken from.

## Contents

- [Goal](#goal)
- [Why now](#why-now)
- [Changes to the roadmap](#changes-to-the-roadmap)
- [Decisions](#decisions)
- [Design](#design)
  - [The files in docs/requirements](#the-files-in-docsrequirements)
  - [A requirement and its criteria](#a-requirement-and-its-criteria)
  - [Statuses](#statuses)
  - [Tests that cover a criterion](#tests-that-cover-a-criterion)
  - [Writing the criteria](#writing-the-criteria)
  - [The new areas](#the-new-areas)
  - [Moving the links](#moving-the-links)
  - [The process after this phase](#the-process-after-this-phase)
  - [Documentation](#documentation)
- [Tests and checks](#tests-and-checks)
- [Definition of done for this phase](#definition-of-done-for-this-phase)
- [Order of work](#order-of-work)
- [Risks](#risks)
- [Out of scope](#out-of-scope)

## Goal

Every requirement in `docs/requirements/` carries **acceptance criteria**: short, checkable statements of what must be true for the requirement to be met. Each criterion has a status and, once delivered, names the phase that delivered it. The requirements become the place where the owner sees what each requirement means in detail, what is done and what is left. Today that takes a search through the roadmap's "Delivers" lines, the phase issues and the specs of finished phases.

The phase writes the criteria for **every** requirement now, from the decisions taken so far (ADRs, living docs, specs, open-point issues), marked ❔ draft where no phase has finalized them yet. Criteria already delivered are marked ✅, and each of them is covered by a test whose title carries its ID.

The requirements document is split: an index with the status of every requirement, one file per area, and the use cases in a file of their own. A sweep of the sources found about 300 to 340 criteria; one file would pass 1,500 lines.

## Why now

The MVP's feature phases start with PH-15a ([#287](https://github.com/luiki-dev/szop/issues/287)), split from [PH-15](../../roadmap.md#ph-15-seed-catalog-read-only) on its own branch. The owner wants the full picture of every requirement before further work, because the criteria may change the shape of later phases ([the roadmap task](#order-of-work)). PH-15a waits on its branch, blocked by this phase ([#287](https://github.com/luiki-dev/szop/issues/287)), and finalizes its own criteria when it resumes.

## Changes to the roadmap

- **PH-40 is added** before [PH-15](../../roadmap.md#ph-15-seed-catalog-read-only) in Stage 4, with its issue [#289](https://github.com/luiki-dev/szop/issues/289) (Order 165). Already done on GitHub and in `roadmap.md`.
- **PH-15a ([#287](https://github.com/luiki-dev/szop/issues/287)) is ⏳ Blocked by #289** on GitHub. Its split from PH-15 lives on its own branch and reaches `main` with it.
- **The phases after this one may change** when the criteria show a phase is too big, misses a requirement or needs another order, and a phase for missing tests may be added ([decision 12](#decisions)). The last task collects these findings ([order of work](#order-of-work), task 8).

## Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | **Acceptance criteria, not user stories** _(Claude's recommendation, the owner's choice)_. | User stories ("As a guest, I want …"); Gherkin scenarios run by playwright-bdd; one GitHub issue per requirement; tests tagged by ID with a generated coverage report. | Each requirement already states what happens, and the use cases say who does it and why, so stories would mostly repeat them. What is missing is the detail decided in phase brainstorms, which today lives only in frozen specs. Gherkin adds a test layer of its own next to [ADR 0007](../../decisions/0007-testing-strategy.md). Issues per requirement keep the criteria outside the repo, where PRs cannot review them. A coverage report needs a script the owner finds unnecessary ([decision 4](#decisions)). |
| 2 | **The requirements doc holds the criteria and their status** _(the owner's choice)_. GitHub keeps the status of phases and open points. | Requirement status on GitHub, beside the phase status ([ADR 0027](../../decisions/0027-open-points-on-github.md)). | The owner checks what is left in the requirements doc. The criteria change in the same PR as the code that delivers them, so their status cannot lag behind the merge. This refines ADR 0027, decision 1: GitHub is the source of status for phases and open points, the requirements for requirements. |
| 3 | **Every requirement gets its criteria now, marked ❔ draft until a phase finalizes them** _(the owner's choice)_. | Criteria written only when the phase that delivers a requirement starts. | The requirements are thin, and much of what was decided or assumed lives in ADRs, specs and open-point issues. Captured now, it can be seen whole, moved between requirements, and shown to change later phases. |
| 4 | **A criterion is ✅ only when a phase delivered it and a test covers it. The test carries the criterion's ID in its title; the criterion does not name the test** _(the owner's rule; pointing the link from the test to the criterion is Claude's proposal, which the owner approved)_. | The criterion naming its test files; a script reporting which criteria have tests. | A criterion is often covered by several tests on different layers. Listing them would make the criterion's line long and break whenever a file moves. With the ID in the title, `grep` finds every test of a criterion, and a reviewer can check the rule without tooling. |
| 5 | **The requirements are split into an index, one file per area and the use cases; every requirement moves with its criteria, and every link is rewritten once** _(the owner's choice, option A)_. | The index keeps every requirement's statement and status under today's anchors, with only the criteria in the area files (option B: no link breaks, but a requirement and its criteria in two files). | A requirement and its criteria belong together. The 376 links in the repo and the links in issue bodies are rewritten by a script once, as [ADR 0027](../../decisions/0027-open-points-on-github.md), decision 2 did for the open points. |
| 6 | **One file per area, named `<AREA-CODE>-<full-area-name>.md`**: `ACC-accounts-and-guest-mode.md`, `NFR-non-functional-requirements.md` _(one file per area is Claude's proposal; the name is the owner's choice)_. | Files grouping several areas, as in the sweep's estimate; the code alone (`acc.md`). | The ID's prefix says where to look, and the rest of the name says what the area is. Small files (UNT, APR, NET) do no harm. |
| 7 | **The criterion's ID is the requirement's ID, a dot and a number: `ACC-1.1`. Criteria are rows of a table, not headings; links go to the requirement** _(Claude's call, approved with the example)_. | Headings per criterion. | On GitHub a heading "ACC-1.1" gets the anchor `#acc-11`, the same as "ACC-11". A number is never reused; a criterion that moves gets a new ID in its new place. |
| 8 | **A new area, APP, for behavior every screen shares, and NFR-4 for security that can be observed from outside** _(Claude's proposal, the owner's choice)_. | App-wide behavior under APR; security as a functional area of its own. | The shell, messages, loading and empty states, the not-found page and forms are built and decided but no requirement holds them. APR stays about appearance, where APR-1 would otherwise be lost. Security is a quality of every part, like accessibility. The account rules (passwords, enumeration, sessions) stay in ACC, where they are. |
| 9 | **Candidate open points do not become criteria** _(Claude's proposal, the owner's choice)_. | Criteria for candidates such as [OP-105](https://github.com/luiki-dev/szop/issues/283) and [OP-106](https://github.com/luiki-dev/szop/issues/284). | A candidate is an idea without a phase. The index of what is left would otherwise list work nobody planned. A candidate gets criteria when it is picked up. |
| 10 | **The landing page on `dzwoniec.com` and the `/design` page stay outside the requirements** _(the owner's choice)_. | Requirements for both. | Both are tools of the project, not Szop's features: one says whether the demo runs, the other shows the design system. [ADR 0044](../../decisions/0044-landing-page-details.md) and [ADR 0048](../../decisions/0048-design-system-phase-details.md) describe them, and their tests stay as they are. |
| 11 | **One phase, with the method first, then the split, then the criteria area by area, then the roadmap** _(the owner's choice)_. | Four phases: the method, then three backfills, interleaved with feature phases. | The owner wants the whole picture before further work. The phase brings one new concept, and its plan stays within about 8 tasks ([ADR 0014](../../decisions/0014-roadmap.md), decision 6). |
| 12 | **The phase changes no behavior. Delivered criteria without a test are listed at the owner's review after task 3, and the owner decides by how many there are: a few small tests are added in this phase, in a commit of their own; more go to a phase of their own on the roadmap, or to open points for the phases that next work in their areas. Until a test covers it, such a criterion stays 🚧** _(the owner's choice)_. | One open point under PH-15a, the next phase (Claude's first proposal); no tests in this phase at all. | PH-15a is about the catalog, and a missing test of the shell or of a security header would be foreign work in it, against the size of a phase. How much is missing is known only after task 3. The sweep expects little: the shell, the color scheme and the security baseline have many tests. |
| 13 | **A cross-cutting criterion is a general rule, ✅ when everything that exists today meets it and a test checks it; later phases keep it true. What one screen must do is a criterion of that screen's requirement** _(Claude's recommendation, the owner's choice)_. | The criterion stays 🚧 until every screen of the MVP exists; a new criterion per screen in APP or NFR. | Most NFR and APP rules are enforced by a mechanism that runs everywhere, such as axe in every E2E journey on every page it visits. The definition of done's first item already makes every phase's tests keep them true. Leaving them 🚧 for many phases would make the index say less. The criterion links the phase that built the mechanism; the empty state of the lists page, for example, belongs to [LST-2](../../requirements/functional-requirements.md#lst-2), not to APP. |
| 14 | **The owner reviews the criteria once during the phase, after task 3, before tasks 4 to 7 run in one go; the rest is read in the PR, commit by commit** _(Claude's recommendation, the owner's choice)_. | A stop after every area; reading everything only in the PR. | Task 3 writes the first criteria, so their style and granularity are settled there. A correction found only in the PR would mean reworking about 300 rows. |
| 15 | **A requirement says whether its list of criteria is finalized: ❔ Criteria not finalized until a brainstorm has reviewed the whole requirement with the owner, ✅ Criteria finalized after. A requirement is ✅ Done only when its criteria are finalized and every one is ✅** _(the owner's choice)_. | A requirement's status taken from its criteria alone. | A list written from earlier decisions can miss criteria. Without the mark, a requirement whose known criteria are all ✅ would read as done although nobody has checked that the list is complete. |

## Design

### The files in docs/requirements

| File | Holds |
|---|---|
| `functional-requirements.md` | **The index.** The introduction; the legend of release tags and statuses; how criteria work (IDs, statuses, the test rule, drafts); **the status of every requirement**, one table per area; the assumptions, actors and domain concepts; the release slicing (MVP, Later, future extensions, out of scope). It keeps its name, so the links in `CLAUDE.md`, the README and the PR template that point at the document as a whole stay valid. |
| `ACC-accounts-and-guest-mode.md`, `LST-shopping-lists.md`, `ITM-list-items.md`, `ORD-list-display-and-ordering.md`, `CAT-categories.md`, `PRD-catalog.md`, `UNT-units.md`, `TPL-templates.md`, `SHR-sharing.md`, `SYN-live-updates.md`, `LIM-limits.md`, `NET-connectivity.md`, `APR-appearance.md`, `APP-app-wide-behavior.md` | One functional area each: a title (`# Accounts and guest mode (ACC)`), a sentence on what the area covers, a link back to the index, and its requirements with their criteria. A text shared by the area (LIM's "all values are configurable defaults") stays at the top of its file. |
| `NFR-non-functional-requirements.md` | The non-functional requirements, NFR-1 to NFR-4, with the introduction of today's section 3. |
| `UC-use-cases.md` | UC-1 to UC-14, as today. Named like the area files, with the use cases' prefix _(Claude's call)_. Use cases stay scenarios and get no criteria; E2E journeys keep following them ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 4). |

Every requirement's heading becomes `## ACC-1`, so its anchor stays `#acc-1` in its new file. A file over about 100 lines gets a `## Contents` section, as every long document does.

The index's status table, one per area:

```markdown
### Appearance (APR)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [APR-1](APR-appearance.md#apr-1) | 🎯 MVP | ✅ Done | 3 of 3 | ✅ Finalized |
```

### A requirement and its criteria

```markdown
## APR-1

🎯 [MVP] · ✅ Done (3 of 3) · ✅ Criteria finalized ([PH-40](../roadmap.md#ph-40-acceptance-criteria))

The user chooses the color scheme: system (the default), light or dark.
The choice is kept on the device.

| ID | Criterion | Status |
|---|---|---|
| APR-1.1 | The menu offers System, Light and Dark, each with an icon and a label, always in view. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.2 | System is the default and follows the device's setting, also when it changes while the app is open. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APR-1.3 | The choice survives a reload and is applied before the page first paints, with no flash of the other scheme. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
```

- **The line under the heading** has the release tag, the requirement's status, the count of criteria done, and whether the list of criteria is finalized, with the phase whose brainstorm finalized it ([below](#statuses)). APR-1's would be finalized by the owner's review after task 3. A requirement no brainstorm has reviewed reads, for example, `🎯 [MVP] · 🚧 In progress (2 of 5) · ❔ Criteria not finalized`.
- **The statement** is today's text, adjusted where the criteria show it is out of date. A detail now held by a criterion may leave the statement, so it is said once.
- **The criteria table** has one row per criterion. Its Status column holds the status and, where it applies, the phase as a link to its roadmap entry, or the open point a draft comes from.
- **A requirement with no criteria yet** cannot occur after this phase. Every requirement gets at least one.
- **Dropped requirements** (ORD-4) keep their heading and their line, with no table.

### Statuses

A criterion moves through:

| Status | Meaning | Status column |
|---|---|---|
| ❔ Draft | Written from a decision or a direction; no phase has finalized it. | `❔ Draft`, or `❔ Draft · [OP-041](…)` when it comes from an open point's direction |
| ⬜ Not started | Finalized by a phase brainstorm, not built yet. | `⬜ Not started · [PH-23](…)` |
| 🚧 In progress | A phase is building it, or it is built but no test covers it yet ([decision 12](#decisions)). | `🚧 [PH-16](…)` |
| ✅ Done | Delivered by a phase and covered by a test that carries its ID ([below](#tests-that-cover-a-criterion)). | `✅ [PH-14b](…)` |
| ➡️ Moved | Moved to another requirement, under a new ID. | `➡️ Moved to [LST-2.3](LST-shopping-lists.md#lst-2)` |
| ✖️ Dropped | No longer wanted. The ID is never reused. | `✖️ Dropped: <reason>` |

**➡️ Moved** is a new status. It joins the icon vocabulary in `CLAUDE.md`, and ❔'s entry gains "a draft acceptance criterion".

**The list of criteria** has a state of its own ([decision 15](#decisions)):

- **❔ Criteria not finalized**: no brainstorm has reviewed the requirement as a whole, so criteria may still be missing. Every requirement starts here after this phase.
- **✅ Criteria finalized**: a brainstorm reviewed every criterion of the requirement with the owner and judged the list complete. This is the brainstorm of the first phase that delivers any part of the requirement, and it reviews the whole requirement, not only its part. For a requirement already delivered, fully or in part, the owner's review after task 3 can finalize it. Later phases may still add, move or drop criteria; the list stays finalized.

A requirement's status follows from both, leaving out moved and dropped criteria:

- **✅ Done** when the list is finalized and every criterion is ✅;
- **🚧 In progress** when at least one criterion is 🚧 or ✅, including when all are ✅ but the list is not finalized;
- **⬜ Not started** when the list is finalized and no criterion has started;
- **❔ Draft** when the list is not finalized and no criterion has started.

"Criteria done" counts the ✅ criteria against all criteria except the moved and dropped ones. The index and the requirement's own line show the same values. They are kept by hand, in the PR that changes a criterion; there is no script ([decision 4](#decisions)).

### Tests that cover a criterion

- **The test's name starts with the criterion's ID and a colon**: `it('APR-1.2: follows the device setting while System is chosen', …)`. A `describe` block can carry the ID instead, for every test inside it. A test covering several criteria lists them: `'APR-1.2, APR-1.3: …'`.
- **Any layer counts**: unit, property, API, database, component, E2E. A criterion is tested at the lowest layer that can prove it, as [testing.md's rules](../../development/testing.md#rules) already say.
- **A check that is not a test**, such as the bundle-size gate or `scripts/check-image.sh`, names the ID in a comment at the assertion.
- **A criterion only a person can check**, such as a Lighthouse run at the demo check for [NFR-3](../../requirements/functional-requirements.md#nfr-3)'s Core Web Vitals, says so in its Status column: `✅ [PH-06a](…) · checked at the demo`. The PR's demo check records the result, as it does today.
- **Finding the tests of a criterion**: `grep -rn "APR-1.2[:,]"` over the code. The colon or comma keeps `APR-1.2` from matching `APR-1.20`.

### Writing the criteria

**Sources:**

- the ADRs;
- [architecture.md](../../architecture/architecture.md), [visual-design.md](../../architecture/visual-design.md) with its mockups, and the [threat model](../../architecture/threat-model.md);
- the specs of finished phases, and [PH-15a's spec](https://github.com/luiki-dev/szop/blob/feat/ph-15a-seed-catalog/docs/superpowers/specs/2026-10-25-PH-15a-seed-catalog-design.md) on its branch, which the owner approved;
- **every open-point issue, open and closed** (106 today). A closed one counts by what settled it, the ADR or the document named in its "settled by" comment, since its own text is the question as it was asked.

Not read: `docs/archive/open-points.md`. Every one of its 88 entries is a GitHub issue holding the entry's text, as [ADR 0027](../../decisions/0027-open-points-on-github.md), decision 5 made them (checked while writing this spec: none is missing), so the issues cover it. The audits are not read either: they are point-in-time, and their findings live on as open points and ADRs.

**What a criterion is:**

- **Observable from outside**: by a user, or by someone sending requests to the API (a 403, a header, a status code). How it is built stays in the architecture: "search matches category names" is a criterion, "the API reads a YAML file" is not.
- **One checkable statement**, in plain present-tense English, short enough for one table cell. A number from a requirement's table may be repeated where the criterion needs it.
- **Decided, or a stated direction.** An open point's suggested direction becomes a ❔ criterion linking the open point. A question an open point leaves open ("decide whether …") gets no criterion; it stays on GitHub.
- **Not a candidate** ([decision 9](#decisions)), and not the landing page or `/design` ([decision 10](#decisions)).

**What else the sweep turns up** is listed in the PR description and, where a decision is needed, becomes an open point: a contradiction between two sources (such as architecture.md's "a guest opening a share link already has an anonymous user" against lazy creation, which [OP-049](https://github.com/luiki-dev/szop/issues/113) already notes), or a behavior that fits no requirement.

**Criteria from PH-15a's spec** (PRD-2, the seed part of ACC-1, the category order rule of ORD-2 and ORD-3) are ❔ drafts like the others _(Claude's call)_. PH-15a's brainstorm took place before criteria existed, so the phase finalizes them when it resumes, with its spec at hand. This phase does not touch PH-15's roadmap entry: PH-15a's branch already splits it, and brings the split to `main` when it merges.

**Delivered criteria (✅).** The phase looks for each delivered criterion's tests, renames their titles to carry its ID, and marks it ✅. A delivered criterion with no test stays 🚧, its Status column saying `🚧 [PH-14b](…) · no test yet`, and goes on the list for the owner's review after task 3, which decides where its test is written ([decision 12](#decisions)).

### The new areas

Cross-cutting criteria follow [decision 13](#decisions).

**APP, app-wide behavior.** What every screen shares, from [ADR 0013](../../decisions/0013-visual-design.md), decisions 17 and 18, [ADR 0049](../../decisions/0049-app-shell-phase-details.md) and [visual-design.md](../../architecture/visual-design.md#6-interaction-patterns). The builder divides it into requirements; a likely cut:

- the menu and navigation: a drawer on phones, a sidebar from 1024 px, the lists as the home screen, only the pages that exist;
- the page title in the header and in the browser's tab;
- messages: toasts that say what happened and what to do, never a generic error; undo preferred to "Are you sure?", with a confirmation only for what cannot be undone;
- loading with skeletons, never a full-screen spinner; empty states that say what the page is for and offer the next step;
- a not-found page for unknown paths;
- forms: visible labels, errors under the field, in words;
- changes that show at once and roll back with a message when they fail.

APP-1 onward are 🎯 [MVP]. The API status in the menu belongs here, as the menu's content.

**NFR-4, security.** What can be observed from outside, from [ADR 0012](../../decisions/0012-security-baseline.md), decisions 7 to 9, [ADR 0025](../../decisions/0025-web-security-baseline-details.md) and the threat model:

- an unsafe request from another site gets 403, and a body that is not JSON gets 415;
- the session cookie's flags;
- the security headers (CSP, HSTS, `Referrer-Policy`);
- tokens in URLs travel in the query string, are hidden in the logged URL, and leave the address bar once used;
- an unexpected error sends no details to the browser.

Much of it is ✅ from [PH-06b](../../roadmap.md#ph-06b-web-security-baseline). The session cookie's part is ❔, for [PH-18](../../roadmap.md#ph-18-registration-and-login).

### Moving the links

A one-off script in the session's scratch directory, not committed, rewrites every link to `functional-requirements.md#<anchor>`:

| Anchor | New target |
|---|---|
| `acc-N`, `lst-N`, … `apr-N` | `<AREA>-<name>.md#<area>-N` |
| `nfr-N` | `NFR-non-functional-requirements.md#nfr-N` |
| `uc-…` | `UC-use-cases.md#uc-…` |
| an area heading (`accounts-and-guest-mode-acc`, …) | `<AREA>-<name>.md` |
| `3-non-functional-requirements` | `NFR-non-functional-requirements.md` |
| `4-use-cases` | `UC-use-cases.md` |
| the index's own sections (`mvp`, `future-extensions-ideas-not-committed`, …) | the index, at its new anchor |

- **Where:** every Markdown file in the repo, the frozen records included (specs, plans, audits, `docs/archive/`), as a mechanical change to links, which `CLAUDE.md` allows for ADRs and which the records need to keep resolving. The PR template's links too.
- **The path** stays relative to the file holding the link; only the file name and anchor change.
- **Links inside today's file** (`[LST-6](#lst-6)` in TPL, `[ACC-7](#acc-7)` in the assumptions) become links to the right file when the split moves them.
- **Issue bodies:** the same rewrite on every issue in `luiki-dev/szop` whose body links `docs/requirements/functional-requirements.md#…`, open or closed, through `gh issue edit`, when the PR opens. Their links point at `main`, so they resolve once the PR is merged. Comments are history and stay.
- **Checked** by a second script that resolves every link into `docs/requirements/` to a file and a heading that exist, run before each commit that touches links. It reports the count of links rewritten and finds none broken. ADR 0027's rewrite was checked the same way.

### The process after this phase

- **At a phase's brainstorm:** the criteria of every requirement the phase delivers are reviewed with the owner, completed and finalized; a requirement still ❔ Criteria not finalized is reviewed as a whole, and becomes ✅ Criteria finalized. Drafts become ⬜ or 🚧, new criteria are added, and some move or are dropped. The spec names the criteria the phase delivers, and the phase's first commit sets them to 🚧.
- **In the phase's PR:** each delivered criterion is ✅, with a test carrying its ID. The requirement's line and the index follow. The reviewer checks that every ✅ in the diff has a test: `grep` for its ID.
- **The roadmap's "Delivers"** keeps linking requirements. A "(part: …)" note may name the criteria it covers, where that makes the part clearer.
- **A new requirement**, or one moved out of the future extensions, gets its criteria when it is written down ([ADR 0004](../../decisions/0004-implementation-process.md), decision 10).

### Documentation

- **ADR 0051, Acceptance criteria and their status:**
  - the decisions above;
  - it refines [ADR 0027](../../decisions/0027-open-points-on-github.md), decision 1 (requirement status in the requirements, not on GitHub) and [ADR 0004](../../decisions/0004-implementation-process.md)'s document roles (the requirements row also answers "how far along each requirement is");
  - it extends ADR 0004, decision 7 (a definition-of-done item for the criteria) and decision 8 (finalizing criteria at a phase's brainstorm);
  - the notes go in all three places `CLAUDE.md` names.
- **[definition-of-done.md](../../development/definition-of-done.md)** and the PR template:
  - item 1 adds: every criterion the phase marks ✅ has a test carrying its ID, or is marked as checked at the demo;
  - item 6 names the criteria's statuses and the index;
  - the template's "Requirement IDs" line becomes "Requirements and criteria".
- **[testing.md](../../development/testing.md):** a rule for the criterion's ID in a test's name, with the `grep`.
- **[project-tracking.md](../../development/project-tracking.md):** which side holds requirement status, and the two moments above (the brainstorm, the PR).
- **`CLAUDE.md`:**
  - the Documentation entry for `docs/requirements/` lists the index, the area files and the use cases;
  - the link rule's examples use the new paths;
  - "During a phase" gains the criteria at the brainstorm and in the PR;
  - the icon vocabulary gains ➡️ Moved and the draft criterion.
- **The README's documentation list**, if it describes the requirements file.
- **[glossary.md](../../glossary.md):** acceptance criterion. The docs write it out; there is no acronym.
- **[roadmap.md](../../roadmap.md):** the "How it works" line on Delivers; and task 8's changes.

## Tests and checks

- **No new tests**, except the few the review after task 3 may add ([decision 12](#decisions)). Renamed tests keep their assertions; `pnpm test` and `pnpm test:e2e` pass with the new titles, and CI is green.
- **The link check** ([moving the links](#moving-the-links)) runs after the split and after each criteria task, and finds no broken link into `docs/requirements/`.
- **A check of the ✅ rule**, before the PR opens: every ✅ criterion's ID is found in a test name or a check's comment (a scratch script running the `grep` per ID), and the PR lists the result. Criteria checked at the demo are listed separately.
- **The index matches the files**: a scratch script compares each requirement's line with its row in the index and with its criteria table's statuses.

## Definition of done for this phase

- Tests pass and CI is green; renamed tests, and any tests added under [decision 12](#decisions), are the only code changes.
- Deployed and checked: ➖ N/A: no behavior changes.
- UI changes shown: ➖ N/A: nothing users see changes.
- Living docs, guides and ADR 0051 as in [Documentation](#documentation).
- Open points: every finding that needs a decision has an open point under the phase that will settle it, and every delivered criterion without a test is covered, or handled as the review after task 3 decided.
- The PR is labelled `skip-changelog`: readers of the release notes see no change.

## Order of work

Each task is one commit. The owner can review the criteria area by area.

1. **The method:** ADR 0051, and the process documents of [Documentation](#documentation), except what depends on the new files' contents.
2. **The split:** the index, the area files, the NFR file and the use cases' file, with today's content moved and nothing reworded; every link in the repo rewritten and checked. A reviewer sees a move.
3. **What exists:** APP and NFR-4 written; the criteria of APR-1 and NFR-1 to NFR-3; every ✅ in the project, with its tests renamed; the list of delivered criteria without a test. **The owner reviews this task before work goes on** ([decision 14](#decisions)), decides where the missing tests are written ([decision 12](#decisions)), and may finalize the lists of criteria of the requirements it covers ([decision 15](#decisions)). Tests added in this phase come in a commit of their own right after it.
4. **ACC, LIM and NET.**
5. **LST, ITM and ORD.**
6. **CAT, PRD, UNT and TPL.**
7. **SHR and SYN.**
8. **The roadmap and the index:**
   - the findings of tasks 3 to 7 that touch later phases, listed for the owner: a phase that grows past its size, a requirement no phase delivers (such as the APP criteria not yet built), a phase whose order no longer fits;
   - the small changes done here: "Delivers" lines, "(part: …)" notes, phase issue bodies;
   - a restructuring of phases is proposed to the owner and done here if the owner approves it and it stays small, otherwise in a step of its own;
   - the index's tables completed and checked.

Before the PR opens: the issue bodies' links rewritten, the ✅ check and the index check run, and the self-review done.

## Risks

- **Review load.** A few hundred criteria are a lot to read. One commit per area group, the index's tables and the PR's summary of findings let the owner read in order, and drafts can be corrected in the phase that finalizes them.
- **A criterion that quietly decides something.** Writing a direction as a criterion can look like a decision. Drafts carry ❔ and the open point's link, and only a phase's brainstorm finalizes them.
- **Broken links.** 376 links in the repo and many in issues. The script is checked by the link check, and issue bodies change only when the PR opens.
- **PH-15a's branch.** It changes `functional-requirements.md` (PRD-2's wording) and `roadmap.md`. When it merges `main` after this phase, PRD-2's change goes to `PRD-catalog.md`, and PH-15a's spec links are rewritten by the same script.
- **The index drifting from the files.** It is kept by hand. The index check runs in this phase, and the definition of done asks for both to change in the PR that changes a criterion.

## Out of scope

- Any change to behavior, and tests beyond what the review after task 3 decides ([decision 12](#decisions)).
- A script in the repo or a CI job for coverage or for the index ([decision 4](#decisions)).
- Criteria for candidates, the landing page and `/design` ([decisions 9 and 10](#decisions)).
- Finalizing criteria: each phase does that for its own requirements.
- User stories, and Gherkin.
