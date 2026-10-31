import type { List } from "@szop/shared";
import { and, desc, eq, ne } from "drizzle-orm";
import type { Executor } from "../access/workspace.ts";
import { lists } from "../db/schema.ts";

function toList(row: typeof lists.$inferSelect): List {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLists(
  db: Executor,
  workspaceId: string,
): Promise<List[]> {
  const rows = await db
    .select()
    .from(lists)
    .where(eq(lists.workspaceId, workspaceId))
    .orderBy(desc(lists.createdAt), desc(lists.id));
  return rows.map(toList);
}

export async function findList(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<List | null> {
  const [row] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.workspaceId, workspaceId), eq(lists.id, id)));
  return row ? toList(row) : null;
}

// A repeated ID keeps the stored list (a retried request is not an error).
export async function insertList(
  db: Executor,
  workspaceId: string,
  { id, name }: { id: string; name: string },
): Promise<{ list: List; created: boolean }> {
  // Stryker disable next-line ObjectLiteral: any conflict here is on the composite key, so `{}` does the same
  const onKeyConflict = { target: [lists.workspaceId, lists.id] };
  const inserted = await db
    .insert(lists)
    .values({ workspaceId, id, name })
    .onConflictDoNothing(onKeyConflict)
    .returning();
  const [row] = inserted;
  if (row) return { list: toList(row), created: true };
  const list = await findList(db, workspaceId, id);
  // Stryker disable next-line CallExpression,ConditionalExpression,StringLiteral: unreachable, the row exists after a conflict
  if (list === null) throw new Error("List vanished after a conflict");
  return { list, created: false };
}

// Writes nothing, so updated_at stays, when the name is unchanged.
export async function renameList(
  db: Executor,
  workspaceId: string,
  id: string,
  name: string,
): Promise<List | null> {
  const [row] = await db
    .update(lists)
    .set({ name })
    .where(
      and(
        eq(lists.workspaceId, workspaceId),
        eq(lists.id, id),
        ne(lists.name, name),
      ),
    )
    .returning();
  return row ? toList(row) : findList(db, workspaceId, id);
}
