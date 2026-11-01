import { catalogSchema } from "@szop/shared";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadSeed, parseSeed, seedLimits, uuidv5 } from "./seed.ts";

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

  it("computes version 5 UUIDs as RFC 9562 does", () => {
    expect(
      uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("gives every entry a UUIDv5 and the same one on every parse", () => {
    const text = readFileSync(new URL("./seed.yaml", import.meta.url), "utf8");
    const catalog = parseSeed(text);
    const v5 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const list of [catalog.categories, catalog.products, catalog.units]) {
      for (const entry of list) expect(entry.id).toMatch(v5);
    }
    expect(parseSeed(text)).toEqual(catalog);
  });

  it("takes the ID from the trimmed, lower-cased name, per kind", () => {
    const idOf = (text: string) => must(parseSeed(text).products[0]).id;
    const product = (name: string) =>
      `units: []\ncategories:\n  - name: A\n    products:\n      - { name: "${name}" }\n`;
    expect(idOf(product("milk"))).toBe(idOf(product("Milk")));
    expect(idOf(product(" Milk "))).toBe(idOf(product("Milk")));
    const catalog = parseSeed(
      "units: []\ncategories:\n  - name: Milk\n    products:\n      - { name: Milk }\n",
    );
    expect(must(catalog.categories[0]).id).not.toBe(
      must(catalog.products[0]).id,
    );
  });

  it("leaves an entry's ID unchanged when another is added before it", () => {
    const before = parseSeed("units: [kg]\ncategories:\n  - name: B\n");
    const after = parseSeed(
      "units: [pcs, kg]\ncategories:\n  - name: A\n  - name: B\n",
    );
    expect(after.units.find((u) => u.name === "kg")).toEqual(before.units[0]);
    expect(after.categories.find((c) => c.name === "B")?.id).toBe(
      must(before.categories[0]).id,
    );
  });

  it("points parentId, categoryId and unitId at the IDs of the entries they name", () => {
    const catalog = parseSeed(valid);
    const id = (list: { id: string; name: string }[], name: string) =>
      must(list.find((x) => x.name === name)).id;
    expect(
      must(catalog.categories.find((c) => c.name === "Milk")).parentId,
    ).toBe(id(catalog.categories, "Dairy & eggs"));
    const oat = must(catalog.products.find((p) => p.name === "Oat milk"));
    expect(oat.categoryId).toBe(id(catalog.categories, "Plant-based"));
    expect(oat.unitId).toBe(id(catalog.units, "l"));
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

  it("keeps known IDs", () => {
    const idOf = (list: { id: string; name: string }[], name: string) =>
      must(list.find((x) => x.name === name)).id;
    expect(idOf(catalog.units, "pcs")).toBe(
      "6069ea93-202a-5281-9ec1-53cc06373993",
    );
    expect(idOf(catalog.categories, "Dairy & eggs")).toBe(
      "2c580789-cfd6-57e9-ac71-c82def957521",
    );
    expect(idOf(catalog.products, "Oat milk")).toBe(
      "8ad28561-c512-5dee-9696-290b912a3c56",
    );
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
