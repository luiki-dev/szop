import type { Catalog } from "@szop/shared";
import { eq, and } from "drizzle-orm";
import { insertCatalog } from "../catalog/repository.ts";
import type { Database } from "../db/database.ts";
import { lists, workspaces } from "../db/schema.ts";
import type { SessionUser } from "../auth/session.ts";

// The database or a transaction on it.
export type Executor =
  Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

// What a request may touch. Today only the owner of a workspace has access;
// `role` is here for sharing to widen later (ADR 0057).
export interface WorkspaceContext {
  user: SessionUser;
  workspaceId: string;
  role: "owner";
}

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

export async function findOwnWorkspace(
  db: Executor,
  user: SessionUser | null,
): Promise<WorkspaceContext | null> {
  if (user === null) return null;
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, user.id));
  return row ? { user, workspaceId: row.id, role: "owner" } : null;
}

// The user's workspace, created on first use with a copy of the catalog.
// Concurrent first calls end in one row: the unique user_id makes the loser's
// insert do nothing, and only the winner copies. Run it inside a transaction
// when it may create the workspace, so a failed copy leaves no workspace.
export async function ownWorkspace(
  db: Executor,
  user: SessionUser | null,
  catalog: Catalog,
): Promise<WorkspaceContext> {
  if (user === null) throw httpError(401, "Sign-in required");
  // Stryker disable next-line ObjectLiteral: the target only names the constraint; any conflict here is the userId one, so `{}` does the same
  const onUserConflict = { target: workspaces.userId };
  const [created] = await db
    .insert(workspaces)
    .values({ userId: user.id })
    .onConflictDoNothing(onUserConflict)
    .returning({ id: workspaces.id });
  if (created) {
    const context: WorkspaceContext = {
      user,
      workspaceId: created.id,
      role: "owner",
    };
    await insertCatalog(db, context, catalog);
    return context;
  }
  const context = await findOwnWorkspace(db, user);
  // Stryker disable next-line ConditionalExpression,StringLiteral: unreachable after the insert; a defensive guard
  if (context === null) throw httpError(500, "Workspace missing");
  return context;
}

// Missing and foreign lists answer alike, so an ID reveals nothing.
export async function requireListAccess(
  db: Executor,
  user: SessionUser | null,
  listId: string,
): Promise<WorkspaceContext> {
  const context = await findOwnWorkspace(db, user);
  if (context === null) throw httpError(404, "Not found");
  // Stryker disable next-line ObjectLiteral: only the row's existence is used
  const idOnly = { id: lists.id };
  const [row] = await db
    .select(idOnly)
    .from(lists)
    .where(
      and(eq(lists.workspaceId, context.workspaceId), eq(lists.id, listId)),
    );
  if (!row) throw httpError(404, "Not found");
  return context;
}
