import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBreached } from "./breach.ts";

const password = "correct horse battery";
const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
const prefix = hash.slice(0, 5);
const suffix = hash.slice(5);

function setup(fetchFn: typeof fetch) {
  const lines: unknown[][] = [];
  const log = { warn: (...args: unknown[]) => lines.push(args) };
  return { lines, run: () => isBreached(password, log, fetchFn) };
}

const answer = (text: string, status = 200) =>
  vi.fn(() => Promise.resolve(new Response(text, { status })));

afterEach(() => {
  vi.useRealTimers();
});

describe("isBreached", () => {
  it("found: a line with a count, asked by the prefix with padding", async () => {
    const fetchFn = answer(
      `0000000000000000000000000000000000A:1\r\n${suffix}:3\r\n`,
    );
    const { run, lines } = setup(fetchFn);
    expect(await run()).toBe(true);
    expect(lines).toHaveLength(0);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(init.headers).toEqual({ "Add-Padding": "true" });
  });

  it("not found", async () => {
    expect(
      await setup(answer("0000000000000000000000000000000000A:2")).run(),
    ).toBe(false);
  });

  it("a padding line with a count of 0 is not a match", async () => {
    expect(await setup(answer(`${suffix}:0`)).run()).toBe(false);
  });

  const failures: [string, typeof fetch][] = [
    ["an error status", answer("nope", 503)],
    [
      "an unreadable body",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.reject(new Error("broken")),
        } as unknown as Response),
      ),
    ],
  ];
  for (const [name, fetchFn] of failures) {
    it(`${name} accepts, with one warning that holds no secret`, async () => {
      const { run, lines } = setup(fetchFn);
      expect(await run()).toBe(false);
      expect(lines).toHaveLength(1);
      const text = JSON.stringify(lines[0]);
      for (const secret of [password, hash, prefix]) {
        expect(text).not.toContain(secret);
      }
    });
  }

  it("a timeout accepts after 3000 ms, with one warning", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    ) as unknown as typeof fetch;
    const { run, lines } = setup(fetchFn);
    const result = run();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBe(false);
    expect(lines).toHaveLength(1);
  });
});
