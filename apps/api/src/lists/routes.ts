import {
  type Catalog,
  createListSchema,
  deleteListsSchema,
  listSchema,
  listsResponseSchema,
  listWithItemsSchema,
  updateListSchema,
} from "@szop/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  findOwnWorkspace,
  ownWorkspace,
  requireListAccess,
} from "../access/workspace.ts";
import type { Auth } from "../auth/auth.ts";
import { sessionHook } from "../auth/session.ts";
import type { Database } from "../db/database.ts";
import { sendError } from "../errors.ts";
import {
  deleteList,
  deleteLists,
  insertList,
  listLists,
  updateList,
} from "./repository.ts";
import { listItemsOf } from "../items/repository.ts";

export interface ListsRoutesOptions {
  db: Database;
  auth: Auth;
  catalog: Catalog;
}

const idParams = z.object({ id: z.string() });

// The lists API (PH-16a spec). Every route reads the session and goes
// through the access layer; a missing or foreign list is one 404.
export function listsRoutes(
  app: FastifyInstance,
  { db, auth, catalog }: ListsRoutesOptions,
): void {
  // The lists plugin adds the hook to its own routes only; the catalog plugin
  // does the same for its route (ACC-1.3).
  app.addHook("preHandler", sessionHook(auth));
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/lists",
    // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handlers already return exactly its fields, so `{}` behaves the same
    { schema: { response: { 200: listsResponseSchema } } },
    async (request) => {
      const context = await findOwnWorkspace(db, request.user);
      return { lists: context ? await listLists(db, context) : [] };
    },
  );

  typed.post(
    "/lists",
    {
      schema: {
        body: createListSchema,
        // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handlers already return exactly its fields, so `{}` behaves the same
        response: { 200: listSchema, 201: listSchema },
      },
    },
    async (request, reply) => {
      const { list, created } = await db.transaction(async (tx) => {
        const context = await ownWorkspace(tx, request.user, catalog);
        return insertList(tx, context, request.body);
      });
      return reply.code(created ? 201 : 200).send(list);
    },
  );

  typed.get(
    "/lists/:id",
    // Stryker disable next-line ObjectLiteral: a path parameter is always a string and the response schema only strips what the handler already leaves out, so `{}` behaves the same
    {
      // Stryker disable next-line ObjectLiteral: a path parameter is always a string, so `{}` behaves the same
      schema: {
        params: idParams,
        // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handler already returns exactly its fields, so `{}` behaves the same
        response: { 200: listWithItemsSchema },
      },
    },
    async (request, reply) => {
      const id = z.uuid().safeParse(request.params.id);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!id.success) return notFound(reply);
      const { context, list } = await requireListAccess(
        db,
        request.user,
        id.data,
      );
      return { ...list, items: await listItemsOf(db, context, id.data) };
    },
  );

  typed.patch(
    "/lists/:id",
    {
      schema: {
        params: idParams,
        body: updateListSchema,
        // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handlers already return exactly its fields, so `{}` behaves the same
        response: { 200: listSchema },
      },
    },
    async (request, reply) => {
      const id = z.uuid().safeParse(request.params.id);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!id.success) return notFound(reply);
      const { context } = await requireListAccess(db, request.user, id.data);
      const list = await updateList(db, context, id.data, request.body);
      return list ?? notFound(reply);
    },
  );

  typed.delete(
    "/lists/:id",
    // Stryker disable next-line ObjectLiteral: a path parameter is always a string, so `{}` behaves the same
    { schema: { params: idParams } },
    async (request, reply) => {
      if (request.user === null) return unauthorized(reply);
      const id = z.uuid().safeParse(request.params.id);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!id.success) return notFound(reply);
      const { context } = await requireListAccess(db, request.user, id.data);
      return (await deleteList(db, context, id.data))
        ? reply.code(204).send()
        : notFound(reply);
    },
  );

  // A POST, not a DELETE with a body: some proxies drop a DELETE's body.
  typed.post(
    "/lists/delete",
    { schema: { body: deleteListsSchema } },
    async (request, reply) => {
      if (request.user === null) return unauthorized(reply);
      await db.transaction(async (tx) => {
        const context = await findOwnWorkspace(tx, request.user);
        if (context) await deleteLists(tx, context, request.body.ids);
      });
      return reply.code(204).send();
    },
  );
}

function unauthorized(reply: Parameters<typeof sendError>[0]) {
  return sendError(reply, 401, "unauthorized", "Sign-in required");
}

function notFound(reply: Parameters<typeof sendError>[0]) {
  return sendError(reply, 404, "not_found", "Not found");
}
