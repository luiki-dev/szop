# ADR 0048 — Design system phase details

- **Status:** ✅ Accepted
- **Date:** 2026-10-24
- **Refines:** [ADR 0013](0013-visual-design.md), decision 12 (the manual theme toggle is part of the MVP, built in PH-14b; see decision 5)
- **Extends:** [ADR 0022](0022-ring-tail-redesign.md), decision 9 (the `sage-800` step and the `link` and `destructive-foreground` roles; see decisions 8 and 9)

## Context

[PH-14](../roadmap.md#ph-14a-design-system) was to build the UI foundation of [ADR 0013](0013-visual-design.md) and [ADR 0022](0022-ring-tail-redesign.md) and the app shell around every page. Its brainstorm found two new concepts in it, the styling system and the responsive shell with its navigation, and about ten tasks, so it was split ([ADR 0014](0014-roadmap.md), decision 6). The owner also wanted a place to see and check the styles in the browser, and asked whether a manual dark-mode toggle was cheap enough to build now. The spec's review then found two color pairs under WCAG's minimum. The [spec](../superpowers/specs/2026-10-24-PH-14a-design-system-design.md) holds the design in full; this ADR records the decisions and the alternatives.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|---|---|---|
| 1 | The phase's size | One phase; two | **Two: [PH-14a Design system](../roadmap.md#ph-14a-design-system) and [PH-14b App shell](../roadmap.md#ph-14b-app-shell)** _(the owner's choice)_. ADR 0014, decision 6, allows one new concept per phase and about 3 to 8 tasks; PH-14 had two concepts and about ten. Each half ends with something working on the demo. PH-14 is retired. |
| 2 | Where the styles are checked | A "Start" menu entry only; a link to `dzwoniec.com`; a page of the design system | **A `/design` page** _(the owner's choice)_ showing every color role, the palette, the type, the buttons, the icons and the shapes, in the current color scheme. It grows as components are added. |
| 3 | Who sees `/design` | Development only (`pnpm dev`); everyone | **Everyone, on the demo too** _(the owner's choice: "nie kombinujmy", don't overcomplicate it)_. Nothing on it is secret, and a development-only route would be one more condition to build and test. |
| 4 | `/` during PH-14a | A Start page now; the health page, restyled | **The health page, restyled, with a link to `/design`** _(the owner's choice)_. The Start page belongs with the shell in PH-14b; this phase changes the look, not the content, so the health journey keeps passing until PH-14b replaces it ([OP-087](https://github.com/luiki-dev/szop/issues/160)). |
| 5 | The manual theme toggle | A 💡 future extension, as ADR 0013, decision 12, had it; part of the MVP | **Part of the MVP, built in PH-14b** _(the owner's choice)_: system, light or dark, chosen in the menu and kept on the device ([APR-1](../requirements/functional-requirements.md#apr-1)). It is about one task (a class instead of the media query for `dark:`, a small script before the page paints, a control, tests) and components do not change, since they use roles only. It needs the menu, which is PH-14b's. |
| 6 | Components from shadcn/ui | The components the next phases will need; Button only | **Button only.** Components are added as phases need them ([visual-design.md](../architecture/visual-design.md#2-components-and-styling)); Button proves the setup and shows the focus ring. |
| 7 | How the token contrast is checked | A unit test parsing the CSS; checking by hand once; an E2E test reading the rendered colors | **An E2E test** that reads each role in the browser through a canvas and computes the WCAG ratio _(Claude's call)_. Tailwind v4's palette is in OKLCH, which a unit test would need a color library to convert; the browser already does. axe checks only text on the page, not the 3:1 pairs of UI parts. |
| 8 | Sage text on the page | Links and ghost buttons in `primary`; in `foreground`, underlined; a darker sage | **A new palette step, `sage-800` `#2F5A43`, and a new role, `link`** (`sage-800` light, `sage-300` dark), for sage text on the page itself: links and the ghost Button _(the owner's choice)_. `primary` (`sage-700`) on `fur` is 3.56:1, under the 4.5:1 text needs; `sage-800` on `fur` is 5.1:1 and on white 7.9:1, so the look stays as in the mockups, a shade darker. `primary` stays for button fills and for text on white and on `accent`. |
| 9 | Text on the destructive color | White in both schemes; another red step in dark mode; a role of its own | **A new role, `destructive-foreground`**: `white` light (4.8:1 on `red-600`), `gray-950` dark (7.3:1 on `red-400`) _(Claude's call)_. White on `red-400` is 2.8:1. Dark text on a light red is shadcn's own dark-mode pattern. |
| 10 | Which pairs the test checks | The redesign spec's contrast table; every pair the pages render | **Every pair the pages render** _(Claude's call)_: the redesign spec's pairs plus `link`, `destructive` and `warning`. Decision 8's problem was a pair outside that table. |

## Consequences

- `apps/web/src/index.css` is the one source of the tokens: the palette and radii in `@theme`, the roles on `:root` and in a `prefers-color-scheme: dark` media query, mapped to Tailwind colors with `@theme inline`. [visual-design.md](../architecture/visual-design.md) lists the same values.
- Every phase that adds a role adds it to `index.css`, to visual-design.md's table, to `/design`'s `roles.ts` and to the contrast test's pairs.
- `/design` is public. It shows nothing but the design system, and it stays until a phase decides otherwise.
- The first-screen JavaScript grew from 110 KB to 124 KB Brotli (Base UI, Lucide, the page), under the 200 KB budget of [NFR-3](../requirements/functional-requirements.md#nfr-3).

## Settled while building

- **`shadcn init` needs `-b base -p nova -t vite`** to run without prompts. It rewrote `index.css` with its own colors, a `.dark` class variant, the Geist font and `tw-animate-css`, and installed the `shadcn` package; all of it was reverted, and the [shadcn/ui page](../development/tools/shadcn-ui.md) lists what to check after `shadcn add`.
- **`cn()` comes from the `cn` package**, shadcn's own replacement for `clsx` with `tailwind-merge`, which the generated code imports.
- **Button keeps four variants and two sizes:** shadcn's `secondary` and `link` variants have no Szop role, and its `xs`, `sm` and `lg` sizes are under 48 px.
- **The radius utilities are `rounded-control` (12 px) and `rounded-surface` (18 px)**, set directly in `@theme`, since they do not change with the color scheme. shadcn's `--radius` is not used.
- **The roles `card-foreground`, `accent-foreground` and `warning-foreground`** were added: shadcn's components expect the first two, and the warning banner's text needed a name.
- **Browsers write a font's range as `U+100`**, not `U+0100`, so the journey's check that Gabarito's Latin Extended file loaded matches both.
- **No palette step changed** after the contrast test's first run: every pair passed in both schemes on Chromium, Firefox and the emulated Pixel.
