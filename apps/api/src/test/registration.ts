import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Email, EmailSender } from "../email/sender.ts";
import { sameOrigin } from "./auth.ts";

// An email sender that records what it is asked to send.
export function fakeEmail(): { sender: EmailSender; sent: Email[] } {
  const sent: Email[] = [];
  return {
    sent,
    sender: {
      send(message) {
        sent.push(message);
        return Promise.resolve();
      },
    },
  };
}

// Signs up and returns the token of the verification link the fake received.
export async function registerAndGetLink(
  app: FastifyInstance,
  fake: { sent: Email[] },
  body: object,
  options: { cookie?: string; ip?: string } = {},
): Promise<{ token: string }> {
  const before = fake.sent.length;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: {
      ...sameOrigin,
      "x-forwarded-for": options.ip ?? `203.0.113.${String(randomInt(1, 255))}`,
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    payload: body,
  });
  if (response.statusCode !== 200) {
    throw new Error(`Sign-up failed: ${String(response.statusCode)}`);
  }
  // The sender is called in the background; let it run.
  await new Promise((resolve) => setImmediate(resolve));
  const text = fake.sent[before]?.text ?? "";
  const token = /verify\?token=([^\s&]+)/.exec(text)?.[1];
  if (!token) throw new Error("No verification link was sent");
  return { token: decodeURIComponent(token) };
}
