// Tests for graphify-guard.ts. Run with: pnpm test
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";

const script = fileURLToPath(new URL("./graphify-guard.ts", import.meta.url));
const ignoreFile = `# keep docs out of the graph
docs/
*.md
*.mdx
*.pdf
*.txt
`;

let repo: string;
let gitOnlyBin: string;
let tool: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "graphify-guard-"));
  spawnSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(join(repo, ".graphifyignore"), ignoreFile);
  for (const file of ["docs/a.md", "README.md", "apps/x.ts"]) {
    mkdirSync(join(repo, file, ".."), { recursive: true });
    writeFileSync(join(repo, file), "");
  }
  mkdirSync(join(repo, "bin"));
  writeFileSync(join(repo, "bin/graphify"), '#!/bin/sh\necho "stub $*"\ncat\n');
  chmodSync(join(repo, "bin/graphify"), 0o755);

  // A PATH holding only git, so a graphify installed on the machine is not found.
  gitOnlyBin = join(repo, "git-only");
  mkdirSync(gitOnlyBin);
  const git = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" });
  symlinkSync(git.stdout.trim(), join(gitOnlyBin, "git"));
  tool = process.env.PATH ?? "";
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

const input = (name: string, toolInput: object, cwd = repo) =>
  JSON.stringify({ tool_name: name, tool_input: toolInput, cwd });

const run = (kind: string, stdin: string, path = `${repo}/bin:${tool}`) =>
  spawnSync(process.execPath, [script, kind], {
    input: stdin,
    cwd: repo,
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, PATH: path },
    encoding: "utf8",
  });

const skipped: [name: string, kind: string, stdin: () => string][] = [
  [
    "Read of docs/a.md",
    "read",
    () => input("Read", { file_path: `${repo}/docs/a.md` }),
  ],
  [
    "Read of README.md",
    "read",
    () => input("Read", { file_path: `${repo}/README.md` }),
  ],
  // Outside the project, git check-ignore exits 128: nothing is shown.
  [
    "Read outside the project",
    "read",
    () => input("Read", { file_path: "/tmp/x.ts" }),
  ],
  [
    "Grep in docs",
    "search",
    () => input("Grep", { pattern: "x", path: "docs" }),
  ],
  [
    "Grep with a docs glob, no path",
    "search",
    () => input("Grep", { pattern: "x", glob: "*.md" }),
  ],
  ["Glob of markdown", "read", () => input("Glob", { pattern: "**/*.md" })],
  [
    "Glob of ts inside docs",
    "read",
    () => input("Glob", { path: "docs", pattern: "**/*.ts" }),
  ],
  [
    "Bash grep in docs",
    "search",
    () => input("Bash", { command: "grep -rn x docs" }),
  ],
  [
    "Bash in a subfolder",
    "search",
    () => input("Bash", { command: "cat a.md" }, `${repo}/docs`),
  ],
  ["Invalid JSON", "read", () => "not json"],
];

const passed: [name: string, kind: string, stdin: () => string][] = [
  [
    "Read of apps/x.ts",
    "read",
    () => input("Read", { file_path: `${repo}/apps/x.ts` }),
  ],
  ["Grep with no path", "search", () => input("Grep", { pattern: "x" })],
  [
    "Bash grep in apps",
    "search",
    () => input("Bash", { command: "grep -rn x apps" }),
  ],
  [
    "Bash with no existing path",
    "search",
    () => input("Bash", { command: "pnpm test" }),
  ],
];

test.each(skipped)("skips graphify: %s", (_name, kind, stdin) => {
  const result = run(kind, stdin());
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
});

test.each(passed)("passes to graphify: %s", (_name, kind, stdin) => {
  const body = stdin();
  const result = run(kind, body);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(`stub hook-guard ${kind}`);
  expect(result.stdout).toContain(body);
});

test("graphify missing: no output, exit 0", () => {
  const result = run(
    "read",
    input("Read", { file_path: `${repo}/apps/x.ts` }),
    gitOnlyBin,
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
});
