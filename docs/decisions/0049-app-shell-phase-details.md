# ADR 0049 — App shell phase details

- **Status:** ✅ Accepted
- **Date:** 2026-10-25
- **Refines:** [ADR 0013](0013-visual-design.md), decision 16, and [ADR 0022](0022-ring-tail-redesign.md), decision 12 (the brand mark: the owner's artwork replaces the draft, on the same `sage-500` tile; see decisions 1 to 3); [ADR 0048](0048-design-system-phase-details.md), decision 5 (the manual theme toggle: a class on `<html>`, a script before the first paint, `localStorage`, three options in the menu; see decision 6)
- **Completes:** [ADR 0013](0013-visual-design.md), decision 17 (the navigation as built for the pages that exist; see decisions 4, 5 and 7)

## Context

[PH-14b](../roadmap.md#ph-14b-app-shell) puts every page in the app shell of [ADR 0013](0013-visual-design.md), decision 17: a drawer on phones, a sidebar from `lg`. It also brings the logo and the favicon, and the manual theme toggle that [ADR 0048](0048-design-system-phase-details.md), decision 5, brought into the MVP ([APR-1](../requirements/functional-requirements.md#apr-1)). The draft `raccoon.svg` was to be polished into the logo; three rounds of polished drafts did not look enough like a raccoon, and the owner drew the mark. The [spec](../superpowers/specs/2026-10-25-PH-14b-app-shell-design.md) holds the design in full; this ADR records the decisions and the alternatives.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|---|---|---|
| 1 | The brand mark | The draft `raccoon.svg`, polished (three versions, then three more after the owner's feedback); the owner's artwork | **The owner's artwork**, the raccoon's head on a transparent background, traced to SVG _(the owner's choice)_. The drafts did not read as a raccoon; the owner's drawing does, at 32 px and up. |
| 2 | The original artwork | Delete it once traced; keep it next to the mockups; keep it as a source | **Kept in `docs/architecture/visual-design/brand-source/`, marked as a source the app never uses**, with the trace without a tile and a README of every step _(the owner's choice)_. The owner's first export, with the tile, is dropped. It is the master copy, for a future splash screen ([OP-105](https://github.com/luiki-dev/szop/issues/283)) or a new export. |
| 3 | The logo file | The PNG, downscaled; a hand-redrawn SVG; a traced SVG | **A traced SVG**: the artwork's colors snapped to its five flat tones, each tone traced with potrace, on a `sage-500` tile, the head centered and enlarged by about 6% _(the owner's choice to center and enlarge; tracing is Claude's call)_. One file for every size, near identical to the PNG at 560 px. The tile is the `sage-500` token, not the artwork's slightly different green. |
| 4 | What the menu lists | Every destination of [visual-design.md, section 5](../architecture/visual-design.md#5-layout-and-navigation), the future ones greyed out; only the pages that exist | **Only the pages that exist** _(the owner's choice)_: Start, and Design system under a "Developer" heading. Nothing in the menu leads nowhere; each phase adds its own entry. |
| 5 | The API's status | A dot in the header; a page of its own; the bottom of the menu | **The bottom of the menu, in the health page's words.** The roadmap put it in the menu; the same texts keep the tests' meaning. |
| 6 | The color scheme control | A cookie; one icon that opens a list; a row of icons without labels; three labelled options; an inline script | **Three options always in view, System, Light and Dark, each with an icon and a label, at the bottom of the menu** _(the owner's choice)_; **kept in `localStorage`** (`szop-color-scheme`); **applied as the class `dark` on `<html>` by `public/color-scheme.js` before the first paint** (Claude's call). APR-1 keeps the choice on the device; three options need no explaining; the CSP blocks inline scripts, and `script-src` falls back to `default-src 'self'`, which allows a file. |
| 7 | The page title | Each page renders its own heading; the shell renders it | **The shell owns the page's `h1` and the tab's title** from each route's `handle` _(Claude's call)_. On a phone the title sits in the header bar next to ☰, as in the mockup; one place keeps the bar and the tab in step. |
| 8 | The health page's journey | Delete it; keep a status check of its own; make it the shell's journey | **The shell's journey**: it opens the menu, checks the API's status there and follows a link ([OP-087](https://github.com/luiki-dev/szop/issues/160)) _(Claude's call)_. The status is still the one end-to-end proof that the SPA, the API and PostgreSQL talk to each other. |

## Consequences

- Every page is a child of one layout route, `AppShell`; a new page names its title in its route's `handle`, and a phase that adds a destination adds it to `shell/menu.tsx`.
- The shell renders either the phone's layout or the desktop's, decided by `matchMedia` on Tailwind's `lg`, so the menu is never in the page twice; unit tests choose the layout with a `matchMedia` stub.
- Dark mode is a class: components keep using the roles, and the dark roles live under `:root.dark` in `index.css`. Two pieces of code hold the same rules, `public/color-scheme.js` (before the first paint) and `shell/color-scheme.ts` (after), and change together.
- The first-screen JavaScript grew from 124 KB to 146 KB Brotli (Base UI's dialog and radio group, the shell), under the 200 KB budget of [NFR-3](../requirements/functional-requirements.md#nfr-3). Vite now warns that the one chunk is over 500 KB before compression; splitting it is left until a phase needs it.

## Settled while building

- **The logo was traced twice.** The first trace, with vtracer, left wavy edges and rounded the sharp tips of the fur and the mask; the owner saw it and asked for another. The second enlarges the artwork 3×, cleans the edges between the tones with a majority filter and traces each tone with potrace (the steps are in `brand-source/README.md`). **The logo is 16.3 KB**: SVGO with whole-pixel precision on the 1254 px canvas, with no visible change at 3× zoom. `favicon.ico` holds 16 and 32 px; `apple-touch-icon.png` is square, since iOS rounds the corners itself and would fill transparent ones with black.
- **shadcn's Sheet** was kept to its root, trigger, content and title, on Szop's roles. ☰ is the Sheet's trigger, since Base UI returns focus only to its own trigger.
- **The control uses Base UI's Radio Group directly**: Toggle Group has the `group` role with pressed buttons, not radios, and shadcn's Radio Group draws dots.
- **The drawer's state lives in the phone's header**, so it goes when the screen grows past `lg`, and the drawer never reopens by itself. **The page's `<main>` keeps its place in the tree** whichever chrome surrounds it, so crossing `lg` (a tablet rotating) does not rebuild the page and lose what it holds; the final review found the first version did.
- **A blocked storage keeps the choice for the visit**, in memory, so the control and the system listener do not fall back to System (found by the final review).
- **The drawer slides; it does not fade its colors.** Its `transition` covered every property, so switching the scheme with the drawer open started color transitions that axe scanned half-way. The axe helper now also waits one frame for the `matchMedia` listener, and ignores cancelled animations.
- **`public/color-scheme.js` is type-checked through `apps/web/tsconfig.public.json`**: a `tsconfig.json` in `public/` would be served with the app.
