import { readFileSync } from "node:fs";
import type { Catalog } from "@szop/shared";
import { parseDocument } from "yaml";
import { z } from "zod";

// The seed catalog (PH-15a spec, decisions 1 to 3): a YAML file nested the
// way the store is, with no IDs; read by the API, never put in tables. It is
// parsed as YAML 1.2, where `no` and `off` stay strings, and checked at
// startup, so a bad edit is a failed deploy and not a broken page.
export const seedLimits = {
  categories: 300,
  depth: 5,
  products: 2000,
  units: 50,
  nameLength: 100,
} as const;

const name = z.string().trim().min(1).max(seedLimits.nameLength);

const productSchema = z.strictObject({ name, unit: name.optional() });
const categorySchema = z.strictObject({
  name,
  products: z.array(productSchema).optional(),
  get subcategories() {
    return z.array(categorySchema).optional();
  },
});
const seedSchema = z.strictObject({
  units: z.array(name),
  categories: z.array(categorySchema),
});

type SeedCategory = z.infer<typeof categorySchema>;

const SEPARATOR = " › ";

// Turns a Zod issue path, made of keys and indices, into the entry's path by
// names: ["categories", 0, "subcategories", 1, "name"] becomes
// "categories › Dairy & eggs › Milk › name". An entry without a usable name
// shows as #position.
function entryPath(raw: unknown, path: PropertyKey[]): string {
  const parts: string[] = [];
  let node: unknown = raw;
  for (const key of path) {
    node = (node as Record<PropertyKey, unknown> | undefined)?.[key];
    if (typeof key === "number") {
      const entryName = (node as { name?: unknown } | undefined)?.name;
      parts.push(
        typeof entryName === "string" && entryName.trim() !== ""
          ? entryName.trim()
          : `#${String(key + 1)}`,
      );
    } else if (key !== "subcategories" && key !== "products") {
      parts.push(String(key));
    }
  }
  return parts.join(SEPARATOR);
}

// Throws an Error naming the entry and the rule that the seed breaks.
export function parseSeed(text: string): Catalog {
  const doc = parseDocument(text, { version: "1.2", uniqueKeys: true });
  // The message of a YAML error carries its line and column.
  if (doc.errors.length > 0)
    throw new Error(doc.errors[0]?.message ?? "invalid YAML");

  const raw: unknown = doc.toJS();
  const parsed = seedSchema.safeParse(raw);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const where = entryPath(raw, issue?.path ?? []);
    const extra =
      issue?.code === "unrecognized_keys"
        ? ` (${issue.keys.map((k) => `"${k}"`).join(", ")})`
        : "";
    throw new Error(
      `${where || "seed"}: ${issue?.message ?? "invalid seed"}${extra}`,
    );
  }
  const seed = parsed.data;

  const catalog: Catalog = { categories: [], products: [], units: [] };
  const fail = (path: string[], rule: string): never => {
    throw new Error(`${path.join(SEPARATOR)}: ${rule}`);
  };
  const lower = (value: string) => value.toLocaleLowerCase("en");

  if (seed.units.length > seedLimits.units) {
    fail(["units"], `more than ${String(seedLimits.units)} units`);
  }
  const unitIds = new Map<string, string>();
  for (const unit of seed.units) {
    if (unitIds.has(lower(unit))) {
      fail(["units"], `the name "${unit}" is used twice`);
    }
    const id = `u${String(catalog.units.length + 1)}`;
    unitIds.set(lower(unit), id);
    catalog.units.push({ id, name: unit });
  }

  const categoryNames = new Set<string>();
  const productNames = new Set<string>();
  const walk = (
    categories: SeedCategory[],
    parentId: string | null,
    trail: string[],
  ): void => {
    categories.forEach((category, position) => {
      const path = [...trail, category.name];
      if (path.length - 1 > seedLimits.depth) {
        fail(path, `nested deeper than ${String(seedLimits.depth)} levels`);
      }
      if (categoryNames.has(lower(category.name))) {
        fail(path, `the name "${category.name}" is used twice`);
      }
      categoryNames.add(lower(category.name));
      if (catalog.categories.length >= seedLimits.categories) {
        fail(path, `more than ${String(seedLimits.categories)} categories`);
      }
      const id = `c${String(catalog.categories.length + 1)}`;
      catalog.categories.push({ id, parentId, position, name: category.name });

      for (const product of category.products ?? []) {
        const productPath = [...path, product.name];
        if (productNames.has(lower(product.name))) {
          fail(productPath, `the name "${product.name}" is used twice`);
        }
        productNames.add(lower(product.name));
        if (catalog.products.length >= seedLimits.products) {
          fail(
            productPath,
            `more than ${String(seedLimits.products)} products`,
          );
        }
        let unitId: string | null = null;
        if (product.unit !== undefined) {
          unitId = unitIds.get(lower(product.unit)) ?? null;
          if (unitId === null) {
            fail(productPath, `the unit "${product.unit}" is not in units`);
          }
        }
        catalog.products.push({
          id: `p${String(catalog.products.length + 1)}`,
          name: product.name,
          categoryId: id,
          unitId,
        });
      }
      walk(category.subcategories ?? [], id, path);
    });
  };
  walk(seed.categories, null, ["categories"]);
  return catalog;
}

export function loadSeed(): Catalog {
  return parseSeed(
    readFileSync(new URL("./seed.yaml", import.meta.url), "utf8"),
  );
}
