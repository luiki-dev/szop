# Tailwind CSS

Tailwind CSS styles the web app with small utility classes written in the markup: `px-4` is 16 px of horizontal padding, `bg-primary` the main brand color, `dark:` a variant that applies only in dark mode. At build time it scans the source for the classes in use and writes one stylesheet holding only those, served from Szop's own origin.

## Why Szop uses it

- **Tailwind CSS v4 through its Vite plugin, rather than CSS Modules:** [ADR 0013](../../decisions/0013-visual-design.md), decision 8. shadcn/ui, the component library, is built on it ([shadcn/ui](shadcn-ui.md)), and mixing it with a second way of writing CSS would give every styling question two answers.
- **Build-time styles only:** the Content Security Policy (CSP) allows no `<style>` elements ([ADR 0012](../../decisions/0012-security-baseline.md), decision 8; ADR 0013, decision 9). Tailwind's output is a plain file, which the CSP allows.
- **Design tokens as CSS custom properties, in two tiers:** ADR 0013, decision 10, and [ADR 0022](../../decisions/0022-ring-tail-redesign.md), decision 9. The values are those of [visual-design.md](../../architecture/visual-design.md#3-design-tokens).

## Configuration

Tailwind v4 has no `tailwind.config.js`: it is configured in **`apps/web/src/index.css`**, which `main.tsx` imports. The file, section by section:

- **`@import "tailwindcss";`** brings in Tailwind's base styles (a reset), its default theme (colors, spacing, type scale, breakpoints) and its utilities.
- **`@theme { … }`** adds to the theme. Each variable becomes a utility: `--color-fur` gives `bg-fur`, `text-fur` and so on; `--radius-surface` gives `rounded-surface`. It holds Szop's palette colors (`fur` and the `sage` steps), the font (`--font-sans`, Gabarito first, so `font-sans` and the page's default are Gabarito) and the two radii, `--radius-control` (12 px, buttons and inputs) and `--radius-surface` (18 px, cards). These do not change with the color scheme.
- **`:root { … }`** defines the **semantic roles** (`--background`, `--primary`, `--link`, `--haul` …), each pointing into the palette, for example `--primary: var(--color-sage-700)`. `color-scheme: light dark` tells the browser the page has both, so form controls and scrollbars follow.
- **`@media (prefers-color-scheme: dark) { :root { … } }`** gives the roles their dark values. Dark mode follows the system setting ([ADR 0013](../../decisions/0013-visual-design.md), decision 12), so this media query is all it takes; no JavaScript runs.
- **`@theme inline { … }`** turns the roles into Tailwind colors: `--color-primary: var(--primary)` makes `bg-primary` exist. `inline` makes the utility use `var(--primary)` itself, so the class changes color when the role does in dark mode. Components use only these role classes, never a palette color (visual-design.md, section 3).
- **`@layer base`** gives `body` the page's background, text color and font.

**`apps/web/vite.config.ts`** runs `tailwindcss()` from `@tailwindcss/vite` first among its plugins ([Vite](vite.md)).

**The class order:** `prettier-plugin-tailwindcss`, set in `.prettierrc.json`, sorts every class list on format ([Prettier](prettier.md)). **The editor:** the Tailwind CSS IntelliSense extension completes classes and shows the CSS behind them ([VS Code](vscode.md)). Both read `index.css` to learn Szop's own utilities.

## Everyday use

- **Style an element** with classes in `className`; long lists live inside components, not on pages (visual-design.md, section 2). Merge class lists with `cn()` ([shadcn/ui](shadcn-ui.md)).
- **Mobile first:** a class without a prefix applies everywhere; `md:` and `lg:` add to it from that width up.
- **A color is always a role** (`bg-card`, `text-muted-foreground`). A color the roles do not have is a new role: add it to `index.css` in both schemes, to visual-design.md's table, and to the contrast test's pairs ([Testing guide](../testing.md)).
- **Only literal class names are found.** Tailwind reads the source as text, so `bg-${color}` built at run time produces no CSS; write the full class name.
- **A class does nothing:** check its spelling with IntelliSense's hover, then that the file is under `apps/web/src`.

## Official documentation

- Installing with Vite: <https://tailwindcss.com/docs/installation/using-vite>
- Theme variables (`@theme`, `inline`): <https://tailwindcss.com/docs/theme>
- Dark mode: <https://tailwindcss.com/docs/dark-mode>
- Functions and directives (`@apply`, `@layer`): <https://tailwindcss.com/docs/functions-and-directives>
