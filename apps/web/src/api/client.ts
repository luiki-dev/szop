import {
  apiErrorSchema,
  catalogSchema,
  healthSchema,
  listSchema,
  listsResponseSchema,
  type Catalog,
  type CreateList,
  type Health,
  type List,
} from "@szop/shared";

// What an unreadable JSON body becomes.
// Stryker disable next-line ArrowFunction: `null` and `undefined` are both an unreadable body, handled the same
const unreadable = () => null;

// The only code that calls fetch; components never do. A 200 and a 503 both
// carry a health body: the 503 says the database is down, which is an answer,
// not a failure of the request. Anything else, or a body that does not match
// the schema, is an error.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`GET /api/health answered ${String(response.status)}`);
  }
  return healthSchema.parse(await response.json());
}

// An error body carries a message worth showing; anything else only the
// status. A 200 whose body is not a catalog (the SPA and the API from
// different deploys) is an error too, not a crash further on.
export async function getCatalog(): Promise<Catalog> {
  const response = await fetch("/api/catalog");
  const body: unknown = await response.json().catch(unreadable);
  if (response.status !== 200) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.error.message
        : `GET /api/catalog answered ${String(response.status)}`,
    );
  }
  const catalog = catalogSchema.safeParse(body);
  if (!catalog.success) {
    throw new Error("The catalog came in a shape this page does not know");
  }
  return catalog.data;
}

// A failed request to the lists API; the status lets a page tell "not found"
// from "unreachable".
export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const json = { "content-type": "application/json" };

// The API refuses writes that are not JSON, so every write sends the header.
function send(method: "POST" | "PATCH", path: string, body: unknown) {
  return fetch(path, { method, headers: json, body: JSON.stringify(body) });
}

// The body of a response that is not the answer: the API's message when it
// sent one, else only the status.
async function failure(
  method: string,
  path: string,
  response: Response,
): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(unreadable);
  const error = apiErrorSchema.safeParse(body);
  return new ApiRequestError(
    error.success
      ? error.data.error.message
      : `${method} ${path} answered ${String(response.status)}`,
    response.status,
  );
}

async function signIn(): Promise<void> {
  const path = "/api/auth/sign-in/anonymous";
  const response = await send("POST", path, {});
  if (!response.ok) throw await failure("POST", path, response);
}

// Runs a write with a session, asking for an anonymous one first when the
// browser has none (Better Auth answers `null`). A 401 means the cookie went
// stale: sign in again and retry once, never in a loop. Plain fetch, not
// better-auth/client, to keep the first screen's JavaScript small.
async function withSession(write: () => Promise<Response>): Promise<Response> {
  const session = await fetch("/api/auth/get-session")
    .then((response) => response.json() as Promise<unknown>)
    .catch(unreadable);
  if (session === null) await signIn();
  const response = await write();
  if (response.status !== 401) return response;
  await signIn();
  return write();
}

async function readList(
  method: string,
  path: string,
  response: Response,
): Promise<List> {
  if (!response.ok) throw await failure(method, path, response);
  const body: unknown = await response.json().catch(unreadable);
  const list = listSchema.safeParse(body);
  if (!list.success) {
    throw new Error("The list came in a shape this page does not know");
  }
  return list.data;
}

export async function getLists(): Promise<List[]> {
  const path = "/api/lists";
  const response = await fetch(path);
  if (!response.ok) throw await failure("GET", path, response);
  const body: unknown = await response.json().catch(unreadable);
  const lists = listsResponseSchema.safeParse(body);
  if (!lists.success) {
    throw new Error("The lists came in a shape this page does not know");
  }
  return lists.data.lists;
}

export async function getList(id: string): Promise<List> {
  const path = `/api/lists/${id}`;
  return readList("GET", path, await fetch(path));
}

export async function createList(body: CreateList): Promise<List> {
  const path = "/api/lists";
  return readList(
    "POST",
    path,
    await withSession(() => send("POST", path, body)),
  );
}

export async function renameList(id: string, name: string): Promise<List> {
  const path = `/api/lists/${id}`;
  return readList(
    "PATCH",
    path,
    await withSession(() => send("PATCH", path, { name })),
  );
}
