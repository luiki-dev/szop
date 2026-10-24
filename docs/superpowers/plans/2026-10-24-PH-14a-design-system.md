# PH-14a Design system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Szop's web app is styled with its design tokens in light and dark mode (following the system), with Gabarito, Lucide and shadcn/ui on Base UI under the CSP; the health page at `/` is restyled and links to a public `/design` page that shows every role, the type, the buttons, the icons and the shapes.

**Architecture:** Tailwind CSS v4 through `@tailwindcss/vite`, configured in one CSS entry, `apps/web/src/index.css`: the palette (`fur`, `sage`) in `@theme`, the semantic roles as custom properties on `:root` and in a `prefers-color-scheme: dark` media query, mapped to Tailwind colors with `@theme inline`. shadcn/ui is initialised with Base UI (`-b base`) and copies Button into `src/components/ui/`; Base UI's `CSPProvider` with `disableStyleElements` wraps the app. An E2E test reads the rendered role colors through a canvas and checks every pair's WCAG contrast.

**Tech Stack:** Tailwind CSS 4.3, `@tailwindcss/vite` 4.3, shadcn CLI 4.22 (Base UI 1.9), `@fontsource-variable/gabarito` 5.3, `lucide-react` 1.61, `prettier-plugin-tailwindcss` 0.8, Vitest + Testing Library, Playwright + axe.

**Spec:** [`docs/superpowers/specs/2026-10-24-PH-14a-design-system-design.md`](../specs/2026-10-24-PH-14a-design-system-design.md)

## Global Constraints

- The colors, roles, radii and type are those of [`visual-design.md`](../../architecture/visual-design.md), section 3, plus the spec's decisions 8 and 9: **`sage-800` `#2F5A43`**; role **`link`** = `sage-800` light, `sage-300` dark; role **`destructive-foreground`** = `white` light, `gray-950` dark.
- Components use roles only (`bg-primary`, `text-link`), never a raw palette color. The one exception is `/design`'s palette strip, which shows the palette itself.
- Dark mode follows the system only: Tailwind's default `dark:` variant and `@media (prefers-color-scheme: dark)`. No toggle, no class on `<html>` (PH-14b).
- **No `<style>` element and no `style` attribute in markup that the CSP blocks**; Base UI's `CSPProvider` has `disableStyleElements`. The CSP is never loosened. React's `style` prop is allowed for dynamic values (visual-design.md, "Under the Content Security Policy"), but this phase needs none.
- UI text is English, sentence case. The health page's status texts stay exactly as they are today ("Checking the API…", "Can't reach the API", "API: ok", "Database: up", "Schema version: …", "API: reachable", "Database: down").
- Tap targets at least 48 px (`min-h-12`); nothing smaller than `text-xs`; `tabular-nums` on numbers.
- Only Button is added from shadcn/ui. Dependencies are pinned the way the repo already pins them (caret ranges in `package.json`, the lockfile committed). No dependency with an install script is allowed without the owner (`pnpm-workspace.yaml`, `allowBuilds`).
- Imports inside `apps/web` keep the repo's style (`.ts`/`.tsx` extensions on relative imports); generated shadcn files are adapted to pass ESLint, never by turning rules off globally.
- The first-screen JavaScript budget (200 KB Brotli, `vite.config.ts`) keeps passing.
- `pnpm check` passes after every task; `pnpm test:e2e` passes after Tasks 2–5.
- Never trigger `demo-up` or `demo-down`, never merge, never commit to `main`. The branch is `feat/ph-14a-design-system`.
- Commits follow Conventional Commits (scope `web`, `e2e` or `docs` as fits) and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017ZZDppgUzL5kBpJNYeS7Jf`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A dependency that injects a `<style>` element** (Base UI, Fontsource, shadcn's generated code, `tw-animate-css` if init adds it). Expected: the CSP guard fails the E2E run. Task 2 runs `pnpm test:e2e` right after `CSPProvider` lands; Task 5's journey opens `/design`, where every component is shown.
2. **Polish characters falling back to the system font** because the Latin Extended subset is missing. Expected: "Żółć ąę" renders in Gabarito. Task 1 imports the full variable package (all subsets, split by `unicode-range`), and Task 5 checks `document.fonts` on `/design`.
3. **A pair that passes in light but not in dark** (or the reverse), since Tailwind v4's OKLCH grays differ from the hex values in the redesign spec. Expected: the contrast test runs both schemes on every project. Task 5.
4. **Font files inlined as `data:` URIs**, which the CSP's `default-src 'self'` blocks. Expected: `assetsInlineLimit: 0` stays; Task 1 checks `dist/assets` holds `.woff2` files.
5. **The focused Button sample stealing focus on load**, which would move a screen reader's position. Expected: the "Focused" sample is styled through a data attribute, not `autoFocus`. Task 4 tests that `document.activeElement` is `body` after render.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/index.css` (new) | Tailwind import, palette, roles light and dark, radii, font, base styles, Base UI's scrollbar CSS |
| `apps/web/src/main.tsx` | Imports `index.css` and the font |
| `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/tsconfig.json` | Tailwind plugin; the `@/` alias |
| `apps/web/components.json` (new) | shadcn's configuration |
| `apps/web/src/lib/utils.ts` (new) | `cn()` |
| `apps/web/src/components/ui/button.tsx` (new) | The Button, restyled to the roles |
| `apps/web/src/app.tsx` | `CSPProvider` around the app |
| `apps/web/src/health/health-page.tsx` | Restyled; link to `/design` |
| `apps/web/src/design/roles.ts` (new) | The list of color roles, shared by the page and its test |
| `apps/web/src/design/design-page.tsx` (new) | `/design` |
| `apps/web/src/routes.tsx` | The `/design` route |
| `apps/web/index.html` | Meta description |
| `e2e/support/contrast.ts` (new) | Reads role colors in the browser; WCAG contrast |
| `e2e/tests/design.spec.ts` (new) | The `/design` journey and the contrast test |
| `.prettierrc.json`, `.vscode/extensions.json` | The Tailwind plugin and extension |
| Docs | Tool pages with their tasks; the rest in Task 6 |

---

### Task 1: Tailwind CSS, the tokens and Gabarito

**Files:**
- Create: `apps/web/src/index.css`, `docs/development/tools/tailwind-css.md`
- Modify: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `.prettierrc.json`, root `package.json` (devDependency), `.vscode/extensions.json`, `docs/development/tools/prettier.md`, `docs/development/tools/vscode.md`, `docs/development/tools/vite.md`

**Interfaces:**
- Produces: Tailwind color utilities for every role: `background`, `foreground`, `card`, `card-foreground`, `muted-foreground`, `border`, `input`, `primary`, `primary-foreground`, `accent`, `accent-foreground`, `ring`, `link`, `destructive`, `destructive-foreground`, `warning`, `warning-foreground`, `haul`, `haul-foreground`, `haul-muted`, `haul-chip`, `haul-accent`; each also as a CSS custom property `--<role>` on `:root`. Palette utilities `fur`, `sage-100/300/500/700/800/950`. Radius utilities `rounded-control` (12 px) and `rounded-surface` (18 px). `font-sans` = Gabarito.

- [x] **Step 1: Install** `tailwindcss`, `@tailwindcss/vite` and `@fontsource-variable/gabarito` in `@szop/web`; `prettier-plugin-tailwindcss` at the root.
- [x] **Step 2: Add `tailwindcss()`** to `plugins` in `apps/web/vite.config.ts`, before the existing ones.
- [x] **Step 3: Write `index.css`.** `@import "tailwindcss";` then `@theme` with `--color-fur: #CBD0D6`, `--color-sage-100: #E3EEE7`, `--color-sage-300: #86C29C`, `--color-sage-500: #5F9273`, `--color-sage-700: #3F7357`, `--color-sage-800: #2F5A43`, `--color-sage-950: #10261A`, `--font-sans: "Gabarito Variable", <Tailwind's default sans stack>`, `--radius-control: 12px`, `--radius-surface: 18px` (the same in both schemes, so in `@theme` directly). Then `:root` with each role's light value from visual-design.md (`card-foreground` = `foreground`, `accent-foreground` = `primary`, `warning` `amber-100` / `warning-foreground` `amber-900`, `link` `sage-800`, `destructive-foreground` `white`); `@media (prefers-color-scheme: dark) { :root { … } }` with the dark values (`warning` `amber-950` / `warning-foreground` `amber-200`, `link` `sage-300`, `destructive-foreground` `gray-950`). Roles reference the palette through `var(--color-…)`. Then `@theme inline` mapping `--color-<role>: var(--<role>)`. A `@layer base` sets `body` to `bg-background text-foreground font-sans antialiased` and `color-scheme: light dark` on `:root`. Comment the file's sections, citing visual-design.md and ADR 0022 the way the repo's other config files cite ADRs.
- [x] **Step 4: Import** `@fontsource-variable/gabarito` (the whole package, so Latin Extended is included by `unicode-range`) and `./index.css` in `main.tsx`.
- [x] **Step 5: Prettier and VS Code.** `.prettierrc.json` becomes `{ "plugins": ["prettier-plugin-tailwindcss"], "tailwindStylesheet": "./apps/web/src/index.css" }`; add `bradlc.vscode-tailwindcss` to `.vscode/extensions.json`.
- [x] **Step 6: Build and check the fonts.** Run `pnpm build`. Expected: the budget line prints and passes; `ls apps/web/dist/assets` lists `gabarito-*.woff2` files and one `.css` file; `grep -c "data:font" apps/web/dist/assets/*.css` prints `0`; the built CSS defines every palette variable the roles reference (for example `grep -o -- "--color-gray-800:[^;]*"` finds it). If Tailwind dropped one as unused, declare the palette with `@theme static`.
- [x] **Step 7: Run** `pnpm check` and `pnpm test:e2e`. Expected: all pass (the health page now has the fur background, and axe passes in both schemes).
- [x] **Step 8: Docs.** `tailwind-css.md` (what it is, why, `index.css` section by section, the Vite plugin, the Prettier plugin, IntelliSense), in the style of `vite.md`; drop the "arrives in PH-14" lines in `prettier.md` and `vscode.md` and describe the plugin and the extension; `vite.md` mentions the Tailwind plugin.
- [x] **Step 9: Commit** `feat(web): add Tailwind CSS, the design tokens and Gabarito`.

### Task 2: shadcn/ui on Base UI, under the CSP

**Files:**
- Create: `apps/web/components.json`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/button.test.tsx`, `docs/development/tools/shadcn-ui.md`
- Modify: `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/src/app.tsx`, `apps/web/src/index.css`, `apps/web/package.json`

**Interfaces:**
- Consumes: the role utilities of Task 1.
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; `Button` and `buttonVariants` from `@/components/ui/button`, with `variant: "default" | "outline" | "ghost" | "destructive"` and `size: "default" | "icon"`, every size at least `min-h-12`.

- [x] **Step 1: Add the `@/` alias** (`@/*` → `./src/*`) to `apps/web/tsconfig.json` (`paths`), `vite.config.ts` and `vitest.config.ts` (`resolve.alias`, with `fileURLToPath(new URL("./src", import.meta.url))`).
- [x] **Step 2: Run** `pnpm --filter @szop/web exec shadcn@4.22.1 init -b base` (through `pnpm dlx` if `exec` cannot fetch it), answering for Vite and CSS variables; then `shadcn@4.22.1 add button`. Read every file it wrote or changed. Keep `components.json`, `lib/utils.ts`, `components/ui/button.tsx` and the dependencies Button needs; **revert its edits to `index.css`** except what Button relies on (keep Task 1's tokens as the source). If it added `tw-animate-css` or another stylesheet import and nothing uses it, remove it.
- [x] **Step 3: Write the failing test** `button.test.tsx`:
  - `it("styles each variant with its roles")`: renders the four variants and expects their classes to contain `bg-primary text-primary-foreground`, `bg-card border-input`, `text-link`, `bg-destructive text-destructive-foreground`.
  - `it("is at least 48 px tall in every size")`: every `size` has `min-h-12` (or `size-12` for `icon`) in `buttonVariants({ size })`.
- [x] **Step 4: Run** `pnpm test -- button`. Expected: FAIL on the class assertions.
- [x] **Step 5: Restyle `buttonVariants`** to the roles of the test, `rounded-control`, `font-semibold`, `text-base`, focus `focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`, and `data-[focused]:` with the same ring classes for `/design`'s sample (Review Focus 5). Fix the generated code for ESLint and the repo's import style.
- [x] **Step 6: Wrap the app** in `app.tsx` with `<CSPProvider disableStyleElements>` from `@base-ui/react/csp-provider`, outermost, with a comment citing ADR 0013, decision 9. Add Base UI's scrollbar CSS to `index.css`, verbatim: `.base-ui-disable-scrollbar { scrollbar-width: none; } .base-ui-disable-scrollbar::-webkit-scrollbar { display: none; }`.
- [x] **Step 7: Run** `pnpm check` and `pnpm test:e2e`. Expected: all pass, the CSP guard reports nothing.
- [x] **Step 8: Docs.** `shadcn-ui.md`: what shadcn/ui and Base UI are, why (ADR 0013, decisions 7 and 9), `components.json` explained, how to add a component and what to check afterwards (no injected styles, roles only, 48 px), `cn()`, `CSPProvider`.
- [x] **Step 9: Commit** `feat(web): add shadcn/ui on Base UI with its Button`.

### Task 3: The health page restyled

**Files:**
- Modify: `apps/web/src/health/health-page.tsx`, `apps/web/src/health/health-page.test.tsx`, `apps/web/index.html`

**Interfaces:**
- Consumes: the roles; the `/design` route path `"/design"` (the route itself lands in Task 4; the link may point at it before it exists).

- [x] **Step 1: Write the failing test** in `health-page.test.tsx`: `it("links to the design system")` expects `screen.getByRole("link", { name: "See the design system →" })` to have `href` `/design`.
- [x] **Step 2: Run** `pnpm test -- health-page`. Expected: the new test FAILS, the others pass.
- [x] **Step 3: Restyle `HealthPage`** after the approved mockup (`docs/superpowers/specs/2026-10-24-PH-14a-design-system/health-phone.png`): `main` with `mx-auto max-w-[720px] px-4 py-6`; `h1` "szop", `text-2xl font-extrabold`; "Shopping lists. Coming soon." in `text-muted-foreground`; a `bg-card rounded-surface p-4` card headed "API status" holding the existing `role="status"` block, the status texts unchanged, each "API"/"Database" line led by an `aria-hidden` dot (`bg-primary` when up, `bg-destructive` when down or unreachable); the schema version `tabular-nums text-sm text-muted-foreground`; then a React Router `Link` "See the design system →" to `/design`, `text-link font-semibold underline`.
- [x] **Step 4: Add** `<meta name="description" content="Szop is a shopping list app for groceries and everyday shopping." />` to `index.html`.
- [x] **Step 5: Run** `pnpm check` and `pnpm test:e2e`. Expected: all pass (`health.spec.ts` unchanged).
- [x] **Step 6: Commit** `feat(web): restyle the health page with the design tokens`.

### Task 4: The `/design` page

**Files:**
- Create: `apps/web/src/design/roles.ts`, `apps/web/src/design/design-page.tsx`, `apps/web/src/design/design-page.test.tsx`
- Modify: `apps/web/src/routes.tsx`

**Interfaces:**
- Consumes: `Button` (Task 2), the roles and radii (Task 1).
- Produces: `colorRoles: readonly ColorRole[]` in `roles.ts`, where `interface ColorRole { name: string; className: string; foreground?: { name: string; className: string } }`, with literal class names (`"bg-primary"`, `"text-primary-foreground"`) so Tailwind sees them. One entry per role of Task 1's list that is a surface or a color, with `foreground` set for `background`/`foreground`, `primary`/`primary-foreground`, `destructive`/`destructive-foreground`, `warning`/`warning-foreground`, `haul`/`haul-foreground`. Each swatch carries `data-role="<name>"`. The route `{ path: "/design", element: <DesignPage /> }`.

- [x] **Step 1: Write the failing tests** in `design-page.test.tsx`, rendering `/design` through the real route table as `health-page.test.tsx` does:
  - `it("shows a swatch for every color role")`: for each `colorRoles` entry, `document.querySelector('[data-role="<name>"]')` exists and has the role's name as text.
  - `it("shows the sections")`: headings "Design system", "Colors", "Type", "Buttons", "Icons", "Shape".
  - `it("links back to the start")`: link "← Back" with `href` `/`.
  - `it("does not take focus on load")`: `document.activeElement` is `document.body`.
- [x] **Step 2: Run** `pnpm test -- design-page`. Expected: FAIL (no route).
- [x] **Step 3: Write `roles.ts`, `DesignPage` and the route**, after the approved mockups (`design-phone.png`, `design-desktop.png`): the layout of Task 3; "Colors" as a 3-column grid of `rounded-control` swatches from `colorRoles`, a swatch with a `foreground` showing "Aa" in it, the `link` role shown as a sample link on `background` and on `card`, and below it the palette strip (`fur`, `sage-100/300/500/700/800/950`, raw palette classes allowed here only); "Type" in a card (`font-extrabold text-2xl` "Screen title 800", `font-bold text-lg` "Heading 700", `font-semibold` "Label 600", "Body 400 · Żółć ąę", `text-xs text-muted-foreground` "Smallest text, 12 px", `tabular-nums` "€28.47 · 1,111.00 · 3 × 0.5 kg"); "Buttons" with the four variants ("Primary", "Outline", "Ghost", "Delete") and a "Focused" Button with `data-focused`; "Icons" with `Menu`, `Plus`, `Check`, `Trash2`, `Undo2`, `ShoppingBag` from `lucide-react`, each `aria-hidden` with its name as a visible label; "Shape" with a `bg-card rounded-surface` card "Card · 18 px radius" and a `bg-haul text-haul-foreground rounded-t-[24px]` sample "Haul · 24 px top corners". Install `lucide-react`.
- [x] **Step 4: Run** `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(web): add the design system page`.

### Task 5: The `/design` journey and the contrast test

**Files:**
- Create: `e2e/support/contrast.ts`, `e2e/tests/design.spec.ts`
- Modify: `docs/development/testing.md`

**Interfaces:**
- Consumes: the `--<role>` custom properties (Task 1), the `/design` page (Task 4).
- Produces: in `contrast.ts`, `type Rgb = [number, number, number]`; `contrastRatio(a: Rgb, b: Rgb): number` (WCAG 2.2 relative luminance); `readRoleColors(page: Page, roles: readonly string[]): Promise<Record<string, Rgb>>`, which in the browser reads `getComputedStyle(document.documentElement).getPropertyValue("--<role>")`, paints it on a 1×1 canvas and reads the pixel back as sRGB (the browser converts OKLCH).

- [x] **Step 1: Write `design.spec.ts`:**
  - `test("the design system page is reachable from the start and accessible")`: `goto("/")`, click "See the design system →", expect heading "Design system", expect `document.fonts.check('16px "Gabarito Variable"', "Żółć")` to be `true` after `document.fonts.ready`, `expectAccessible(page)`.
  - `test("every color pair meets its contrast in light and dark")`: sanity `expect(contrastRatio([255,255,255],[0,0,0])).toBeCloseTo(21)`; then for `colorScheme` of `light` and `dark`, `page.emulateMedia`, `goto("/design")`, `readRoleColors`, and for each pair of the table below expect `contrastRatio` ≥ its minimum, with a message naming the pair and scheme.

  | Foreground | Background | Minimum |
  |---|---|---|
  | `foreground` | `background`, `card` | 4.5 |
  | `muted-foreground` | `background`, `card` | 4.5 |
  | `primary-foreground` | `primary` | 4.5 |
  | `primary` | `accent`, `card` | 4.5 |
  | `link` | `background`, `card` | 4.5 |
  | `destructive-foreground` | `destructive` | 4.5 |
  | `warning-foreground` | `warning` | 4.5 |
  | `haul-foreground` | `haul`, `haul-chip` | 4.5 |
  | `haul-muted` | `haul`, `haul-chip` | 4.5 |
  | `input` | `card`, `background` | 3 |
  | `ring` | `background`, `card` | 3 |
  | `haul-accent` | `haul`, `haul-chip` | 3 |

- [x] **Step 2: Run** `pnpm test:e2e`. Expected: PASS on all three projects. If a pair fails, change the role to the next palette step that passes, and note it for Task 6's visual-design.md update (never lower a minimum).
- [x] **Step 3: Docs.** `testing.md`: the contrast test (what it reads, why through a canvas, where the pairs live, what to do when one fails) in the E2E section, with the Contents in sync.
- [x] **Step 4: Commit** `test(e2e): add the design system journey and the token contrast test`.

### Task 6: Decisions and living docs

**Files:**
- Create: `docs/decisions/0048-design-system-phase-details.md`
- Modify: `docs/decisions/0013-visual-design.md`, `docs/decisions/0014-roadmap.md` (status line and decision cells only), `docs/architecture/visual-design.md`, `docs/requirements/functional-requirements.md`, `docs/architecture/stack-overview.md` (section 14), `docs/architecture/architecture.md`, `docs/glossary.md`, `docs/roadmap.md` (PH-14b's **Delivers** links the new requirement)

- [x] **Step 1: ADR 0048** in the style of ADR 0044: context (the brainstorm, the split), the spec's decisions 1–10 with their options and reasons, consequences, and "Settled while building" (anything Tasks 1–5 changed, such as a palette step or shadcn's generated files). Header: `Refines:` ADR 0013, decision 12 (the toggle becomes MVP, built in PH-14b); `Extends:` ADR 0022, decision 9 (`sage-800`, `link`, `destructive-foreground`). The split is decision 1, applying ADR 0014, decision 6, which it does not change. Add the notes in the earlier ADRs' status lines and decision cells, oldest first.
- [x] **Step 2: Requirements.** A new area `### Appearance (APR)` before Limits with `#### APR-1`: "🎯 [MVP] The user chooses the color scheme: system (the default), light or dark. The choice is kept on the device." Remove the "manual choice between light and dark mode" from the 💡 future extensions, keeping "Themes"; add APR to the Contents. Link [APR-1] from PH-14b's **Delivers** in `roadmap.md`.
- [x] **Step 3: `visual-design.md`.** `sage-800` in the palette list; `link` and `destructive-foreground` in the role table, and `card-foreground`, `accent-foreground` and `warning-foreground` if kept; the radius utility names (`rounded-control`, `rounded-surface`); where the tokens live (`apps/web/src/index.css`) and the `/design` page; the contrast paragraph pointing at the E2E test; the dark-mode section saying the toggle comes in PH-14b ([APR-1]).
- [x] **Step 4: The rest.** `stack-overview.md` section 14: how a role travels from `:root` through `@theme inline` to a class, shadcn's copied code, `CSPProvider`; `architecture.md`: the web app's new folders if it lists folders; `glossary.md`: OKLCH and any new niche term.
- [x] **Step 5: Run** `pnpm check` (Prettier on Markdown is skipped by `.prettierignore`; check links by reading). Expected: PASS.
- [x] **Step 6: Commit** `docs: record the PH-14a decisions and update the living docs`.
