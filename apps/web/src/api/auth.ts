import { z } from "zod";
import { listsResponseSchema, type Registration } from "@szop/shared";
import { deadline, failure, send } from "./client.ts";

// Plain fetch, not better-auth/client, to keep the JavaScript small. Better
// Auth's errors ({ code, message }) become an ApiRequestError with its code.
export async function signUp(body: Registration): Promise<void> {
  const path = "/api/auth/sign-up/email";
  const response = await send("POST", path, body, deadline());
  if (!response.ok) throw await failure("POST", path, response);
}

// 204 whatever the address; 400 and 429 answer in the app's shape.
export async function resendLink(email: string): Promise<void> {
  const path = "/api/registration/resend";
  const response = await send("POST", path, { email }, deadline());
  if (!response.ok) throw await failure("POST", path, response);
}

const sessionSchema = z
  .object({
    user: z.object({
      name: z.string(),
      email: z.string(),
      isAnonymous: z.boolean().default(false),
    }),
  })
  .nullable();

// The session's user, or null with none (Better Auth answers `null`).
export async function getSession() {
  const path = "/api/auth/get-session";
  const response = await fetch(path, { signal: deadline() });
  if (!response.ok) throw await failure("GET", path, response);
  const session = sessionSchema.safeParse(await response.json());
  if (!session.success) {
    throw new Error("The session came in a shape this page does not know");
  }
  return session.data;
}

// What the registration form needs to know about this browser's guest: a
// guest with no session yet (401) has no workspace.
export async function getWorkspace(): Promise<{
  lists: number;
  hasWorkspace: boolean;
}> {
  const path = "/api/lists";
  const response = await fetch(path, { signal: deadline() });
  if (response.status === 401) return { lists: 0, hasWorkspace: false };
  if (!response.ok) throw await failure("GET", path, response);
  const body = listsResponseSchema.safeParse(await response.json());
  if (!body.success) {
    throw new Error("The lists came in a shape this page does not know");
  }
  return {
    lists: body.data.lists.length,
    hasWorkspace: body.data.hasWorkspace,
  };
}
