# fast-check

fast-check is a library for **property-based testing**: instead of a few hand-picked inputs, a test states a rule that must hold for every input of some kind, and fast-check generates hundreds of random inputs and looks for one that breaks it. It runs inside [Vitest](vitest.md): a property test is an ordinary `it` that calls `fc.assert`.

## Why Szop uses it

- **Property tests for the domain rules:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 7. A rule such as "a parent category always comes before its children" is about all possible category trees. Hand-picked examples miss the odd shapes; generated ones find them.
- **First use:** the category order, `orderCategories` in `packages/shared/src/catalog.ts` (PH-15a), whose rules are [ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2) and [ORD-3](../../requirements/ORD-list-display-and-ordering.md#ord-3).

## How the repo uses it

- **Where:** a development dependency of `packages/shared` only, since the rules worth a property live there. The tests run in the `shared` Vitest project (`pnpm test --project shared`).
- **Arbitraries stay in the test file.** An **arbitrary** is a description of how to generate one kind of value. `catalog.test.ts` defines `forest`, which builds up to 50 categories, each with a parent among the earlier ones or none, with positions drawn per sibling group, and then shuffles them. Nothing else needs it, so it is not exported.
- **One property per `it`**, with the criterion's ID on the `describe` around them, not on each `it` ([Rules](../testing.md#rules)): the output is a permutation of the input, every category comes after its parent, a subtree is contiguous, siblings are in order, `depth` is right, and the input order does not matter.
- **The shape of a property:** `fc.assert(fc.property(arbitrary, (value) => { expect(…) }))`. The function receives a generated value and checks it with the usual `expect`. fast-check runs it 100 times by default.

## Reading a counterexample

When a property fails, fast-check **shrinks** the input: it tries smaller and simpler inputs that still fail, until none does, so the failure is small enough to read. For `orderCategories` with its position tie-break removed on purpose (siblings sorted by name only), the output was:

```text
Error: Property failed after 1 tests
{ seed: 761409540, path: "0:1:0:1:0:0:1:0:3:0:3:0:0:11:7:0:0:0:0:0:0:0:0:3", endOnFailure: true }
Counterexample: [[{"id":"c0","parentId":null,"position":0,"name":"name 0"},{"id":"c4","parentId":"c0","position":0,"name":"name 4"},{"id":"c1","parentId":"c0","position":1,"name":"name 7"},{"id":"c3","parentId":"c0","position":2,"name":"name 6"},{"id":"c5","parentId":"c0","position":4,"name":"name 5"}]]
Shrunk 23 time(s)
```

- **`Counterexample`** is the input, one entry per argument of the property. Here `c5` has `position` 4 and so must come after `c4`, `c1` and `c3`, but sorting by name put it earlier (the order "name 4", "name 5", "name 6", "name 7" is `c4`, `c5`, `c3`, `c1`). The counterexample is illustrative: it is rebuilt in full from the original run, which was cut short with "…", so the `seed` and `path` below will not replay exactly this array.
- **`Shrunk 23 time(s)`** says it started from a larger input and reduced it 23 times.
- **`seed` and `path`** replay exactly this failure. Pass them to the failing `fc.assert`, run the test, fix the code, and remove them again:

```ts
fc.assert(fc.property(forest, (xs) => { … }), {
  seed: 761409540,
  path: "0:1:0:1:0:0:1:0:3:0:3:0:0:11:7:0:0:0:0:0:0:0:0:3",
});
```

With the `path`, fast-check goes straight to the shrunk failing case instead of searching again. Once the cause is found, add the counterexample as an ordinary example test, so the case stays covered whatever the random inputs are.

## Official documentation

- Getting started: <https://fast-check.dev/docs/introduction/>
- Arbitraries: <https://fast-check.dev/docs/core-blocks/arbitraries/>
- Replaying a failure: <https://fast-check.dev/docs/introduction/getting-started/#replay-the-failure>
