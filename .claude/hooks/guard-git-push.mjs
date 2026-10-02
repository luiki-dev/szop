// Claude Code PreToolUse hook: refuses git pushes that force, delete or push tags.
//
// It backs the deny rules in .claude/settings.json where a pattern cannot reach:
// a `+branch` or `:branch` refspec, bundled short flags (`-uf`, `-ud`), `--mirror`,
// `--prune`, `--follow-tags` and `git -C dir push`. Like the deny rules, it guards
// against mistakes, not against a determined attacker; GitHub's rulesets are the
// real boundary. ADR 0015 (docs/decisions/0015-git-push-guard-hook.md).
//
// Input: the tool call as JSON on stdin. Exit 2 blocks the command and shows
// stderr to Claude; exit 0 leaves the decision to the permission rules.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// git's own options that take their value as the next word (`git -C dir push`).
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

// Splits a shell command into segments (at ; & | and newlines) of words,
// honouring quotes. Subshells and expansions are not interpreted.
function parseSegments(command) {
  const segments = [[]];
  let word = null;
  let quote = null;
  const endWord = () => {
    if (word !== null) segments.at(-1).push(word);
    word = null;
  };
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      word ??= '';
    } else if (';&|\n'.includes(char)) {
      endWord();
      segments.push([]);
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word = (word ?? '') + char;
    }
  }
  endWord();
  return segments;
}

// Returns the words after `push` if the segment runs `git push`, otherwise null.
function pushArguments(words) {
  let i = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i] ?? '')) i++; // VAR=value prefixes
  if (words[i] !== 'git' && !words[i]?.endsWith('/git')) return null;
  i++;
  while (words[i]?.startsWith('-')) {
    i += GIT_OPTIONS_WITH_VALUE.has(words[i]) ? 2 : 1;
  }
  return words[i] === 'push' ? words.slice(i + 1) : null;
}

function checkPushArguments(args) {
  let optionsEnded = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (optionsEnded || !arg.startsWith('-')) {
      if (arg.startsWith('+')) return `a "${arg}" refspec force-pushes`;
      if (arg.startsWith(':')) return `a "${arg}" refspec deletes a remote branch`;
    } else if (arg === '--') {
      optionsEnded = true;
    } else if (arg.startsWith('--')) {
      const name = arg.split('=')[0];
      if (name.startsWith('--force')) return `${name} force-pushes`;
      if (name === '--mirror') return '--mirror can force-push and delete remote branches';
      if (name === '--delete') return '--delete deletes a remote branch';
      if (name === '--prune') return '--prune deletes remote branches';
      if (name === '--tags' || name === '--follow-tags') return `${name} pushes tags`;
    } else {
      // A group of short flags, such as -uf. -o takes a value: the rest of the
      // group, or the next word.
      for (const [j, flag] of [...arg.slice(1)].entries()) {
        if (flag === 'f') return `${arg} force-pushes`;
        if (flag === 'd') return `${arg} deletes a remote branch`;
        if (flag === 'o') {
          if (j === arg.length - 2) i++;
          break;
        }
      }
    }
  }
  return null;
}

// Returns why the command is refused, or null if it is allowed.
export function findViolation(command) {
  for (const words of parseSegments(command)) {
    const args = pushArguments(words);
    const violation = args && checkPushArguments(args);
    if (violation) return violation;
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { tool_input } = JSON.parse(readFileSync(0, 'utf8'));
  const violation = findViolation(tool_input?.command ?? '');
  if (violation) {
    console.error(
      `Blocked by .claude/hooks/guard-git-push.mjs: ${violation} (ADR 0012, decision 19; ADR 0015). ` +
        'Ask the owner to run it if it is really needed.',
    );
    process.exit(2);
  }
}
