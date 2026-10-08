# Vite

Vite is the build tool and development server of the web app. In development it serves the app's source files to the browser and reloads the page the moment a file changes, with no bundling step to wait for. For production it will bundle the source into a few static files; that part arrives in [PH-06a](../../roadmap.md#ph-06a-production-build-and-serving).

## Why Szop uses it

- **Vite builds the React single-page application (SPA):** the [architecture](../../architecture/architecture.md#1-system-overview) names it as the SPA's build tool, and [ADR 0005](../../decisions/0005-development-environment.md) takes it as given. Vitest shares its configuration ([Vitest](vitest.md)).
- **A proxy for one origin in development:** [ADR 0005](../../decisions/0005-development-environment.md), decision 10. The proxy's target is a constant in the config: [ADR 0021](../../decisions/0021-spa-skeleton-details.md), decision 3.

## Configuration

**`apps/web/vite.config.ts`** is the config Vite reads, line by line:

- `plugins: [react()]`: `@vitejs/plugin-react` teaches Vite to compile JSX, the HTML-like syntax in `.tsx` files, and adds React's fast refresh, which swaps a changed component into the running page without losing its state.
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
- **There is no `build` script yet.** Bundling for production, and serving the result from the API, is [PH-06a](../../roadmap.md#ph-06a-production-build-and-serving).

## Official documentation

- Getting started: <https://vite.dev/guide/>
- `server.proxy`: <https://vite.dev/config/server-options#server-proxy>
- The React plugin: <https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react>
- Features (hot module replacement, JSX): <https://vite.dev/guide/features>
