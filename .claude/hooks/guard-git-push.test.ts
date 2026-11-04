// Tests for guard-git-push.ts. Run with: pnpm test
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { findViolation } from "./guard-git-push.ts";

const allowed: string[] = [
  "git push",
  "git push -u origin feat/shopping-lists",
  "git push --set-upstream origin docs/adr-0015",
  "git push origin HEAD",
  "git push origin feat/a:feat/a",
  "git push -n -h",
  "git push -o ci.skip origin feat/x",
  "git push --no-force-with-lease origin feat/x",
  "git status && git log -1",
  "git pull --prune",
  "git fetch -f",
  'echo "git push -f"',
  "ls -d dir",
  'echo "\\\\+x"',
  "time git status",
  "env FOO=1 git log",
  "git -c alias.st=status st",
  "(cd x && git push -u origin feat/x)",
  "echo a \\\n  b\ngit status",
  "env -u X git status",
];

const blocked: [command: string, reason: string][] = [
  ["git push -f", "force"],
  ["git push --force origin feat/x", "force"],
  ["git push --force-with-lease origin feat/x", "force"],
  ["git push -uf origin feat/x", "force"],
  ["git push origin +feat/x", "force"],
  ['git push origin "+HEAD:feat/x"', "force"],
  ["git push --mirror origin", "mirror"],
  ["git push -d origin feat/x", "delete"],
  ["git push -ud origin feat/x", "delete"],
  ["git push --delete origin feat/x", "delete"],
  ["git push origin :feat/x", "delete"],
  ["git push --prune origin", "prune"],
  ["git push --tags", "tags"],
  ["git push --follow-tags origin feat/x", "tags"],
  ["git -C . push -f", "force"],
  ["git -c push.default=current push --force", "force"],
  ["GIT_TRACE=1 git push -f", "force"],
  ["git status && git push -f", "force"],
  ["git add . ; git push origin :feat/x", "delete"],
  ["true || git push --tags", "tags"],
  ["git push -- origin :feat/x", "delete"],
  ["git push origin \\+main", "force"],
  ["git push \\-f", "force"],
  ["git push $'-f'", "force"],
  ["env git push -f", "force"],
  ["env -i FOO=1 git push -f", "force"],
  ["env -u NAME git push -f", "force"],
  ["command git push -f", "force"],
  ["time git push -f", "force"],
  ["nohup git push -f", "force"],
  ["xargs git push -f", "force"],
  ["xargs -n1 git push -f", "force"],
  ["xargs -I {} git push -f", "force"],
  ["(git push -f)", "force"],
  ["{ git push -f; }", "force"],
  ["if true; then git push -f; fi", "force"],
  ["while x; do git push -f; done", "force"],
  ["! git push -f", "force"],
  ["git \\\n push -f", "force"],
  ["env FOO=1 \\\n git push -f", "force"],
  ["env -S 'git push -f'", "env -S"],
  ["env --split-string='git push -f'", "env -S"],
  ["env --chdir d git push -f", "force"],
  ["xargs -a f git push -f", "force"],
  ["git -c alias.p=push p -f", "alias"],
  ["git -c 'alias.p=!git push -f' p", "alias"],
];

test.each(allowed)("allows: %s", (command) => {
  expect(findViolation(command)).toBeNull();
});

test.each(blocked)("blocks: %s", (command, reason) => {
  expect(findViolation(command)).toMatch(reason);
});

const script = fileURLToPath(new URL("./guard-git-push.ts", import.meta.url));
const runHook = (command: string) =>
  spawnSync("node", [script], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });

test("hook exits 2 with the reason on stderr for a blocked push", () => {
  const result = runHook("git push -uf origin feat/x");
  expect(result.status).toBe(2);
  expect(result.stderr).toMatch(/force/);
});

test("hook exits 0 for an allowed command", () => {
  const result = runHook("git push -u origin feat/x");
  expect(result.status).toBe(0);
});
