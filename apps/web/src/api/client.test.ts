import { delay, http, HttpResponse, type JsonBodyType } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { server } from "../test/server.ts";
import { threeLists } from "../test/lists.ts";
import {
  ApiRequestError,
  createList,
  deleteList,
  deleteLists,
  getCatalog,
  getHealth,
  getList,
  getLists,
  renameList,
  timeLimit,
  timeoutMessage,
} from "./client.ts";

describe("getHealth", () => {
  it("names the status it did not expect", async () => {
    server.use(
      http.get("/api/health", () => new HttpResponse(null, { status: 500 })),
    );

    await expect(getHealth()).rejects.toThrow("GET /api/health answered 500");
  });
});

describe("APP-5.2: IDs in a path", () => {
  it("are encoded, so no caller can reach another API path", async () => {
    const paths: string[] = [];
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.all("/api/lists/*", ({ request }) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return new HttpResponse(null, { status: 404 });
      }),
    );

    await getList("a/b").catch(() => undefined);
    await renameList("../x", "N").catch(() => undefined);
    await deleteList("a?b").catch(() => undefined);

    expect(paths).toEqual([
      "GET /api/lists/a%2Fb",
      "PATCH /api/lists/..%2Fx",
      "DELETE /api/lists/a%3Fb",
    ]);
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

  it("OP-116: a write with a session sends one request", async () => {
    const calls = stubApi({ session: { id: "s" } });

    await expect(createList(newList)).resolves.toEqual(party);

    expect(calls).toEqual(["POST /api/lists"]);
  });

  it("OP-116: a 401 signs in once and sends the write once more", async () => {
    const calls = stubApi(null, [401, 201]);

    await expect(createList(newList)).resolves.toEqual(party);

    expect(calls).toEqual([
      "POST /api/lists",
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("signs in when the session answer is not JSON", async () => {
    const calls = stubApi(null, [401, 201]);
    server.use(
      http.get("/api/auth/get-session", () => {
        calls.push("GET /api/auth/get-session");
        return new HttpResponse("<html>", { status: 200 });
      }),
    );

    await createList(newList);

    expect(calls).toEqual([
      "POST /api/lists",
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("signs in when get-session fails with a JSON body", async () => {
    const calls = stubApi(null, [401, 201]);
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
      "POST /api/lists",
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/anonymous",
      "POST /api/lists",
    ]);
  });

  it("OP-116: a second 401 is an error with no third try", async () => {
    const calls = stubApi(null, [401]);

    await expect(createList(newList)).rejects.toMatchObject({
      status: 401,
      message: "Sign in",
    });

    expect(calls.filter((call) => call === "POST /api/lists")).toHaveLength(2);
  });

  it("fails when the anonymous sign-in is refused", async () => {
    stubApi(null, [401]);
    server.use(
      http.post(
        "/api/auth/sign-in/anonymous",
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    await expect(createList(newList)).rejects.toThrow(
      "POST /api/auth/sign-in/anonymous answered 429",
    );
  });

  describe("with locks", () => {
    // A navigator.locks that runs the callbacks one after another.
    let chain: Promise<unknown> = Promise.resolve();
    beforeEach(() => {
      chain = Promise.resolve();
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: {
          request: (
            _name: string,
            _options: unknown,
            callback: () => Promise<unknown>,
          ) => {
            const run = chain.then(callback);
            chain = run.catch(() => undefined);
            return run;
          },
        },
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(navigator, "locks");
    });

    it("ACC-1.6: two sign-ins that meet make one sign-in request", async () => {
      const calls: string[] = [];
      let signedIn = false;
      server.use(
        http.get("/api/auth/get-session", () =>
          HttpResponse.json(signedIn ? { session: {} } : null),
        ),
        http.post("/api/auth/sign-in/anonymous", () => {
          calls.push("POST /api/auth/sign-in/anonymous");
          signedIn = true;
          return HttpResponse.json({ ok: true });
        }),
        http.post("/api/lists", () =>
          signedIn
            ? HttpResponse.json(party, { status: 201 })
            : HttpResponse.json(
                { error: { code: "unauthorized", message: "Sign in" } },
                { status: 401 },
              ),
        ),
      );

      await expect(
        Promise.all([
          createList(newList),
          createList({ ...newList, id: "other-id" }),
        ]),
      ).resolves.toHaveLength(2);

      expect(calls).toEqual(["POST /api/auth/sign-in/anonymous"]);
    });

    it("a failed sign-in releases the lock for the next change", async () => {
      let signIns = 0;
      server.use(
        http.get("/api/auth/get-session", () => HttpResponse.json(null)),
        http.post("/api/auth/sign-in/anonymous", () =>
          ++signIns === 1
            ? new HttpResponse(null, { status: 500 })
            : HttpResponse.json({ ok: true }),
        ),
        http.post("/api/lists", () =>
          signIns < 2
            ? HttpResponse.json(
                { error: { code: "unauthorized", message: "Sign in" } },
                { status: 401 },
              )
            : HttpResponse.json(party, { status: 201 }),
        ),
      );

      await expect(createList(newList)).rejects.toThrow();
      await expect(createList(newList)).resolves.toEqual(party);
    });
  });

  describe("NET-1.4: the time limit", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("NET-1.4: a read with no answer fails after the limit", async () => {
      server.use(http.get("/api/lists", () => delay("infinite")));
      const result = getLists().catch((error: unknown) => error);
      let settled = false;
      void result.then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(timeLimit - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await result).toEqual(new Error(timeoutMessage));
    });

    it("NET-1.4: the limit covers the whole change", async () => {
      server.use(
        http.post("/api/lists", async () => {
          await delay(6_000);
          return HttpResponse.json(
            { error: { code: "unauthorized", message: "Sign in" } },
            { status: 401 },
          );
        }),
        http.get("/api/auth/get-session", () => HttpResponse.json(null)),
        http.post("/api/auth/sign-in/anonymous", () => delay("infinite")),
      );
      const result = createList(newList).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(timeLimit);

      expect(await result).toEqual(new Error(timeoutMessage));
    });
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

  it("deletes one list with a DELETE that carries no body or JSON type", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.delete(`/api/lists/${party?.id ?? ""}`, ({ request }) => {
        seen.push(request.headers.get("content-type"));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteList(party?.id ?? "")).resolves.toBeUndefined();
    expect(seen).toEqual([null]);
  });

  it("deletes several lists with POST /api/lists/delete and their IDs", async () => {
    let body: unknown;
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.post("/api/lists/delete", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteLists(["a", "b"])).resolves.toBeUndefined();
    expect(body).toEqual({ ids: ["a", "b"] });
  });

  it("rejects a failed delete with ApiRequestError", async () => {
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.delete(
        "/api/lists/x",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(deleteList("x")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("names the method and path of a failed delete", async () => {
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.delete(
        "/api/lists/x",
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.post(
        "/api/lists/delete",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(deleteList("x")).rejects.toThrow(
      "DELETE /api/lists/x answered 500",
    );
    await expect(deleteLists(["a"])).rejects.toThrow(
      "POST /api/lists/delete answered 500",
    );
  });

  it("names a failed request's error ApiRequestError", async () => {
    server.use(
      http.get("/api/lists", () => new HttpResponse("<html>", { status: 502 })),
    );

    await expect(getLists()).rejects.toMatchObject({ name: "ApiRequestError" });
  });
});
