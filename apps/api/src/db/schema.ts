// The Drizzle schema: every table the API stores, which `pnpm db:generate`
// turns into migrations in ../../drizzle/. Conventions: ADR 0057, decision 14.
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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

// The workspace's copy of the default data. Like `lists`, `id` has no default:
// the seed and, later, the browser create the IDs. ADR 0060, decision 3.
export const units = pgTable(
  "units",
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
    primaryKey({ name: "units_pkey", columns: [table.workspaceId, table.id] }),
    foreignKey({
      name: "units_workspace_id_fkey",
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete("cascade"),
    check(
      "units_name_check",
      sql`char_length(${table.name}) BETWEEN 1 AND 100`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    workspaceId: uuid("workspace_id").notNull(),
    id: uuid("id").notNull(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull(),
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
    primaryKey({
      name: "categories_pkey",
      columns: [table.workspaceId, table.id],
    }),
    foreignKey({
      name: "categories_workspace_id_fkey",
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "categories_workspace_id_parent_id_fkey",
      columns: [table.workspaceId, table.parentId],
      foreignColumns: [table.workspaceId, table.id],
    }).onDelete("cascade"),
    check(
      "categories_name_check",
      sql`char_length(${table.name}) BETWEEN 1 AND 100`,
    ),
    check("categories_position_check", sql`${table.position} >= 0`),
  ],
);

export const products = pgTable(
  "products",
  {
    workspaceId: uuid("workspace_id").notNull(),
    id: uuid("id").notNull(),
    name: text("name").notNull(),
    categoryId: uuid("category_id"),
    unitId: uuid("unit_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "products_pkey",
      columns: [table.workspaceId, table.id],
    }),
    foreignKey({
      name: "products_workspace_id_fkey",
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "products_workspace_id_category_id_fkey",
      columns: [table.workspaceId, table.categoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }).onDelete("set null"),
    foreignKey({
      name: "products_workspace_id_unit_id_fkey",
      columns: [table.workspaceId, table.unitId],
      foreignColumns: [units.workspaceId, units.id],
    }).onDelete("set null"),
    check(
      "products_name_check",
      sql`char_length(${table.name}) BETWEEN 1 AND 100`,
    ),
  ],
);
