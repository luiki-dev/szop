import { eq, and } from "drizzle-orm";
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

// The user's workspace, created on first use. Concurrent first calls end in
// one row: the unique user_id makes the loser's insert do nothing.
export async function ownWorkspace(
  db: Executor,
  user: SessionUser | null,
): Promise<WorkspaceContext> {
  if (user === null) throw httpError(401, "Sign-in required");
  await db
    .insert(workspaces)
    .values({ userId: user.id })
    .onConflictDoNothing({ target: workspaces.userId });
  const context = await findOwnWorkspace(db, user);
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
  const [row] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(
      and(eq(lists.workspaceId, context.workspaceId), eq(lists.id, listId)),
    );
  if (!row) throw httpError(404, "Not found");
  return context;
}
