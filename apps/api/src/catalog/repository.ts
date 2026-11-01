import type { Catalog } from "@szop/shared";
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
