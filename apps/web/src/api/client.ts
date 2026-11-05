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

// How long a request may wait for the server, and what a request that waited
// that long fails with.
export const timeLimit = 10_000;
export const timeoutMessage = "The server didn't answer in time.";

// A signal that aborts with our own error after the limit, so fetch rejects
// with it as it is. Not AbortSignal.timeout: Vitest's fake timers do not
// drive it.
function deadline(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new Error(timeoutMessage));
  }, timeLimit);
  return controller.signal;
}

// The only code that calls fetch; components never do. Every request has a
// time limit. A 200 and a 503 both
// carry a health body: the 503 says the database is down, which is an answer,
// not a failure of the request. Anything else, or a body that does not match
// the schema, is an error.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health", { signal: deadline() });
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`GET /api/health answered ${String(response.status)}`);
  }
  return healthSchema.parse(await response.json());
}

// An error body carries a message worth showing; anything else only the
// status. A 200 whose body is not a catalog (the SPA and the API from
// different deploys) is an error too, not a crash further on.
export async function getCatalog(): Promise<Catalog> {
  const response = await fetch("/api/catalog", { signal: deadline() });
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

// Whether a failed change leaves the user unsure it was saved: false only for
// a refusal with its own message (a 4xx but 401), which a retry would not
// change; true for a timeout, no network, a 5xx, a second 401 and an
// unreadable answer.
export function notSaved(error: Error): boolean {
  return !(
    error instanceof ApiRequestError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401
  );
}

const json = { "content-type": "application/json" };

// The API refuses writes that are not JSON, so every write with a body sends
// the header. A DELETE has no body and must not claim one: Fastify answers 400
// to JSON with nothing in it.
function send(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  signal: AbortSignal,
) {
  return body === undefined
    ? fetch(path, { method, signal })
    : fetch(path, {
        method,
        headers: json,
        body: JSON.stringify(body),
        signal,
      });
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

async function signIn(signal: AbortSignal): Promise<void> {
  const path = "/api/auth/sign-in/anonymous";
  const response = await send("POST", path, {}, signal);
  if (!response.ok) throw await failure("POST", path, response);
}

// Signs in as a guest unless a session exists by the time this runs. Under a
// lock shared by all tabs, so tabs that meet make one sign-in, not one each
// (Better Auth answers `null`, or fails, when there is no session). jsdom has
// no navigator.locks, so the callback runs alone there.
function guestSignIn(signal: AbortSignal): Promise<void> {
  const signInUnlessSession = async () => {
    const session = await fetch("/api/auth/get-session", { signal })
      .then((response) =>
        response.ok ? (response.json() as Promise<unknown>) : null,
      )
      .catch((error: unknown) => {
        if (signal.aborted) throw error;
        return null;
      });
    if (!session) await signIn(signal);
  };
  return "locks" in navigator
    ? navigator.locks.request(
        "szop-guest-sign-in",
        { signal },
        signInUnlessSession,
      )
    : signInUnlessSession();
}

// Runs a write, and on a 401 (no session, or a stale cookie) signs in as a
// guest and writes once more, never in a loop. The whole run shares one
// deadline. Plain fetch, not better-auth/client, to keep the first screen's
// JavaScript small.
async function withSession(
  write: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  const signal = deadline();
  const response = await write(signal);
  if (response.status !== 401) return response;
  await guestSignIn(signal);
  return write(signal);
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
  const response = await fetch(path, { signal: deadline() });
  if (!response.ok) throw await failure("GET", path, response);
  const body: unknown = await response.json().catch(unreadable);
  const lists = listsResponseSchema.safeParse(body);
  if (!lists.success) {
    throw new Error("The lists came in a shape this page does not know");
  }
  return lists.data.lists;
}

export async function getList(id: string): Promise<List> {
  const path = `/api/lists/${encodeURIComponent(id)}`;
  return readList("GET", path, await fetch(path, { signal: deadline() }));
}

export async function createList(body: CreateList): Promise<List> {
  const path = "/api/lists";
  return readList(
    "POST",
    path,
    await withSession((signal) => send("POST", path, body, signal)),
  );
}

export async function renameList(id: string, name: string): Promise<List> {
  const path = `/api/lists/${encodeURIComponent(id)}`;
  return readList(
    "PATCH",
    path,
    await withSession((signal) => send("PATCH", path, { name }, signal)),
  );
}

// A 204 has no body to read.
async function expectNoContent(
  method: string,
  path: string,
  response: Response,
) {
  if (!response.ok) throw await failure(method, path, response);
}

export async function deleteList(id: string): Promise<void> {
  const path = `/api/lists/${encodeURIComponent(id)}`;
  await expectNoContent(
    "DELETE",
    path,
    await withSession((signal) => send("DELETE", path, undefined, signal)),
  );
}

export async function deleteLists(ids: string[]): Promise<void> {
  const path = "/api/lists/delete";
  await expectNoContent(
    "POST",
    path,
    await withSession((signal) => send("POST", path, { ids }, signal)),
  );
}
