// Claude Code PreToolUse hook: runs graphify's own guard only for paths in the graph.
//
// graphify's `hook-guard` nudges Claude toward the code map before a search or a
// read. The map is code only (.graphifyignore leaves docs/ and markdown out), so
// the nudge is noise when every path the call touches is ignored. This wrapper
// skips graphify then and otherwise passes the call through. ADR 0056, decisions
// 5 and 6 (docs/decisions/0056-claude-code-tooling.md).
//
// Usage: graphify-guard.ts <search|read>. Input: the tool call as JSON on stdin.
// Output: graphify's stdout, or nothing. It fails open: graphify missing, git
// failing, bad JSON or any other error gives no output and exit 0. It never
// blocks a tool call (no exit 2).
//
// It imports only node: modules, so it runs before `pnpm install`, and Node runs
// it directly by stripping the types (ADR 0016).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseSegments } from "./guard-git-push.ts";

interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    path?: string;
    pattern?: string;
    glob?: string;
    command?: string;
  };
  cwd?: string;
}

// The paths a tool call touches. A pattern or glob only narrows a path, so it
// counts only when there is no path.
function pathsOf(input: HookInput, cwd: string): string[] {
  const toolInput = input.tool_input ?? {};
  switch (input.tool_name) {
    case "Read":
      return toolInput.file_path ? [toolInput.file_path] : [];
    case "Glob":
      return [toolInput.path ?? toolInput.pattern ?? ""].filter(Boolean);
    case "Grep":
      return [toolInput.path ?? toolInput.glob ?? ""].filter(Boolean);
    case "Bash":
      return parseSegments(toolInput.command ?? "")
        .flat()
        .filter((word) => existsSync(resolve(cwd, word)));
    default:
      return [];
  }
}

if (import.meta.main) {
  try {
    const kind = process.argv[2] ?? "";
    const stdin = readFileSync(0, "utf8");
    const input = JSON.parse(stdin) as HookInput;
    const cwd = input.cwd ?? process.cwd();
    const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const paths = pathsOf(input, cwd).map(
      (path) => relative(projectDir, resolve(cwd, path)) || ".",
    );

    if (paths.length > 0) {
      const check = spawnSync(
        "git",
        [
          "-c",
          "core.excludesFile=.graphifyignore",
          "check-ignore",
          "--no-index",
          "--",
          ...paths,
        ],
        { cwd: projectDir, encoding: "utf8" },
      );
      // Exit 1: no path is ignored, so go on. Any other failure (128 for a path
      // outside the project, git missing): stay silent.
      if (check.status !== 0 && check.status !== 1) process.exit(0);
      const ignored = check.stdout.split("\n").filter(Boolean).length;
      if (check.status === 0 && ignored === paths.length) process.exit(0);
    }

    const graphify = spawnSync("graphify", ["hook-guard", kind], {
      input: stdin,
      encoding: "utf8",
    });
    if (!graphify.error) process.stdout.write(graphify.stdout);
  } catch {
    // Fail open.
  }
}
