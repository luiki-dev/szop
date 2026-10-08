# Vite

Vite is the build tool and development server of the web app. In development it serves the app's source files to the browser and reloads the page the moment a file changes, with no bundling step to wait for. For production, `vite build` bundles the source into a few static files, which the API serves ([PH-06a](../../roadmap.md#ph-06a-production-build-and-serving), [ADR 0023](../../decisions/0023-production-build-and-serving-details.md)).

## Why Szop uses it

- **Vite builds the React single-page application (SPA):** the [architecture](../../architecture/architecture.md#1-system-overview) names it as the SPA's build tool, and [ADR 0005](../../decisions/0005-development-environment.md) takes it as given. Vitest shares its configuration ([Vitest](vitest.md)).
- **A proxy for one origin in development:** [ADR 0005](../../decisions/0005-development-environment.md), decision 10. The proxy's target is a constant in the config: [ADR 0021](../../decisions/0021-spa-skeleton-details.md), decision 3.

## Configuration

**`apps/web/vite.config.ts`** is the config Vite reads, line by line:

- `plugins: [react(), precompress(), firstScreenBudget(200 * 1024)]`: `@vitejs/plugin-react` teaches Vite to compile JSX, the HTML-like syntax in `.tsx` files, and adds React's fast refresh, which swaps a changed component into the running page without losing its state. The other two are Szop's own, defined in the same file and explained below.
- **`precompress()`** writes a Brotli (`.br`, quality 11) and a gzip (`.gz`, level 9) copy next to every text file of the build (`.html`, `.js`, `.css`, `.svg`, `.json`, `.txt`, `.webmanifest`); images and fonts are compressed already. It runs in the `closeBundle` hook, after Vite has written every file, those copied from `public/` included, and finds the output folder in `configResolved`. The API sends whichever copy the browser accepts, so the files are compressed once, with the strongest settings, instead of on every request ([ADR 0023](../../decisions/0023-production-build-and-serving-details.md), decision 3).
- **`firstScreenBudget(200 * 1024)`** enforces the performance budget of [NFR-3](../../requirements/functional-requirements.md#nfr-3). In the `writeBundle` hook it starts from the entry chunk, follows the chunks it imports statically (lazy chunks, in `dynamicImports`, load later and do not count), compresses each with Brotli in memory and adds up the sizes. It always prints `first-screen JavaScript: … KB Brotli of 200.0 KB (… chunks)`, and above the limit it throws, so the build fails with `[plugin szop:first-screen-budget] Error: … over budget (NFR-3)` ([ADR 0023](../../decisions/0023-production-build-and-serving-details.md), decision 4).
- **Why the two are inline:** each is about 20 lines using only `node:zlib`, so a plugin package would add a dependency for little. Being plugins, a plain `vite build` cannot skip them, as it could a separate script. Both have `apply: "build"`, so the development server never runs them. Vitest does not load this file, so they have no unit tests; CI's `build` job runs them on every code PR.
- `server.proxy`: `"/api": "http://127.0.0.1:3000"`. A request to Vite for a path starting with `/api` is forwarded to the API, and the answer is passed back. The browser therefore talks to one origin, Vite's, as it will in production, so there is no Cross-Origin Resource Sharing (CORS) setup and cookies stay first-party.
- **Why the target is a constant:** `3000` is `PORT` in `apps/api/.env.example`. A second `.env` for one value that is the same on every machine would add a setup step, and the proxy does not exist in production, where the API serves the SPA itself. If `PORT` is changed, the page shows "Can't reach the API".
- **No `port` setting:** Vite's default, 5173, stays.

**`apps/web/index.html`** is the entry. Vite serves it at `/`, and its `<script type="module" src="/src/main.tsx">` loads the app, which `main.tsx` mounts into `<div id="root">`. Vite starts from this HTML file and follows its imports, not the other way around.

**`apps/web/tsconfig.json`** sets `moduleResolution: "bundler"`, the TypeScript mode that matches how Vite resolves imports ([ADR 0021](../../decisions/0021-spa-skeleton-details.md), decision 6), and adds the `vite/client` types.

## Everyday use

```bash
pnpm dev                     # from the root: the API and Vite, side by side
pnpm --filter @szop/web dev  # Vite only
```

- **`pnpm dev`** runs every package's `dev` script in parallel: the API restarts on a change ([tsx](tsx.md)) and Vite serves the page. It prints `Local: http://localhost:5173/`; open that address, not the API's.
- **Changing a file** updates the open page at once. A change to `vite.config.ts` restarts Vite by itself.
- **The page shows "Can't reach the API":** the API is not running, or `PORT` in `apps/api/.env` is not 3000. See the [setup guide](../setup.md#9-run-the-api-and-the-page).
- **`pnpm build`** (from the root, which runs `vite build` in `apps/web`) writes the production build to `apps/web/dist/`: `index.html`, the bundle under `assets/` with a content hash in each file name, and the `.br` and `.gz` copies. `pnpm start` then serves it from the API on `http://localhost:3000`; see the [setup guide](../setup.md#run-the-production-build).
- **`dist/` is generated,** so git (`.gitignore`), Prettier (`.prettierignore`) and ESLint (a global ignore of `**/dist/` in `eslint.config.js`) all skip it.
- **The build fails with `over budget (NFR-3)`:** the first screen's JavaScript passed 200 KB. Find the import that grew it, and load it lazily with `import()` if the first screen does not need it.

## Official documentation

- Getting started: <https://vite.dev/guide/>
- `server.proxy`: <https://vite.dev/config/server-options#server-proxy>
- The React plugin: <https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react>
- Features (hot module replacement, JSX): <https://vite.dev/guide/features>
- Building for production: <https://vite.dev/guide/build>
- The plugin API and its hooks: <https://vite.dev/guide/api-plugin>
