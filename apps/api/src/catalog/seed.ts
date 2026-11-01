import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Catalog } from "@szop/shared";
import { parseDocument } from "yaml";
import { z } from "zod";

// The default data (PH-15a spec, decisions 1 to 3; PH-16b, decision 2): a YAML
// file nested the way the store is, with no IDs in the file. Each entry's ID is
// a UUIDv5 of its trimmed, lower-cased name in the namespace of its kind, so
// the IDs are the same on every start and fit the tables' uuid columns. It is
// parsed as YAML 1.2, where `no` and `off` stay strings, and checked at
// startup, so a bad edit is a failed deploy and not a broken page.

// Fixed, chosen once: changing one changes every ID of its kind.
export const seedNamespaces = {
  units: "7c1f0a52-3b6e-4d0a-9f5c-2e8a41b6d701",
  categories: "a94d3e18-5c27-4f6b-8e0d-91b7c3f2a802",
  products: "3e6b8d47-0f19-4a85-b2c6-d5e04a7193f3",
} as const;

// RFC 9562 version 5: SHA-1 of the namespace's bytes followed by the name.
export function uuidv5(name: string, namespace: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name)
    .digest();
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
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
    // Stryker disable next-line OptionalChaining: the path comes from a validation issue, so every step of it exists in the raw document
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
  // Stryker disable next-line ObjectLiteral: the options only state the YAML library's defaults (version 1.2, unique keys)
  const doc = parseDocument(text, { version: "1.2", uniqueKeys: true });
  // The message of a YAML error carries its line and column.
  if (doc.errors.length > 0) {
    const yamlError = doc.errors[0];
    // Stryker disable next-line OptionalChaining: `errors[0]` exists, the length is checked above, so `yamlError` is defined
    // Stryker disable next-line StringLiteral: `errors[0]` exists, the length is checked above, so the fallback is unreachable
    throw new Error(yamlError?.message ?? "invalid YAML");
  }

  const raw: unknown = doc.toJS();
  const parsed = seedSchema.safeParse(raw);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    // Stryker disable next-line OptionalChaining: a failed parse has at least one issue, so `issue` is defined
    // Stryker disable next-line ArrayDeclaration: a failed parse has at least one issue, so the fallback is unreachable
    const where = entryPath(raw, issue?.path ?? []);
    const extra =
      // Stryker disable next-line OptionalChaining: a failed parse has at least one issue, so `issue` is defined
      issue?.code === "unrecognized_keys"
        ? ` (${issue.keys.map((k) => `"${k}"`).join(", ")})`
        : "";
    // Stryker disable next-line OptionalChaining: a failed parse has at least one issue, so `issue` is defined
    // Stryker disable next-line StringLiteral: a failed parse has at least one issue, so the fallback is unreachable
    const message = issue?.message ?? "invalid seed";
    throw new Error(`${where || "seed"}: ${message}${extra}`);
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
    const id = uuidv5(lower(unit), seedNamespaces.units);
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
      const id = uuidv5(lower(category.name), seedNamespaces.categories);
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
          id: uuidv5(lower(product.name), seedNamespaces.products),
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
  try {
    return parseSeed(
      readFileSync(new URL("./seed.yaml", import.meta.url), "utf8"),
    );
  } catch (error) {
    // server.ts prints this message for any startup failure, so name the file.
    throw new Error(`seed.yaml: ${(error as Error).message}`, { cause: error });
  }
}
