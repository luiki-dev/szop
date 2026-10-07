# Mock Service Worker (MSW)

Mock Service Worker (MSW) fakes the network in tests. A test says what an address should answer, and when the code under test sends a request there, MSW catches it on the way and returns that answer. The code that sends it, the API client, runs unchanged.

## Why Szop uses it

- **MSW, not a mocked client module:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 10. Mocking the API client would skip exactly the code worth testing: the request, TanStack Query's handling of the answer, and the schema that parses it.
- **How it is set up:** [ADR 0021](../../decisions/0021-spa-skeleton-details.md), decisions 1 and 7. MSW 3 is used.

## Configuration

**`apps/web/src/test/server.ts`** creates the server with `setupServer` from `msw/node` and one default handler: `http.get("/api/health", …)` answers the healthy body. The body is a `healthyBody` constant written `satisfies Health`, the type from `packages/shared`, so a fake that drifts from the real response fails the type check.

**`apps/web/src/test/setup.ts`** runs the server's lifecycle for every test file:

- `server.listen({ onUnhandledFrame: "error" })` before all tests. A request that has no handler fails the test instead of reaching a real network. MSW 3 renamed this option: version 2 called it `onUnhandledRequest`, which version 3 ignores without a word, so the setting would silently do nothing.
- `server.resetHandlers()` after each test: the handlers a test added are dropped, so the next test starts from the default.
- `server.close()` after all tests.

A relative address such as `/api/health` works: MSW 3 resolves it against the simulated browser's location.

## Everyday use

- **A different answer for one test:** `server.use(http.get("/api/health", () => HttpResponse.json(body, { status: 503 })))`. The handler added last wins, and `resetHandlers` removes it after the test.
- **A failed request:** `HttpResponse.error()` makes the request fail as if the network were down. A body that is not JSON is `new HttpResponse("<html>…</html>")`.
- **Type the body:** write it `satisfies Health` ([the testing guide](../testing.md#writing-a-component-test)).
- **A test fails with an error naming the request:** nobody wrote a handler for it. Add one with `server.use`, or to the defaults in `server.ts` when every test needs it.
- **MSW also has a browser mode,** a service worker that fakes the network in a running page. Szop does not use it.

## Official documentation

- Getting started: <https://mswjs.io/docs/>
- Handlers (`http`): <https://mswjs.io/docs/api/http>
- `setupServer` in Node: <https://mswjs.io/docs/api/setup-server>
