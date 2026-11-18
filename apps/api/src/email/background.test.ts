import type { FastifyBaseLogger } from "fastify";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { sendInBackground } from "./background.ts";

const email = {
  to: "someone@example.com",
  subject: "Secret subject",
  text: "t",
  html: "<p>t</p>",
};

let log: { error: Mock<FastifyBaseLogger["error"]> };

beforeEach(() => {
  log = { error: vi.fn<FastifyBaseLogger["error"]>() };
});

describe("sendInBackground", () => {
  it("returns before the send settles", () => {
    const sender = { send: () => new Promise<void>(() => {}) };
    sendInBackground(sender, email, "test", log);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("logs a rejection once, without the address or the subject", async () => {
    const error = Object.assign(
      new Error("Recipient someone@example.com: Secret subject"),
      { code: "EENVELOPE" },
    );
    sendInBackground(
      { send: () => Promise.reject(error) },
      email,
      "verification",
      log,
    );
    await vi.waitFor(() => {
      expect(log.error).toHaveBeenCalledTimes(1);
    });
    expect(log.error).toHaveBeenCalledWith(
      { emailKind: "verification", errorName: "Error", errorCode: "EENVELOPE" },
      "email not sent",
    );
    const written = JSON.stringify(log.error.mock.calls);
    expect(written).not.toContain("someone@example.com");
    expect(written).not.toContain("Secret subject");
  });

  it("logs a rejection that is not an Error", async () => {
    sendInBackground(
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test
      { send: () => Promise.reject("boom") },
      email,
      "test",
      log,
    );
    await vi.waitFor(() => {
      expect(log.error).toHaveBeenCalledTimes(1);
    });
    expect(log.error).toHaveBeenCalledWith(
      { emailKind: "test", errorName: undefined, errorCode: undefined },
      "email not sent",
    );
  });

  it("logs nothing when the send succeeds", async () => {
    sendInBackground({ send: () => Promise.resolve() }, email, "test", log);
    await new Promise((resolve) => setImmediate(resolve));
    expect(log.error).not.toHaveBeenCalled();
  });
});
