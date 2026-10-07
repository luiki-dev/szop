# "Ring tail" Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every document that describes Szop's look or how checked items are shown describes the "Ring tail" redesign: ADR 0022, the design system with new mockups, the requirements, the architecture, the roadmap and the open points.

**Architecture:** documentation only. ADR 0022 records the decisions and notes what it changes in ADR 0013 and ADR 0001; `visual-design.md` and its images carry the design system; the requirements, architecture, stack overview and README carry the behavior; the roadmap and the open points carry the work it leaves to PH-14, PH-17 and PH-21.

**Tech Stack:** Markdown; HTML and CSS mockups rendered to PNG by Windows Chrome in headless mode; Gabarito from Google Fonts in the mockups only.

**Spec:** `docs/superpowers/specs/2026-10-07-ring-tail-redesign-design.md`. Read it before starting; this plan argues from it and copies from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Task 1: ADR 0022 and the notes in earlier ADRs](#task-1-adr-0022-and-the-notes-in-earlier-adrs)
- [Task 2: The mockups](#task-2-the-mockups)
- [Task 3: visual-design.md](#task-3-visual-designmd)
- [Task 4: Requirements, architecture, stack overview and README](#task-4-requirements-architecture-stack-overview-and-readme)
- [Task 5: Roadmap and open points](#task-5-roadmap-and-open-points)
- [After tasks 1–5: final pass and the PR](#after-tasks-15-final-pass-and-the-pr)

## Global Constraints

- **Where:** the worktree `/home/lemekk/workspace/szop-ring-tail`, branch `docs/ring-tail-redesign`, made from `origin/main`. The main checkout `/home/lemekk/workspace/szop` belongs to another session working on PH-05: **never run git commands there, never write files there.** The worktree is a one-off exception to [ADR 0009](../../decisions/0009-git-workflow.md), decision 5, approved by the owner.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, push the branch (`git push -u origin docs/ring-tail-redesign` the first time, `git push` after) and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **Commits** follow Conventional Commits (`docs(scope): description`, imperative) and end with the session's attribution lines, naming the model that wrote the commit.
- **ADR number 0022, open point numbers OP-079, OP-080, OP-081.** ADR 0021 is PH-05's, on its own branch. Before Task 1 and before the PR, run `git fetch origin` and check `origin/main` for `docs/decisions/0022-*` and for `OP-079` to `OP-081` in `docs/open-points.md`; if either is taken, stop and tell the owner.
- **Writing style ([CLAUDE.md](../../../CLAUDE.md)):** requirements, use cases and requirement areas are always links, never plain IDs (outside headings and code); every status gets its icon before its word; no icons in headings; niche acronyms spelled out on first use and in the glossary; a long document's `## Contents` lists every `##` and `###` heading.
- **Accepted ADRs are not rewritten.** In ADR 0013 and ADR 0001 only the status line and notes at the end of decision cells change (mechanical changes). Audits, earlier specs and plans stay as written.
- **Values, exactly these** (spec, [Palette and semantic roles](../specs/2026-10-07-ring-tail-redesign-design.md#palette-and-semantic-roles)): `fur #CBD0D6`; `sage-100 #E3EEE7`, `sage-300 #86C29C`, `sage-500 #5F9273`, `sage-700 #3F7357`, `sage-950 #10261A`; Tailwind `gray-200 #E5E7EB`, `gray-400 #9CA3AF`, `gray-500 #6B7280`, `gray-600 #4B5563`, `gray-700 #374151`, `gray-800 #1F2937`, `gray-900 #111827`, `gray-950 #030712`.
- **Copy, exactly these strings** wherever the docs or mockups show the screen: "The haul", "€28.47 of €36.54", "8 of 11 items", "€8.07 to go", "+6 more", "+ Add item", "Add", "Newest first · ↶ puts an item back", "Put all back", "Check items off to drop them here", "Nothing on this list yet", "Everything's in the haul". Sentence case everywhere.
- **Links between docs** are relative and must resolve: from `docs/decisions/` to the requirements is `../requirements/functional-requirements.md#…`, from `docs/` it is `requirements/functional-requirements.md#…`, from `docs/architecture/` it is `../requirements/functional-requirements.md#…`.

## Review Focus

Things no task's own check catches, most likely first. Each has a check in the task named.

- **A stale mention left behind**: teal, Figtree, "calm and roomy", "the checked part", the hide toggle, or [ORD-4](../../requirements/functional-requirements.md#ord-4) as live, in a living doc. A reader would trust the stale line. Check: the grep in [the final pass](#after-tasks-15-final-pass-and-the-pr).
- **A broken anchor**: a link to `#the-list-and-the-haul`, `#op-079` or a renamed heading that does not exist. Check: the link check in the final pass.
- **The dark mode mockup does not read**: the cards and the haul blend into the `gray-900` page (contrast 1.2:1 and 1.1:1). Check: Task 2, step 5, with the fallback the spec names.
- **Polish characters in Gabarito**: a product name like "Żółty ser" renders in a fallback font. Check: Task 2, step 4.
- **Merge conflicts with PH-05**: its branch also changes `stack-overview.md`, `architecture.md` and `glossary.md`. Edit only the lines named here, so a conflict stays a few lines; the final pass checks whether PH-05 has merged.

---

### Task 1: ADR 0022 and the notes in earlier ADRs

**Files:**
- Create: `docs/decisions/0022-ring-tail-redesign.md`
- Modify: `docs/decisions/0013-visual-design.md` (status line; the last cell of decisions 6, 10, 11, 13, 14, 16 and 18)
- Modify: `docs/decisions/0001-functional-requirements-scope.md` (status line; the last cell of decision 9)
- Modify: `docs/glossary.md` (two rows)

**Interfaces:**
- Produces: the file `docs/decisions/0022-ring-tail-redesign.md`, titled "ADR 0022 — "Ring tail" visual redesign", with decisions numbered 1 to 13 as below. Tasks 3 to 5 link to it as `0022-ring-tail-redesign.md` and cite its decision numbers.

- [x] **Step 1: Check the numbers are free**

```bash
git fetch origin
git ls-tree --name-only origin/main docs/decisions/ | grep 0022 || echo "0022 free"
git show origin/main:docs/open-points.md | grep -E "OP-079|OP-080|OP-081" || echo "OPs free"
```

Expected: `0022 free` and `OPs free`. Otherwise stop and tell the owner.

- [x] **Step 2: Write ADR 0022**

Follow the shape of [ADR 0020](../../decisions/0020-database-details.md). Its exact header:

```markdown
# ADR 0022 — "Ring tail" visual redesign

- **Status:** ✅ Accepted
- **Date:** 2026-10-07
- **Supersedes:** [ADR 0013](0013-visual-design.md), decisions 6 (the look; see decision 1), 11 (teal; see decision 2) and 13 (Figtree; see decision 10); [ADR 0001](0001-functional-requirements-scope.md), decision 9 (checked items in a separate part, and the toggle hiding them; see decisions 1, 4 and 6)
- **Extends:** [ADR 0013](0013-visual-design.md), decisions 10 (the `fur` and `sage` colors and the `haul-*` roles; see decision 9), 14 (`--radius-surface`; see decision 11) and 18 (the list-and-haul pattern and the add bar's label; see decisions 3 to 8 and 13)
- **Refines:** [ADR 0013](0013-visual-design.md), decision 16 (the sage tile and the Gabarito wordmark; see decision 12)
```

**`## Context`**, one paragraph: [OP-073](../open-points.md#op-073) recorded a design exploration of 2026-10-06, "Ring tail" ([screenshot](../ideas/visual-design/ring-tail.png)), which the owner liked: a fur-gray page with white rounded cards, Gabarito, a ringed raccoon tail as the progress bar, and checked items dropping out of the list as chips into a dark "haul" tray that also held the add bar. It was brainstormed on 2026-10-07, before PH-14 builds the design system, to keep, adjust or drop it, and to settle what the exploration left open: the green of its logo, the add bar inside the haul, a haul with 40 checked items, the remaining amount [ITM-8](../requirements/functional-requirements.md#itm-8) asks for, and dark mode. The design is in the [spec](../superpowers/specs/2026-10-07-ring-tail-redesign-design.md); the options were compared as mockups in the visual companion.

**`## Decisions`**: the table header `| # | Topic | Options considered | Decision and reasoning |`. Rows 1 to 10 are the spec's [decisions table](../specs/2026-10-07-ring-tail-redesign-design.md#decisions-taken-in-the-brainstorm), copied verbatim, with one change: at the end of row 1 add "It supersedes ADR 0013, decision 6, and ADR 0001, decision 9." Then these three rows, verbatim:

```markdown
| 11 | Shape | One `--radius` of 12 px for everything, as today; a second radius for surfaces | **A second token, `--radius-surface`: 18 px for category cards, 24 px for the top corners of the haul and its drawer.** `--radius` stays 12 px for buttons and inputs. The exploration's surfaces are clearly rounder than its controls, and one token for both would make either the buttons too round or the cards too square. |
| 12 | Brand | Keep the teal tile; a sage tile | **The raccoon on a `sage-500` tile; the wordmark "szop" in lowercase Gabarito Bold, `sage-700` (`sage-300` in dark mode).** Only the tile's color changes in `raccoon.svg`. On the list screen the tile sits at the right of the header, as in the exploration. |
| 13 | The add bar's label | A visible label above the add bar; a placeholder with an accessible name | **The one exception to "labels are always visible"**: the add bar works like a search field, with "+ Add item" as its placeholder, the accessible name "Add item to *list name*" and a visible "Add" button. A label above it would take a line from the list on every screen, for a field whose purpose the button already states. |
```

After the table, the spec's paragraph "Two smaller changes from the exploration…", verbatim.

**`## Consequences`**, these bullets, verbatim:

```markdown
- **The design system changes before it is built.** [visual-design.md](../architecture/visual-design.md) describes the Ring tail look, the `fur` and `sage` colors, the `haul-*` roles, Gabarito, `--radius-surface`, the sage brand and the list-and-haul pattern, with new mockups; PH-14 builds it ([OP-056](../open-points.md#op-056)).
- **Checked items leave the list.** [ORD-1](../requirements/functional-requirements.md#ord-1), [ORD-2](../requirements/functional-requirements.md#ord-2), [ORD-5](../requirements/functional-requirements.md#ord-5) and [UC-3](../requirements/functional-requirements.md#uc-3-shop-in-a-store) describe the haul; [ORD-4](../requirements/functional-requirements.md#ord-4), the toggle hiding checked items, is ✖️ dropped. [ITM-8](../requirements/functional-requirements.md#itm-8) and [LST-5](../requirements/functional-requirements.md#lst-5) keep their wording: the haul shows all three totals, and "Uncheck all" is the drawer's "Put all back".
- **List items record when they were checked**, which orders the haul; how "checked" is stored is [OP-080](../open-points.md#op-080) for PH-17.
- **PH-17 builds the haul**: its chips, putting items back, the drawer and the progress by item count. It grows with them, so its brainstorm considers splitting the drawer off ([OP-081](../open-points.md#op-081)), and it picks a drawer component that works under the CSP ([OP-079](../open-points.md#op-079)). **PH-21 adds the money** in the haul's header and "Put all back", and no longer delivers [ORD-4](../requirements/functional-requirements.md#ord-4).
- **The font costs 16 KB more**: Gabarito's Latin file is 36 KB against Figtree's 20 KB. Fonts are outside the 200 KB JavaScript budget of [NFR-3](../requirements/functional-requirements.md#nfr-3), and `font-display: swap` keeps text visible while it loads.
- **A haul panel on wide screens** (decision 7) is not built; it can come back as a 💡 future extension if shopping at a desktop turns out to matter.
- [OP-073](../open-points.md#op-073) is closed.
```

- [x] **Step 3: Add the notes to ADR 0013**

Status line: replace the end of line 3 so it reads:

```markdown
- **Status:** ✅ Accepted — its consequences refined by [ADR 0014](0014-roadmap.md), decision 9 (the UI foundation comes with the first MVP phase, PH-14, rather than the first phase that builds UI); decisions 6, 11 and 13 superseded, 10, 14 and 18 extended and 16 refined by [ADR 0022](0022-ring-tail-redesign.md) (the Ring tail look: sage instead of teal, Gabarito instead of Figtree, the haul)
```

At the end of each decision's last cell, just before the closing ` |`, append (after one space):

| Decision | Note |
|---|---|
| 6 | `<br>🔁 **Superseded by [ADR 0022](0022-ring-tail-redesign.md), decision 1:** the Ring tail look, a fur-gray page with white cards and a dark tray, the haul, collecting the checked items.` |
| 10 | `<br>➕ **Extended by [ADR 0022](0022-ring-tail-redesign.md), decision 9:** the palette adds a custom \`fur\` color and a small \`sage\` scale, and the roles add \`haul\`, \`haul-foreground\`, \`haul-muted\`, \`haul-chip\` and \`haul-accent\`.` |
| 11 | `<br>🔁 **Superseded by [ADR 0022](0022-ring-tail-redesign.md), decision 2:** the accent is sage (\`sage-700\` in light mode, \`sage-300\` in dark mode) instead of teal.` |
| 13 | `<br>🔁 **Superseded by [ADR 0022](0022-ring-tail-redesign.md), decision 10:** Gabarito instead of Figtree, with weight 800 added.` |
| 14 | `<br>➕ **Extended by [ADR 0022](0022-ring-tail-redesign.md), decision 11:** \`--radius-surface\`, 18 px for cards and 24 px for the haul's top corners.` |
| 16 | `<br>✏️ **Refined by [ADR 0022](0022-ring-tail-redesign.md), decision 12:** the tile is \`sage-500\` and the wordmark Gabarito Bold in sage.` |
| 18 | `<br>➕ **Extended by [ADR 0022](0022-ring-tail-redesign.md), decisions 3 to 8 and 13:** the list-and-haul pattern (the add bar above the haul, the drawer, progress in the haul) and the add bar's label as the one exception to visible labels; the focus ring is sage.` |

(The backslashes above only escape the backticks inside this table; write plain backticks in the ADR.)

- [x] **Step 4: Add the notes to ADR 0001**

Status line becomes:

```markdown
- **Status:** ✅ Accepted — decision 1 superseded by [ADR 0002](0002-technical-architecture.md), and with it the local browser storage in the guest-mode consequence (guest workspaces live on the server; the migration path into an account remains); decision 9 superseded by [ADR 0022](0022-ring-tail-redesign.md) (checked items go to the haul; the hide toggle is dropped)
```

At the end of decision 9's last cell, before ` |`, append:

```markdown
<br>🔁 **Superseded by [ADR 0022](0022-ring-tail-redesign.md), decisions 1, 4 and 6:** checked items leave the list for the haul, a tray apart from it, most recently checked first; the toggle hiding them is dropped.
```

- [x] **Step 5: Add the glossary rows**

In `docs/glossary.md`, under `## Acronyms`, between the `OAuth / OIDC` row and the `OpenSSF` row:

```markdown
| **OFL** | SIL Open Font License | A free license for fonts: they may be used, bundled and shipped with software, but not sold on their own. Gabarito is under it (see ADR 0022). |
```

Under `## Terms`, between the `Graceful shutdown` row and the `Headless component library` row:

```markdown
| **Haul** | In Szop's list screen, the dark tray at the bottom that collects the checked items, shows how far along the shopping is and opens into a drawer listing them all (see `visual-design.md`). |
```

- [x] **Step 6: Check and commit**

```bash
grep -c "0022-ring-tail-redesign.md" docs/decisions/0013-visual-design.md   # expect 8 (status + 7 notes)
grep -c "0022-ring-tail-redesign.md" docs/decisions/0001-functional-requirements-scope.md   # expect 2
pnpm format:check
git add docs/decisions/0022-ring-tail-redesign.md docs/decisions/0013-visual-design.md docs/decisions/0001-functional-requirements-scope.md docs/glossary.md docs/superpowers/plans/2026-10-07-ring-tail-redesign.md
git commit -m "docs(adr): add ADR 0022, the Ring tail redesign"
```

If `pnpm format:check` is not available in the worktree because `node_modules` is missing, run `pnpm install --frozen-lockfile` first.

---

### Task 2: The mockups

**Files:**
- Modify: `docs/architecture/visual-design/raccoon.svg` (line 3, the tile)
- Replace: `docs/architecture/visual-design/list-screen.png`, `navigation.png`, `brand.png`
- Create: `docs/architecture/visual-design/haul-drawer.png`
- Scratch (not committed): `$CLAUDE_JOB_DIR/tmp/mockups/*.html`

**Interfaces:**
- Produces: the four PNG file names above; Task 3 embeds them.

The mockups are pictures, not code: HTML pages styled with the spec's tokens, rendered to PNG. The brainstorm's mockups (in the main checkout's `.superpowers/brainstorm/597300-1791393805/content/`, readable, never written) are the starting point for markup: `progress-in-haul.html` (list, haul, drawer), `desktop.html` (sidebar) and `dark-mode.html` (variables per scheme). Read them; write new files only under `$CLAUDE_JOB_DIR/tmp/mockups/`.

- [ ] **Step 1: Change the raccoon's tile**

In `raccoon.svg`, line 3: `fill="#0f766e"` becomes `fill="#5F9273"`. Nothing else changes.

- [ ] **Step 2: Write the four pages**

Each page is a full HTML document with `<link href="https://fonts.googleapis.com/css2?family=Gabarito:wght@400..800&display=swap" rel="stylesheet">`, a body background of `#E5E7EB` (like the current images), the raccoon inlined from the new `raccoon.svg`, and small captions in `system-ui` 13 px `#4B5563` under each frame, like the current images. Use the colors of [Global Constraints](#global-constraints) through CSS custom properties named after the roles (`--background`, `--card`, `--haul`, …), one set for light and one for dark, so the pictures follow the spec's table exactly. Phones are 330 × 680 px frames with 28 px corners.

1. **`list-screen.html`, 760 × 760 px**: two phones side by side, captioned "Light" and "Dark (follows the system)". Each shows the list "Weekly shop": header (← , title, raccoon tile 44 px); the card "Fruit & vegetables", "2 left", with "Bananas" (note "ripe ones, not green", "6 pcs", "€1.99") and "Baby spinach" ("1", "€2.10"); the card "Dairy", "1 left", with "Greek yoghurt" ("2", "€3.98"); the add bar; the collapsed haul with the handle, "The haul", "€28.47 of €36.54", the bar at 73%, "8 of 11 items", "€8.07 to go", and the chips "Rice €1.89", "Coffee €6.99", "+6 more".
2. **`haul-drawer.html`, 1100 × 760 px**: three light phones, captioned "The drawer, scrolled to its end", "Nothing checked yet" and "Typing in the add bar". (a) the list dimmed behind the drawer at 75% height: the pinned header as in the collapsed haul, "Newest first · ↶ puts an item back", the rows "Eggs 10 pcs €3.20", "Bread 1 €2.80", "Milk 2 l €4.66", "Tomatoes 500 g €3.49", each with a ↶ button, then a full-width "Put all back" button (`haul-chip` background, white text). (b) the same list with all items unchecked (add "Tomatoes" to Fruit & vegetables and "Milk" to Dairy) and the haul showing "€0.00 of €36.54", an empty bar, "0 of 11 items", "€36.54 to go" and the line "Check items off to drop them here" where the chips go. (c) the add bar focused, its field showing "Oat mi" and a `ring` focus ring, the haul folded to one line "The haul · €28.47", and below it a `#9CA3AF` block 220 px high captioned inside "keyboard".
3. **`navigation.html`, 1250 × 745 px**, the same layout as the current `navigation.png`: a phone with "☰ Lists", three list cards ("Weekly shop", "8 of 11 · €8.07 to go"; "Hardware store", "0 of 5"; "Birthday party", "2 of 12") and a full-width sage "+ New list" button pinned at the bottom, captioned "Phone: ☰ opens the menu as a drawer"; a 1024-wide desktop with the sidebar (raccoon 32 px and "szop" wordmark, "Lists" active on `sage-100` with `sage-700` text, "Templates", "Archive", "SETUP", "Catalog", "Categories", "Units", "Settings") next to the same three cards and a "+ New list" button at the top right, captioned "Desktop (from 1024 px): the menu is a permanent sidebar".
4. **`brand.html`, 560 × 250 px**, the same layout as the current `brand.png`: the raccoon at 128, 32 and 16 px; a browser tab "Weekly shop – Szop" with the 16 px raccoon; the mark with the wordmark "szop" (Gabarito 700, 30 px) on a white header (`sage-700` text) and on a `gray-900` header (`sage-300` text).

- [ ] **Step 3: Render them**

Serve the folder and render each page with Windows Chrome in headless mode (the WSL2 setup reaches `localhost` from Windows):

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$CLAUDE_JOB_DIR/tmp/mockups" &
SERVER=$!
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT='C:\Users\lemek\AppData\Local\Temp'
for spec in list-screen:760,760 haul-drawer:1100,760 navigation:1250,745 brand:560,250; do
  name=${spec%%:*}; size=${spec#*:}
  "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=5000 \
    --window-size=$size --screenshot="$OUT\\$name.png" "http://localhost:8765/$name.html"
  cp "/mnt/c/Users/lemek/AppData/Local/Temp/$name.png" "/home/lemekk/workspace/szop-ring-tail/docs/architecture/visual-design/$name.png"
done
kill $SERVER
```

Expected: four PNGs of the given sizes (`file docs/architecture/visual-design/*.png`).

- [ ] **Step 4: Check the font**

Open each PNG (the Read tool shows images) and check that every text is Gabarito (its "€" and "&" have the shapes of the brainstorm mockups, not the system font's). Then render one extra line, "Żółty ser · Łosoś · Gęś", in weights 400, 600, 700 and 800 on a scratch page, and check that every Polish letter is Gabarito, not a fallback. Note the result for the PR description.

- [ ] **Step 5: Check the dark mockup reads**

Look at the dark phone in `list-screen.png`: the cards (`gray-800`) and the haul (`gray-950`) must read as separate from the page (`gray-900`). If they do not, change the dark `background` to `#18202D` (halfway between `gray-900` and `gray-800`), re-render, and record it: the value goes into Task 3's color table and a sentence into ADR 0022's decision 9 ("Dark mode's page is `#18202D`, not `gray-900`, so the cards and the haul stand apart from it"), amended in this task's commit.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/visual-design/ docs/superpowers/plans/2026-10-07-ring-tail-redesign.md
git commit -m "docs(design): draw the Ring tail mockups"
```

The owner's review of this task is the approval of the mockups: on pushing, send the four images to the owner.

---

### Task 3: visual-design.md

**Files:**
- Modify: `docs/architecture/visual-design.md`

**Interfaces:**
- Consumes: ADR 0022 (Task 1), the PNGs (Task 2).
- Produces: the heading `### The list and the haul` under `## 5. Layout and navigation`, anchor `#the-list-and-the-haul`, which Tasks 4 and 5 may link to.

- [ ] **Step 1: The introduction**

Line 3: "The decisions behind it, with the alternatives considered, are in [ADR 0013](../decisions/0013-visual-design.md);" becomes "The decisions behind it, with the alternatives considered, are in [ADR 0013](../decisions/0013-visual-design.md) and [ADR 0022](../decisions/0022-ring-tail-redesign.md), which replaced its look, color and font;".

- [ ] **Step 2: Section 1, the look**

Replace the paragraph and the image of `## 1. The look` with:

```markdown
**Ring tail**: a fur-gray page holds white, generously rounded category cards, and a dark tray at the bottom, **the haul**, collects what is already in the basket ([The list and the haul](#the-list-and-the-haul)). Sage is the one accent, and color is used sparingly. Rows are 56 px high with large round checkboxes, for one hand on a phone in a store. The look comes from a design exploration ([its screenshot](../ideas/visual-design/ring-tail.png)), adjusted in [ADR 0022](../decisions/0022-ring-tail-redesign.md).

![The list screen in light and dark mode: white category cards on a fur-gray page, large round checkboxes, quantities and prices on the right, the add bar, and the dark haul at the bottom with its progress bar and chips](visual-design/list-screen.png)
```

- [ ] **Step 3: Section 3, tokens**

In the section's introduction: "**The palette** is Tailwind's built-in colors;" becomes "**The palette** is Tailwind's built-in colors plus two of Szop's own, `fur` and `sage`;", and "The roles are shadcn/ui's, plus `warning`;" becomes "The roles are shadcn/ui's, plus `warning` and the `haul-*` roles of the haul;".

Under `### Color`, replace the sentence "The accent is **teal**; …" and the table with:

```markdown
The accent is **sage**; neutrals come from Tailwind's **`gray`**, and the light page is **`fur`**. The two custom colors, defined next to Tailwind's palette:

- **`fur`**: `#CBD0D6`.
- **`sage`**, only the steps used: `sage-100 #E3EEE7`, `sage-300 #86C29C`, `sage-500 #5F9273` (the logo's tile), `sage-700 #3F7357`, `sage-950 #10261A`. A phase that needs another step adds it here and checks its contrast.
```

followed by the spec's roles table ([Palette and semantic roles](../specs/2026-10-07-ring-tail-redesign-design.md#palette-and-semantic-roles)), copied verbatim with its "Used for" column but without the 🆕 marks (here every role is simply current). Leave out the spec's sentence "`destructive` and `warning` are unchanged."; the table already shows their values. If Task 2, step 5 changed the dark page, the `background` row's dark value is that value.

Replace the **Contrast** paragraph with:

```markdown
**Contrast:** every text pair meets 4.5:1 and every UI part (checkbox borders, the focus ring, the progress fill) 3:1 against its background, in both schemes ([NFR-2](../requirements/functional-requirements.md#nfr-2)). The narrowest are `primary` on `accent` (4.6:1) and the focus ring on the fur page (3.6:1); every pair is listed in the [redesign spec](../superpowers/specs/2026-10-07-ring-tail-redesign-design.md#contrast). `gray-400` borders on white are only about 2.5:1, which is why `input` is `gray-500` in light mode. axe checks every page in light and dark.
```

Under `### Dark mode`, append to the first paragraph: "**The haul stays the darkest surface in both schemes**: `gray-800` on the fur page in light mode, `gray-950` on the `gray-900` page in dark mode, so the screen keeps its shape." (If Task 2, step 5 changed the dark page, write its value instead of `gray-900`.)

Under `### Typography`, replace the first bullet with:

```markdown
- **[Gabarito](https://fontsource.org/fonts/gabarito)**, self-hosted from `@fontsource-variable/gabarito`, under the SIL Open Font License (OFL): one variable font for every weight, 36 KB for Latin, with Latin Extended downloaded only when a character needs it, such as a Polish product name. Bundled by Vite and served from our origin; `font-display: swap`, with the system font as the fallback.
```

and in the second bullet "Weights 400, 600 and 700." becomes "Weights 400, 600, 700 and 800; 800 is for the screen title and the haul's amount."

Under `### Spacing, size, shape and motion`, the `--radius` row becomes:

```markdown
| `--radius` | 12 px for buttons and inputs; checkboxes, chips and pills fully round |
| `--radius-surface` | 18 px for category cards; 24 px for the top corners of the haul and its drawer |
```

- [ ] **Step 4: Section 4, brand**

The brand mark bullet: "on a teal rounded square" becomes "on a sage rounded square (`sage-500`)". The wordmark bullet becomes:

```markdown
- **The wordmark** is "szop" in lowercase Gabarito Bold, `sage-700` (`sage-300` in dark mode), next to the mark. On the list screen the mark alone sits at the right of the header.
```

Update the image's alt text: "…next to the wordmark on light and dark headers" stays; nothing else changes in it.

- [ ] **Step 5: Section 5, the list and the haul**

In the bullets, "**Inside a list**, the menu gives way to a back arrow, and the add bar sits at the bottom." becomes "**Inside a list**, the menu gives way to a back arrow, and the add bar and the haul sit at the bottom ([below](#the-list-and-the-haul))."

After the navigation image, add a new subsection. Its text is the spec's sections [The list and the haul](../specs/2026-10-07-ring-tail-redesign-design.md#the-list-and-the-haul), [Amounts](../specs/2026-10-07-ring-tail-redesign-design.md#amounts), [Desktop](../specs/2026-10-07-ring-tail-redesign-design.md#desktop) and [States](../specs/2026-10-07-ring-tail-redesign-design.md#states), copied verbatim as one subsection with bold lead-ins instead of `###` headings ("**Amounts.**", "**Desktop.**", "**States:**" then the table), with the relative links fixed for `docs/architecture/` (`../requirements/…`), and this opening and image:

```markdown
### The list and the haul

The main screen's pattern, decided in [ADR 0022](../decisions/0022-ring-tail-redesign.md), decisions 3 to 8: **checked items leave the list and drop into the haul**, a dark tray at the bottom, so the list shows only what is left. The list phases build it and design their screens on top of it.

![Three phones: the haul's drawer open at 75% of the screen, scrolled to its "Put all back" button; the haul before anything is checked; and the haul folded to one line while typing in the add bar](visual-design/haul-drawer.png)
```

- [ ] **Step 6: Section 6, forms**

The bullet "**Labels are always visible**, never placeholder-only. …" gets a second sentence after "never placeholder-only.": "The one exception is the list's add bar, which works like a search field: its accessible name says which list it adds to, and its button says "Add" ([ADR 0022](../decisions/0022-ring-tail-redesign.md), decision 13)."

- [ ] **Step 7: Contents, check and commit**

Add `  - [The list and the haul](#the-list-and-the-haul)` under `- [5. Layout and navigation](#5-layout-and-navigation)` in `## Contents`.

```bash
grep -n -i "teal\|figtree\|calm and roomy" docs/architecture/visual-design.md   # expect no output
pnpm format:check
git add docs/architecture/visual-design.md docs/superpowers/plans/2026-10-07-ring-tail-redesign.md
git commit -m "docs(design): describe the Ring tail look and the haul"
```

---

### Task 4: Requirements, architecture, stack overview and README

**Files:**
- Modify: `docs/requirements/functional-requirements.md` (ORD-1, ORD-2, ORD-4, ORD-5, UC-3)
- Modify: `docs/architecture/architecture.md` (data model: list items; the assets bullet; the state table)
- Modify: `docs/architecture/stack-overview.md` (two lines)
- Modify: `README.md` (one feature line)

**Interfaces:**
- Consumes: ADR 0022 (Task 1); the anchor `#the-list-and-the-haul` (Task 3); OP-080 (written in Task 5, linked here: the link resolves once Task 5 lands, and the final pass checks it).

- [ ] **Step 1: The requirements**

In `docs/requirements/functional-requirements.md`, the bodies under the headings (the headings stay):

- `#### ORD-1`: `🎯 [MVP] Checked items leave the list and go to **the haul**, a tray apart from the list that shows what is already in the basket. Putting an item back returns it to the list.`
- `#### ORD-2`: `🎯 [MVP] The list's items are sorted by the global category order, then alphabetically by name. Uncategorized items come last. The haul shows the most recently checked items first.`
- `#### ORD-4`: `✖️ Dropped by [ADR 0022](../decisions/0022-ring-tail-redesign.md): it was "a toggle hides checked items". Checked items now leave the list for the haul ([ORD-1](#ord-1)), so there is nothing to hide.`
- `#### ORD-5`: in its sentence, "and the unchecked/checked split ([ORD-1](#ord-1)) still applies" becomes "and checked items still go to the haul ([ORD-1](#ord-1))".
- `#### UC-3 Shop in a store`: `The user walks the store in category order, checking items off. Checked items drop into the haul, so the list shows only what is left. The haul shows what is in the basket, how many items are done and what is left to spend.`

Then check whether the document lists MVP requirements elsewhere (`grep -n "ORD-4\|ord-4" docs/requirements/functional-requirements.md`): only the ORD-4 heading and its own body should remain.

- [ ] **Step 2: The architecture**

In `docs/architecture/architecture.md`:

- The **List items** bullet under `### Data model highlights` gets this sentence at its end: "They also record when they were checked, which orders the haul with the most recently checked first ([ORD-2](../requirements/functional-requirements.md#ord-2)); whether "checked" is that timestamp alone or a flag next to it is [OP-080](../open-points.md#op-080)."
- The **Assets** bullet: "the Figtree font (`@fontsource-variable/figtree`)" becomes "the Gabarito font (`@fontsource-variable/gabarito`)".
- The state table's row `| **Device preference** | "hide checked items" toggle ([ORD-4](../requirements/functional-requirements.md#ord-4)) | \`localStorage\` |` becomes `| **Device preference** | none yet | \`localStorage\` |`.

- [ ] **Step 3: The stack overview**

In `docs/architecture/stack-overview.md`:

- Section 5, step 2: "the shared ordering rules move it to the checked part" becomes "the shared ordering rules move it from the list to the haul".
- Section 14, the design tokens bullet: "`--primary` instead of `#0f766e`" becomes "`--primary` instead of `#3F7357`", and "(`teal-700`, `gray-500`)" becomes "(`gray-500`, plus Szop's own `fur` and `sage-700`)".

- [ ] **Step 4: The README**

The feature line "- **Shopping** — check items off as you go and hide what is already in the basket." becomes "- **Shopping** — check items off as you go: they drop into the haul at the bottom, so the list shows only what is left."

- [ ] **Step 5: Check and commit**

```bash
grep -rn -i "checked part\|hide checked\|hides checked\|figtree\|teal-" docs/requirements docs/architecture README.md   # expect no output
pnpm format:check
git add docs/requirements/functional-requirements.md docs/architecture/architecture.md docs/architecture/stack-overview.md README.md docs/superpowers/plans/2026-10-07-ring-tail-redesign.md
git commit -m "docs(requirements): move checked items to the haul"
```

---

### Task 5: Roadmap and open points

**Files:**
- Modify: `docs/roadmap.md` (PH-14, PH-17, PH-21 entries)
- Modify: `docs/open-points.md` (OP-056, OP-073, three new entries)

**Interfaces:**
- Produces: the anchors `#op-079`, `#op-080` and `#op-081`, linked from ADR 0022 (Task 1) and `architecture.md` (Task 4).

- [ ] **Step 1: The roadmap**

In `docs/roadmap.md`:

- PH-14, **Delivers:** "the UI foundation of [ADR 0013](decisions/0013-visual-design.md) and the [visual design](architecture/visual-design.md): Tailwind CSS, shadcn/ui on Base UI under the CSP, the design tokens, Figtree, Lucide, the favicon and the logo." becomes "the UI foundation of [ADR 0013](decisions/0013-visual-design.md) and [ADR 0022](decisions/0022-ring-tail-redesign.md), and the [visual design](architecture/visual-design.md): Tailwind CSS, shadcn/ui on Base UI under the CSP, the design tokens, Gabarito, Lucide, the favicon and the logo."
- PH-17, **Goal:** becomes "a user adds items to a list by name, edits any of their fields, checks, unchecks and removes them, and sees the list sorted by category order or in the order they were added; checked items drop into the haul, which shows how many are done and puts an item back on a tap." **Delivers:** gets, after the ORD-5 link, "; the haul with its chips and drawer ([ADR 0022](decisions/0022-ring-tail-redesign.md))".
- PH-21, **Goal:** becomes "in the store, a user checks items off into the haul and sees in it the spent and remaining totals; afterwards, "Put all back" resets the list for next week." **Delivers:** "[ITM-8](requirements/functional-requirements.md#itm-8), [ORD-4](requirements/functional-requirements.md#ord-4), [LST-5](requirements/functional-requirements.md#lst-5);" becomes "[ITM-8](requirements/functional-requirements.md#itm-8) (the amounts in the haul), [LST-5](requirements/functional-requirements.md#lst-5);".

The README's roadmap diagram shows phase names and statuses only; check it names neither Figtree nor [ORD-4](../../requirements/functional-requirements.md#ord-4) (`grep -n -i "figtree\|ORD-4" README.md`, expect no output) and leave it.

- [ ] **Step 2: OP-056**

In OP-056's text, "Figtree from `@fontsource-variable/figtree`" becomes "Gabarito from `@fontsource-variable/gabarito`", and its **Source** line becomes "[ADR 0013](decisions/0013-visual-design.md), decisions 7–17 and 19; [ADR 0022](decisions/0022-ring-tail-redesign.md), decisions 2 and 9–12".

- [ ] **Step 3: Close OP-073**

Move the whole `#### OP-073` entry from the PH-14 group to the end of `## Closed` (after OP-065, IDs in order), unchanged except its status line:

```markdown
- **Status:** ✅ Closed: kept and adjusted in [ADR 0022](decisions/0022-ring-tail-redesign.md), designed in the [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md): sage instead of the exploration's green, the add bar above the haul, one row of chips with a drawer, progress inside the haul, the same tray on a desktop, and a darkest-haul dark mode. The work it leaves is OP-079 to OP-081 (PH-17) and OP-056 (PH-14)
```

- [ ] **Step 4: Add OP-079 to OP-081**

At the end of the `### PH-17 List items` group (after its last entry, before `### PH-18`), in this order:

```markdown
#### OP-079

**Pick a drawer component that works under the CSP** for the haul's drawer ([visual-design.md](architecture/visual-design.md#the-list-and-the-haul)). shadcn/ui's Drawer is built on vaul; check whether vaul injects `<style>` elements, which the CSP forbids ([visual-design.md](architecture/visual-design.md#under-the-content-security-policy)). If it does, shape Base UI's Dialog as a bottom sheet, with dragging added on top. Either way the drawer is a modal dialog: focus moves in and is trapped, Esc and the dimmed list close it, and dragging is never the only way to open or close it.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), decisions 4 and 5; [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md#out-of-scope)
- **Status:** ⬜ Open

#### OP-080

**Decide how "checked" is stored.** The haul orders items by when they were checked, so list items need a `checked_at` timestamp. Either it is the only field (`checked_at IS NOT NULL` means checked), or a `checked` flag stays next to it. One field cannot disagree with itself; a flag keeps the API's `{ "checked": true }` shape and simple queries. "Put all back" ([LST-5](requirements/functional-requirements.md#lst-5)) and duplicating a list must clear it either way.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), consequences; [redesign spec](superpowers/specs/2026-10-07-ring-tail-redesign-design.md#architecture-changes)
- **Status:** ⬜ Open

#### OP-081

**Consider splitting PH-17.** The haul makes PH-17 bigger: besides adding, editing, checking and sorting items, it builds the haul, its chips, putting items back, the drawer (a new component, [OP-079](#op-079)) and the progress by item count. Its brainstorm checks the plan against the size rule of [ADR 0014](decisions/0014-roadmap.md), decision 6, and splits the drawer into a phase of its own if it is too big.

- **Source:** [ADR 0022](decisions/0022-ring-tail-redesign.md), consequences
- **Status:** ⬜ Open
```

- [ ] **Step 5: Check and commit**

```bash
grep -c "^#### OP-073" docs/open-points.md   # expect 1, under ## Closed
awk '/^## Closed/{c=1} /^#### OP-073/{print (c?"closed":"NOT closed")}' docs/open-points.md   # expect closed
grep -n -i "figtree" docs/roadmap.md docs/open-points.md   # expect only OP-073's own text, under Closed
pnpm format:check
git add docs/roadmap.md docs/open-points.md docs/superpowers/plans/2026-10-07-ring-tail-redesign.md
git commit -m "docs(roadmap): plan the haul into PH-17 and PH-21"
```

---

## After tasks 1–5: final pass and the PR

- [ ] **Step 1: Stale mentions**

```bash
grep -rn -i "teal\b\|teal-\|figtree\|calm and roomy\|checked part\|hide checked\|hides checked" --include=*.md . \
  | grep -v "docs/decisions/\|docs/audits/\|docs/superpowers/\|^./docs/open-points.md:.*OP-073"
```

Expected: no output. (ADRs, audits, earlier specs and plans stay as written; OP-073's closed entry keeps its history.)

- [ ] **Step 2: Links**

Check every link this branch added or changed resolves, file and anchor. For each changed Markdown file, list its links and check them:

```bash
git diff --name-only origin/main -- '*.md'
grep -on "](\([^)]*\))" <file>   # per file; open each target and find the anchor's heading
```

At least: `#the-list-and-the-haul`, `#contrast` and `#palette-and-semantic-roles` in the spec, `#op-079`, `#op-080`, `#op-081`, `0022-ring-tail-redesign.md` from `docs/`, `docs/decisions/` and `docs/architecture/`, and the four images.

- [ ] **Step 3: PH-05**

`git fetch origin && git log --oneline origin/main -5`. If PH-05 has merged, `git merge origin/main`, resolve conflicts in `stack-overview.md`, `architecture.md` and `glossary.md` keeping both sides, and re-run steps 1 and 2. If it has not, say in the PR that it touches the same three files.

- [ ] **Step 4: Self-review and the PR**

Read the whole diff against the spec (`git diff origin/main`). Then open the PR with the template (`.github/pull_request_template.md`), title `docs: adopt the Ring tail redesign`, its body naming ADR 0022, the four new images (embedded), the Gabarito check of Task 2, step 4, the dark mode check of step 5, and the worktree exception. Never merge it.
