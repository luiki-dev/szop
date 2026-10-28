import { catalogSchema } from "@szop/shared";
import { describe, expect, it } from "vitest";
import { loadSeed, parseSeed, seedLimits } from "./seed.ts";

const valid = `
units: [pcs, kg, g, l, ml, pack]

categories:
  - name: Dairy & eggs
    products:
      - { name: Eggs, unit: pcs }
    subcategories:
      - name: Milk
        products:
          - { name: Milk, unit: l }
          - { name: Lactose-free milk, unit: l }
          - { name: Butter }
        subcategories:
          - name: Plant-based
            products:
              - { name: Oat milk, unit: l }
  - name: Bakery
`;

// The value, or a failed test when there is none.
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected a value");
  return value;
}

// A file with one category holding the given YAML lines.
function withCategory(lines: string): string {
  return `units: [pcs, l]\ncategories:\n  - name: Dairy & eggs\n${lines}`;
}

describe("parseSeed", () => {
  it("turns a valid file into the flat catalog", () => {
    const catalog = parseSeed(valid);
    expect(catalogSchema.parse(catalog)).toEqual(catalog);

    const byName = (name: string) =>
      must(catalog.categories.find((c) => c.name === name));
    const dairy = byName("Dairy & eggs");
    expect(dairy).toMatchObject({ parentId: null, position: 0 });
    expect(byName("Bakery")).toMatchObject({ parentId: null, position: 1 });
    expect(byName("Milk").parentId).toBe(dairy.id);
    expect(byName("Plant-based").parentId).toBe(byName("Milk").id);

    const litre = must(catalog.units.find((u) => u.name === "l"));
    const oat = must(catalog.products.find((p) => p.name === "Oat milk"));
    expect(oat.unitId).toBe(litre.id);
    expect(oat.categoryId).toBe(byName("Plant-based").id);
    expect(
      must(catalog.products.find((p) => p.name === "Butter")).unitId,
    ).toBeNull();

    for (const list of [catalog.categories, catalog.products, catalog.units]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    }
  });

  it("reads no and off as strings", () => {
    const catalog = parseSeed(
      "units: [no]\ncategories:\n  - name: off\n    products:\n      - { name: Tea, unit: no }\n",
    );
    expect(must(catalog.units[0]).name).toBe("no");
    expect(must(catalog.categories[0]).name).toBe("off");
  });

  it("refuses a category name used twice in another case, anywhere in the tree", () => {
    expect(() =>
      parseSeed(
        withCategory(
          "    subcategories:\n      - name: Milk\n        subcategories:\n          - name: MILK\n",
        ),
      ),
    ).toThrow(/Dairy & eggs › Milk › MILK: the name "MILK" is used twice/);
  });

  it("refuses a product name used twice in another case", () => {
    expect(() =>
      parseSeed(
        withCategory(
          "    products:\n      - { name: Eggs }\n      - { name: eggs }\n",
        ),
      ),
    ).toThrow(/Dairy & eggs › eggs: the name "eggs" is used twice/);
  });

  it("refuses an unknown unit, naming the product and the unit", () => {
    expect(() =>
      parseSeed(
        withCategory("    products:\n      - { name: Eggs, unit: dozen }\n"),
      ),
    ).toThrow(/Dairy & eggs › Eggs: the unit "dozen" is not in units/);
  });

  it("refuses a unit listed twice", () => {
    expect(() =>
      parseSeed("units: [pcs, PCS]\ncategories:\n  - name: A\n"),
    ).toThrow(/units: the name "PCS" is used twice/);
  });

  it("refuses nesting deeper than 5 levels", () => {
    // Nested YAML in flow style, simpler than indentation.
    const nest = (n: number, level = 1): string =>
      level > n
        ? "[]"
        : `[{ name: L${String(level)}, subcategories: ${nest(n, level + 1)} }]`;
    expect(() => parseSeed(`units: []\ncategories: ${nest(5)}`)).not.toThrow();
    expect(() => parseSeed(`units: []\ncategories: ${nest(6)}`)).toThrow(
      /L1 › L2 › L3 › L4 › L5 › L6: .*deeper than 5 levels/,
    );
  });

  it.each([
    ["an empty name", '"" ', /name: .*(too small|>=1)/i],
    ["a blank name", '"   "', /name: .*(too small|>=1)/i],
    ["a name of 101 characters", "a".repeat(101), /name: .*100/],
    ["a number", "2024", /name: .*string/i],
    ["null", "null", /name: .*string/i],
    ["nothing", "", /name: .*string/i],
  ])("refuses %s as a category name", (_label, value, message) => {
    expect(() =>
      parseSeed(`units: []\ncategories:\n  - name: ${value}\n`),
    ).toThrow(message);
  });

  it("names the entry for a bad product name", () => {
    expect(() =>
      parseSeed(withCategory("    products:\n      - { name: 7 }\n")),
    ).toThrow(/categories › Dairy & eggs › #1 › name/);
  });

  it("refuses an unknown key", () => {
    expect(() => parseSeed(withCategory("    colour: red\n"))).toThrow(
      /Dairy & eggs.*colour/,
    );
  });

  it("refuses a duplicate YAML key", () => {
    expect(() =>
      parseSeed("units: [pcs]\nunits: [kg]\ncategories: []\n"),
    ).toThrow(/line 2/i);
  });

  it("reports the line of a YAML syntax error", () => {
    expect(() =>
      parseSeed("units: [pcs]\ncategories:\n  - name: [unclosed\n"),
    ).toThrow(/line \d+/i);
  });

  it("refuses more categories, products and units than the limits", () => {
    const many = (n: number, f: (i: number) => string) =>
      Array.from({ length: n }, (_, i) => f(i)).join(", ");
    expect(() =>
      parseSeed(
        `units: []\ncategories: [${many(seedLimits.categories + 1, (i) => `{ name: C${String(i)} }`)}]`,
      ),
    ).toThrow(/more than 300 categories/);
    expect(() =>
      parseSeed(
        `units: []\ncategories: [{ name: A, products: [${many(seedLimits.products + 1, (i) => `{ name: P${String(i)} }`)}] }]`,
      ),
    ).toThrow(/more than 2000 products/);
    expect(() =>
      parseSeed(
        `units: [${many(seedLimits.units + 1, (i) => `u${String(i)}`)}]\ncategories: []`,
      ),
    ).toThrow(/more than 50 units/);
  });
});

describe("parseSeed messages and ids", () => {
  const messageFor = (text: string): string => {
    try {
      parseSeed(text);
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error("expected parseSeed to throw");
  };

  it.each([
    [
      "a file that is not a map",
      "42",
      "seed: Invalid input: expected object, received number",
    ],
    [
      "a blank name",
      'units: []\ncategories:\n  - name: "   "\n',
      "categories › #1 › name: Too small: expected string to have >=1 characters",
    ],
    [
      "an entry that is null",
      "units: [pcs]\ncategories: [null]\n",
      "categories › #1: Invalid input: expected object, received null",
    ],
    [
      "a bad name in a subcategory",
      "units: []\ncategories:\n  - name: A\n    subcategories:\n      - name: 7\n",
      "categories › A › #1 › name: Invalid input: expected string, received number",
    ],
    [
      "an unknown key, the entry shown trimmed",
      'units: []\ncategories:\n  - name: "  Dairy "\n    colour: red\n',
      'categories › Dairy: Unrecognized key: "colour" ("colour")',
    ],
    [
      "two unknown keys",
      "units: []\ncategories:\n  - name: A\n    colour: red\n    shade: x\n",
      'categories › A: Unrecognized keys: "colour", "shade" ("colour", "shade")',
    ],
    [
      "a missing key",
      "units: []\n",
      "categories: Invalid input: expected array, received undefined",
    ],
  ])("names the entry and the rule for %s", (_label, text, message) => {
    expect(messageFor(text)).toBe(message);
  });

  it("starts the path of a limit error at the list or the categories", () => {
    expect(messageFor("units: [a, a]\ncategories: []\n")).toBe(
      'units: the name "a" is used twice',
    );
    expect(
      messageFor("units: []\ncategories: [{ name: A }, { name: a }]\n"),
    ).toBe('categories › a: the name "a" is used twice');
    expect(
      messageFor(
        `units: [${Array.from({ length: seedLimits.units + 1 }, (_, i) => `u${String(i)}`).join(", ")}]\ncategories: []`,
      ),
    ).toBe("units: more than 50 units");
  });

  it("accepts exactly the limit of units", () => {
    const units = Array.from(
      { length: seedLimits.units },
      (_, i) => `u${String(i)}`,
    );
    expect(
      parseSeed(`units: [${units.join(", ")}]\ncategories: []`).units,
    ).toHaveLength(seedLimits.units);
  });

  it("numbers units, categories and products from 1", () => {
    const catalog = parseSeed(valid);
    expect(catalog.units.map((u) => u.id).slice(0, 2)).toEqual(["u1", "u2"]);
    expect(catalog.categories.map((c) => c.id).slice(0, 2)).toEqual([
      "c1",
      "c2",
    ]);
    expect(catalog.products.map((p) => p.id).slice(0, 2)).toEqual(["p1", "p2"]);
  });

  it("compares names in lower case, so names that differ only in upper case are different", () => {
    // "ß" and "SS" are the same in upper case and different in lower case.
    expect(() => parseSeed("units: [ß, SS]\ncategories: []\n")).not.toThrow();
  });
});

describe("the real seed file", () => {
  const catalog = loadSeed();

  it("passes every rule", () => {
    expect(catalogSchema.parse(catalog)).toEqual(catalog);
  });

  it("stays within the quotas and logs how much of them it uses", () => {
    const parentOf = new Map(catalog.categories.map((c) => [c.id, c.parentId]));
    const depthOf = (id: string): number => {
      const parent = parentOf.get(id) ?? null;
      return parent === null ? 1 : 1 + depthOf(parent);
    };
    const deepest = Math.max(...catalog.categories.map((c) => depthOf(c.id)));
    expect(catalog.categories.length).toBeLessThanOrEqual(
      seedLimits.categories,
    );
    expect(deepest).toBeLessThanOrEqual(seedLimits.depth);
    expect(catalog.products.length).toBeLessThanOrEqual(seedLimits.products);
    expect(catalog.units.length).toBeLessThanOrEqual(seedLimits.units);
    const use = (n: number, max: number) => `${String(n)}/${String(max)}`;
    console.log(
      `seed quota use: categories ${use(catalog.categories.length, seedLimits.categories)}, products ${use(catalog.products.length, seedLimits.products)}, units ${use(catalog.units.length, seedLimits.units)}, deepest level ${use(deepest, seedLimits.depth)}`,
    );
  });

  it("has 18 to 22 top-level categories and 300 to 500 products", () => {
    const top = catalog.categories.filter((c) => c.parentId === null);
    expect(top.length).toBeGreaterThanOrEqual(18);
    expect(top.length).toBeLessThanOrEqual(22);
    expect(catalog.products.length).toBeGreaterThanOrEqual(300);
    expect(catalog.products.length).toBeLessThanOrEqual(500);
  });

  it("holds Dairy & eggs > Milk > Plant-based > Oat milk", () => {
    const byId = new Map(catalog.categories.map((c) => [c.id, c]));
    const oat = must(catalog.products.find((p) => p.name === "Oat milk"));
    const path: string[] = [];
    for (
      let c = byId.get(oat.categoryId ?? "");
      c;
      c = c.parentId === null ? undefined : byId.get(c.parentId)
    ) {
      path.unshift(c.name);
    }
    expect(path).toEqual(["Dairy & eggs", "Milk", "Plant-based"]);
  });
});
