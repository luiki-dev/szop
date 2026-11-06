import type { CreateItem, ListItem, UpdateItem } from "@szop/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Executor, WorkspaceContext } from "../access/workspace.ts";
import { listItems } from "../db/schema.ts";

function toItem(row: typeof listItems.$inferSelect): ListItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unitId: row.unitId,
    price: row.price,
    categoryId: row.categoryId,
    note: row.note,
    checkedAt: row.checkedAt?.toISOString() ?? null,
  };
}

// PostgreSQL's foreign-key violation (23503), on the error or, as Drizzle
// wraps it, its cause. A category or unit of another workspace ends here.
export function isForeignKeyViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return code(error) === "23503" || code(cause) === "23503";
}

const inList = ({ workspaceId }: WorkspaceContext, listId: string) =>
  and(eq(listItems.workspaceId, workspaceId), eq(listItems.listId, listId));

// In the order added: IDs are time-ordered.
export async function listItemsOf(
  db: Executor,
  context: WorkspaceContext,
  listId: string,
): Promise<ListItem[]> {
  const rows = await db
    .select()
    .from(listItems)
    .where(inList(context, listId))
    .orderBy(asc(listItems.id));
  return rows.map(toItem);
}

async function findItem(
  db: Executor,
  context: WorkspaceContext,
  listId: string,
  id: string,
): Promise<ListItem | null> {
  const [row] = await db
    .select()
    .from(listItems)
    .where(and(inList(context, listId), eq(listItems.id, id)));
  return row ? toItem(row) : null;
}

// A repeated ID keeps the stored item (a retried request is not an error).
// Null when the database refuses a reference, or the ID is another list's.
export async function insertItem(
  db: Executor,
  context: WorkspaceContext,
  listId: string,
  { checkedAt, ...body }: CreateItem,
): Promise<{ item: ListItem; created: boolean } | null> {
  // Stryker disable next-line ObjectLiteral: any conflict here is on the composite key, so `{}` does the same
  const onKeyConflict = { target: [listItems.workspaceId, listItems.id] };
  let inserted;
  try {
    inserted = await db
      .insert(listItems)
      .values({
        ...body,
        workspaceId: context.workspaceId,
        listId,
        checkedAt: checkedAt ? new Date(checkedAt) : null,
      })
      .onConflictDoNothing(onKeyConflict)
      .returning();
  } catch (error) {
    if (isForeignKeyViolation(error)) return null;
    throw error;
  }
  const [row] = inserted;
  if (row) return { item: toItem(row), created: true };
  const item = await findItem(db, context, listId, body.id);
  return item && { item, created: false };
}

// Every check stores the time of that call (ITM-7.4). Null when no item
// matched, or the database refuses a reference.
export async function updateItem(
  db: Executor,
  context: WorkspaceContext,
  listId: string,
  id: string,
  { checked, ...changes }: UpdateItem,
): Promise<ListItem | null> {
  try {
    const [row] = await db
      .update(listItems)
      .set({
        ...changes,
        ...(checked === undefined
          ? {}
          : { checkedAt: checked ? sql`now()` : null }),
      })
      .where(and(inList(context, listId), eq(listItems.id, id)))
      .returning();
    return row ? toItem(row) : null;
  } catch (error) {
    if (isForeignKeyViolation(error)) return null;
    throw error;
  }
}

// Whether a row was deleted; a missing item is not an error here.
export async function deleteItem(
  db: Executor,
  context: WorkspaceContext,
  listId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(listItems)
    .where(and(inList(context, listId), eq(listItems.id, id)))
    .returning({ id: listItems.id });
  return rows.length > 0;
}
