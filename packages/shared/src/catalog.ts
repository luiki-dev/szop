import { z } from "zod";
import { compareNames } from "./names.ts";

// The body of GET /api/catalog (PH-15a spec): the seed catalog, flattened.
// A category's parentId is null at the top level; position is its index
// among its siblings. A product's categoryId and unitId are null when it has
// no category or no unit. Names are 1 to 100 characters.
export const catalogCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  position: z.number().int().min(0),
  name: z.string().min(1).max(100),
});

export const catalogProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  categoryId: z.string().nullable(),
  unitId: z.string().nullable(),
});

export const catalogUnitSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
});

export const catalogSchema = z.object({
  categories: z.array(catalogCategorySchema),
  products: z.array(catalogProductSchema),
  units: z.array(catalogUnitSchema),
});

export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogUnit = z.infer<typeof catalogUnitSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export type OrderedCategory = CatalogCategory & { depth: number };

// The categories in walking order (ORD-2.1, ORD-3.1): siblings by position,
// then by name, and each category directly followed by its own subtree
// (depth first). depth is the number of ancestors. The input order does not
// matter. Broken input still ends: a category whose parentId names no
// category is treated as top-level, and categories reachable only through a
// cycle are dropped.
export function orderCategories(
  categories: readonly CatalogCategory[],
): OrderedCategory[] {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, CatalogCategory[]>();
  for (const category of categories) {
    const key =
      category.parentId !== null && ids.has(category.parentId)
        ? category.parentId
        : null;
    const group = children.get(key);
    if (group) group.push(category);
    else children.set(key, [category]);
  }
  for (const group of children.values()) {
    group.sort(
      (a, b) => a.position - b.position || compareNames(a.name, b.name),
    );
  }

  const ordered: OrderedCategory[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const category of children.get(parent) ?? []) {
      ordered.push({ ...category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return ordered;
}
