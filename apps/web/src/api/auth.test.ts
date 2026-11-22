import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/server.ts";
import { ApiRequestError } from "./client.ts";
import { getSession, getWorkspace, resendLink, signUp } from "./auth.ts";

const body = {
  name: "Ania",
  email: "ania@example.com",
  password: "x".repeat(15),
};

describe("signUp", () => {
  it("throws Better Auth's code", async () => {
    server.use(
      http.post("/api/auth/sign-up/email", () =>
        HttpResponse.json(
          { code: "password_breached", message: "Leaked." },
          { status: 400 },
        ),
      ),
    );

    const error = await signUp(body).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 400,
      code: "password_breached",
      message: "Leaked.",
    });
  });
});

describe("signUp with no guest session", () => {
  it("ACC-2.7: signs in as a guest before the sign-up, so a list added later has a session to join", async () => {
    const calls: string[] = [];
    server.use(
      http.get("/api/auth/get-session", () => {
        calls.push("get-session");
        return HttpResponse.json(null);
      }),
      http.post("/api/auth/sign-in/anonymous", () => {
        calls.push("sign-in");
        return HttpResponse.json({});
      }),
      http.post("/api/auth/sign-up/email", () => {
        calls.push("sign-up");
        return HttpResponse.json({ token: null });
      }),
    );

    await signUp(body);

    expect(calls).toEqual(["get-session", "sign-in", "sign-up"]);
  });
});

describe("resendLink", () => {
  it("reads the code of the app's shape", async () => {
    server.use(
      http.post("/api/registration/resend", () =>
        HttpResponse.json(
          { error: { code: "too_many_requests", message: "Slow down." } },
          { status: 429 },
        ),
      ),
    );

    await expect(resendLink("a@b.co")).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });
});

describe("getSession", () => {
  it("answers null with no session and the user with one", async () => {
    await expect(getSession()).resolves.toBeNull();
    server.use(
      http.get("/api/auth/get-session", () =>
        HttpResponse.json({
          user: { name: "A", email: "a@b.co", isAnonymous: false },
        }),
      ),
    );
    await expect(getSession()).resolves.toMatchObject({ user: { name: "A" } });
  });
});

describe("getWorkspace", () => {
  it("counts the lists; a 401 is no workspace", async () => {
    server.use(
      http.get("/api/lists", () => new HttpResponse(null, { status: 401 })),
    );
    await expect(getWorkspace()).resolves.toEqual({
      lists: 0,
      hasWorkspace: false,
    });
  });
});
