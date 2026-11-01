import type { Catalog } from "@szop/shared";
import { eq } from "drizzle-orm";
import type { Executor, WorkspaceContext } from "../access/workspace.ts";
import { categories, products, units } from "../db/schema.ts";

// Copies a catalog into a workspace: units, categories, then products, so each
// insert finds what it references. An empty array is skipped, since Drizzle
// rejects an insert with no rows.
export async function insertCatalog(
  db: Executor,
  { workspaceId }: WorkspaceContext,
  catalog: Catalog,
): Promise<void> {
  if (catalog.units.length > 0) {
    await db
      .insert(units)
      .values(catalog.units.map((row) => ({ workspaceId, ...row })));
  }
  if (catalog.categories.length > 0) {
    await db
      .insert(categories)
      .values(catalog.categories.map((row) => ({ workspaceId, ...row })));
  }
  if (catalog.products.length > 0) {
    await db
      .insert(products)
      .values(catalog.products.map((row) => ({ workspaceId, ...row })));
  }
}

// The workspace's catalog in the flat shape of the API. Row order is not
// meaningful: the page orders what it shows.
export async function readCatalog(
  db: Executor,
  { workspaceId }: WorkspaceContext,
): Promise<Catalog> {
  const [unitRows, categoryRows, productRows] = await Promise.all([
    db
      .select({ id: units.id, name: units.name })
      .from(units)
      .where(eq(units.workspaceId, workspaceId)),
    db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        position: categories.position,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId)),
    db
      .select({
        id: products.id,
        name: products.name,
        categoryId: products.categoryId,
        unitId: products.unitId,
      })
      .from(products)
      .where(eq(products.workspaceId, workspaceId)),
  ]);
  return { units: unitRows, categories: categoryRows, products: productRows };
}
