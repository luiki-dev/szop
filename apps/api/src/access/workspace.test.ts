import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { lists } from "../db/schema.ts";
import { useTestDatabase } from "../test/database.ts";
import {
  findOwnWorkspace,
  ownWorkspace,
  requireListAccess,
} from "./workspace.ts";

const idOf = (n: number) => `00000000-0000-4000-8000-00000000000${String(n)}`;

describe("the access layer", () => {
  const database = useTestDatabase();

  async function newUser(n: number) {
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${idOf(n)}, 'g', ${`g${String(n)}@x.test`}, false)`,
    );
    return { id: idOf(n) };
  }

  it("findOwnWorkspace is null for no user and for a user without a workspace", async () => {
    expect(await findOwnWorkspace(database.db, null)).toBeNull();
    expect(await findOwnWorkspace(database.db, await newUser(1))).toBeNull();
  });

  it("ownWorkspace rejects with 401 without a user", async () => {
    await expect(ownWorkspace(database.db, null)).rejects.toMatchObject({
      statusCode: 401,
      message: "Sign-in required",
    });
  });

  it("ACC-1.1: two concurrent calls make one workspace", async () => {
    const user = await newUser(1);
    const [a, b] = await Promise.all([
      ownWorkspace(database.db, user),
      ownWorkspace(database.db, user),
    ]);
    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.role).toBe("owner");
    const count = await database.db.execute<{ n: string }>(
      sql`SELECT count(*) AS n FROM workspaces`,
    );
    expect(count.rows[0]?.n).toBe("1");
  });

  it("NFR-4.10: requireListAccess rejects 404 for a foreign and a missing list", async () => {
    const owner = await newUser(1);
    const other = await newUser(2);
    const { workspaceId } = await ownWorkspace(database.db, owner);
    await database.db
      .insert(lists)
      .values({ workspaceId, id: idOf(5), name: "Mine" });

    await expect(
      requireListAccess(database.db, owner, idOf(5)),
    ).resolves.toMatchObject({ workspaceId });
    await ownWorkspace(database.db, other);
    await expect(
      requireListAccess(database.db, other, idOf(5)),
    ).rejects.toMatchObject({ statusCode: 404, message: "Not found" });
    await expect(
      requireListAccess(database.db, owner, idOf(6)),
    ).rejects.toMatchObject({ statusCode: 404, message: "Not found" });
    await expect(
      requireListAccess(database.db, await newUser(3), idOf(5)),
    ).rejects.toMatchObject({ statusCode: 404, message: "Not found" });
  });
});
