# PH-14b App shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page sits in Szop's app shell: on a phone, a header with ☰ that opens the menu as a drawer; from `lg`, a permanent sidebar. The menu holds the owner's raccoon logo, Start and Design system, the API's status and a System / Light / Dark color scheme control. `/` becomes a Start page; the favicon is the new mark.

**Architecture:** A layout route in `routes.tsx` renders `AppShell` around every page through `<Outlet />`. `AppShell` decides phone or desktop with a `matchMedia` hook (`(min-width: 64rem)`, Tailwind's `lg`), so only one menu is in the DOM at a time: on a phone a header bar and a drawer (shadcn/ui's Sheet on Base UI's Dialog), on a desktop a sidebar. The color scheme is a `dark` class on `<html>`, set before the first paint by `public/color-scheme.js` and kept in step by `shell/color-scheme.ts`, which follows the system's `change` event while the choice is System.

**Tech Stack:** React 19, React Router 8 (layout routes, `handle`, `useMatches`), Tailwind CSS 4.3 (`@custom-variant`), shadcn CLI 4.22 with Base UI 1.9 (Sheet, Toggle Group or Radio Group), Lucide, Vitest + Testing Library, Playwright + axe; vtracer's output, SVGO, Pillow and headless Chrome for the brand files (one-off, nothing added to the build).

**Spec:** [`docs/superpowers/specs/2026-10-25-PH-14b-app-shell-design.md`](../specs/2026-10-25-PH-14b-app-shell-design.md)

## Global Constraints

- The brand mark is the approved trace, [`logo-approved.svg`](../specs/2026-10-25-PH-14b-app-shell/logo-approved.svg); never trace again. The app's files use the tile color **`#5F9273`** (`sage-500`), not the artwork's `#5C8E6F`. Its five tones: `#F9F7F2`, `#B4BCC5`, `#6C7882`, `#3A4654`, `#141C2B`.
- No file name says "head-only": the source is `brand-source/szop.png`, its trace `brand-source/szop-trace.svg`.
- UI text is English, sentence case, exactly as the spec writes it: "Open menu", "Close menu", "Menu", "Start", "Developer", "Design system", "Color scheme", "System", "Light", "Dark", "Welcome to Szop", "Szop is a shopping list app. Your lists will be here soon.", "Szop, Start"; the status texts unchanged: "Checking the API…", "Can't reach the API", "API: ok", "Database: up", "Schema version: N", "API: reachable", "Database: down". `document.title` is "Title · Szop".
- The stored choice: `localStorage` key **`szop-color-scheme`**, values `"system"`, `"light"`, `"dark"`; anything else, nothing, or a throwing storage means `"system"`.
- Components use roles only (`bg-accent`, `text-link`), never a raw palette color. Tap targets at least 48 px (`min-h-12`); `tabular-nums` on numbers; motion only under `motion-safe:`.
- **No `<style>` element and no blocked `style` attribute**; the CSP is never loosened, and no inline `<script>` (the CSP blocks it). Base UI stays under `CSPProvider disableStyleElements`. Generated shadcn code is read, kept to what is used and adapted to ESLint, never by turning rules off globally.
- Imports inside `apps/web` keep the repo's style (`.ts`/`.tsx` extensions on relative imports, `@/` for `src/`). Dependencies are pinned as the repo pins them; no dependency with an install script without the owner (`pnpm-workspace.yaml`, `allowBuilds`). Tools used once for the brand files (SVGO, Pillow) run through `pnpm dlx` or `uv run --with`, and are not added to any `package.json`.
- The first-screen JavaScript budget (200 KB Brotli, `vite.config.ts`) keeps passing.
- `pnpm check` and `pnpm test:e2e` pass after every task.
- Never trigger `demo-up` or `demo-down`, never merge, never commit to `main`. The branch is `feat/ph-14b-app-shell`.
- Commits follow Conventional Commits (scope `web`, `e2e` or `docs` as fits) and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017ZZDppgUzL5kBpJNYeS7Jf`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A storage that throws** (private mode, blocked site data). Expected: the app renders in the system scheme and the control still switches the page for the session. Task 3's `color-scheme.test.ts` makes `localStorage` throw on read and on write.
2. **Crossing `lg` with the drawer open** (rotating a tablet, resizing a window). Expected: the drawer goes, the sidebar shows, nothing stays dimmed or focus-trapped. Task 2's `shell.test.tsx` flips the media query while the drawer is open.
3. **The system scheme changing while the menu is closed on a phone** (the drawer, and the control in it, are not mounted). Expected: the page follows at once. Task 3 starts the listener in `main.tsx`, outside the menu, and tests it without rendering the menu.
4. **A long page title on a narrow phone.** Expected: the title is cut with "…", ☰ stays visible and full size. Task 2 gives the `h1` `min-w-0 truncate` and ☰ `shrink-0`, and its test checks both classes.
5. **Following the logo link in the drawer.** Expected: the drawer closes like after any other link. Task 2 tests the logo link as well as the Start and Design system links.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/architecture/visual-design/brand-source/` (new) | `szop.png` (moved), `szop-trace.svg`, `README.md`: the masters, not served |
| `apps/web/src/brand/logo.svg` (new) | The logo, imported as a hashed asset |
| `apps/web/public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` (new) | The icons |
| `apps/web/public/color-scheme.js` (new) | Applies the stored choice before the first paint |
| `apps/web/index.html` | Icon links; the color scheme script |
| `apps/web/src/index.css` | `dark:` as a class; dark roles under `:root.dark` |
| `apps/web/src/main.tsx` | Starts following the system scheme |
| `apps/web/src/routes.tsx` | The layout route; each route's `handle.title` |
| `apps/web/src/shell/app-shell.tsx` (new) | Header bar and drawer, or sidebar; the page's `h1` and `document.title` |
| `apps/web/src/shell/menu.tsx` (new) | Logo, links, the status and the control: one component for both places |
| `apps/web/src/shell/use-media-query.ts` (new) | `useMediaQuery`, `desktopQuery` |
| `apps/web/src/shell/api-status.tsx` (new), `shell/use-health.ts` (moved) | The API's status |
| `apps/web/src/shell/color-scheme.ts` (new) | Read, store, apply, follow the system |
| `apps/web/src/shell/color-scheme-control.tsx` (new) | The three-way control |
| `apps/web/src/components/ui/sheet.tsx`, `toggle-group.tsx` or `radio-group.tsx` (new) | shadcn/ui components on Base UI |
| `apps/web/src/start/start-page.tsx` (new) | `/` |
| `apps/web/src/design/design-page.tsx` | Loses its back link and `h1` |
| `apps/web/src/health/` (removed) | Replaced by the shell's status |
| `apps/web/src/test/match-media.ts` (new), `test/setup.ts` | A `matchMedia` stub for jsdom |
| `e2e/tests/shell.spec.ts` (new, replaces `health.spec.ts`), `design.spec.ts` | The journeys |

---

### Task 1: The brand files

**Files:**
- Create: `docs/architecture/visual-design/brand-source/README.md`, `brand-source/szop-trace.svg`, `apps/web/src/brand/logo.svg`, `apps/web/public/favicon.svg`, `apps/web/public/favicon.ico`, `apps/web/public/apple-touch-icon.png`
- Move: `docs/architecture/visual-design/szop.png` → `docs/architecture/visual-design/brand-source/szop.png` (untracked today: `git add` it in its new place)
- Modify: `apps/web/index.html`, `docs/architecture/visual-design/brand.png` (redrawn), `docs/architecture/visual-design.md` (section 4's paragraph on the mark), every Markdown link to `raccoon.svg`
- Remove: `docs/architecture/visual-design/raccoon.svg`

**Interfaces:**
- Produces: `apps/web/src/brand/logo.svg`, imported as `import logo from "@/brand/logo.svg";` (a URL string); `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`.

- [ ] **Step 1: Sources.** Move `szop.png` into `brand-source/`; copy `docs/superpowers/specs/2026-10-25-PH-14b-app-shell/szop-trace.svg` there. Write `README.md`: what the folder is (the owner's original artwork, 1254 × 1254 px, a transparent background; the masters the app's brand files are made from; never served or imported by the app); the three trace steps and their parameters, copied from the spec's [The brand mark](../specs/2026-10-25-PH-14b-app-shell-design.md#the-brand-mark); how the app's files below were made (Steps 2–4, the commands as run).
- [ ] **Step 2: `logo.svg`.** Copy `logo-approved.svg`, change the tile's `fill="#5C8E6F"` to `#5F9273`, optimize with `pnpm dlx svgo@4 --multipass` (keep `viewBox`; drop the vtracer comment and the XML prolog). Render the original and the result side by side at 560 px with headless Chrome and look: no visible difference. Expected: under 40 KB if it gets there without visible change (spec, Risks: a target, not a gate); write the size down for the PR.
- [ ] **Step 3: The icons.** `public/favicon.svg` = `logo.svg`. Render `logo.svg` at 256 px to a PNG with a transparent background (`google-chrome --headless=new --default-background-color=00000000 --window-size=256,256 --screenshot=…` on a page showing only the image), then with Pillow (`uv run --python 3.12 --with pillow`) write `favicon.ico` with sizes 16 and 32. `apple-touch-icon.png`: 180 × 180, from an SVG copy whose tile has `rx="0"` (iOS rounds the corners itself and would fill transparent ones with black).
- [ ] **Step 4: `index.html`.** In `<head>`, after the description: `<link rel="icon" href="/favicon.ico" sizes="32x32" />`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`.
- [ ] **Step 5: `brand.png`.** Redraw it as the old one is laid out (the mark at 128, 32 and 16 px, in a browser tab, and next to the wordmark "szop" on a light and a dark header), from a throwaway HTML page screenshotted with headless Chrome, using `logo.svg`; the wordmark in Gabarito Bold, `#2F5A43` on light (the `link` role), `#86C29C` on dark.
- [ ] **Step 6: The draft goes.** `git rm docs/architecture/visual-design/raccoon.svg`. In `visual-design.md`, section 4, the brand mark paragraph describes the owner's raccoon (a head with a dark mask, white brows and muzzle, ears with white rims, on a `sage-500` rounded square), links `brand-source/` and names `apps/web/src/brand/logo.svg` and `public/` as the app's files. Every other Markdown link to `raccoon.svg` (ADRs 0013 and 0022, the ring tail spec and plan, if they link it) becomes a permalink to the file at commit `00cced4` (`https://github.com/luiki-dev/szop/blob/00cced4/docs/architecture/visual-design/raccoon.svg`), a mechanical change; plain code mentions stay. Check with `grep -rn "raccoon.svg" docs`.
- [ ] **Step 7: Run** `pnpm build`, then `ls apps/web/dist` (expected: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`), then `pnpm check` and `pnpm test:e2e`. Expected: all pass.
- [ ] **Step 8: Commit** `feat(web): add the raccoon logo and favicon from the owner's artwork`.

### Task 2: The shell, the menu and the Start page

**Files:**
- Create: `apps/web/src/shell/app-shell.tsx`, `shell/menu.tsx`, `shell/use-media-query.ts`, `shell/api-status.tsx`, `shell/shell.test.tsx`, `shell/api-status.test.tsx`, `apps/web/src/start/start-page.tsx`, `apps/web/src/components/ui/sheet.tsx`, `apps/web/src/test/match-media.ts`, `e2e/tests/shell.spec.ts`
- Move: `apps/web/src/health/use-health.ts` → `apps/web/src/shell/use-health.ts`
- Modify: `apps/web/src/routes.tsx`, `apps/web/src/design/design-page.tsx`, `design/design-page.test.tsx`, `apps/web/src/test/setup.ts`, `e2e/tests/design.spec.ts`
- Remove: `apps/web/src/health/health-page.tsx`, `health/health-page.test.tsx`, `e2e/tests/health.spec.ts`

**Interfaces:**
- Consumes: `logo` from Task 1.
- Produces:
  - `src/test/match-media.ts`: `stubMatchMedia(matches?: Record<string, boolean>): { set(query: string, matches: boolean): void }` — replaces `window.matchMedia` with a fake whose `MediaQueryList` has `matches`, `addEventListener` / `removeEventListener` for `"change"`; `set` updates a query and fires its listeners. Unknown queries do not match. `setup.ts` calls `stubMatchMedia()` in a `beforeEach`.
  - `shell/use-media-query.ts`: `export const desktopQuery = "(min-width: 64rem)";` and `useMediaQuery(query: string): boolean` (`useSyncExternalStore` over `matchMedia`).
  - `routes.tsx`: `export interface RouteHandle { title: string }`; `routes` = one layout route `{ element: <AppShell />, children: [{ index: true, element: <StartPage />, handle: { title: "Start" } }, { path: "design", element: <DesignPage />, handle: { title: "Design system" } }] }`.
  - `shell/menu.tsx`: `Menu({ onNavigate }: { onNavigate?: () => void })`, with a slot at the bottom that Task 3 fills (`ColorSchemeControl` goes after `ApiStatus`).

- [ ] **Step 1: Add shadcn's Sheet**: `pnpm --filter @szop/web exec shadcn@4.22.1 add sheet` (or Base UI's Drawer through shadcn if the base-nova registry offers it and it is simpler). Read what it wrote: keep the side `"left"` variant, the overlay and the close button; no `tw-animate-css` unless the animation needs it and it injects no style element; animations under `motion-safe:`, 150–200 ms.
- [ ] **Step 2: Write `match-media.ts`** and add `stubMatchMedia()` to `setup.ts`'s `beforeEach`.
- [ ] **Step 3: Write the failing tests** in `shell.test.tsx`, rendering the real `routes` with `createMemoryRouter` (the pattern of today's `health-page.test.tsx`, with MSW's healthy handler):
  - `it("shows Start at / with its title and the menu in a sidebar on a desktop")`: `stubMatchMedia({ [desktopQuery]: true })`; `h1` "Start"; `document.title` "Start · Szop"; links "Szop, Start", "Start" (with `aria-current="page"`), "Design system"; the text "Developer"; the card text "Welcome to Szop"; no button "Open menu".
  - `it("follows a link to the design system")`: clicking "Design system" gives `h1` "Design system", `document.title` "Design system · Szop", `aria-current` on it.
  - `it("opens the menu from ☰ on a phone and closes it with Esc")`: phone (no stub override); `getByRole("button", { name: "Open menu" })`; no navigation in the document; click it → `getByRole("dialog", { name: "Menu" })` holds the links; `Escape` → the dialog is gone and ☰ has focus.
  - `it.each(["Szop, Start", "Start", "Design system"])("closes the drawer after following %s")`.
  - `it("swaps the drawer for the sidebar when the screen grows past lg")`: drawer open, `set(desktopQuery, true)` → no dialog, the sidebar's links present, no "Open menu" button; `set(desktopQuery, false)` → still no dialog (the drawer does not reopen by itself).
  - `it("cuts a long title and keeps ☰ whole")`: the phone `h1` has `min-w-0` and `truncate`, ☰ has `shrink-0`.
- [ ] **Step 4: Move the status tests** into `api-status.test.tsx`: the four cases of `health-page.test.tsx` (loading, ok with the schema version, the database down, the API unreachable), rendering `<ApiStatus />` in a `QueryClientProvider`, texts unchanged, still one `role="status"`. Update `design-page.test.tsx` for the shell's `h1` and the removed back link.
- [ ] **Step 5: Run** `pnpm test -- shell api-status design-page`. Expected: FAIL (the modules do not exist).
- [ ] **Step 6: Implement.** `ApiStatus` takes the health page's `Status` and `Line` as they are (dot `aria-hidden`, `bg-primary` / `bg-destructive`), compact (`text-sm`), schema version `text-xs text-muted-foreground tabular-nums`. `Menu`: the logo link (`<img src={logo} alt="" width={40} height={40}>` + "szop" in `font-bold text-link`, the link named "Szop, Start"), `NavLink`s "Start" (`House`) and "Design system" (`Palette`) under the heading "Developer" (`text-xs font-semibold uppercase text-muted-foreground`), each `min-h-12`, whole row clickable, `aria-current` styled `bg-accent text-accent-foreground`; every link calls `onNavigate`; at the bottom, after a `border-t border-border`, `<ApiStatus />`. `AppShell`: `useMediaQuery(desktopQuery)`; the title from `useMatches()`'s last match whose `handle` is a `RouteHandle`; a `useEffect` sets `document.title` to `` `${title} · Szop` `` or "Szop". Desktop: `aside` (`w-64 bg-card`, full height, sticky, own scroll) with `<nav aria-label="Menu"><Menu /></nav>`, and the content column (`mx-auto max-w-[720px] px-4 py-6`) with the `h1` (`text-2xl font-extrabold`) then `<Outlet />`. Phone: a header bar with ☰ (`Button` variant ghost, size icon, `shrink-0`, "Open menu") and the `h1` (`min-w-0 truncate text-xl font-extrabold`), then the content; the `Sheet` (side left, `w-[280px] max-w-[85vw]`, title "Menu" for its accessible name, close button "Close menu") with `<Menu onNavigate={() => setOpen(false)} />`; the open state resets to closed whenever the shell turns desktop. `StartPage`: the card of the spec. `DesignPage`: drop its "← Back" link and its `h1`, keep the intro line. Delete `health/`.
- [ ] **Step 7: Run** the tests of Step 5. Expected: PASS.
- [ ] **Step 8: E2E.** `shell.spec.ts` replaces `health.spec.ts`: `test("the shell shows the menu, the API's status and the pages", async ({ page, isMobile }) => …)`: `goto("/")`; `h1` "Start"; if `isMobile`, click "Open menu"; in the status, "API: ok" and "Database: up"; `expectAccessible(page)` with the menu open; follow "Design system"; `h1` "Design system"; on a phone the dialog is gone. `design.spec.ts`: reach `/design` through the menu (opening it first on a phone) instead of the old link. `csp-guard.spec.ts` stays.
- [ ] **Step 9: Run** `pnpm check`, `pnpm build` (the budget line passes; write the number down) and `pnpm test:e2e`. Expected: all pass, no CSP violation.
- [ ] **Step 10: Commit** `feat(web): add the app shell with its menu and a Start page`.

### Task 3: The color scheme

**Files:**
- Create: `apps/web/public/color-scheme.js`, `apps/web/src/shell/color-scheme.ts`, `shell/color-scheme.test.ts`, `shell/color-scheme-control.tsx`, `shell/color-scheme-control.test.tsx`, `apps/web/src/components/ui/toggle-group.tsx` or `radio-group.tsx`
- Modify: `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/shell/menu.tsx`, `e2e/tests/shell.spec.ts`

**Interfaces:**
- Consumes: `stubMatchMedia` from Task 2; `Menu`'s bottom slot.
- Produces (`shell/color-scheme.ts`): `type ColorScheme = "system" | "light" | "dark"`; `const storageKey = "szop-color-scheme"`; `const darkQuery = "(prefers-color-scheme: dark)"`; `readColorScheme(): ColorScheme`; `storeColorScheme(choice: ColorScheme): void` (`"system"` removes the key; a throwing storage is ignored); `applyColorScheme(choice: ColorScheme): void` (toggles `dark` on `document.documentElement`); `followSystemColorScheme(): () => void` (on the media query's `change`, re-applies `readColorScheme()`; returns the unsubscribe).

- [ ] **Step 1: Write the failing tests** in `color-scheme.test.ts`:
  - `readColorScheme`: `"light"` and `"dark"` as stored; nothing, `"blue"` → `"system"`; a `getItem` that throws (`vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error() })`) → `"system"`.
  - `storeColorScheme`: `"dark"` stores it; `"system"` removes the key; a `setItem` that throws does not throw.
  - `applyColorScheme`: `"dark"` adds the class; `"light"` removes it; `"system"` follows `stubMatchMedia({ [darkQuery]: true })`.
  - `followSystemColorScheme`: with nothing stored, `set(darkQuery, true)` adds the class and `set(darkQuery, false)` removes it, no component rendered (Review Focus 3); with `"light"` stored, `set(darkQuery, true)` leaves it light; after the returned unsubscribe, nothing changes.
- [ ] **Step 2: Write the failing tests** in `color-scheme-control.test.tsx`: a `radiogroup` named "Color scheme" with radios "System", "Light", "Dark", "System" checked by default; clicking "Dark" checks it, stores `"dark"`, adds the class; clicking "System" removes the key and the class follows the media query; with `localStorage` throwing on both calls, clicking "Dark" still adds the class (Review Focus 1).
- [ ] **Step 3: Run** `pnpm test -- color-scheme`. Expected: FAIL.
- [ ] **Step 4: Implement `color-scheme.ts`** with the interface above, and `public/color-scheme.js`: a classic script (no `import`, no `export`), an IIFE in a `try`/`catch` that reads `szop-color-scheme` and adds `dark` to `document.documentElement` when the value is `"dark"`, or is not `"light"` and `matchMedia("(prefers-color-scheme: dark)").matches`. A comment in each file points at the other: the rules are duplicated on purpose, since the script runs before the bundle.
- [ ] **Step 5: CSS and HTML.** In `index.css`: `@custom-variant dark (&:where(.dark, .dark *));` after the import; `:root` gets `color-scheme: light`; the `@media (prefers-color-scheme: dark)` block becomes `:root.dark { color-scheme: dark; … }` with the same values; the comments say the class is set by `color-scheme.js` and `color-scheme.ts` (APR-1). In `index.html`, `<script src="/color-scheme.js"></script>` as the first element after `<meta charset>`, before anything Vite injects. In `main.tsx`, call `followSystemColorScheme()` before rendering.
- [ ] **Step 6: The control.** `pnpm --filter @szop/web exec shadcn@4.22.1 add toggle-group` (or `radio-group`; take the one whose Base UI part gives `role="radiogroup"` / `role="radio"` and arrow keys, checking the rendered roles in the test). `ColorSchemeControl`: label "Color scheme" (`text-xs font-semibold uppercase text-muted-foreground`, the group's accessible name), three equal segments with `Monitor` / `Sun` / `Moon` (`aria-hidden`) above "System" / "Light" / "Dark", each `min-h-12`, the checked one `bg-accent text-accent-foreground`; state starts from `readColorScheme()`; a change calls `storeColorScheme` then `applyColorScheme`. Add it to `Menu` after `ApiStatus`.
- [ ] **Step 7: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 8: E2E.** In `shell.spec.ts`, `test("the color scheme survives a reload and is set before the app runs", async ({ page, isMobile }) => …)`: open the menu (on a phone); choose "Dark"; `expect(page.locator("html")).toHaveClass(/\bdark\b/)`; the body's computed background is the dark `background` (`readRoleColors` from `support/contrast.ts`, or `getComputedStyle(document.body).backgroundColor` against the `gray-900` value read the same way); reload, still `dark`; then `page.route("**/assets/*.js", (route) => route.abort())`, reload, the class is there with the bundle blocked; `page.unroute`, reload, choose "System", the class follows `page.emulateMedia({ colorScheme: "dark" })` and `"light"`. Check `design.spec.ts`'s axe and contrast runs still flip the scheme (they use `emulateMedia`, which the app follows while the choice is System).
- [ ] **Step 9: Run** `pnpm check`, `pnpm build` and `pnpm test:e2e`. Expected: all pass, no CSP violation (the script loads from `'self'`).
- [ ] **Step 10: Commit** `feat(web): let the user choose the color scheme in the menu`.

### Task 4: The documentation and the tracking

**Files:**
- Create: `docs/decisions/0049-app-shell-phase-details.md`
- Modify: `docs/architecture/visual-design.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/development/testing.md`, `docs/glossary.md` (if a new term appears), `docs/architecture/threat-model.md` (if it applies), `docs/decisions/0013-visual-design.md`, `docs/decisions/0022-ring-tail-redesign.md`, `docs/decisions/0048-design-system-phase-details.md`, `docs/roadmap.md`, `docs/requirements/functional-requirements.md` (only if [APR-1](../../requirements/functional-requirements.md#apr-1)'s wording no longer fits)

- [ ] **Step 1: ADR 0049**, in the form of ADR 0048: the spec's eight decisions with their alternatives and reasons, who chose each; `Refines:` ADR 0013, decision 16, and ADR 0022, decision 12 (the brand mark), and ADR 0013, decision 12, as ADR 0048, decision 5, refined it (the toggle's mechanism: a class, a script, `localStorage`); the notes in those ADRs' status lines and cells (CLAUDE.md, "Documentation").
- [ ] **Step 2: visual-design.md.** Section 4 completed (the app's files, `brand-source/`, the new `brand.png`; the wordmark in `link`, since `sage-700` fails on `fur`); "Dark mode" as built (the class, `color-scheme.js`, `color-scheme.ts`, the control, the key); section 5 as built today (the menu's current entries, the header bar with the page title on phones, the sidebar from `lg`, one `Menu` component).
- [ ] **Step 3: The other living docs.** `architecture.md`: the layout route, `shell/`, `start/`, page titles through `handle`, the color scheme's two halves. `stack-overview.md`: layout routes and `<Outlet />`; why the script lives in `public/` (the CSP). `testing.md`: the shell journey replaces the health journey (OP-087), `isMobile` to open the menu, `stubMatchMedia` in unit tests. Glossary and threat model only if they need it.
- [ ] **Step 4: Roadmap and open points.** `roadmap.md`: PH-14b's **Delivers** says the favicon and the header logo come from the owner's artwork (not the draft `raccoon.svg`); the stage row gets the plan link (already there) and stays 🚧 until the PR step. Create OP-105 on GitHub (`open-point` label, no parent: a candidate) "A splash or loading screen with the large raccoon", pointing at `brand-source/`, with ADR 0049 as its source; link it from the spec's mention.
- [ ] **Step 5: Run** `pnpm check`. Expected: pass (Prettier formats the Markdown).
- [ ] **Step 6: Commit** `docs: record the PH-14b decisions and update the living docs`.
