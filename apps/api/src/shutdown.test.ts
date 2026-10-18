import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startShutdownDeadline } from "./shutdown.ts";

describe("startShutdownDeadline", () => {
  const server = {
    getConnections: vi.fn(
      (callback: (error: Error | null, count: number) => void) => {
        callback(null, 2);
        // Node's returns the server itself, for chaining.
        return server as unknown as Server;
      },
    ),
    closeAllConnections: vi.fn(),
  };
  const log = { warn: vi.fn(), error: vi.fn() };
  const exit = vi.fn();

  function start(): void {
    startShutdownDeadline({
      server,
      log,
      deadlineMs: 10_000,
      graceMs: 5_000,
      exit,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does nothing before the deadline", () => {
    start();

    vi.advanceTimersByTime(9_999);

    expect(log.warn).not.toHaveBeenCalled();
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("closes the open connections at the deadline", () => {
    start();

    vi.advanceTimersByTime(10_000);

    expect(log.warn).toHaveBeenCalledWith(
      { openConnections: 2 },
      "shutdown deadline reached, closing connections",
    );
    expect(server.closeAllConnections).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits with code 1 when the shutdown still has not finished", () => {
    start();

    vi.advanceTimersByTime(15_000);

    expect(log.error).toHaveBeenCalledWith("shutdown did not finish, exiting");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("never keeps the process alive by itself", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    start();

    vi.advanceTimersByTime(10_000);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    for (const { value } of setTimeoutSpy.mock.results) {
      expect((value as NodeJS.Timeout).hasRef()).toBe(false);
    }
  });
});
