import { http, HttpResponse, type JsonBodyType } from "msw";
import { describe, expect, it } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { server } from "../test/server.ts";
import { threeLists } from "../test/lists.ts";
import {
  ApiRequestError,
  createList,
  getCatalog,
  getHealth,
  getList,
  getLists,
  renameList,
} from "./client.ts";

describe("getHealth", () => {
  it("names the status it did not expect", async () => {
    server.use(
      http.get("/api/health", () => new HttpResponse(null, { status: 500 })),
    );

    await expect(getHealth()).rejects.toThrow("GET /api/health answered 500");
  });
});

describe("getCatalog", () => {
  it("returns the catalog", async () => {
    server.use(http.get("/api/catalog", () => HttpResponse.json(smallCatalog)));

    await expect(getCatalog()).resolves.toEqual(smallCatalog);
  });

  it("names the status when an error body is not an API error", async () => {
    server.use(
      http.get(
        "/api/catalog",
        () => new HttpResponse("<html>", { status: 502 }),
      ),
    );

    await expect(getCatalog()).rejects.toThrow("GET /api/catalog answered 502");
  });

  it("says so when a 200 is not a catalog", async () => {
    server.use(
      http.get("/api/catalog", () => HttpResponse.json({ units: [] })),
    );

    await expect(getCatalog()).rejects.toThrow(
      "The catalog came in a shape this page does not know",
    );
  });
});

describe("lists", () => {
  const [party] = threeLists;
  const newList = { id: party?.id ?? "", name: "Party" };
  // Records each request as "METHOD /path" and answers the session and the
  // sign-in; `session` is what get-session answers, `postStatuses` what each
  // POST /api/lists answers in turn (the last one repeats).
  function stubApi(session: JsonBodyType, postStatuses: number[] = [201]) {
    const calls: string[] = [];
    let posts = 0;
    server.use(
      http.get("/api/auth/get-session", () => {
        calls.push("GET /api/auth/get-session");
        return HttpResponse.json(session);
      }),
      http.post("/api/auth/sign-in/anonymous", async ({ request }) => {
        calls.push("POST /api/auth/sign-in/anonymous");
        expect(request.headers.get("content-type")).toBe("application/json");
        expect(await request.json()).toEqual({});
        return HttpResponse.json({ ok: true });
      }),
      http.post("/api/lists", ({ request }) => {
        calls.push("POST /api/lists");
        expect(request.headers.get("content-type")).toBe("application/json");
        const status =
          postStatuses[Math.min(posts++, postStatuses.length - 1)] ?? 201;
        return status === 201
          ? HttpResponse.json(party, { status })
          : HttpResponse.json(
              { error: { code: "unauthorized", message: "Sign in" } },
              { status },
            );
      }),
    );
    return calls;
  }

  it("signs in anonymously before the first write when there is no session", async () => {
    const calls = stubApi(null);

    await expect(createList(newList)).resolves.toEqual(party);

    expect(calls).toEqual([
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("signs in before the write when the session answer is not JSON", async () => {
    const calls = stubApi(null);
    server.use(
      http.get("/api/auth/get-session", () => {
        calls.push("GET /api/auth/get-session");
        return new HttpResponse("<html>", { status: 200 });
      }),
    );

    await createList(newList);

    expect(calls).toEqual([
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("signs in before the write when get-session fails with a JSON body", async () => {
    const calls = stubApi(null);
    server.use(
      http.get("/api/auth/get-session", () => {
        calls.push("GET /api/auth/get-session");
        return HttpResponse.json(
          { message: "Too many requests" },
          { status: 429 },
        );
      }),
    );

    await createList(newList);

    expect(calls).toEqual([
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("does not sign in when there is a session", async () => {
    const calls = stubApi({ session: { id: "s" } });

    await createList(newList);

    expect(calls).toEqual(["GET /api/auth/get-session", "POST /api/lists"]);
  });

  it("signs in again and retries once after a 401", async () => {
    const calls = stubApi({ session: { id: "s" } }, [401, 201]);

    await expect(createList(newList)).resolves.toEqual(party);

    expect(calls).toEqual([
      "GET /api/auth/get-session",
      "POST /api/lists",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("stops after a second 401", async () => {
    const calls = stubApi({ session: { id: "s" } }, [401]);

    await expect(createList(newList)).rejects.toMatchObject({
      status: 401,
      message: "Sign in",
    });

    expect(calls.filter((call) => call === "POST /api/lists")).toHaveLength(2);
  });

  it("fails when the anonymous sign-in is refused", async () => {
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json(null)),
      http.post(
        "/api/auth/sign-in/anonymous",
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    await expect(createList(newList)).rejects.toThrow(
      "POST /api/auth/sign-in/anonymous answered 429",
    );
  });

  it("renames a list with a session", async () => {
    let body: unknown;
    server.use(
      http.get("/api/auth/get-session", () =>
        HttpResponse.json({ session: {} }),
      ),
      http.patch(`/api/lists/${party?.id ?? ""}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...party, name: "Bash" });
      }),
    );

    await expect(renameList(party?.id ?? "", "Bash")).resolves.toMatchObject({
      name: "Bash",
    });
    expect(body).toEqual({ name: "Bash" });
  });

  it("gets the lists in the server's order", async () => {
    server.use(
      http.get("/api/lists", () => HttpResponse.json({ lists: threeLists })),
    );

    await expect(getLists()).resolves.toEqual(threeLists);
  });

  it("answers a missing list with an ApiRequestError of status 404", async () => {
    server.use(
      http.get(`/api/lists/${party?.id ?? ""}`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "Not found" } },
          { status: 404 },
        ),
      ),
    );

    const error: unknown = await getList(party?.id ?? "").catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, message: "Not found" });
  });

  it("names the status when an error body is not an API error", async () => {
    server.use(
      http.get("/api/lists", () => new HttpResponse("<html>", { status: 502 })),
    );

    await expect(getLists()).rejects.toThrow("GET /api/lists answered 502");
  });

  it("says so when a 200 is not a list", async () => {
    server.use(
      http.get(`/api/lists/${party?.id ?? ""}`, () =>
        HttpResponse.json({ nope: true }),
      ),
    );

    await expect(getList(party?.id ?? "")).rejects.toThrow(
      "The list came in a shape this page does not know",
    );
  });

  it("says so when a 200 is not the lists", async () => {
    server.use(
      http.get("/api/lists", () => HttpResponse.json({ lists: [{}] })),
    );

    await expect(getLists()).rejects.toThrow(
      "The lists came in a shape this page does not know",
    );
  });

  it("names the request method and path when a failure has no API error body", async () => {
    server.use(
      http.get(
        `/api/lists/${party?.id ?? ""}`,
        () => new HttpResponse("<html>", { status: 502 }),
      ),
      http.get("/api/auth/get-session", () => HttpResponse.json({ s: 1 })),
      http.post(
        "/api/lists",
        () => new HttpResponse("<html>", { status: 500 }),
      ),
      http.patch(
        `/api/lists/${party?.id ?? ""}`,
        () => new HttpResponse("<html>", { status: 503 }),
      ),
    );
    const id = party?.id ?? "";

    await expect(getList(id)).rejects.toThrow(
      `GET /api/lists/${id} answered 502`,
    );
    await expect(createList(newList)).rejects.toThrow(
      "POST /api/lists answered 500",
    );
    await expect(renameList(id, "X")).rejects.toThrow(
      `PATCH /api/lists/${id} answered 503`,
    );
  });

  it("names a failed request's error ApiRequestError", async () => {
    server.use(
      http.get("/api/lists", () => new HttpResponse("<html>", { status: 502 })),
    );

    await expect(getLists()).rejects.toMatchObject({ name: "ApiRequestError" });
  });
});
