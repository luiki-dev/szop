// Tests for token-usage.py's default --projects (PH-49, ADR 0076). Run with: pnpm test --project scripts
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const repo = fileURLToPath(new URL("..", import.meta.url));
const script = join(repo, "scripts/token-usage.py");
const fixture = join(repo, "sandbox/base/files/fixtures/projects/-home-x-szop");

test("the default --projects comes from the repository's root", () => {
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repo,
    encoding: "utf8",
  }).stdout.trim();
  const home = mkdtempSync(join(tmpdir(), "token-usage-"));
  cpSync(
    fixture,
    join(home, ".claude/projects", root.replace(/[^A-Za-z0-9]/g, "-")),
    { recursive: true },
  );

  const result = spawnSync("python3", [script], {
    cwd: repo,
    env: { ...process.env, HOME: home },
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Sessions: 1 main, 1 subagent transcripts");
});

test("outside a git repository it names --projects", () => {
  const result = spawnSync("python3", [script], {
    cwd: mkdtempSync(join(tmpdir(), "token-usage-")),
    encoding: "utf8",
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("--projects");
});

test("a call in two transcripts goes to the same session whatever the order on disk", () => {
  const call = (branch: string) =>
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-11-01T10:00:00Z",
      requestId: "req_1",
      gitBranch: branch,
      message: {
        id: "msg_1",
        model: "claude-opus-4-5",
        usage: {
          input_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 1,
        },
      },
    }) + "\n";
  const sessions = { "a.jsonl": "feat/ph-01-a", "b.jsonl": "feat/ph-02-b" };
  const reports = [false, true].map((reversed) => {
    const dir = mkdtempSync(join(tmpdir(), "token-usage-"));
    const names = Object.keys(sessions) as (keyof typeof sessions)[];
    for (const name of reversed ? names.reverse() : names) {
      writeFileSync(join(dir, name), call(sessions[name]));
    }
    return spawnSync(
      "python3",
      [script, "--by-phase", "--projects", dir, "--usage-log", "/nonexistent"],
      { encoding: "utf8" },
    ).stdout;
  });
  expect(reports[0]).toContain("| PH-01 |");
  expect(reports[1]).toBe(reports[0]);
});
