// Tests for claude-backup.sh (PH-49, ADR 0076). Run with: pnpm test --project scripts
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, test } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const hook = join(here, "claude-backup.sh");
const fixture = join(here, "fixtures/projects");

let home: string;
let bare: string;
let clone: string;
let env: NodeJS.ProcessEnv;

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function backup(mode: string, extra: NodeJS.ProcessEnv = {}) {
  const result = spawnSync("bash", [hook, mode], {
    env: { ...env, ...extra },
    encoding: "utf8",
  });
  return {
    status: result.status,
    lines: result.stdout.split("\n").filter(Boolean),
  };
}

function onMain(path: string): string {
  return git(bare, "show", `main:${path}`);
}

function filesOnMain(): string[] {
  return git(bare, "ls-tree", "-r", "--name-only", "main")
    .split("\n")
    .filter(Boolean);
}

function write(path: string, content: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claude-backup-"));
  env = {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
  };
  write(
    join(home, ".gitconfig"),
    "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n",
  );
  cpSync(fixture, join(home, ".claude/projects"), { recursive: true });
  write(join(home, ".claude/projects/-home-x-szop/.env"), "TOKEN=x\n");
  write(join(home, ".claude/usage-log.csv"), "timestamp,session\n1,a\n");
  write(join(home, ".claude/.credentials.json"), '{"token":"x"}');
  write(join(home, ".claude/settings.json"), "{}");

  bare = join(home, "remote.git");
  git(home, "init", "-q", "--bare", bare);
  const seed = join(home, "seed");
  git(home, "clone", "-q", bare, seed);
  write(join(seed, "README.md"), "config\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "init");
  git(seed, "push", "-q", "origin", "main");
  clone = join(home, "claude-config");
  git(home, "clone", "-q", bare, clone);
});

test("start pulls memory written in the other environment", () => {
  const other = join(home, "other");
  git(home, "clone", "-q", bare, other);
  write(join(other, "memory/szop/a.md"), "remembered\n");
  git(other, "add", ".");
  git(other, "commit", "-q", "-m", "memory");
  git(other, "push", "-q");

  expect(backup("start")).toEqual({ status: 0, lines: [] });
  expect(readFileSync(join(clone, "memory/szop/a.md"), "utf8")).toBe(
    "remembered\n",
  );
});

test("end pushes the stripped transcripts and the usage log", () => {
  expect(backup("end")).toEqual({ status: 0, lines: [] });
  expect(filesOnMain()).toContain(
    "transcripts/wsl/-home-x-szop/11111111-1111-4111-8111-111111111111.jsonl",
  );
  expect(onMain("usage-log/wsl.csv")).toBe("timestamp,session\n1,a\n");
});

test("end on WSL never writes user/", () => {
  write(join(home, ".claude/owner-CLAUDE.md"), "# mine\n");
  write(join(home, ".claude/statusline-command.sh"), "echo hi\n");
  backup("end");
  expect(filesOnMain().filter((f) => f.startsWith("user/"))).toEqual([]);
});

test("end in the sandbox writes user/ without the kit's keys or hooks", () => {
  const kit = join(home, ".claude/kit-settings.json");
  write(kit, JSON.stringify({ a: 1, hooks: { SessionEnd: [] } }));
  write(
    join(home, ".claude/settings.json"),
    JSON.stringify({ a: 1, model: "x", hooks: { SessionStart: [] } }),
  );
  write(join(home, ".claude/owner-CLAUDE.md"), "# mine\n");
  write(join(home, ".claude/statusline-command.sh"), "echo hi\n");

  expect(
    backup("end", { CLAUDE_BACKUP_ENV: "sandbox", CLAUDE_KIT_SETTINGS: kit }),
  ).toEqual({ status: 0, lines: [] });
  expect(JSON.parse(onMain("user/settings.json"))).toEqual({ model: "x" });
  expect(onMain("user/CLAUDE.md")).toBe("# mine\n");
  expect(onMain("user/statusline-command.sh")).toBe("echo hi\n");
  expect(filesOnMain()).toContain(
    "transcripts/sandbox/-home-x-szop/11111111-1111-4111-8111-111111111111.jsonl",
  );
});

test("no credential reaches the repository", () => {
  backup("end", { CLAUDE_BACKUP_ENV: "sandbox" });
  const names = filesOnMain().map((f) => f.split("/").pop());
  expect(names).not.toContain(".credentials.json");
  expect(names.filter((n) => n?.startsWith(".env"))).toEqual([]);
});

test("with no network it prints one line and exits 0", () => {
  git(clone, "remote", "set-url", "origin", "/nonexistent.git");
  for (const mode of ["start", "end"]) {
    const { status, lines } = backup(mode);
    expect(status).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^claude-backup: .*nonexistent/);
  }
});

test("a backup that failed earlier is pushed by the next", () => {
  git(clone, "remote", "set-url", "origin", "/nonexistent.git");
  backup("end");
  git(clone, "remote", "set-url", "origin", bare);
  write(join(home, ".claude/usage-log.csv"), "timestamp,session\n1,a\n2,a\n");

  expect(backup("end")).toEqual({ status: 0, lines: [] });
  const subjects = git(bare, "log", "main", "--format=%s").split("\n");
  expect(subjects.filter((s) => s.startsWith("backup(wsl): "))).toHaveLength(2);
});

test("a conflict keeps both versions", () => {
  const second = join(home, "second");
  git(home, "clone", "-q", bare, second);
  write(join(clone, "memory/szop/MEMORY.md"), "first\n");
  expect(backup("end").lines).toEqual([]);
  write(join(second, "memory/szop/MEMORY.md"), "second\n");

  const { status, lines } = backup("end", { CLAUDE_CONFIG_REPO: second });
  expect(status).toBe(0);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^claude-backup: .*conflict\/wsl-\d{8}T\d{6}Z/);
  expect(onMain("memory/szop/MEMORY.md")).toBe("first\n");
  const branch = /conflict\/wsl-\d{8}T\d{6}Z/.exec(lines[0] ?? "")?.[0] ?? "";
  expect(git(bare, "show", `${branch}:memory/szop/MEMORY.md`)).toBe("second\n");
  expect(git(second, "status", "--porcelain")).toBe("");
  expect(git(second, "branch", "--show-current").trim()).toBe("main");
  expect(existsSync(join(second, ".git/rebase-merge"))).toBe(false);
});

test("a second backup running at once exits", () => {
  const lock = join(clone, ".git/claude-backup.lock");
  const result = spawnSync("flock", [lock, "bash", hook, "end"], {
    env,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  const lines = result.stdout.split("\n").filter(Boolean);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^claude-backup: .*already running/);
  expect(filesOnMain()).toEqual(["README.md"]);
});
