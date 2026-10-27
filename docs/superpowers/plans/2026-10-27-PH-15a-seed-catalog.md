# PH-15a Seed catalog, read-only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor without a session opens **Catalog** in the menu and browses Szop's default catalog, read from a hand-edited YAML file by the API, as a collapsible tree in the store's category order, and searches it by product or category name.

**Architecture:** `packages/shared` gets the catalog's Zod schemas, the category order rule (`orderCategories`, with fast-check properties), `compareNames` and the API's error schema. The API parses and checks `apps/api/src/catalog/seed.yaml` once at startup (`yaml` + Zod), passes the flat catalog to `buildApp`, and serves it from `GET /api/catalog`, serialized through the shared schema by `fastify-type-provider-zod`; every API error gets one JSON shape. The web app fetches the catalog once, builds a tree from it, and filters and expands it in the browser.

**Tech Stack:** Zod 4.6, fast-check 4.10, `yaml` 2.9 (YAML 1.2), Fastify 5.12 with `fastify-type-provider-zod` 7.0, React 19, React Router 8, TanStack Query 5, Tailwind CSS 4.3, Lucide, Vitest + Testing Library (+ `@testing-library/user-event` 14.6), MSW 3, Playwright + axe.

**Spec:** [`docs/superpowers/specs/2026-10-25-PH-15a-seed-catalog-design.md`](../specs/2026-10-25-PH-15a-seed-catalog-design.md)

## Global Constraints

- UI text is English, sentence case, exactly as the spec writes it: "Catalog", "Setup", "Search the catalog", "Expand all", "Collapse all", "Try again", "20 categories · 412 products" (numbers from the data; "1 category", "1 product" in the singular), `No products match "xyz"`, the accessible name "Dairy & eggs, 31 products" ("1 product"). `document.title` is "Catalog · Szop".
- The seed file's header comment is the spec's, word for word ([The seed file](../specs/2026-10-25-PH-15a-seed-catalog-design.md#the-seed-file)). It holds "Dairy & eggs" › "Milk" › "Plant-based" › "Oat milk", which the E2E test relies on.
- Seed limits: at most 300 categories, nesting at most 5 levels, at most 2,000 products, at most 50 units; names trimmed, not empty, at most 100 characters; category names unique across the tree and product names unique, both case-insensitive; units unique; every `unit` named in `units`; no unknown keys; duplicate YAML keys rejected.
- The error body is `{ "error": { "code", "message" } }`; codes `invalid_input` (400), `forbidden_cross_site` (403), `not_found` (404), `unsupported_media_type` (415), `internal_error` (500, message `Internal server error`, never the error's own text).
- Names sort with `Intl.Collator("pl", { numeric: true })`; search is case- and accent-insensitive (NFD, combining marks removed), substring anywhere, query trimmed.
- Components use roles only (`bg-muted`, `text-link`), never a raw palette color. Tap targets at least 48 px (`min-h-12`); rows 56 / 52 / 48 px as the spec says; indent 20 px per level; `tabular-nums` on counts; motion only under `motion-safe:`.
- No `<style>` element, no blocked `style` attribute, no inline `<script>`: the CSP is never loosened. Indentation therefore goes through classes or a CSS custom property set by a class, not `style={{ paddingLeft }}`; check how `design-page.tsx` or the CSP guard handles it before choosing.
- Imports keep the repo's style (`.ts`/`.tsx` extensions on relative imports, `@/` for `apps/web/src`). Dependencies are added with caret ranges as the repo does; no dependency with an install script without the owner (`pnpm-workspace.yaml`, `allowBuilds`).
- A test that covers an acceptance criterion starts its name with the criterion's ID and a colon (`it("PRD-2.5: …")`), [testing.md, Rules](../../development/testing.md#rules).
- The first-screen JavaScript budget (200 KB Brotli, `vite.config.ts`) keeps passing; lazy-load the catalog page only if it needs it.
- `pnpm check` and `pnpm test:e2e` pass after every task.
- Never trigger `demo-up` or `demo-down`, never merge, never commit to `main`. The branch is `feat/ph-15a-seed-catalog`.
- Commits follow Conventional Commits (scope `shared`, `api`, `web`, `e2e` or `docs` as fits) and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01MPNqqfhoF1qzzhv3ksMp6Z`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A seed value YAML reads as something other than a string**, such as `name: 2024`, `name: null` or `name:` with nothing. Expected: the API refuses to start with a message naming the entry, never a category called "2024" or "null". Task 2 tests all three.
2. **The catalog body does not match the schema** (a deploy where the SPA and the API disagree). Expected: the page shows the error card with "Try again", not a blank page or a crash. Task 5 serves a body with a category missing its `name`.
3. **A query that is only spaces, or holds `(`, `*` or `.`.** Expected: spaces show the normal tree; the other characters are matched literally (`.` finds nothing in a catalog without dots), never as a regular expression. Task 6 tests both.
4. **A category with no products and no subcategories, and a product with no unit.** Expected: the category shows "0 products" and opens to nothing without an error; the product shows no unit text at all (not "null"). Task 5 tests both.
5. **Searching, toggling, then clearing with Esc while the field has focus.** Expected: the field empties, the browsing expansion from before the search returns untouched, focus stays in the field. Task 6 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/catalog.ts` (new) | `catalogSchema` and its parts, `orderCategories` |
| `packages/shared/src/names.ts` (new) | `compareNames` |
| `packages/shared/src/api-error.ts` (new) | `apiErrorSchema` |
| `packages/shared/src/index.ts` | Exports the above |
| `packages/shared/vitest.config.ts` (new), `vitest.config.ts` | A `shared` test project |
| `apps/api/src/catalog/seed.yaml` (new) | The seed content |
| `apps/api/src/catalog/seed.ts` (new) | `parseSeed`, `loadSeed`, `seedLimits` |
| `apps/api/src/catalog/routes.ts` (new) | `GET /api/catalog` |
| `apps/api/src/errors.ts` (new) | The error handler and `sendError` |
| `apps/api/src/app.ts`, `server.ts` | The compilers, the handler, the `catalog` dependency |
| `apps/api/src/security/cross-site.ts`, `web/routes.ts`, `health/routes.ts` | The new error shape; health declares its schema |
| `apps/api/src/test/catalog.ts` (new) | `testCatalog` for `buildApp` in tests |
| `apps/web/src/catalog/` (new) | `catalog-page.tsx`, `catalog-tree.tsx`, `tree.ts`, `search.ts`, `use-catalog.ts` and their tests |
| `apps/web/src/api/client.ts`, `routes.tsx`, `shell/menu.tsx`, `index.css`, `design/roles.ts` | `getCatalog`, the route, Setup › Catalog and the links' focus ring, the `muted` role |
| `apps/web/src/test/catalog.ts` (new) | `smallCatalog`, the MSW fixture |
| `e2e/tests/catalog.spec.ts` (new), `design.spec.ts`, `shell.spec.ts` | The journey, the `muted` pairs, the ring color |

---

### Task 1: The shared catalog and fast-check

**Files:**
- Create: `packages/shared/src/catalog.ts`, `src/catalog.test.ts`, `src/names.ts`, `src/names.test.ts`, `packages/shared/vitest.config.ts`, `docs/development/tools/fast-check.md`
- Modify: `packages/shared/src/index.ts`, `packages/shared/package.json`, `vitest.config.ts`, `docs/development/testing.md`

**Interfaces:**
- Produces (from `@szop/shared`):
  - `catalogCategorySchema` `{ id: string, parentId: string | null, position: int ≥ 0, name: string 1..100 }`, `catalogProductSchema` `{ id, name, categoryId: string | null, unitId: string | null }`, `catalogUnitSchema` `{ id, name }`, `catalogSchema` `{ categories, products, units }`; types `Catalog`, `CatalogCategory`, `CatalogProduct`, `CatalogUnit`.
  - `type OrderedCategory = CatalogCategory & { depth: number }`; `orderCategories(categories: readonly CatalogCategory[]): OrderedCategory[]`.
  - `compareNames(a: string, b: string): number`.

- [x] **Step 1: The test project.** `pnpm --filter @szop/shared add -D fast-check@^4.10.2`. `packages/shared/vitest.config.ts`: `defineProject({ test: { name: "shared", environment: "node", include: ["src/**/*.test.ts"] } })`, with the one-line comment the other projects have; add `"packages/shared/vitest.config.ts"` to the root `projects`.
- [x] **Step 2: Write the failing tests** in `names.test.ts`: `it("ORD-2.2, ORD-2.3: sorts by Polish rules")`: `["tofu", "śmietana", "ser"].sort(compareNames)` → `["ser", "śmietana", "tofu"]`; `it("ignores case")`: `compareNames("milk", "Milk") === 0` or the two sort next to each other before "Mint" (pick the collator sensitivity that makes the test hold and say which in a comment); `it("sorts numbers by value")`: `["Pack 10", "Pack 2"]` → `["Pack 2", "Pack 10"]`.
- [x] **Step 3: Write the failing tests** in `catalog.test.ts`:
  - `catalogSchema`: accepts a body of two categories, one product with a unit and one without, one unit; rejects a category name of 101 characters; rejects an empty name; rejects `position: -1`.
  - `describe("ORD-2.1, ORD-3.1: orderCategories")` examples: the empty list → `[]`; one level with positions 2, 0, 1 → by position, all `depth` 0; a tie in `position` → by `compareNames`; five levels (`a` › `b` › `c` › `d` › `e`, input reversed) → in that order with depths 0 to 4; a parent with two subcategories, each with a child → each parent directly before its own subtree.
  - Broken input terminates: a category whose `parentId` names no category, and two categories that are each other's parent. Expected (this plan's choice for the spec's open question): the orphan is treated as top-level; categories reachable only through a cycle are dropped. The function's comment says so.
  - Properties (`fc.assert(fc.property(…))`), over a `forest` arbitrary defined in the test file: up to 50 categories, each with a parent drawn from the ones before it or `null`, positions drawn per sibling group (ties allowed), unique names, then the array shuffled (`fc.shuffledSubarray(xs, { minLength: xs.length })`). One `it` per property: the output is a permutation of the input (same IDs, each once); every category comes after its parent; a category's whole subtree is contiguous and directly follows it; siblings appear in `position` order (then `compareNames`); `depth` equals the number of ancestors; two shuffles of the same forest give the same output.
- [x] **Step 4: Run** `pnpm test -- --project shared`. Expected: FAIL (the modules do not exist).
- [x] **Step 5: Implement** `names.ts` (one module-level `Intl.Collator("pl", { numeric: true, … })`, its comment citing the spec's decision 13 and [ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2)), `catalog.ts` (the schemas with the comment style of `health.ts`; `orderCategories` groups children by `parentId`, sorts each group by `position` then `compareNames`, walks depth-first from the roots), and the exports in `index.ts`.
- [x] **Step 6: Run** the tests of Step 4. Expected: PASS. Then break `orderCategories` on purpose (sort siblings by name only) and check a property fails with a shrunk counterexample; note its output for the docs, then undo.
- [x] **Step 7: Docs.** `docs/development/tools/fast-check.md` in the form of `vitest.md`: what it is, why (ADR 0007's property tests), how the repo uses it (in `packages/shared`, arbitraries kept in the test file), reading a counterexample and replaying it with `seed` and `path` from the failure message. `testing.md`: a "Property tests" section (when to write one: a rule over a whole input space, such as an order; where they live; reading and replaying a failure) and the `shared` project wherever the projects are listed; its Contents updated.
- [x] **Step 8: Run** `pnpm check`. Expected: PASS.
- [x] **Step 9: Commit** `feat(shared): add the catalog schema and the category order rule`.

### Task 2: The seed file

**Files:**
- Create: `apps/api/src/catalog/seed.yaml`, `apps/api/src/catalog/seed.ts`, `apps/api/src/catalog/seed.test.ts`
- Modify: `apps/api/package.json`, `apps/api/src/server.ts`

**Interfaces:**
- Consumes: `Catalog`, `catalogSchema` from Task 1.
- Produces (`catalog/seed.ts`): `seedLimits = { categories: 300, depth: 5, products: 2000, units: 50, nameLength: 100 } as const`; `parseSeed(text: string): Catalog` (throws `Error` with a message naming the entry and the rule); `loadSeed(): Catalog` (reads `new URL("./seed.yaml", import.meta.url)`).

- [x] **Step 1:** `pnpm --filter @szop/api add yaml@^2.9.1`.
- [x] **Step 2: Write the failing tests** in `seed.test.ts`, on small YAML strings:
  - A valid file (the spec's example) → `catalogSchema.parse(result)` equals `result`; "Dairy & eggs" has `parentId: null`, `position: 0`; "Milk" has "Dairy & eggs"'s ID as parent; "Plant-based" depth 2; "Oat milk"'s `unitId` is the ID of `l`; a product without `unit` has `unitId: null`; IDs are unique.
  - A unit called `no` and a category called `off` stay the strings "no" and "off".
  - Each broken rule throws, the message matched with `toThrow(/…/)`: a duplicate category name in another case anywhere in the tree (`/Dairy & eggs › Milk.*"milk".*used twice/i` or the builder's equivalent naming the path and the name); a duplicate product name; an unknown unit (names the product and the unit); depth 6; an empty or blank name; a name of 101 characters; an unknown key (`colour:`); a duplicate YAML key; a YAML syntax error (the message holds the line number); `name: 2024`, `name: null` and `name:` (Review Focus 1); a duplicate unit.
  - `describe("the real seed file")` (OP-052): `loadSeed()` does not throw; the category count ≤ 300, depth ≤ 5, products ≤ 2,000, units ≤ 50; 18 to 22 top-level categories; "Oat milk" sits under "Plant-based" › "Milk" › "Dairy & eggs"; and the test logs one line, `seed quota use: categories N/300, products N/2000, units N/50, deepest level N/5`, for the PR.
- [x] **Step 3: Run** `pnpm test -- seed`. Expected: FAIL.
- [x] **Step 4: Implement `seed.ts`.** `parseDocument(text, { version: "1.2", uniqueKeys: true })`; any `doc.errors` → throw with the first error's message (it carries the line). The file's shape as a strict Zod schema (a recursive category with optional `products` and `subcategories`; names `z.string().trim().min(1).max(100)`), its issues turned into the entry's path by category names, not indices. Then the cross-entry rules (uniqueness, units, depth, counts), then the flattening: categories in pre-order with `position` = index among siblings; IDs `c1…`, `p1…`, `u1…` in file order. A comment at the top names the spec's decisions 1 to 3.
- [x] **Step 5: Write `seed.yaml`.** The header comment, then `units` and about 20 top-level categories of a Lidl- or Biedronka-like store in walking order (produce first, household and non-food last), each with 5 or 6 subcategories, a few typical products each, 300 to 500 products in total, English names, a few with accents (at least "Crème fraîche") and with numbers. No prices.
- [x] **Step 6: Run** the tests of Step 3. Expected: PASS; note the quota line.
- [x] **Step 7: `server.ts`** calls `loadSeed()` right after `loadConfig`, in the same `try`, so a broken seed prints its message and exits 1 before the database is touched; Task 4 passes the result to `buildApp`. Check by hand: break the file, `pnpm --filter @szop/api dev`, see the message and the exit; restore. Note it for the PR.
- [x] **Step 8: Run** `pnpm check` and `pnpm check:image` (the seed must be in the image: `apps/api/src` is copied). Expected: PASS.
- [x] **Step 9: Commit** `feat(api): add the seed catalog in YAML, checked at startup`.

### Task 3: The error shape

**Files:**
- Create: `packages/shared/src/api-error.ts`, `apps/api/src/errors.ts`, `apps/api/src/errors.test.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/security/cross-site.ts`, `security/cross-site.test.ts`, `security/json-only.test.ts`, `apps/api/src/web/routes.ts`, `web/routes.test.ts`

**Interfaces:**
- Produces: `apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })`, `type ApiError` (shared); in `errors.ts`: `sendError(reply: FastifyReply, status: number, code: string, message: string): FastifyReply` and `errorHandler` (the function given to `app.setErrorHandler` in `buildApp`). Task 4 adds the 400 branch.

- [x] **Step 1: Write the failing tests** in `errors.test.ts` (adding throwaway routes after `buildApp`, as `json-only.test.ts` does):
  - `it("NFR-4.11: answers an unexpected error with a generic 500 and logs the details")`: a route throwing `new Error("secret detail")` → 500, `apiErrorSchema` accepts the body, `{ error: { code: "internal_error", message: "Internal server error" } }`, the raw body does not contain "secret detail", and the captured log (`captureLog`, level info) has a line at level 50 whose `err.message` is "secret detail".
  - A route throwing an error with `statusCode: 409` → 409, code `conflict`, its message kept.
  - `GET /api/nope` and `GET /missing.js` → 404 `{ error: { code: "not_found", … } }`.
  - Update the existing expectations: the cross-site 403 → `forbidden_cross_site`; the JSON-only 415 → `unsupported_media_type`; `web/routes.test.ts`' 404 bodies. Every one checked with `apiErrorSchema`.
- [x] **Step 2: Run** `pnpm test -- errors cross-site json-only web/routes`. Expected: FAIL.
- [x] **Step 3: Implement.** `errorHandler`: a 4xx `statusCode` → that status, the code from `http.STATUS_CODES[status]` in snake case, the error's message; anything else → `request.log.error(error, "request failed")` and the generic 500. `cross-site.ts` and the not-found handler call `sendError`; their "until OP-071" comments go. Register the handler in `buildApp` before the plugins.
- [x] **Step 4: Run** the tests of Step 2. Expected: PASS.
- [x] **Step 5: Run** `pnpm check`. Expected: PASS.
- [x] **Step 6: Commit** `feat(api): answer every error in one JSON shape`.

### Task 4: The catalog route and serialization

**Files:**
- Create: `apps/api/src/catalog/routes.ts`, `catalog/routes.test.ts`, `apps/api/src/test/catalog.ts`
- Modify: `apps/api/package.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/errors.ts`, `errors.test.ts`, `apps/api/src/health/routes.ts`, every test calling `buildApp`

**Interfaces:**
- Consumes: `catalogSchema`, `healthSchema`, `Catalog`; `loadSeed` (Task 2); `errorHandler` (Task 3).
- Produces: `AppDeps.catalog: Catalog`; `catalogRoutes(app, { catalog }: CatalogRoutesOptions)` registered under `/api`; `testCatalog: Catalog` in `src/test/catalog.ts` (two categories, two products, one unit, valid against `catalogSchema`).

- [ ] **Step 1: Check the provider.** `pnpm --filter @szop/api add fastify-type-provider-zod@^7.0.0`, then `pnpm why @fastify/swagger openapi-types --filter @szop/api --prod`. Its peers list `@fastify/swagger` and `openapi-types`. If they stay out of the production dependencies (optional peers, or types only), go on. If `@fastify/swagger` lands in the image's dependencies, stop and ask the owner: accept it, or take the spec's fallback (an explicit `catalogSchema.parse` in the route), recorded in ADR 0050.
- [ ] **Step 2: Write the failing tests** in `catalog/routes.test.ts`:
  - `it("PRD-2.1, ACC-1.2: answers GET /api/catalog with the catalog")`: `buildApp({ …, catalog: testCatalog })` → 200, JSON, `catalogSchema.parse(body)` equals `body` and equals `testCatalog`.
  - `it("ACC-1.3: sets no cookie")`: no `set-cookie` header.
  - `it("ACC-1.2: is read-only")`: `POST`, `PUT`, `DELETE /api/catalog` (same-origin) → 404 `not_found`.
  - A catalog built wrong on purpose (a name of 101 characters) → 500 `internal_error`, the body does not contain the long name.
  - In `errors.test.ts`: a throwaway route with `schema: { querystring: z.object({ n: z.coerce.number().int() }) }`, `?n=x` → 400 `invalid_input`.
- [ ] **Step 3: Run** `pnpm test -- catalog/routes errors`. Expected: FAIL.
- [ ] **Step 4: Implement.** In `buildApp`: `setValidatorCompiler` and `setSerializerCompiler` from the provider, before any route; `catalog` in `AppDeps` with a comment; `app.register(catalogRoutes, { prefix: "/api", catalog })` after health. `catalogRoutes` uses `app.withTypeProvider<ZodTypeProvider>()` and `schema: { response: { 200: catalogSchema } }`. `healthRoutes` declares `response: { 200: healthSchema, 503: healthSchema }` (this plan's call for the spec's open question: both bodies through the serializer, the same pattern for every status; the ADR records it). `errorHandler` gains the 400 branch for `hasZodFastifySchemaValidationErrors(error)` (or the provider's equivalent), and a response serialization error falls into the 500. `server.ts` passes the catalog from Task 2. Every test's `buildApp` call gets `catalog: testCatalog`.
- [ ] **Step 5: Run** `pnpm test -- --project api`. Expected: PASS, the health tests unchanged.
- [ ] **Step 6: Run** `pnpm check`, then `pnpm image:up` and `curl -s localhost:3000/api/catalog | head -c 300` (expected: the catalog), `image:down`.
- [ ] **Step 7: Commit** `feat(api): serve the seed catalog from GET /api/catalog`.

### Task 5: The catalog page

**Files:**
- Create: `apps/web/src/catalog/catalog-page.tsx`, `catalog/catalog-tree.tsx`, `catalog/tree.ts`, `catalog/tree.test.ts`, `catalog/use-catalog.ts`, `catalog/catalog-page.test.tsx`, `apps/web/src/test/catalog.ts`
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/routes.tsx`, `apps/web/src/shell/menu.tsx`, `shell/shell.test.tsx`, `apps/web/src/index.css`, `apps/web/src/design/roles.ts`, `e2e/tests/design.spec.ts`, `e2e/tests/shell.spec.ts`

**Interfaces:**
- Consumes: `catalogSchema`, `orderCategories`, `compareNames`, `apiErrorSchema`.
- Produces:
  - `getCatalog(): Promise<Catalog>` (anything but 200 throws, using the error body's message when `apiErrorSchema` accepts it); `useCatalog()` (query key `["catalog"]`, `staleTime: Infinity`, `retry: false`: "Try again" is the retry).
  - `tree.ts`: `interface CatalogNode { category: CatalogCategory; depth: number; products: CatalogProduct[]; children: CatalogNode[]; productCount: number }` (products sorted with `compareNames`; `productCount` over the whole subtree); `buildCatalogTree(catalog: Catalog): CatalogNode[]`; `allCategoryIds(nodes: CatalogNode[]): Set<string>`.
  - `CatalogTree({ nodes, open, onToggle })` renders rows; Task 6 reuses it with the search's nodes and highlights.
  - `smallCatalog` (test fixture, `satisfies Catalog`): "Dairy & eggs" (Eggs; Milk › Milk, Lactose-free milk; Milk › Plant-based › Oat milk; Cheese › Cheddar, Cream cheese; a product "Crème fraîche"), "Bakery" (Bread, with no unit; Croissant; a 40-character name), "Empty shelf" (nothing): 3 top-level categories, 10 products.

- [ ] **Step 1: Write the failing tests** in `tree.test.ts`: `it("PRD-2.5: sorts products by name and lists them before subcategories")`; counts over the subtree; "Empty shelf" has `productCount: 0` and no children (Review Focus 4).
- [ ] **Step 2: Write the failing tests** in `catalog-page.test.tsx`, through the real `routes` (the `renderApp` of `shell.test.tsx`), `server.use(http.get("/api/catalog", …))` with `smallCatalog`:
  - `it("PRD-2.1, APP-1.9: Catalog sits under Setup in the menu and opens the page")`: on a desktop, "Setup" heading before "Developer", the link "Catalog" → `/catalog`, `h1` "Catalog", `document.title` "Catalog · Szop".
  - `it("PRD-2.8, APP-4.1: shows skeleton cards while loading")` (a handler that waits): skeleton cards, no `role="progressbar"`; then the top-level categories.
  - `it("PRD-2.2, PRD-2.3: shows the top-level categories collapsed, with their counts")`: buttons "Dairy & eggs, 7 products", "Bakery, 3 products", "Empty shelf, 0 products", all `aria-expanded="false"`; the line "3 categories · 10 products".
  - `it("PRD-2.2, PRD-2.5: opens a category to its products first, then its subcategories")`: order of the rows inside.
  - `it("PRD-2.4: expands and collapses everything")`: every button `aria-expanded` true, then false; both buttons have their names as `aria-label`, their label text inside a `hidden lg:inline` span.
  - `it("PRD-2.2: keeps a child open when its parent is closed and reopened")`.
  - `it("PRD-2.8, APP-4.3: says the catalog could not be loaded and offers Try again")`: a 500 then a 200; clicking "Try again" shows the categories.
  - A body that fails `catalogSchema` → the same error card (Review Focus 2).
  - `it("PRD-2.9: wraps a long product name")`: the 40-character name's element has `wrap-break-word` and no `truncate`.
  - Bread (no unit) shows no unit text; "Empty shelf" opens without error (Review Focus 4).
  - In `shell.test.tsx`, the desktop menu test also expects the link "Catalog".
- [ ] **Step 3: Run** `pnpm test -- catalog shell`. Expected: FAIL.
- [ ] **Step 4: The `muted` role.** `index.css`: `--muted` light `var(--color-gray-50)`, dark between `gray-800` and `gray-700` (a `color-mix` or a new step; the builder's pick), mapped to `--color-muted`; `roles.ts` gains `{ name: "muted", className: "bg-muted" }`. In `design.spec.ts`' pairs: `["foreground", "muted", 4.5]`, `["muted-foreground", "muted", 4.5]`, `["link", "muted", 3]` (the chevron), `["border", "muted", …]` only if the band's edge relies on it.
- [ ] **Step 5: Implement** the client, the hook, `tree.ts`, `CatalogTree` and `CatalogPage` as the spec's [The catalog page](../specs/2026-10-25-PH-15a-seed-catalog-design.md#the-catalog-page) describes them: top-level cards, category rows as `<button aria-expanded aria-controls>` with Lucide `ChevronRight` / `ChevronDown` in `text-link`, semibold name, count pill (`tabular-nums`), the `bg-muted` band below the top level; product rows with a muted bullet, name, unit right in `text-muted-foreground`; nested `<ul>`s; "Expand all" (`ChevronsUpDown`) and "Collapse all" (`ChevronsDownUp`) as `Button`s with `aria-label`, a `title` and a `hidden lg:inline` label; expansion as `useState<Set<string>>`. The route `catalog` with `handle: { title: "Catalog" }`. The menu: a "Setup" heading with "Catalog" (Lucide `ListTree`) above "Developer".
- [ ] **Step 6: The menu's focus ring (OP-107).** `MenuLink` and the logo `Link` get the `Button`'s ring classes (`outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`). In `shell.spec.ts`, `test("NFR-2.8: the focus ring is drawn in the ring color, on links as on buttons", …)`: on a desktop, Tab to the "Start" link and to a button; each focused element's `box-shadow` contains the color of `--ring` (read with `readRoleColors`). NFR-2.8 is ❔ Draft: its wording is confirmed with the owner before the task's commit.
- [ ] **Step 7: Run** the tests of Step 3. Expected: PASS.
- [ ] **Step 8: Run** `pnpm check`, `pnpm build` (the budget line passes; write the number down; lazy-load the page only if it fails) and `pnpm test:e2e`. Expected: all pass, no CSP violation.
- [ ] **Step 9: Commit** `feat(web): add the catalog page with its collapsible tree`.

### Task 6: Search

**Files:**
- Create: `apps/web/src/catalog/search.ts`, `catalog/search.test.ts`, `catalog/catalog-search.test.tsx`
- Modify: `apps/web/package.json`, `apps/web/src/catalog/catalog-page.tsx`, `catalog/catalog-tree.tsx`

**Interfaces:**
- Consumes: `CatalogNode`, `CatalogTree`, `smallCatalog` (Task 5).
- Produces (`search.ts`):
  - `foldForSearch(text: string): string` (NFD, `\p{M}` removed, lowercase).
  - `findMatch(name: string, query: string): [start: number, end: number] | null`, indices in the original `name`. Fold one code point at a time and keep each folded character's source index, so "creme" in "Crème fraîche" gives `[0, 5]`.
  - `interface SearchResult { nodes: SearchNode[]; open: Set<string>; productCount: number }`, `interface SearchNode { node: CatalogNode; matched: boolean; products: CatalogProduct[]; children: SearchNode[]; shownCount: number }`; `searchTree(tree: CatalogNode[], query: string): SearchResult | null` (`null` for a blank query). Rules from the spec's [Search](../specs/2026-10-25-PH-15a-seed-catalog-design.md#search): a matching product is kept with every ancestor, all in `open`; a matching category is kept on its path, not in `open` unless something inside it matches, and then `products` / `children` hold only the matches. `shownCount` is the matching products in the subtree, or the whole `productCount` for a matched category with nothing matching inside it; `productCount` (the line above the tree) counts the matching products.

- [ ] **Step 1:** `pnpm --filter @szop/web add -D @testing-library/user-event@^14.6.8` (OP-080).
- [ ] **Step 2: Write the failing tests** in `search.test.ts`: `foldForSearch("Crème Fraîche")` → `"creme fraiche"`; `it("PRD-2.10: ignores case and accents")`: `findMatch("Crème fraîche", "CREME")` → `[0, 5]`; `findMatch("Oat milk", "milk")` → `[4, 8]`; no match → `null`; `searchTree` for "oat milk" keeps Dairy & eggs › Milk › Plant-based › Oat milk, all three open; for "cheese", Cheese is kept with Cream cheese only and is open (Cream cheese matches inside it); for "plant", Plant-based is kept, matched, not open, `shownCount` its whole count; `"   "` → `null`; `"("`, `"*"` and `"."` find nothing and do not throw (Review Focus 3).
- [ ] **Step 3: Write the failing tests** in `catalog-search.test.tsx` with `userEvent.setup()`:
  - The field: `getByRole("search")` holds `getByRole("searchbox", { name: "Search the catalog" })` with the placeholder; no visible label.
  - `it("PRD-2.6: shows a product match under its opened path, highlighted")`: type "oat"; rows Dairy & eggs, Milk, Plant-based open; `Oat milk`'s `mark` holds "Oat"; Bakery is gone; the line says "1 product"; "Expand all" and "Collapse all" are gone.
  - `it("PRD-2.7: shows a matching category collapsed, and whole when opened by hand")`: type "plant"; Plant-based shown, `aria-expanded="false"`, its name's `mark` holds "Plant"; open it → Oat milk shows. Then a category whose name and products inside both match: "milk" opens Milk with Milk, Lactose-free milk and Plant-based › Oat milk; Cheese and Eggs are gone.
  - `it("PRD-2.10: ignores case and accents")`: "CREME" finds "Crème fraîche".
  - Toggling while searching, then changing the query, opens the new matches again.
  - `it("PRD-2.11: restores the expansion from before the search when cleared")`: open Bakery; type; collapse a match; click ✕ ("Clear search") → Bakery open, nothing else; again with Esc, focus stays in the field (Review Focus 5).
  - `it("PRD-2.12: says no products match")`: "xyz" → `No products match "xyz"` in a card.
- [ ] **Step 4: Run** `pnpm test -- search`. Expected: FAIL.
- [ ] **Step 5: Implement** `search.ts`, then in the page: the field (magnifier, `type="search"`, ✕ button "Clear search" while the query is not empty, Esc clears), the query in state, `useMemo` over `searchTree`; a second `Set` for the search's expansion, reset to `result.open` whenever the query changes; the browsing `Set` untouched while searching. `CatalogTree` takes an optional highlight query and renders the name's match in `<mark className="bg-accent text-accent-foreground">`; a matched category opened by hand renders its whole `node`.
- [ ] **Step 6: Run** the tests of Step 4 and `pnpm test -- catalog`. Expected: PASS.
- [ ] **Step 7: Run** `pnpm check`, `pnpm build` and `pnpm test:e2e`. Expected: all pass.
- [ ] **Step 8: Commit** `feat(web): search the catalog by product or category name`.

### Task 7: The journey, the documentation and the tracking

**Files:**
- Create: `e2e/tests/catalog.spec.ts`, `docs/decisions/0050-seed-catalog-phase-details.md`
- Modify: `docs/decisions/0014-roadmap.md`, `0022-ring-tail-redesign.md`, `0051-acceptance-criteria.md`, `docs/architecture/architecture.md`, `visual-design.md`, `stack-overview.md`, `threat-model.md`, `docs/development/testing.md`, `docs/glossary.md`, `docs/requirements/` (`PRD-catalog.md`, `ORD-…`, `ACC-…`, `APP-…`, `NFR-…`, `functional-requirements.md`), `CLAUDE.md`, `docs/roadmap.md`, `README.md` (the roadmap diagram, if it shows phase status)

- [ ] **Step 1: E2E.** `catalog.spec.ts`, on every project: `test("PRD-2.1, PRD-2.4, PRD-2.6: browse and search the seed catalog", async ({ page, isMobile }) => …)`: `goto("/")`, `openMenu`, "Catalog"; `h1` "Catalog"; on a phone "Expand all" has no visible text, from `lg` it shows its label; open "Dairy & eggs" (by role, name starting with "Dairy & eggs"); a product of it visible; type "oat milk"; "Oat milk" visible and "Dairy & eggs" expanded; clear; `expectAccessible(page)` with a category open, in light and in dark (`emulateMedia`). Run `pnpm test:e2e`. Expected: PASS on all three projects.
- [ ] **Step 2: ADR 0050** in the form of ADR 0049: the spec's 14 decisions with their alternatives and who chose each, plus this plan's calls (orphans top-level and cycles dropped; health's 503 serialized; `muted`'s dark value; the pill counts during search; `retry: false`; lazy-loading or not; the provider's peers). `Refines:` ADR 0014, decision 7; ADR 0022, decision 13; ADR 0051, decision 15; the notes in their status lines and cells.
- [ ] **Step 3: The living docs**, as the spec's [Documentation](../specs/2026-10-25-PH-15a-seed-catalog-design.md#documentation) lists them: `architecture.md` (seed data, Errors with the codes and the handler, `catalog/`, `/catalog` in the routes table, the serializer); `visual-design.md` (the tree pattern, `muted` in the color table, the search-field label exception under Forms and focus, the menu links' ring, the mockups as reference); `stack-overview.md` (YAML checked with Zod, property-based testing, Fastify type providers); `testing.md` (the seed data tests, the catalog journey); `threat-model.md` (`GET /api/catalog`, public and read-only); `glossary.md` (YAML, property-based testing, and any other niche term used). No tool pages for `yaml` or the provider (libraries; earlier libraries have none).
- [ ] **Step 4: The requirements.** Every criterion with a test named after it → ✅ [PH-15a](../../roadmap.md#ph-15a-seed-catalog-read-only): [PRD-2](../../requirements/PRD-catalog.md#prd-2).1 to 2.12, [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).3, [APP-1](../../requirements/APP-app-wide-behavior.md#app-1).9, [APP-4](../../requirements/APP-app-wide-behavior.md#app-4).1 and 4.3, [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).11, and [NFR-2](../../requirements/NFR-non-functional-requirements.md#nfr-2).8 if the owner finalized it; [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).2, [ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2).1–2.3 and [ORD-3](../../requirements/ORD-list-display-and-ordering.md#ord-3).1 stay 🚧 with their note. Check each with `grep -rn 'PRD-2.N[:,]' apps packages e2e`. Each requirement's status line and the index updated; decision 14's rule in the index ("How phases change criteria", "✅ Criteria finalized") and in `CLAUDE.md`'s "During the brainstorm".
- [ ] **Step 5: Roadmap and open points.** `roadmap.md`: PH-15a's **Delivers** if anything changed. On GitHub, with a "settled by" comment each: OP-071 (#94), OP-079 (#96), OP-107 (#292) and OP-080 (#104) to be closed by the PR; OP-052 (#93): tick the PH-15a part, re-parent to PH-17a; OP-010 (#63): tick fast-check, re-parent to PH-15b; OP-041 (#100): tick the sorting part. List every change for the PR description.
- [ ] **Step 6: Run** `pnpm check`. Expected: PASS (Prettier formats the Markdown).
- [ ] **Step 7: Commit** `docs: record the PH-15a decisions and update the living docs`.
