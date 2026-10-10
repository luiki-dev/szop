import type { LogStream } from "../app.ts";

export type LogLine = Record<string, unknown>;

// An in-memory log for one app: pass `stream` to buildApp as logStream, and
// read what was logged with `lines()`. The app must log at "info" or below.
export function captureLog(): { stream: LogStream; lines(): LogLine[] } {
  const written: string[] = [];
  return {
    stream: {
      write(line: string): void {
        written.push(line);
      },
    },
    lines(): LogLine[] {
      return written.map((line) => JSON.parse(line) as LogLine);
    },
  };
}
