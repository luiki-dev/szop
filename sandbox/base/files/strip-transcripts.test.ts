// Tests for strip-transcripts.py (PH-49, ADR 0076). Run with: pnpm test --project scripts
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const strip = join(here, "strip-transcripts.py");
const tokenUsage = join(here, "../../../scripts/token-usage.py");
const fixture = join(here, "fixtures/projects");
const mainSession = "-home-x-szop/11111111-1111-4111-8111-111111111111.jsonl";

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort();
}

function run(src: string, dest: string) {
  return spawnSync("python3", [strip, src, dest], { encoding: "utf8" });
}

function stripped(): string {
  const dest = join(mkdtempSync(join(tmpdir(), "strip-")), "copy");
  const result = run(fixture, dest);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return dest;
}

function report(projects: string): string {
  const result = spawnSync(
    "python3",
    [tokenUsage, "--projects", projects, "--usage-log", "/nonexistent"],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(0);
  return result.stdout.replaceAll(projects, "<projects>");
}

test("token-usage.py gives the same report on the copy as on the original", () => {
  expect(report(stripped())).toBe(report(fixture));
});

test("the copy holds none of the message text", () => {
  const dest = stripped();
  for (const f of files(dest)) {
    expect(readFileSync(join(dest, f), "utf8")).not.toContain(
      "FIXTURE-SECRET-TEXT",
    );
  }
});

test("the copy keeps the folders and file names", () => {
  expect(files(stripped())).toEqual(files(fixture));
});

test("a cut last line is skipped", () => {
  const dest = stripped();
  const lines = (path: string) =>
    readFileSync(path, "utf8").split("\n").filter(Boolean).length;
  expect(lines(join(dest, mainSession))).toBe(
    lines(join(fixture, mainSession)) - 1,
  );
});

test("an unchanged source is not rewritten", () => {
  const src = join(mkdtempSync(join(tmpdir(), "strip-src-")), "projects");
  cpSync(fixture, src, { recursive: true });
  const dest = join(mkdtempSync(join(tmpdir(), "strip-")), "copy");
  const copy = join(dest, mainSession);

  expect(run(src, dest).status).toBe(0);
  // Age the copy, so a rewrite would show as a new mtime.
  utimesSync(copy, 1_000_000, 1_000_000);
  utimesSync(join(src, mainSession), 1_000_000, 1_000_000);
  expect(run(src, dest).status).toBe(0);
  expect(statSync(copy).mtimeMs).toBe(1_000_000_000);

  writeFileSync(
    join(src, mainSession),
    readFileSync(join(src, mainSession), "utf8") + "\n",
  );
  expect(run(src, dest).status).toBe(0);
  expect(statSync(copy).mtimeMs).not.toBe(1_000_000_000);
});
