# Testing Library

Testing Library renders React components into a simulated browser and finds elements the way a user would: by their role, label and visible text, not by their position in the markup. A test then checks what the user would see.

## Why Szop uses it

- **Testing Library with jsdom:** [ADR 0007](../../decisions/0007-testing-strategy.md), decisions 9 and 10. Finding elements by role and text keeps a test from breaking when the markup is rearranged, and a role that cannot be found is often an accessibility bug.
- **First used in [PH-05](../../roadmap.md#ph-05-spa-skeleton):** [ADR 0021](../../decisions/0021-spa-skeleton-details.md), decision 7. The network is faked with [MSW](msw.md).

## The packages

- **`@testing-library/react`:** `render` puts a component into the page of the simulated browser ([jsdom](vitest.md#jsdom)), `screen` queries it, and `cleanup` removes what a test rendered.
- **`@testing-library/dom`:** the queries themselves (`getByRole` and the rest). `@testing-library/react` needs it as a peer dependency, so it is installed next to it.
- **`@testing-library/jest-dom`:** extra matchers for `expect`, such as `toBeInTheDocument()` and `toHaveTextContent()`. `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`, which registers them in Vitest.

## Configuration

Nothing is configured in a file of its own. `apps/web/src/test/setup.ts`, listed in the `web` project's `setupFiles` ([Vitest](vitest.md)), registers the matchers and calls `cleanup` in an `afterEach`. Testing Library normally cleans up by itself, but only when Vitest's globals are on (`afterEach` must exist as a global). Szop keeps them off, so the setup file calls `cleanup` explicitly; without it, a test would see the elements of the one before.

## Everyday use

- **Find by role first:** `screen.getByRole("status")`. Then by label (`getByLabelText`) or text (`getByText`). Never by test ID: a user cannot see one, and a role or text that is hard to find says the page is hard to use.
- **`getBy`, `findBy`, `queryBy`:** `getBy…` finds the element now and throws if it is missing. `findBy…` waits, up to a timeout, for it to appear: use it for anything that shows after a request. `queryBy…` returns `null` when the element is absent, so use it to check that something is not there.
- **Assert what the user sees:** `expect(screen.getByRole("status")).toHaveTextContent("Checking the API…")`.
- **Reading a failure:** the error prints the page's markup as it was and, for `getByRole`, the roles it found, which shows what the query missed.
- **`@testing-library/user-event`,** which simulates typing and clicking, is not installed yet. Nothing in the app takes input; it joins with the first interaction ([OP-080](../../open-points.md#op-080)).

How to write a component test: [Testing guide](../testing.md#writing-a-component-test).

## Official documentation

- Introduction: <https://testing-library.com/docs/>
- React Testing Library: <https://testing-library.com/docs/react-testing-library/intro/>
- Which query to use: <https://testing-library.com/docs/queries/about#priority>
- `jest-dom` matchers: <https://github.com/testing-library/jest-dom>
