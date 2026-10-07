# "Ring tail" visual redesign — design

- **Topic:** the "Ring tail" redesign of [OP-073](../../open-points.md#op-073), settled before PH-14 builds the design system
- **Date:** 2026-10-07
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8; documentation only, no code
- **Open points:** [OP-073](../../open-points.md#op-073)

A design exploration on 2026-10-06 produced an alternative look for Szop, "Ring tail" ([screenshot](../../ideas/visual-design/ring-tail.png)): a fur-gray page with white category cards, Gabarito, and checked items dropping out of the list into a dark "haul" tray at the bottom. This brainstorm kept it, adjusted it and settled what [OP-073](../../open-points.md#op-073) left open. The result replaces parts of [ADR 0013](../../decisions/0013-visual-design.md) (the look, the color, the font) and decision 9 of [ADR 0001](../../decisions/0001-functional-requirements-scope.md) (how checked items are shown), so it changes the design system, the requirements and the architecture notes. Nothing is built here: PH-14 builds the design system, and the list phases build the screen.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [The look](#the-look)
  - [Palette and semantic roles](#palette-and-semantic-roles)
  - [Contrast](#contrast)
  - [Typography](#typography)
  - [Shape](#shape)
  - [Brand](#brand)
  - [The list and the haul](#the-list-and-the-haul)
  - [Amounts](#amounts)
  - [Desktop](#desktop)
  - [States](#states)
  - [Accessibility notes](#accessibility-notes)
- [Requirement changes](#requirement-changes)
- [Architecture changes](#architecture-changes)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

Szop has one agreed look before PH-14 builds it, and every document that describes the look or the behavior of checked items says the same thing.

The topic is done when:

- ADR 0022 records the decisions below with the options considered, and the earlier ADRs it changes carry the notes of the CLAUDE.md convention;
- [visual-design.md](../../architecture/visual-design.md) describes the Ring tail look, the tokens of this spec, Gabarito, the sage brand and the list-and-haul pattern, and its mockups show them;
- the requirements, the architecture, the stack overview and the roadmap describe the haul instead of the unchecked/checked split and the hide toggle;
- [OP-073](../../open-points.md#op-073) is closed and the new open points are in the register;
- no document still names teal, Figtree, "the checked part" or the hide toggle as current, outside accepted ADRs and audits, which stay as written.

## Out of scope

- **Building anything**: Tailwind, the tokens as CSS and the font arrive in PH-14; the haul in PH-17 and PH-21.
- **Screens other than the list**: the lists home, templates, the catalog and the rest keep the layout principles of `visual-design.md` and are designed by their phases, in the new look.
- **A haul panel on wide screens**: rejected for now (decision 7); it can come back as a 💡 future extension if shopping at a desktop turns out to matter.
- **Which drawer component**: chosen by the phase that builds the drawer, under the CSP; new open point.
- **How "checked" is stored**: new open point for PH-17.
- **A manual theme toggle**: still a 💡 future extension, unchanged.

## Decisions taken in the brainstorm

ADR 0022 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | The look | Keep "calm and roomy" (ADR 0013, decision 6); the "Ring tail" exploration; its two siblings, "Store route" and "Yellow sticker" | **Ring tail, adjusted.** The owner liked its palette and its idea: what is in the basket is visually apart from what is left. Kept close to the exploration, with the changes below. |
| 2 | The accent | Honey (amber); sage green; indigo; none (navy) | **Sage**: tile `#5F9273`, accent `#3F7357`, `#86C29C` on dark surfaces. Mockups of whole screens showed it against the navy haul. Quieter than the old teal, keeps a green, calmer than honey; indigo blended into the navy and navy left the logo nearly invisible. |
| 3 | The add bar | Pinned above the haul; at the top of the list; a floating "+" button | **Pinned above the haul, on the page**, styled like the list (a white field, a sage button), so it reads as adding to the list, not to the haul. The exploration had it inside the haul. It stays within thumb reach, as the layout principles ask; at the top it is far from the thumb and scrolls away, and a floating button costs a tap per item. While the field has focus the haul folds to one line. |
| 4 | Scaling the haul | All chips, wrapping; one row of chips with a drawer | **One row of chips, newest first, then "+N more"; a drawer at 75% of the screen shows everything.** The collapsed haul never grows, however long the list. Newest first, because the item just checked is the one to undo. |
| 5 | The drawer's content | The same chips, wrapped; rows | **Rows**: name, quantity and unit, line total and a ↶ button. With room to spare, the quantity matters when checking the basket. Only the button puts an item back; the row does nothing. |
| 6 | Progress | The ringed raccoon tail of the exploration; a bar under the title; a count pill with a thin line; inside the haul | **Inside the haul's header**: a bar with "8 of 11 items" and "€8.07 to go", the same header collapsed and in the drawer. The tail drew a ring per item and does not scale to 40 items; the pill squeezed long list names. The top of the screen keeps only the title. |
| 7 | Desktop | The same tray under the column; a haul panel on the right from `xl` | **The same tray, inside the 720 px column.** Shopping happens on the phone; a panel is a second layout to build, test and screenshot for a screen that is mostly used to plan, when the haul is empty. |
| 8 | Dark mode | The haul stays the darkest; the haul is raised; the haul is inverted (fur gray) | **The haul stays the darkest surface**, so the screen keeps its shape in both schemes. A raised haul relied on a shadow; an inverted one put a bright block on a dark screen. |
| 9 | Tokens | Tailwind `gray` with two custom additions; a fully custom palette; Tailwind's built-ins only | **Tailwind `gray`, plus a custom `fur` color and a small `sage` scale, and new `haul-*` roles.** Keeps ADR 0013's two tiers and changes only what the look needs; a custom palette drops Tailwind's tested scales; built-ins only lose the fur gray's blue tint and turn sage into a bright green. Dark mode snaps to Tailwind grays rather than the custom slates of its mockup. |
| 10 | The font | Keep Figtree; Gabarito | **Gabarito**, as in the exploration. It is under the SIL Open Font License (OFL), self-hostable from `@fontsource-variable/gabarito`, and has tabular figures (checked: with `tnum` every digit is equally wide). It costs 36 KB for Latin, against Figtree's 20 KB. |

Two smaller changes from the exploration, made during the brainstorm: **the chips lose their ×**, which reads as "delete" while tapping only puts the item back, and **the haul gets a handle**, which shows it can be pulled up.

## Design

### The look

**Ring tail**: a fur-gray page holds white, generously rounded category cards; the dark haul tray at the bottom collects what is in the basket; sage is the one accent. Rows stay 56 px high with large round checkboxes, and anything tappable is at least 48 px.

### Palette and semantic roles

The palette is Tailwind's `gray` plus two custom additions, defined next to it as CSS custom properties:

- **`fur`**: `#CBD0D6`, the page in light mode.
- **`sage`**, only the steps used: `sage-100 #E3EEE7`, `sage-300 #86C29C`, `sage-500 #5F9273` (the logo tile), `sage-700 #3F7357`, `sage-950 #10261A`. A phase that needs another step adds it and checks its contrast.

Components keep using only semantic roles. Changed values and new roles (🆕):

| Role | Used for | Light | Dark |
|---|---|---|---|
| `background` / `foreground` | The page and its text | `fur` / `gray-800` | `gray-900` / `gray-200` |
| `card` | Category cards, inputs on the page, the sidebar | `white` | `gray-800` |
| `muted-foreground` | Secondary text: notes, counts, prices | `gray-600` | `gray-400` |
| `border` | Dividers between rows | `gray-200` | `gray-700` |
| `input` | Borders of checkboxes and inputs | `gray-500` | `gray-400` |
| `primary` / `primary-foreground` | The main button, the active menu entry's text | `sage-700` / `white` | `sage-300` / `sage-950` |
| `accent` | The active menu entry's background | `sage-100` | `sage-950` |
| `ring` | The focus ring | `sage-700` | `sage-300` |
| 🆕 `haul` / `haul-foreground` | The haul tray and drawer, and their text | `gray-800` / `white` | `gray-950` / `white` |
| 🆕 `haul-muted` | Secondary text in the haul: prices, the caption | `fur` | `gray-400` |
| 🆕 `haul-chip` | Chips, the ↶ buttons, the progress bar's track, the handle | `gray-700` | `gray-800` |
| 🆕 `haul-accent` | The progress fill, the focus ring inside the haul | `sage-300` | `sage-300` |
| `destructive` | Deleting | `red-600` | `red-400` |
| `warning` | The offline banner | `amber-100` with `amber-900` text | `amber-950` with `amber-200` text |

`destructive` and `warning` are unchanged.

### Contrast

Computed with the WCAG formula for every pair the roles produce ([NFR-2](../../requirements/functional-requirements.md#nfr-2): text 4.5:1, UI parts 3:1):

| Pair | Light | Dark |
|---|---|---|
| `foreground` on `background` / on `card` | 9.5 / 14.7 | 14.3 / 11.9 |
| `muted-foreground` on `card` / on `background` | 7.6 / 4.9 | 5.8 / 7.0 |
| `input` on `card` (UI) | 4.8 | 5.8 |
| `primary-foreground` on `primary` | 5.5 | 7.8 |
| `primary` on `accent` (the active menu entry) | 4.6 | 7.8 |
| `ring` on `card` / on `background` (UI) | 5.5 / 3.6 | 7.1 / 8.6 |
| `haul-foreground` on `haul` / on `haul-chip` | 14.7 / 10.3 | 20.1 / 11.9 |
| `haul-muted` on `haul` / on `haul-chip` | 9.5 / 6.6 | 7.9 / 5.8 |
| `haul-accent` on `haul` / on `haul-chip` (UI) | 7.1 / 5.0 | 9.8 / 7.1 |

The narrowest are `primary` on `accent` (4.6) and the focus ring on the fur page (3.6). PH-14 re-checks every pair when it writes the tokens, and axe checks every page in both schemes. In dark mode the surfaces are close in tone (cards 1.2:1, the haul 1.1:1 against the page); WCAG asks nothing of surfaces, but the final mockups must show that the cards and the haul still read as separate (see [To verify](#to-verify-during-implementation)).

### Typography

- **Gabarito**, self-hosted from `@fontsource-variable/gabarito`: one variable font, 36 KB for Latin, with Latin Extended loaded only when a character needs it. Bundled by Vite, served from our origin, `font-display: swap`, the system font as the fallback.
- **Weights 400, 600, 700 and 800**; 800 is for the screen title and the haul's amount.
- Tailwind's default type scale, item names and inputs at 16 px, nothing below 12 px, and **tabular figures** for quantities, prices and totals: all unchanged.

### Shape

- **`--radius`** stays 12 px, for buttons and inputs.
- 🆕 **`--radius-surface`**: 18 px for category cards, 24 px for the top corners of the haul and the drawer. The exploration's surfaces are clearly rounder than its controls.
- Checkboxes, chips and pills stay fully round. Spacing, elevation and motion are unchanged.

### Brand

- **The raccoon** is unchanged; only its tile changes, from teal `#0f766e` to `sage-500` (`#5F9273`). `raccoon.svg` changes that one value.
- **The wordmark**: "szop" in lowercase Gabarito Bold, `sage-700` (`sage-300` in dark mode).
- **On the list screen** the raccoon tile sits at the right of the header, as in the exploration.

### The list and the haul

A layout pattern of the design system, not one phase's screen: the list phases build it and design their screens on top of it. From top to bottom, on a phone:

1. **Header**: ← back, the list's name (Gabarito 800, cut with "…" when too long), the raccoon tile. List actions (rename, sort setting and so on) are placed by the phases that add them.
2. **Category cards with the unchecked items only**, ordered as [ORD-2](../../requirements/functional-requirements.md#ord-2) and [ORD-3](../../requirements/functional-requirements.md#ord-3) say. The card's header shows the category and "N left". A card disappears when all its items are checked.
3. **The add bar**, pinned above the haul, on the page: a white field "+ Add item" and a sage "Add" button. While the field has focus, the haul folds to one line ("The haul · €28.47"), so the keyboard leaves room for the list.
4. **The collapsed haul**, a dark tray with rounded top corners and a fixed height:
   - a handle;
   - "The haul" and the amount, "€28.47 of €36.54";
   - the progress bar, with "8 of 11 items" and "€8.07 to go" under it;
   - **one row of chips, most recently checked first**, as many as fit, then "+N more". A chip shows the name and the line total, or the name alone without a price. **Tapping a chip puts the item back** in the list.
5. **The drawer**, the haul pulled up to **75% of the screen's height**:
   - opened by dragging the handle up, tapping the haul's header or tapping "+N more"; closed by dragging it down, tapping the dimmed list or pressing Esc;
   - the list behind it is dimmed; the drawer traps focus while open and returns it when closed;
   - **the header stays pinned**: handle, amount, bar and caption, as in the collapsed haul;
   - then "Newest first · ↶ puts an item back", and **rows**: name, quantity and unit, line total and a **↶ button**. Only the button puts an item back; the row itself does nothing;
   - at the end, a **"Put all back"** button: [LST-5](../../requirements/functional-requirements.md#lst-5)'s "Uncheck all".

**Checking an item**: its row leaves its card and its chip appears first in the haul, in 150 to 200 ms, without motion when the system asks for reduced motion. Putting an item back reverses it: the item returns to its place in its card.

### Amounts

The haul shows all three totals of [ITM-8](../../requirements/functional-requirements.md#itm-8):

- **"€28.47"**: the checked items;
- **"of €36.54"**: all items;
- **"€8.07 to go"**: the unchecked items.

Items without a price are left out of all three. When no item has a price, the money is not shown, and the header keeps the count ("8 of 11 items"). The progress bar always follows the count of items, not the money.

### Desktop

The same pattern inside the content column of at most 720 px, next to the sidebar from `lg`: the add bar and the haul are pinned at the bottom of the column, and the drawer covers 75% of the window's height, within the column. One row of chips holds more chips.

### States

| State | List area | Haul |
|---|---|---|
| Loading | Skeleton cards | A skeleton header |
| Empty list | "Nothing on this list yet", pointing at the add bar | Hidden |
| Nothing checked yet | The cards | Header with an empty bar; "Check items off to drop them here" instead of chips |
| Everything checked | "Everything's in the haul" | Unchanged |
| Long names | Rows wrap to two lines | Chips cut with "…" at about 12 characters; drawer rows wrap |
| Offline | The amber banner at the top; checkboxes disabled with a reason | Chips, ↶ and "Put all back" disabled |
| Dark mode | `gray-900` page, `gray-800` cards | `gray-950`, the darkest surface |

### Accessibility notes

- **The add bar's label**: the forms rule says labels are always visible, never placeholder-only. The add bar is its **one exception**, like a search field: its accessible name is "Add item to *list name*", and the visible "Add" button says what it does. `visual-design.md` records the exception next to the rule.
- **Chips and ↶ buttons** are buttons named "Put *item* back". "+N more" is named "Show all N items in the haul".
- **The drawer** is a modal dialog named "The haul": focus moves into it, is trapped, and returns to what opened it. Dragging is never the only way: the header and "+N more" open it, Esc and the dimmed list close it.
- **The progress bar** is a `progressbar` with its value and maximum, labelled by the caption.

## Requirement changes

In [functional-requirements.md](../../requirements/functional-requirements.md). The haul replaces decision 9 of [ADR 0001](../../decisions/0001-functional-requirements-scope.md) ("separate part" and the toggle):

| ID | Today | Becomes |
|---|---|---|
| [ORD-1](../../requirements/functional-requirements.md#ord-1) | The list shows unchecked items first, then checked items. | Checked items leave the list and go to the haul, a tray apart from it; putting one back returns it to the list. |
| [ORD-2](../../requirements/functional-requirements.md#ord-2) | Within each of the two parts, sorted by category order, then name. | The list's items are sorted by category order, then name; the haul's are ordered most recently checked first. |
| [ORD-4](../../requirements/functional-requirements.md#ord-4) | A toggle hides checked items. | ✖️ Dropped: the list never shows checked items, so there is nothing to hide. The ID is kept and never reused. |
| [ORD-5](../../requirements/functional-requirements.md#ord-5) | "…the unchecked/checked split ([ORD-1](../../requirements/functional-requirements.md#ord-1)) still applies." | "…checked items still go to the haul ([ORD-1](../../requirements/functional-requirements.md#ord-1))." |
| [UC-3](../../requirements/functional-requirements.md#uc-3-shop-in-a-store) | Checked items move to the checked part; the user hides them; the totals show spent and remaining. | Checked items drop into the haul, so the list shows only what is left; the haul shows what is in the basket, how far along they are and what is left to spend. |

[ITM-8](../../requirements/functional-requirements.md#itm-8) and [LST-5](../../requirements/functional-requirements.md#lst-5) keep their wording: the haul shows all three totals, and "Uncheck all" is the drawer's "Put all back".

## Architecture changes

In [architecture.md](../../architecture/architecture.md) and [stack-overview.md](../../architecture/stack-overview.md):

- **Data model highlights, list items**: they also record **when they were checked**, which gives the haul its newest-first order. Whether "checked" is that timestamp alone (`checked_at IS NOT NULL`) or a flag next to it is decided by PH-17 (new open point).
- **State**: the "device preference" row loses its only example, the hide toggle; it stays, with "none yet".
- **The optimistic-update example** in the stack overview moves the checked item "to the haul", not "to the checked part".

## Documentation and records

- **ADR 0022 — "Ring tail" visual redesign**, with the decisions above. It changes earlier decisions, noted in the three places the CLAUDE.md convention asks for:

  | Earlier decision | How |
  |---|---|
  | [ADR 0013](../../decisions/0013-visual-design.md), decision 6, overall look | 🔁 superseded by decision 1 |
  | ADR 0013, decision 10, design tokens | ➕ extended by decision 9: `fur`, `sage`, the `haul-*` roles |
  | ADR 0013, decision 11, color | 🔁 superseded by decision 2: sage instead of teal |
  | ADR 0013, decision 13, typography | 🔁 superseded by decision 10: Gabarito instead of Figtree |
  | ADR 0013, decision 14, spacing, size, shape and motion | ➕ extended: `--radius-surface` |
  | ADR 0013, decision 16, brand mark | ✏️ refined: the sage tile, the wordmark in Gabarito |
  | ADR 0013, decision 18, layout and interaction principles | ➕ extended by decisions 3 to 8: the list-and-haul pattern; the add bar's label exception |
  | [ADR 0001](../../decisions/0001-functional-requirements-scope.md), decision 9, checked items display | 🔁 superseded by decisions 1, 4 and 6: the haul |

- **[visual-design.md](../../architecture/visual-design.md)**: section 1 (the look), the color and typography tokens, the shape table, section 4 (brand), a new "The list and the haul" pattern, the forms exception; the decisions now point to ADR 0013 and ADR 0022.
- **Mockups** in `docs/architecture/visual-design/`, drawn in the visual companion with the tokens of this spec, approved by the owner, then captured as images:
  - `list-screen.png`: the list on a phone, light and dark, the haul collapsed (replaces the teal one);
  - 🆕 `haul-drawer.png`: the drawer open, the "nothing checked yet" haul and the haul folded while typing;
  - `navigation.png`: the lists home on a phone and the desktop sidebar, in the new look;
  - `brand.png` and `raccoon.svg`: the sage tile and the Gabarito wordmark.

  The exploration's [screenshot](../../ideas/visual-design/ring-tail.png) stays, as the record of where the idea came from.
- **Requirements, architecture and the stack overview**: as in the two sections above.
- **[roadmap.md](../../roadmap.md)**: PH-14 delivers Gabarito instead of Figtree. PH-17's goal speaks of the haul instead of "unchecked items first": it builds the haul, its chips, putting items back, the drawer and the progress by item count. PH-21 adds the money in the haul's header ([ITM-8](../../requirements/functional-requirements.md#itm-8)) and "Put all back" ([LST-5](../../requirements/functional-requirements.md#lst-5)), and no longer delivers [ORD-4](../../requirements/functional-requirements.md#ord-4). The README's diagram names no requirements and does not change.
- **[open-points.md](../../open-points.md)**:
  - [OP-073](../../open-points.md#op-073) ✅ closed, pointing at ADR 0022;
  - PH-14's design system point (Figtree, the teal tokens) names Gabarito and the new tokens;
  - new, under PH-17: **OP-079** a drawer component that works under the CSP (shadcn's Drawer is built on vaul, which may inject styles; a Base UI Dialog shaped as a bottom sheet is the fallback); **OP-080** how "checked" is stored, the timestamp alone or a flag next to it; **OP-081** PH-17 grows with the haul and its drawer: its brainstorm considers splitting the drawer into a phase of its own.
- **[glossary.md](../../glossary.md)**: OFL (SIL Open Font License).

## Tasks

About five, each a commit on `docs/ring-tail-redesign`:

1. ADR 0022, and the notes in ADR 0013 and ADR 0001.
2. The final mockups, approved by the owner, and `visual-design.md`.
3. Requirements, architecture and the stack overview.
4. Roadmap and open points.
5. Glossary and a final pass: no stale teal, Figtree, "checked part" or hide toggle outside accepted ADRs and audits; every link and every Contents list in order.

## To verify during implementation

- **The dark surfaces**: with Tailwind's grays the cards and the haul are close in tone to the page (1.2:1 and 1.1:1). The final mockup must show them clearly apart; if it does not, the dark `background` moves to a custom value between `gray-900` and `gray-800`, recorded in ADR 0022.
- **Gabarito's Latin Extended** covers Polish product names (ą, ę, ł, ó, ś, ź, ż and the capitals) in every weight used.
- **The vaul question** (OP-079) is not answered here; the mockups do not depend on it.
- **This branch was made from `origin/main` while PH-05 is open**, which takes ADR 0021. If PH-05 adds open points before this merges, the new open points take the next free numbers instead.
