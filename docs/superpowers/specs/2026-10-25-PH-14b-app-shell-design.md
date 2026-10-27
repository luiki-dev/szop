# PH-14b App shell: design

The spec of [PH-14b](../../roadmap.md#ph-14b-app-shell). The decisions it settles go into ADR 0049 (App shell phase details), written in the phase; this document holds the design they were taken from.

## Contents

- [Goal](#goal)
- [Changes to the roadmap](#changes-to-the-roadmap)
- [Decisions](#decisions)
- [Design](#design)
  - [The brand mark](#the-brand-mark)
  - [The shell](#the-shell)
  - [The menu](#the-menu)
  - [The pages](#the-pages)
  - [The color scheme](#the-color-scheme)
  - [Documentation](#documentation)
- [Tests](#tests)
- [Definition of done for this phase](#definition-of-done-for-this-phase)
- [Order of work](#order-of-work)
- [Risks](#risks)
- [Out of scope](#out-of-scope)

## Goal

Every page of Szop sits in the app shell of [visual-design.md, section 5](../../architecture/visual-design.md#5-layout-and-navigation): on a phone, a header with ☰ that opens the menu as a drawer; from `lg` (1024 px), the menu as a permanent sidebar. The menu carries the raccoon logo, the pages that exist today (Start, and Design system under its own heading), the API's status, and the color scheme control: System, Light or Dark ([APR-1](../../requirements/APR-appearance.md#apr-1)). `/` becomes a Start page; the walking skeleton's health page goes, and its API status moves into the menu ([OP-087](https://github.com/luiki-dev/szop/issues/160)).

The logo and the favicon come from the owner's own artwork, which replaces the draft `raccoon.svg`.

## Changes to the roadmap

- **The logo is the owner's artwork, not the polished draft.** The roadmap entry said "polished from the draft `raccoon.svg`"; three rounds of polished drafts did not look enough like a raccoon, and the owner drew the mark ([decision 1](#decisions)). The entry's **Delivers** is updated, and the phase issue's body with it, when the PR opens.
- **A splash or loading screen with the large raccoon** is a 💡 idea for later: a new open point ([OP-105](https://github.com/luiki-dev/szop/issues/283), a candidate with no phase) records it, pointing at the artwork kept in the repo (`brand-source/`).

## Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | **The brand mark is the owner's artwork** (`szop.png`, the raccoon's head on a transparent background), traced to SVG _(the owner's choice)_. | The draft `raccoon.svg`, polished (three versions shown, then three more after the owner's feedback). | The drafts did not read as a raccoon; the owner's drawing does, at 32 px and up. |
| 2 | **The original stays in the repo, marked as a source, not as a file the app uses**; the owner's first export, with the tile, is dropped _(the owner's choice)_. | Delete it once traced; keep it next to the mockups. | It is the master copy, for a future splash screen or a new export; a folder of its own with a note says it is not served. |
| 3 | **The logo is an SVG traced from the PNG**, its colors snapped to the artwork's five flat tones, on a `sage-500` tile, with the head centered and enlarged by about 6% _(the owner's choice to center and enlarge; tracing with vtracer is Claude's call)_. | Ship the PNG downscaled; redraw by hand. | One file for every size, crisp on any screen; the trace was checked side by side with the PNG at 560 px and is near identical. The artwork's tile color (`#5C8E6F`) is replaced by the `sage-500` token (`#5F9273`) so the logo matches the app. |
| 4 | **The menu shows only the pages that exist** _(the owner's choice)_: Start, and Design system under a "Developer" heading. | All of section 5's destinations, the future ones greyed out as "coming soon". | Nothing in the menu leads nowhere; each phase adds its own entry. |
| 5 | **The API's status sits at the bottom of the menu**, in the health page's words. | A dot in the header; a page of its own. | The roadmap puts it in the menu; keeping the texts keeps the tests' meaning. |
| 6 | **The color scheme control is a three-way choice at the bottom of the menu, kept in `localStorage`**; a small script in `public/` applies it before the page paints. The three options are always visible, with an icon and a label each _(the owner's choice)_. | A cookie; one icon that opens a list of the three; a row of icons without labels; an inline script. | [APR-1](../../requirements/APR-appearance.md#apr-1) keeps the choice on the device; three visible options need no explaining; the CSP blocks inline scripts, and `script-src` falls back to `default-src 'self'`, which allows a file. |
| 7 | **The shell owns the page title**: each route names its title, and the shell renders it as the page's `h1` and in `document.title` _(Claude's call)_. | Each page renders its own heading. | On a phone the title sits in the header bar next to ☰, as in the mockup; one place keeps the bar and the tab title in step. |
| 8 | **The health page's journey becomes the shell's journey**: it opens the menu, checks the API's status there and switches the color scheme ([OP-087](https://github.com/luiki-dev/szop/issues/160)) _(Claude's call)_. | Delete the journey; keep a status check on its own. | The status is still the one end-to-end proof that the SPA, the API and PostgreSQL talk to each other. |

## Design

### The brand mark

**Sources.** `docs/architecture/visual-design/szop.png` (the head on a transparent background) moves to `docs/architecture/visual-design/brand-source/`, with a `README.md` saying: this is the owner's original artwork (1254 × 1254 px), the master the app's files are made from; the app never uses it directly; how the app's files were made (below). `szop-trace.svg` is copied there too, as the vector master for later uses such as the splash screen.

**The approved trace** is in this spec's folder: [`logo-approved.svg`](2026-10-25-PH-14b-app-shell/logo-approved.svg) (the tile with the head centered and enlarged, as the owner approved it, [comparison](2026-10-25-PH-14b-app-shell/logo-centered-comparison.png), [at icon sizes](2026-10-25-PH-14b-app-shell/logo-sizes.png)) and [`szop-trace.svg`](2026-10-25-PH-14b-app-shell/szop-trace.svg) (the head without the tile). The builder starts from these files and does not trace again. They were made in three steps, which the `brand-source/README.md` records:

1. **Snap the colors**: every pixel of `szop.png` with alpha ≥ 128 is set to the nearest (by RGB distance) of the five tones `#F9F7F2`, `#B4BCC5`, `#6C7882`, `#3A4654`, `#141C2B`, fully opaque; the rest becomes fully transparent (Pillow, a short Python script).
2. **Trace** with vtracer 0.6 (`pip install vtracer`, Python 3.12; its wheel crashed on 3.14): `colormode="color"`, `hierarchical="stacked"`, `mode="spline"`, `filter_speckle=12`, `color_precision=8`, `layer_difference=8`, `corner_threshold=60`, `length_threshold=4.0`, `max_iterations=10`, `splice_threshold=45`, `path_precision=1`. Each traced fill is then snapped to the nearest of the five tones again.
3. **Wrap**: viewBox `0 0 1254 1254`, a `<rect>` of the full size with `rx="188"` under the head, the paths in `<g transform="translate(627 627) scale(1.06) translate(-626.5 -578)">` (the head's bounding box is x 68–1185, y 153–1003, so its center goes to the tile's center).

The approved file's tile is the artwork's `#5C8E6F`; the app's files use `sage-500`, `#5F9273` ([decision 3](#decisions)).

**The app's files**, made once from the approved trace and committed (no build step):

- **`apps/web/src/brand/logo.svg`**: `logo-approved.svg` with the tile in `sage-500` (`#5F9273`). It is optimized (SVGO or lower path precision) as far as it goes without visible change; the target is under 40 KB before compression (the first trace is 68 KB, about 25 KB with gzip). It is imported by the shell as an asset (`import logo from "./logo.svg"`), so it gets a hashed name and the immutable cache, and shown with `<img>`, not inlined into the JavaScript.
- **`apps/web/public/favicon.svg`**: the same SVG, for browsers that take an SVG icon.
- **`apps/web/public/favicon.ico`** with 16 and 32 px images, and **`apps/web/public/apple-touch-icon.png`** at 180 px, rendered from the SVG.
- **`index.html`** links them: `<link rel="icon" href="/favicon.ico" sizes="32x32">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. The API serves `public/` files with `no-cache`, as it serves every file outside `assets/`.

**Removed:** the draft `docs/architecture/visual-design/raccoon.svg`. **Replaced:** `docs/architecture/visual-design/brand.png` (the mark at several sizes and next to the wordmark), redrawn with the new mark. Links to `raccoon.svg` in living docs are updated; ADRs and old specs keep theirs (a mechanical link fix is allowed, but a link into the past is fine as it is).

The mark stays a sage tile in both color schemes. The 16 px icon is accepted as it renders (a grey face with the dark mask); a hand-made 16 px variant is not part of this phase.

### The shell

A layout route in `routes.tsx` wraps every page (`/` and `/design`) and renders the page through `<Outlet />`. New code lives in `apps/web/src/shell/`.

**On a phone (below `lg`):**

- **A header bar** at the top: a ☰ button (Lucide `Menu`, named "Open menu", at least 48 px), then the page's title as its `h1` (Gabarito 800, `text-xl` or as the mockup has it, cut with "…" when too long). No logo in the bar: the logo is in the menu.
- **The drawer**: ☰ opens the menu from the left, over the page, which is dimmed behind it. It is a modal dialog named "Menu": focus moves into it and is trapped, Esc, a tap on the dimmed page or the close button ("Close menu", Lucide `X`) closes it, and focus returns to ☰. Following a link in it closes it. It is about 280 px wide, at most 85% of the screen. It is built on Base UI's Dialog through shadcn/ui's Sheet component (or Base UI's Drawer, if the current version has one and it is simpler; the plan checks). Opening and closing slide in 150 to 200 ms, without motion when the system asks for reduced motion.

**From `lg`:**

- **The sidebar**: the same menu, always visible at the left, about 256 px wide, in `card`, full height, with its own scroll if it ever overflows. No ☰ and no header bar.
- **The content**: next to the sidebar, a column of at most 720 px with 16 px side padding on small widths and more from `md`, as today; the page's `h1` at its top.

The menu is one component, used in both places, so it cannot drift.

**Page titles** ([decision 7](#decisions)): each route has a `handle` with its title; the shell reads the current match's title for the `h1` and sets `document.title` to "Title · Szop" ("Szop" alone if a route has none).

### The menu

From top to bottom:

1. **The logo**: the mark (40 px) and the wordmark "szop" in lowercase Gabarito Bold, `link` color (`sage-800` light, `sage-300` dark: visual-design.md asks for `sage-700`, which fails contrast on `fur` and is near the limit on white; the builder uses the role that passes on the menu's background and records it in visual-design.md). The logo is a link to `/`, named "Szop, Start".
2. **Start** (Lucide `House`), a link to `/`.
3. **A section heading, "Developer"** (small caps style as the mockup's "SETUP": `text-xs`, semibold, uppercase, `muted-foreground`), then **Design system** (Lucide `Palette`), a link to `/design`.
4. **At the bottom**, separated by a `border` line:
   - **The API's status**, a `role="status"` region with the health page's texts: "Checking the API…", "Can't reach the API", "API: ok" and "Database: up" with "Schema version: N" in small `muted-foreground` tabular figures, or "API: reachable" and "Database: down". The colored dot before each line stays decoration (`aria-hidden`), as on the health page. It uses the existing `useHealth` hook (no retries); it asks when the menu is mounted, so on a phone each time the drawer opens, and on a desktop once per page load.
   - **The color scheme control** ([The color scheme](#the-color-scheme)).

Links are React Router `NavLink`s, at least 48 px high, the whole row clickable, with an icon and a label. The current page's link has `aria-current="page"` and the `accent` background with `accent-foreground` text, as the mockup's "Lists". The focus ring is the usual one.

### The pages

**`/`, Start.** Title "Start". In the content: a `card` with "Welcome to Szop" (`text-lg`, bold) and "Szop is a shopping list app. Your lists will be here soon." in `muted-foreground`. Nothing else: the link to `/design` and the API status are in the menu now. States: none besides the shell's (the status lives in the menu). `apps/web/src/start/start-page.tsx`.

**`/design`.** Title "Design system". It loses its own "← Back" link and its own `h1` (the shell has both jobs now); everything else stays.

**Removed:** `apps/web/src/health/health-page.tsx` and its test; `use-health.ts` stays and is used by the menu's status (moved to `shell/` or kept where it is, the builder's call).

**Unknown paths** keep today's behavior (React Router's error screen); a not-found page is not part of this phase.

### The color scheme

**The choice**: `"system"` (the default), `"light"` or `"dark"`, stored in `localStorage` under `szop-color-scheme`. Anything else, or no value, or a storage that throws (private mode, blocked storage) means `"system"`.

**Applying it**: the class `dark` on `<html>` when the choice is `"dark"`, or `"system"` and `matchMedia("(prefers-color-scheme: dark)")` matches; otherwise no class. `color-scheme` on `:root` follows it (`light`, or `dark` with the class), so native controls and scrollbars match.

**CSS**: `index.css` switches Tailwind's `dark:` variant to the class (`@custom-variant dark (&:where(.dark, .dark *));`) and moves the dark role values from `@media (prefers-color-scheme: dark)` to `:root.dark` (or `.dark`). Components do not change: they use roles.

**Before the first paint**: `apps/web/public/color-scheme.js`, a plain classic script (not a module, no imports), loaded in `<head>` with `<script src="/color-scheme.js"></script>` before the stylesheets, reads the choice and sets the class, so the page never flashes in the wrong scheme. It is a few lines, guarded with `try`/`catch`. Vite copies it unchanged; the CSP's `default-src 'self'` allows it.

**In the app**: a small module (`shell/color-scheme.ts`) with the same rules as the script: read the choice, store it, apply it, and, while the choice is `"system"`, listen to the media query's `change` event and re-apply, so switching the system setting (or Playwright's `emulateMedia`) updates the page live. The script and the module duplicate a few lines on purpose: the script must run before the app's bundle; a comment in each points at the other.

**The control**: at the bottom of the menu, labelled "Color scheme", a group of three options, "System", "Light" and "Dark" (with Lucide `Monitor`, `Sun`, `Moon`), exactly one selected, with radio semantics (a `radiogroup` with three `radio`s, arrow keys move between them), each at least 48 px high, the selected one in `accent`. Base UI's Radio Group or Toggle Group, whichever gives the radio semantics with less code. Choosing one stores and applies it at once.

### Documentation

- **ADR 0049** (App shell phase details): the decisions above. `Refines:` [ADR 0013](../../decisions/0013-visual-design.md), decision 16, and [ADR 0022](../../decisions/0022-ring-tail-redesign.md), decision 12 (the brand mark: the owner's artwork replaces the draft; the tile stays `sage-500`), and decision 12 of ADR 0013 as [ADR 0048](../../decisions/0048-design-system-phase-details.md) refined it (the toggle's mechanism); the notes in those ADRs.
- **[visual-design.md](../../architecture/visual-design.md):** section 4 (the brand mark: the new mark, `brand-source/`, the app's files, the new `brand.png`; the wordmark's role), the dark-mode section (the class, the script, the control, `localStorage`), section 5 (the shell as built: what the menu holds now, the header bar on phones, the page title).
- **[architecture.md](../../architecture/architecture.md):** the web app's shell (the layout route, `shell/`, `start/`, the page titles), the color scheme's script and module.
- **[stack-overview.md](../../architecture/stack-overview.md):** layout routes and `<Outlet />`; why a script in `public/` and not inline (the CSP).
- **[testing.md](../../development/testing.md):** the shell's journey replacing the health journey; how a journey opens the menu on the phone project.
- **[functional-requirements.md](../../requirements/functional-requirements.md):** nothing changes in [APR-1](../../requirements/APR-appearance.md#apr-1) unless its wording no longer fits.
- **[threat-model.md](../../architecture/threat-model.md):** only if `localStorage` or the new script count as an entry point in its terms (the builder checks; a stored choice that is not one of the three values is ignored).
- **[glossary.md](../../glossary.md):** any niche term the new docs use.

## Tests

- **Unit (Vitest, Testing Library), through the real route table:**
  - `shell.test.tsx`: the menu shows Start and Design system, with `aria-current` on the current page; the `h1` and `document.title` follow the route; on a phone-sized render ☰ opens the menu, Esc closes it and focus returns to ☰, and following a link closes it (jsdom has no layout, so "phone" and "desktop" are told apart by what the components render for the breakpoint; the builder picks a way that does not need real CSS, for example testing the drawer and the sidebar components each on their own).
  - The API status: the health page's four cases (loading, ok with the schema version, the database down, the API unreachable), moved from `health-page.test.tsx`, now rendered in the menu.
  - `color-scheme.test.ts`: the rules (stored values, a bad value, a throwing storage, `"system"` following the media query and its `change` event, the class on `<html>`).
  - The control: choosing Dark stores `"dark"` and sets the class; choosing System removes the stored value or stores `"system"` (the builder's call) and follows the media query.
  - `design-page.test.tsx` keeps passing, adjusted for the shell's `h1`.
- **E2E (Playwright, every project):**
  - `e2e/tests/shell.spec.ts` replaces `health.spec.ts`: open `/`; on the phone project open the menu with ☰ (on the desktop projects the sidebar is already there); check "API: ok" and "Database: up" in the status; run `expectAccessible` with the menu open; choose Dark, check the `dark` class on `<html>` and a dark `background` color, reload, check it is still dark; then prove the script alone sets the class before the first paint, for example by blocking the app's bundle with `page.route` and checking the class on `<html>` (a `DOMContentLoaded` listener would not prove it: module scripts run before that event); choose System again; go to Design system through the menu and check its `h1`.
  - `design.spec.ts`: its "follow the link from `/`" step goes through the menu instead. The contrast test keeps working: `expectAccessible` and the contrast test switch the scheme with `emulateMedia`, which the app follows while the choice is System (the default in a fresh test context).
  - `csp-guard.spec.ts` keeps opening `/`, now the Start page. The CSP guard runs on every journey, so a blocked script or an inline style fails the test.
- **The first-screen budget** (200 KB Brotli) keeps passing; the logo is an image file, not counted. The build log's number goes into the PR.
- **By hand:** the PR's screenshots (phone with the menu closed and open, in light and dark; desktop in light and dark; the favicon in a browser tab), and a look in Firefox.

## Definition of done for this phase

The shared [definition of done](../../development/definition-of-done.md) applies. In particular: CI green; the PR shows the screenshots above; the demo check after `demo-up` on the branch confirms the shell on a phone and a desktop, the favicon, the API status in the menu, the color scheme surviving a reload, and no CSP errors in the console. No owner steps beyond the usual demo check.

## Order of work

About six tasks, each one commit:

1. **The brand files**: the source moved to `brand-source/` with its README and `szop-trace.svg`; `logo.svg`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`; the links in `index.html`; `raccoon.svg` removed, `brand.png` redrawn.
2. **The color scheme mechanism**: the class-based `dark:` variant in `index.css`, `public/color-scheme.js`, `shell/color-scheme.ts` with its unit tests.
3. **The shell**: the layout route, the header bar, the drawer and the sidebar, the menu with the logo and the links, the page titles, the Start page, the health page removed, `/design` adjusted; unit tests.
4. **The menu's bottom**: the API status and the color scheme control; unit tests.
5. **E2E**: `shell.spec.ts` replacing `health.spec.ts`, `design.spec.ts` adjusted.
6. **The documentation**: ADR 0049 with its notes, visual-design.md, architecture.md, stack-overview.md, testing.md, the glossary; the roadmap entry's **Delivers**; OP-105.

## Risks

- **The trace grows or loses detail when optimized.** The size target is a target, not a gate: a bigger file is fine if optimizing it more would blur the fur; the PR states the size.
- **A flash of the wrong scheme.** If the script is loaded after the stylesheet or deferred, the page paints light first; the E2E check that the class exists before the bundle runs catches it.
- **The drawer component injects styles** (an inline `style` for its animation or scroll lock). The CSP guard fails the journey; the fix is a stylesheet rule or an option, never loosening the CSP ([ADR 0013](../../decisions/0013-visual-design.md), decision 9).
- **Base UI's component names move** (Sheet, Drawer, Toggle Group). The plan checks the current shadcn/ui and Base UI versions before naming files.

## Out of scope

- A splash or loading screen with the large raccoon ([OP-105](https://github.com/luiki-dev/szop/issues/283)).
- A hand-made 16 px icon; a web app manifest and installability ([OP-061](https://github.com/luiki-dev/szop/issues/188)).
- Menu entries for pages that do not exist yet; the list screen's header with ← back (the list phases).
- A not-found page.
- The landing page on `dzwoniec.com` and its own favicon.
