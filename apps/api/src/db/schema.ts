// The Drizzle schema: every table the API stores, which `pnpm db:generate`
// turns into migrations in ../../drizzle/. Conventions: ADR 0057, decision 14.
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema.ts";

export * from "./auth-schema.ts";

// A user's own space, created on the first write (lazily, not at sign-in).
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("workspaces_user_id_key").on(table.userId),
    foreignKey({
      name: "workspaces_user_id_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

// `id` has no default: the browser creates it, so a retried request repeats it.
export const lists = pgTable(
  "lists",
  {
    workspaceId: uuid("workspace_id").notNull(),
    id: uuid("id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ name: "lists_pkey", columns: [table.workspaceId, table.id] }),
    foreignKey({
      name: "lists_workspace_id_fkey",
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete("cascade"),
    index("lists_workspace_id_created_at_idx").on(
      table.workspaceId,
      table.createdAt.desc(),
    ),
    check(
      "lists_name_check",
      sql`char_length(${table.name}) BETWEEN 1 AND 100`,
    ),
  ],
);
