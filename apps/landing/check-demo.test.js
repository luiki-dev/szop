import { describe, expect, it, vi } from "vitest";
import { checkDemo } from "./check-demo.js";

const URL = "https://szop.dzwoniec.com/api/health";

describe("checkDemo", () => {
  it("is up when the request is answered, whatever the answer", async () => {
    let calls = 0;
    /** @type {string | URL | Request | undefined} */
    let sentUrl;
    /** @type {RequestInit | undefined} */
    let sentInit;
    /** @type {typeof fetch} */
    const fetchFn = (input, init) => {
      calls += 1;
      sentUrl = input;
      sentInit = init;
      return Promise.resolve(new Response());
    };

    expect(await checkDemo(fetchFn, URL, 5000)).toBe("up");

    expect(calls).toBe(1);
    expect(sentUrl).toBe(URL);
    // no-cors: the demo sends no CORS headers; no-store: every check asks the
    // network, not the cache.
    expect(sentInit?.mode).toBe("no-cors");
    expect(sentInit?.cache).toBe("no-store");
    expect(sentInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("is down when the request fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await checkDemo(fetchFn, URL, 5000)).toBe("down");
  });

  it("is down when the request outlives the timeout", async () => {
    // Settles only when its signal aborts, like a host that accepts the
    // connection and never answers.
    /** @type {typeof fetch} */
    const hangingFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("The operation was aborted"));
        });
      });

    expect(await checkDemo(hangingFetch, URL, 20)).toBe("down");
  });
});
