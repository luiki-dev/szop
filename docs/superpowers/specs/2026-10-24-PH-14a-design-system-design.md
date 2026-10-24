# PH-14a Design system: design

The spec of [PH-14a](../../roadmap.md#ph-14a-design-system). The decisions it settles go into [ADR 0048](../../decisions/0048-design-system-phase-details.md), written in the phase; this document holds the design they were taken from.

## Contents

- [Goal](#goal)
- [Changes to the roadmap](#changes-to-the-roadmap)
- [Decisions](#decisions)
- [Design](#design)
  - [Styling setup](#styling-setup)
  - [Design tokens](#design-tokens)
  - [Font and icons](#font-and-icons)
  - [The pages](#the-pages)
  - [Tooling](#tooling)
  - [Documentation](#documentation)
- [Tests](#tests)
- [Definition of done for this phase](#definition-of-done-for-this-phase)
- [Order of work](#order-of-work)
- [Risks](#risks)
- [Out of scope](#out-of-scope)

## Goal

Szop's web app is styled with the design system of [visual-design.md](../../architecture/visual-design.md): Tailwind CSS v4, shadcn/ui on Base UI under the CSP, the design tokens in light and dark mode, Gabarito and Lucide. The owner wants to see the tokens in the browser and check them, so a public page, `/design`, shows every color role, the type, the buttons, the icons and the shapes in the current color scheme. The walking skeleton's health page at `/` keeps its content, is restyled with the tokens and links to `/design`.

The app shell (menu, drawer, sidebar, logo, favicon) is not part of this phase: it is [PH-14b](../../roadmap.md#ph-14b-app-shell).

## Changes to the roadmap

- **PH-14 was split** into PH-14a Design system and PH-14b App shell (committed with the roadmap and GitHub changes at the start of the phase). PH-14 held about ten tasks and two new concepts, the styling system and the responsive app shell ([ADR 0014](../../decisions/0014-roadmap.md), decision 6). [OP-056](https://github.com/luiki-dev/szop/issues/92) moved to PH-14a, its favicon, logo and shell part listed in PH-14b's **Also**; [OP-087](https://github.com/luiki-dev/szop/issues/160) moved to PH-14b, since the health page stays at `/` until the shell replaces it.
- **The manual theme toggle comes into the MVP** and is built in PH-14b: System, Light or Dark, chosen in the menu. [ADR 0013](../../decisions/0013-visual-design.md), decision 12, had it as a 💡 future extension. This phase records the decision (ADR 0048 and the [functional requirements](../../requirements/functional-requirements.md)); PH-14b's brainstorm settles its details. PH-14a's dark mode follows the system setting only.
- **The meta description**, which Lighthouse missed on the demo ([ADR 0038](../../decisions/0038-app-on-ecs-and-rds-details.md), consequences, "left to PH-14"), is added here.

## Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | **Split PH-14** into PH-14a (design system) and PH-14b (app shell) _(the owner's choice)_. | One phase. | About ten tasks and two new concepts; each half ends with something working on the demo. |
| 2 | **A `/design` page** showing the tokens and the first components _(the owner's choice)_. | Only a "Start" menu entry; a link to `dzwoniec.com`. | The owner wants a place to check the styles; the page grows as components are added. |
| 3 | **`/design` is public**, on the demo too, with no switch _(the owner's choice: "nie kombinujmy")_. | Only in development (`pnpm dev`). | Nothing on it is secret; a development-only route is one more condition to build and test. |
| 4 | **`/` stays the health page, restyled, with a link to `/design`** until PH-14b replaces it _(the owner's choice)_. | A Start page now. | The Start page belongs with the shell; this phase changes the look, not the content. |
| 5 | **The manual theme toggle is MVP, built in PH-14b** _(the owner's choice)_. | Keep it a 💡 future extension (ADR 0013, decision 12). | It is about one task and needs the menu; components do not change, since they use roles only. |
| 6 | **Only the Button component** is added from shadcn/ui. | Add the components the next phases will need. | Visual-design.md, section 2: components are added one by one as phases need them. Button is enough to prove the setup and to show the focus ring. |
| 7 | **The token contrast is checked by an E2E test** that reads the rendered colors of the pairs in the browser _(Claude's call)_. | A unit test that parses the CSS; checking by hand once. | Tailwind v4's palette is in OKLCH, so a unit test would need a color library to convert it; the browser already does. Axe checks only text, not the 3:1 pairs (focus ring, input borders, progress fill). |
| 8 | **A new palette step, `sage-800` `#2F5A43`, and a new role, `link`** (`sage-800` light, `sage-300` dark), for sage text on the page itself: links and the ghost Button _(the owner's choice, found by the spec's review)_. | Links and ghost text in `foreground`, links underlined. | `primary` (`sage-700`) on `fur` is 3.56:1, under the 4.5:1 text needs; `sage-800` on `fur` is 5.1:1 and on white 7.9:1, and the look stays as in the mockups, a shade darker. `primary` stays for text on white and on `accent`, and for button fills. |
| 9 | **A new role, `destructive-foreground`**: `white` light (4.8:1 on `red-600`), `gray-950` dark (7.3:1 on `red-400`) _(Claude's call)_. | White text in both schemes; another red step in dark mode. | White on `red-400` is 2.8:1. Dark text on a light red is shadcn's own pattern for dark mode. |
| 10 | **The contrast test checks every pair this phase renders**, not only the redesign spec's table _(Claude's call)_. | Only the redesign spec's pairs. | That table has no `link`, `destructive` or `warning` pairs; a pair shown on `/design` but untested is how decision 8's problem would have slipped through. |

## Design

### Styling setup

- **Tailwind CSS v4** through `@tailwindcss/vite`, added to `apps/web/vite.config.ts` next to the React plugin. One CSS entry, `apps/web/src/index.css`, imported by `main.tsx`; it holds `@import "tailwindcss"`, the tokens and the base styles. No `tailwind.config.js`.
- **shadcn/ui** is initialised with **Base UI** as its headless library (`shadcn init`, with whichever option of the current CLI selects Base UI; the plan checks the CLI's current flags). It writes `apps/web/components.json`, `apps/web/src/lib/utils.ts` (`cn()`) and its CSS variables. The `@/` path alias it expects is added to `tsconfig.json` and `vite.config.ts` (and to Vitest's config if it does not inherit it). The generated token values are replaced with Szop's ([Design tokens](#design-tokens)).
- **Button** is added with the CLI into `apps/web/src/components/ui/button.tsx`. Its variants are restyled to the roles: default (`primary`), outline (`card` with an `input` border), ghost (`link` text), destructive (`destructive` with `destructive-foreground` text). Every size is at least 48 px high (visual-design.md, tap targets).
- **Base UI's `CSPProvider`** wraps the app in `app.tsx` with `disableStyleElements`. The CSS Base UI would otherwise inject (hiding native scrollbars in scroll areas and selects) goes into `index.css`, taken from Base UI's documentation, even though no scroll area or select exists yet, so the next phase does not trip over it.
- **No `<style>` element and no inline style attribute in the HTML** reach the page: the E2E CSP guard checks it on every journey.

### Design tokens

All in `index.css`, in the two tiers of visual-design.md, section 3:

- **The palette:** Tailwind's built-in colors, plus `fur` (`#CBD0D6`) and `sage` (100, 300, 500, 700, 950 with the values of visual-design.md, and the new `sage-800` `#2F5A43`, [decision 8](#decisions)) in `@theme`, so `bg-sage-500` and friends exist.
- **The roles:** every role of the color table (`background`, `foreground`, `card`, `muted-foreground`, `border`, `input`, `primary`, `primary-foreground`, `accent`, `ring`, `haul`, `haul-foreground`, `haul-muted`, `haul-chip`, `haul-accent`, `destructive`, `warning` with its text), plus the two new roles `link` and `destructive-foreground` ([decisions 8 and 9](#decisions)), as CSS custom properties on `:root`, overridden inside `@media (prefers-color-scheme: dark)`, and mapped to Tailwind colors with `@theme inline` so components write `bg-primary`, `text-muted-foreground`. shadcn's own roles that Szop does not list (for example `secondary`, `popover`, `muted`) are set to the nearest Szop role or left out; the builder decides, keeps visual-design.md's table the source, and adds any role it keeps to that table.
- **Shape:** `--radius` 12 px and `--radius-surface` 18 px, as Tailwind radius tokens (`rounded-lg` or a named one; the builder picks names and records them). The haul's 24 px top corners are shown on `/design` but need no token of their own until PH-17, unless one is simpler.
- **Dark mode** uses Tailwind's default `dark:` variant (the media query). PH-14b switches it to a class.
- **Motion:** nothing animates in this phase; `motion-safe:` is the rule for later.

### Font and icons

- **Gabarito** from `@fontsource-variable/gabarito`, imported once in `main.tsx` or `index.css`, set as Tailwind's `--font-sans` with the system stack as fallback. Fontsource's CSS already uses `font-display: swap` and splits Latin from Latin Extended by `unicode-range`; the font files become hashed assets, not `data:` URIs (`assetsInlineLimit: 0` stays).
- **Tabular figures** with `tabular-nums` where numbers are shown (the schema version, the sample on `/design`).
- **Lucide** from `lucide-react`, icons imported one by one.

### The pages

Approved mockups (phone in light and dark, desktop in light): [`/` on a phone](2026-10-24-PH-14a-design-system/health-phone.png), [`/design` on a phone](2026-10-24-PH-14a-design-system/design-phone.png), [`/design` on a desktop](2026-10-24-PH-14a-design-system/design-desktop.png). The mockups use approximate colors; the built pages use the tokens. The text is English, in sentence case.

Both pages are mobile first: a 16 px side padding on the phone, and from `md` a centered column of at most 720 px. No header, menu or logo: those are PH-14b's.

**`/`, the health page.**

- Title "szop" (Gabarito 800) and the line "Shopping lists. Coming soon." in `muted-foreground`.
- A `card` with "API status" and the same `role="status"` content as today: "Checking the API…", "Can't reach the API", "API: ok" / "Database: up" / "Schema version: …", or "API: reachable" / "Database: down". The texts stay exactly as they are, so the existing unit tests and the E2E journey keep passing. A small dot before "API" and "Database" (sage for up, `destructive` for down) is decoration (`aria-hidden`); the words carry the state.
- A link "See the design system →" to `/design`, a React Router `Link`, in `link`.
- States: loading, the API unreachable, the database down, and dark mode, as above. Long content does not apply.

**`/design`.**

- A link "← Back" to `/` (in `link`), the title "Design system" and the line "Szop's tokens and components, in the current color scheme."
- **Colors:** a grid of swatches, one per role of visual-design.md's table, each with the role's name. Where a role has a foreground (`primary` / `primary-foreground`, `destructive` / `destructive-foreground`, `haul` / `haul-foreground`, `warning` and its text, `background` / `foreground`, `link` on `background`), the swatch shows sample text in it, so axe checks that pair. A line below lists the palette (fur, the sage steps), with small swatches.
- **Type:** in a `card`, the weights (800, 700, 600, 400), the sizes in use (`text-2xl` or the title size, `text-lg`, `text-base`, `text-xs`), a line with Polish characters ("Żółć ąę"), and a line of tabular figures.
- **Buttons:** every Button variant, and one showing the focus ring (rendered with its focus-visible styles applied through a class or attribute, not by stealing focus).
- **Icons:** a row of a few Lucide icons the app will use (menu, plus, check, trash, undo, shopping bag), each with an accessible name or `aria-hidden` with a visible label.
- **Shape:** a card with the 18 px radius and a sample of the haul's 24 px top corners on the `haul` color.
- Static: no loading, error or empty states. Dark mode follows the system.
- The page is a route in `routes.tsx` (`/design`), in `apps/web/src/design/design-page.tsx`.

**`index.html`** gains `<meta name="description" content="…">`, one plain sentence about Szop.

### Tooling

- **`prettier-plugin-tailwindcss`** in the root `.prettierrc.json`, pointed at `index.css` as its Tailwind stylesheet (v4 needs the `tailwindStylesheet` option).
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) in `.vscode/extensions.json`.
- ESLint, `tsc` and the existing scripts cover the new files without changes; the plan checks that `components/ui/` generated code passes the lint rules, and fixes the code rather than turning rules off.

### Documentation

- **Tool pages:** `docs/development/tools/tailwind-css.md` and `docs/development/tools/shadcn-ui.md` (what, why, configuration explained), in the style of the existing ones; `prettier.md` and `vscode.md` lose their "arrives in PH-14" lines and describe the plugin and the extension; `vite.md` mentions the Tailwind plugin and the alias.
- **[visual-design.md](../../architecture/visual-design.md):** where the tokens live (`index.css`), the `/design` page, the names chosen for the radius tokens, `sage-800` and the roles `link` and `destructive-foreground` in the color table, with their contrast; the dark-mode section says the toggle is coming in PH-14b.
- **[functional-requirements.md](../../requirements/functional-requirements.md):** the manual theme toggle moves from the 💡 future extensions to a requirement marked 🎯 MVP (a new ID in the fitting area, or under the NFRs if that fits better; the builder picks and links it from PH-14b's entry).
- **ADR 0048** (Design system phase details): the decisions above, with its `Refines:` header on ADR 0013, decision 12 (the toggle) and ADR 0014 (the split), and the notes in those ADRs.
- **[stack-overview.md](../../architecture/stack-overview.md), section 14:** extended with how the pieces fit now that they exist (the CSS entry, `@theme`, roles as variables, shadcn's copied code, `CSPProvider`).
- **[architecture.md](../../architecture/architecture.md):** the web app's folders (`components/ui`, `lib`, `design`) if it lists them.
- **[testing.md](../../development/testing.md):** the token contrast test.
- **[glossary.md](../../glossary.md):** OKLCH, and any other niche term the new docs use.
- **[scripts.md](../../development/scripts.md):** only if a script changes.

## Tests

- **Unit (Vitest, Testing Library):** the existing `health-page.test.tsx` keeps passing unchanged (the texts do not change), plus a check that `/` links to `/design`. A `design-page.test.tsx` renders `/design` through the real route table and checks the headings and that a swatch exists for every role of the token list, so a role cannot be dropped from the page silently. The test keeps the role list in one place, shared with the page if that is simpler.
- **E2E (Playwright, every project):**
  - `e2e/tests/design.spec.ts`: opens `/design`, follows the link from `/`, runs `expectAccessible` (axe in light and dark), and the CSP guard runs as in every test.
  - **The token contrast test**, in the same file or its own: on `/design`, for light and for dark (`page.emulateMedia`), reads the computed colors of every pair this phase renders ([decision 10](#decisions)): the pairs of the [redesign spec's contrast table](2026-10-07-ring-tail-redesign-design.md#contrast), plus `link` on `background` and on `card`, `destructive-foreground` on `destructive`, the `warning` pair and any other pair `/` and `/design` show, through the browser (for example by painting each color on a canvas and reading the pixel back as sRGB), computes the WCAG contrast ratio and expects at least 4.5:1 for text and 3:1 for the UI parts. The pairs live in a table in the test.
  - `health.spec.ts` keeps working as it is (its texts stay); it is replaced in PH-14b ([OP-087](https://github.com/luiki-dev/szop/issues/160)).
- **The first-screen budget** in `vite.config.ts` (200 KB Brotli) keeps passing; the build log's number goes into the PR. Fonts and CSS are not counted by it.
- **By hand:** the screenshots for the PR (phone light and dark, desktop light) of both pages, and a look in Firefox.

## Definition of done for this phase

The shared [definition of done](../../development/definition-of-done.md) applies. In particular: CI green; the PR shows screenshots of `/` and `/design` (phone light and dark, desktop light); the demo check after `demo-up` on the branch confirms both pages, the font loading from our origin and no CSP errors in the console. No owner steps beyond the usual demo check.

## Order of work

About six tasks, each one commit:

1. Tailwind CSS v4 with its Vite plugin, `index.css`, the palette and roles in light and dark, Gabarito; Prettier plugin and the VS Code extension.
2. shadcn/ui on Base UI: `shadcn init`, the alias, `cn()`, `CSPProvider` with its CSS, Button restyled.
3. The health page restyled, its link to `/design`, the meta description.
4. The `/design` page with its unit test.
5. The E2E journey for `/design` and the token contrast test.
6. The documentation: tool pages, visual-design.md, requirements (the toggle), ADR 0048 with its notes, stack overview, testing guide, glossary.

## Risks

- **shadcn's CLI and Base UI move fast.** The flag or prompt that selects Base UI and the files it writes may differ from what this spec names; the plan checks the current CLI, and the code it writes is reviewed and kept to what Szop uses.
- **A dependency injects styles.** The CSP guard catches it on the first E2E run; the fix is a stylesheet rule or another option, never loosening the CSP.
- **Contrast in OKLCH.** Tailwind v4's grays differ slightly from the hex values in the redesign spec, so a pair could fall just under its threshold. The contrast test finds it; the fix is the next palette step, recorded in visual-design.md.
- **The `@/` alias** has to be known to Vite, TypeScript, Vitest and ESLint's import rules; a missing one shows as a failed build or test, not silently.

## Out of scope

- The app shell, the menu, the logo, the favicon and the Start page ([PH-14b](../../roadmap.md#ph-14b-app-shell)).
- The theme toggle itself (PH-14b) and any change to the dark-mode mechanism.
- Components other than Button; toasts (Base UI Toast comes with the first phase that shows a message).
- Storybook ([OP-060](https://github.com/luiki-dev/szop/issues/117)) and visual regression tests.
