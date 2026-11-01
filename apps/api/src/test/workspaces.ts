import type { Catalog } from "@szop/shared";
import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";
import { ownWorkspace, type WorkspaceContext } from "../access/workspace.ts";
import type { Database } from "../db/database.ts";
import { sameOrigin, signIn } from "./auth.ts";

// A signed-in guest with a workspace, for tests that need two of them.
export interface Guest {
  cookie: string;
  context: WorkspaceContext;
  // Sends a request as this guest: adds the cookie and the same-origin headers.
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

async function guest(
  app: FastifyInstance,
  db: Database,
  catalog: Catalog,
): Promise<Guest> {
  const cookie = await signIn(app);
  const session = await app.inject({
    method: "GET",
    url: "/api/auth/get-session",
    headers: { cookie },
  });
  const user = { id: session.json<{ user: { id: string } }>().user.id };
  return {
    cookie,
    context: await ownWorkspace(db, user, catalog),
    inject: (options) =>
      app.inject({
        ...options,
        headers: { ...sameOrigin, cookie, ...options.headers },
      }),
  };
}

// Two guests, each with a workspace holding a copy of the catalog.
export async function twoWorkspaces(
  app: FastifyInstance,
  db: Database,
  catalog: Catalog,
): Promise<[Guest, Guest]> {
  return [await guest(app, db, catalog), await guest(app, db, catalog)];
}
