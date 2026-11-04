// Claude Code PreToolUse hook: refuses git pushes that force, delete or push tags.
//
// It also sees through backslash escapes and $'...' quoting, wrappers (env,
// command, time, nohup, xargs), subshells and braces, shell keywords (if, then,
// do, !) and `git -c alias.x=...push...`. Still a seatbelt, not a boundary
// (ADR 0065).
//
// It backs the deny rules in .claude/settings.json where a pattern cannot reach:
// a `+branch` or `:branch` refspec, bundled short flags (`-uf`, `-ud`), `--mirror`,
// `--prune`, `--follow-tags` and `git -C dir push`. Like the deny rules, it guards
// against mistakes, not against a determined attacker; GitHub's rulesets are the
// real boundary. ADR 0015 (docs/decisions/0015-git-push-guard-hook.md).
//
// Input: the tool call as JSON on stdin. Exit 2 blocks the command and shows
// stderr to Claude; exit 0 leaves the decision to the permission rules.
//
// It imports only node: modules, so it runs before `pnpm install`, and Node runs
// it directly by stripping the types (ADR 0016).

import { readFileSync } from "node:fs";

interface HookInput {
  tool_input?: { command?: string };
}

// git's own options that take their value as the next word (`git -C dir push`).
const GIT_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
]);

// Words that start a command without being one: skipped at the start of a segment.
const KEYWORDS = new Set([
  "if",
  "then",
  "do",
  "else",
  "elif",
  "while",
  "until",
  "!",
  "{",
  "}",
]);

// Wrappers that run the rest of the line as a command, with the options that
// take their value as the next word.
const WRAPPERS: Record<string, Set<string>> = {
  env: new Set(["-u", "--unset", "-C", "--chdir"]),
  xargs: new Set([
    "-I",
    "-n",
    "-L",
    "-P",
    "-d",
    "-E",
    "-s",
    "-a",
    "--arg-file",
  ]),
  command: new Set(),
  time: new Set(),
  nohup: new Set(),
};

// Splits a shell command into segments (at ; & | ( ) and newlines) of words,
// honouring quotes and backslash escapes (including $'...'). Subshells and
// expansions are not interpreted.
export function parseSegments(command: string): string[][] {
  const segments: string[][] = [];
  let words: string[] = [];
  let word: string | null = null;
  let quote: string | null = null; // ', ", or $ for $'...'
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    segments.push(words);
    words = [];
  };
  const chars = Array.from(command);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] as string;
    const next = chars[i + 1] ?? "";
    if (quote === "'") {
      if (char === "'") quote = null;
      else word = (word ?? "") + char;
    } else if (quote === "$") {
      if (char === "'") quote = null;
      else if (char === "\\") word = (word ?? "") + (chars[++i] ?? "");
      else word = (word ?? "") + char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "\\" && next === "\n")
        i++; // line continuation
      else if (char === "\\" && '"\\$`'.includes(next) && next) {
        word = (word ?? "") + next;
        i++;
      } else word = (word ?? "") + char;
    } else if (char === "\\" && next === "\n") {
      i++; // line continuation: bash removes both characters
    } else if (char === "\\") {
      word = (word ?? "") + (chars[++i] ?? "");
    } else if (char === "$" && next === "'") {
      // shortcut: $'…' decodes only single-character escapes (not \xHH or \NNN) and $"…" is not handled; upgrade if a real bypass shows up.
      quote = "$";
      word ??= "";
      i++;
    } else if (char === '"' || char === "'") {
      quote = char;
      word ??= "";
    } else if (";&|()\n".includes(char)) {
      endSegment();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word = (word ?? "") + char;
    }
  }
  endSegment();
  return segments;
}

const isAssignment = (word: string | undefined) =>
  /^[A-Za-z_][A-Za-z0-9_]*=/.test(word ?? "");

// Returns the words after `push` if the segment runs `git push`, a reason if it
// sets a git alias that pushes, otherwise null.
function pushArguments(words: string[]): string[] | string | null {
  let i = 0;
  for (;;) {
    const word = words[i] ?? "";
    const wrapper = WRAPPERS[word.split("/").pop() ?? ""];
    if (isAssignment(word) || KEYWORDS.has(word)) {
      i++;
    } else if (wrapper) {
      i++;
      while (words[i]?.startsWith("-") || isAssignment(words[i])) {
        // env -S splits a string into a command and its arguments: not followed.
        if (
          word === "env" &&
          /^(-[^-]*S|--split-string)/.test(words[i] ?? "")
        ) {
          return "env -S runs a command the hook cannot read and can bypass the push checks";
        }
        i += wrapper.has(words[i] as string) ? 2 : 1;
      }
    } else break;
  }
  const git = words[i];
  if (git !== "git" && !git?.endsWith("/git")) return null;
  i++;
  for (let option = words[i]; option?.startsWith("-"); option = words[i]) {
    const config = option === "-c" ? words[i + 1] : option.slice(2);
    if (option.startsWith("-c") && /^alias\..*=.*push/.test(config ?? "")) {
      return `a git alias that pushes (${config ?? ""}) can bypass the push checks`;
    }
    i += GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
  }
  return words[i] === "push" ? words.slice(i + 1) : null;
}

function checkPushArguments(args: string[]): string | null {
  let optionsEnded = false;
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
    } else if (optionsEnded || !arg.startsWith("-")) {
      if (arg.startsWith("+")) return `a "${arg}" refspec force-pushes`;
      if (arg.startsWith(":"))
        return `a "${arg}" refspec deletes a remote branch`;
    } else if (arg === "--") {
      optionsEnded = true;
    } else if (arg.startsWith("--")) {
      const name = arg.split("=")[0] ?? arg;
      if (name.startsWith("--force")) return `${name} force-pushes`;
      if (name === "--mirror")
        return "--mirror can force-push and delete remote branches";
      if (name === "--delete") return "--delete deletes a remote branch";
      if (name === "--prune") return "--prune deletes remote branches";
      if (name === "--tags" || name === "--follow-tags")
        return `${name} pushes tags`;
    } else {
      // A group of short flags, such as -uf. -o takes a value: the rest of the
      // group, or the next word.
      const flags = arg.slice(1);
      for (let j = 0; j < flags.length; j++) {
        const flag = flags.charAt(j);
        if (flag === "f") return `${arg} force-pushes`;
        if (flag === "d") return `${arg} deletes a remote branch`;
        if (flag === "o") {
          skipNext = j === flags.length - 1;
          break;
        }
      }
    }
  }
  return null;
}

// Returns why the command is refused, or null if it is allowed.
export function findViolation(command: string): string | null {
  for (const words of parseSegments(command)) {
    const args = pushArguments(words);
    if (typeof args === "string") return args;
    const violation = args && checkPushArguments(args);
    if (violation) return violation;
  }
  return null;
}

// import.meta.main needs Node 24.2 or later (engines in package.json).
if (import.meta.main) {
  const input = JSON.parse(readFileSync(0, "utf8")) as HookInput;
  const violation = findViolation(input.tool_input?.command ?? "");
  if (violation) {
    console.error(
      `Blocked by .claude/hooks/guard-git-push.ts: ${violation} (ADR 0012, decision 19; ADR 0015). ` +
        "Ask the owner to run it if it is really needed.",
    );
    process.exit(2);
  }
}
