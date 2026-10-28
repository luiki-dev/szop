import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  catalogSchema,
  orderCategories,
  type CatalogCategory,
} from "./catalog.ts";
import { compareNames } from "./names.ts";

const cat = (
  id: string,
  parentId: string | null,
  position: number,
  name: string = id,
): CatalogCategory => ({ id, parentId, position, name });

describe("catalogSchema", () => {
  const valid = {
    categories: [
      { id: "c1", parentId: null, position: 0, name: "Dairy" },
      { id: "c2", parentId: "c1", position: 0, name: "Milk" },
    ],
    products: [
      { id: "p1", name: "Oat milk", categoryId: "c2", unitId: "u1" },
      { id: "p2", name: "Bread", categoryId: null, unitId: null },
    ],
    units: [{ id: "u1", name: "l" }],
  };

  it("accepts categories, products with and without a unit, and units", () => {
    expect(catalogSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a category name of 101 characters", () => {
    const body = {
      ...valid,
      categories: [cat("c1", null, 0, "x".repeat(101))],
    };
    expect(catalogSchema.safeParse(body).success).toBe(false);
  });

  it("rejects an empty name", () => {
    const body = { ...valid, categories: [cat("c1", null, 0, "")] };
    expect(catalogSchema.safeParse(body).success).toBe(false);
  });

  it("rejects a negative position", () => {
    const body = { ...valid, categories: [cat("c1", null, -1)] };
    expect(catalogSchema.safeParse(body).success).toBe(false);
  });
});

describe("ORD-2.1, ORD-3.1: orderCategories", () => {
  const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

  it("returns an empty list for an empty list", () => {
    expect(orderCategories([])).toEqual([]);
  });

  it("orders one level by position", () => {
    const out = orderCategories([
      cat("a", null, 2),
      cat("b", null, 0),
      cat("c", null, 1),
    ]);
    expect(ids(out)).toEqual(["b", "c", "a"]);
    expect(out.map((c) => c.depth)).toEqual([0, 0, 0]);
  });

  it("breaks a tie in position by name", () => {
    const out = orderCategories([
      cat("x", null, 0, "tofu"),
      cat("y", null, 0, "śmietana"),
      cat("z", null, 0, "ser"),
    ]);
    expect(ids(out)).toEqual(["z", "y", "x"]);
  });

  it("walks five levels with depths 0 to 4", () => {
    const out = orderCategories([
      cat("e", "d", 0),
      cat("d", "c", 0),
      cat("c", "b", 0),
      cat("b", "a", 0),
      cat("a", null, 0),
    ]);
    expect(ids(out)).toEqual(["a", "b", "c", "d", "e"]);
    expect(out.map((c) => c.depth)).toEqual([0, 1, 2, 3, 4]);
  });

  it("puts each parent directly before its own subtree", () => {
    const out = orderCategories([
      cat("p2c", "p2s", 0),
      cat("p1c", "p1s", 0),
      cat("p2s", "p", 1),
      cat("p1s", "p", 0),
      cat("p", null, 0),
    ]);
    expect(ids(out)).toEqual(["p", "p1s", "p1c", "p2s", "p2c"]);
  });

  it("treats a category whose parent does not exist as top-level", () => {
    const out = orderCategories([cat("a", null, 0), cat("o", "missing", 1)]);
    expect(ids(out)).toEqual(["a", "o"]);
    expect(out.map((c) => c.depth)).toEqual([0, 0]);
  });

  it("drops categories reachable only through a cycle", () => {
    const out = orderCategories([
      cat("a", "b", 0),
      cat("b", "a", 0),
      cat("ok", null, 0),
    ]);
    expect(ids(out)).toEqual(["ok"]);
  });
});

// A forest of up to 50 categories: each has a parent among the ones before it
// or none, positions are drawn per sibling group (ties allowed), names are
// unique; the array is then shuffled.
const forest = fc
  .integer({ min: 0, max: 50 })
  .chain((n) =>
    fc.tuple(
      fc.array(fc.nat(), { minLength: n, maxLength: n }),
      fc.array(fc.nat({ max: 4 }), { minLength: n, maxLength: n }),
    ),
  )
  .map(([parents, positions]): CatalogCategory[] =>
    parents.map((p, i) => {
      // p % (i + 1) is 0..i: an earlier category, or i itself meaning none.
      const pick = p % (i + 1);
      return {
        id: `c${String(i)}`,
        parentId: pick === i ? null : `c${String(pick)}`,
        position: positions[i] ?? 0,
        name: `name ${String(i)}`,
      };
    }),
  )
  .chain((xs) => fc.shuffledSubarray(xs, { minLength: xs.length }));

const childrenOf = (xs: readonly CatalogCategory[], id: string | null) =>
  xs.filter((c) => c.parentId === id);

const descendants = (xs: readonly CatalogCategory[], id: string): string[] =>
  childrenOf(xs, id).flatMap((c) => [c.id, ...descendants(xs, c.id)]);

describe("ORD-2.1, ORD-3.1: orderCategories properties", () => {
  it("returns a permutation of its input", () => {
    fc.assert(
      fc.property(forest, (xs) => {
        const out = orderCategories(xs).map((c) => c.id);
        expect([...out].sort()).toEqual(xs.map((c) => c.id).sort());
      }),
    );
  });

  it("puts every category after its parent", () => {
    fc.assert(
      fc.property(forest, (xs) => {
        const out = orderCategories(xs).map((c) => c.id);
        for (const c of xs) {
          if (c.parentId !== null) {
            expect(out.indexOf(c.parentId)).toBeLessThan(out.indexOf(c.id));
          }
        }
      }),
    );
  });

  it("keeps a subtree contiguous, right after its root", () => {
    fc.assert(
      fc.property(forest, (xs) => {
        const out = orderCategories(xs).map((c) => c.id);
        for (const c of xs) {
          const subtree = descendants(xs, c.id);
          const at = out.indexOf(c.id);
          expect(out.slice(at + 1, at + 1 + subtree.length).sort()).toEqual(
            [...subtree].sort(),
          );
        }
      }),
    );
  });

  it("lists siblings by position, then by name", () => {
    fc.assert(
      fc.property(forest, (xs) => {
        const out = orderCategories(xs).map((c) => c.id);
        const byId = new Map(xs.map((c) => [c.id, c]));
        for (const parent of [null, ...xs.map((c) => c.id)]) {
          const expected = childrenOf(xs, parent)
            .sort(
              (a, b) => a.position - b.position || compareNames(a.name, b.name),
            )
            .map((c) => c.id);
          const actual = out.filter((id) => byId.get(id)?.parentId === parent);
          expect(actual).toEqual(expected);
        }
      }),
    );
  });

  it("sets depth to the number of ancestors", () => {
    fc.assert(
      fc.property(forest, (xs) => {
        const byId = new Map(xs.map((c) => [c.id, c]));
        const depth = (c: CatalogCategory): number =>
          c.parentId === null ? 0 : 1 + depth(byId.get(c.parentId) ?? c);
        for (const c of orderCategories(xs)) {
          expect(c.depth).toBe(depth(c));
        }
      }),
    );
  });

  it("gives the same output for two shuffles of the same forest", () => {
    fc.assert(
      fc.property(
        forest.chain((xs) =>
          fc.tuple(
            fc.constant(xs),
            fc.shuffledSubarray(xs, { minLength: xs.length }),
          ),
        ),
        ([a, b]) => {
          expect(orderCategories(a)).toEqual(orderCategories(b));
        },
      ),
    );
  });
});
