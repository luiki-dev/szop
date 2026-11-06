import {
  createItemSchema,
  listItemSchema,
  updateItemSchema,
} from "@szop/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireListAccess } from "../access/workspace.ts";
import type { Auth } from "../auth/auth.ts";
import { sessionHook } from "../auth/session.ts";
import type { Database } from "../db/database.ts";
import { sendError } from "../errors.ts";
import { deleteItem, insertItem, updateItem } from "./repository.ts";

export interface ItemsRoutesOptions {
  db: Database;
  auth: Auth;
}

const listParams = z.object({ listId: z.string() });
const itemParams = z.object({ listId: z.string(), id: z.string() });

// The items API (PH-17 spec). Items nest under their list; a missing or
// foreign list, item, category or unit is one 404.
export function itemsRoutes(
  app: FastifyInstance,
  { db, auth }: ItemsRoutesOptions,
): void {
  app.addHook("preHandler", sessionHook(auth));
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/lists/:listId/items",
    {
      // Stryker disable next-line ObjectLiteral: a path parameter is always a string, so `{}` behaves the same
      schema: {
        params: listParams,
        body: createItemSchema,
        // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handlers already return exactly its fields, so `{}` behaves the same
        response: { 200: listItemSchema, 201: listItemSchema },
      },
    },
    async (request, reply) => {
      if (request.user === null) return unauthorized(reply);
      const listId = z.uuid().safeParse(request.params.listId);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!listId.success) return notFound(reply);
      const { context } = await requireListAccess(
        db,
        request.user,
        listId.data,
      );
      const result = await insertItem(db, context, listId.data, request.body);
      if (result === null) return notFound(reply);
      return reply.code(result.created ? 201 : 200).send(result.item);
    },
  );

  typed.patch(
    "/lists/:listId/items/:id",
    {
      // Stryker disable next-line ObjectLiteral: a path parameter is always a string, so `{}` behaves the same
      schema: {
        params: itemParams,
        body: updateItemSchema,
        // Stryker disable next-line ObjectLiteral: the response schema documents and strips; the handlers already return exactly its fields, so `{}` behaves the same
        response: { 200: listItemSchema },
      },
    },
    async (request, reply) => {
      if (request.user === null) return unauthorized(reply);
      const ids = parseIds(request.params);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!ids) return notFound(reply);
      const { context } = await requireListAccess(db, request.user, ids.listId);
      const item = await updateItem(
        db,
        context,
        ids.listId,
        ids.id,
        request.body,
      );
      return item ?? notFound(reply);
    },
  );

  typed.delete(
    "/lists/:listId/items/:id",
    // Stryker disable next-line ObjectLiteral: a path parameter is always a string, so `{}` behaves the same
    { schema: { params: itemParams } },
    async (request, reply) => {
      if (request.user === null) return unauthorized(reply);
      const ids = parseIds(request.params);
      // Stryker disable next-line ConditionalExpression: an invalid ID would reach the access layer as undefined and end in the same 404; the guard keeps it from the query
      if (!ids) return notFound(reply);
      const { context } = await requireListAccess(db, request.user, ids.listId);
      return (await deleteItem(db, context, ids.listId, ids.id))
        ? reply.code(204).send()
        : notFound(reply);
    },
  );
}

function parseIds(params: { listId: string; id: string }) {
  const parsed = z.object({ listId: z.uuid(), id: z.uuid() }).safeParse(params);
  return parsed.success ? parsed.data : null;
}

function unauthorized(reply: Parameters<typeof sendError>[0]) {
  return sendError(reply, 401, "unauthorized", "Sign-in required");
}

function notFound(reply: Parameters<typeof sendError>[0]) {
  return sendError(reply, 404, "not_found", "Not found");
}
