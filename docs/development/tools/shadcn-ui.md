# shadcn/ui

shadcn/ui is a set of React components that are not installed as a dependency: its command-line tool copies each component's source into `apps/web/src/components/ui/`, and from then on the code is Szop's to read and change. The components are styled with [Tailwind CSS](tailwind-css.md) and built on **Base UI**, a headless library: it provides the behavior and accessibility (focus handling, keyboard use, dialogs, menus, toasts) and no looks.

## Why Szop uses it

- **shadcn/ui on Base UI:** [ADR 0013](../../decisions/0013-visual-design.md), decision 7. It is the most widespread React setup, its defaults are easy to restyle, and owning the code means no fight with a library's styling. Base UI is shadcn's default headless library, and it works under Szop's Content Security Policy (CSP).
- **Living with the CSP:** ADR 0013, decision 9. Base UI can inject small `<style>` elements, which the CSP blocks, so it is told not to and its CSS is in the stylesheet (below).
- **Components one by one:** a component is added when a phase needs it, never all up front ([visual-design.md](../../architecture/visual-design.md#2-components-and-styling)). PH-14a added the first, Button.

## Configuration

- **`apps/web/components.json`** is what the command-line tool reads when it adds a component: `style: "base-nova"` (the component set built on Base UI, with the Nova look as its starting point), `tailwind.css` pointing at `src/index.css`, `cssVariables: true` (colors as CSS variables, Szop's roles), `iconLibrary: "lucide"`, and the `aliases` where it writes files (`@/components/ui`, `@/lib/utils`).
- **The `@/` alias** means `apps/web/src/`. The generated code imports through it, so it is set in `apps/web/tsconfig.json` (`paths`), `vite.config.ts` and `vitest.config.ts` (`resolve.alias`).
- **`apps/web/src/lib/utils.ts`** exports `cn()`, from the `cn` package, which is shadcn's own: it joins class lists and lets a later Tailwind class win over an earlier one that sets the same property, so `cn("px-2", "px-4")` gives `px-4`. Components pass their caller's `className` through it.
- **`apps/web/src/components/ui/button.tsx`** is Button, restyled: the variants `default` (`primary`), `outline` (`card` with an `input` border), `ghost` (`link` text) and `destructive`, the sizes `default` (at least 48 px high) and `icon` (48 px square), the 12 px control radius and the focus ring. `class-variance-authority` (`cva`) maps the `variant` and `size` props to class lists.
- **`apps/web/src/app.tsx`** wraps the app in Base UI's **`CSPProvider` with `disableStyleElements`**, so no Base UI component renders a `<style>` element. What it would have injected, a class that hides native scrollbars in scroll areas and selects, is at the end of `index.css`.

## Everyday use

```bash
pnpm --filter @szop/web dlx shadcn@4.22.1 add <component>   # copies the component into src/components/ui/
```

After adding a component, read every file the tool wrote or changed, and:

- **Keep `index.css` Szop's.** The tool may add its own colors, a `.dark` class variant, fonts or animation imports; revert those, and map what the component needs onto the existing roles (a new role goes into visual-design.md's table too).
- **Remove dependencies nothing uses** that it installed.
- **Restyle to the roles** and to 48 px tap targets; use `cn()` for class lists and the repository's code style (Prettier and ESLint fix most of it).
- **Check for injected styles:** run `pnpm test:e2e` with a journey that opens the component. The CSP guard fails on any `<style>` element ([Testing guide](../testing.md#the-csp-guard)). Toasts use Base UI's Toast, never Sonner, which injects one.
- **Write a component test** for what Szop changed, as `button.test.tsx` does.

## Official documentation

- shadcn/ui: <https://ui.shadcn.com/docs>
- The command-line tool: <https://ui.shadcn.com/docs/cli>
- `components.json`: <https://ui.shadcn.com/docs/components-json>
- Base UI: <https://base-ui.com/react/overview/quick-start>
- `CSPProvider`: <https://base-ui.com/react/utils/csp-provider>
