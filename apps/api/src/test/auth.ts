import type { FastifyInstance } from "fastify";
import { testConfig } from "./config.ts";

// Headers of a request from the app itself: pass the cross-site and
// JSON-only checks of the web baseline.
export const sameOrigin = {
  "sec-fetch-site": "same-origin",
  origin: testConfig().appOrigin,
  "content-type": "application/json",
};

// Signs in anonymously and returns the `cookie` header value for later
// `inject` calls.
export async function signIn(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/anonymous",
    headers: sameOrigin,
    payload: {},
  });
  if (response.statusCode !== 200) {
    throw new Error(
      `Sign-in failed: ${String(response.statusCode)} ${response.body}`,
    );
  }
  return response.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
