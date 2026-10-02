# ADR 0015 — A Claude Code hook that guards git push

- **Status:** ✅ Accepted — decision 3 refined by [ADR 0016](0016-toolchain-details.md) (the hook in TypeScript)
- **Date:** 2026-10-02
- **Refines:** [ADR 0012](0012-security-baseline.md), decision 19 (how the push guardrails are enforced: one broken deny rule removed, a hook added for what patterns cannot express)

## Context

[ADR 0012](0012-security-baseline.md), decision 19 put deny rules in `.claude/settings.json` so that Claude Code never force-pushes, deletes remote branches or pushes tags, whatever an `allow` says. The owner's personal `.claude/settings.local.json` allows `Bash(git push *)`, so every push the deny rules miss runs without a prompt.

Claude Code printed a warning at startup, and a check with harmless `git push -h …` probes showed what the rules miss:

- **`Bash(git push * :*)` never matched.** A pattern ending in `:*` is read as Claude Code's legacy prefix syntax, so the `*` before it is taken literally: `git push origin :feat/x`, which deletes the remote branch, was allowed. No pattern can say "a word starting with `:`", since every pattern ending in `:*` falls into the legacy syntax.
- **Bundled short flags pass.** git reads `-uf` as `-u -f`, but the rules look for a separate ` -f`; the same holds for `-ud`. A pattern such as `git push -*f*` would also match `git push -u origin feat/x`, since patterns cannot exclude.
- **Other forms pass:** `--mirror` and `--prune` (which force-update and delete remote branches), `--follow-tags` (which pushes tags) and `git -C dir push`.

The `--force*`, `-f`, `+branch`, `--delete`, `-d` and `--tags` rules were tested and work.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Closing the gaps | Drop the broken rule and record the gaps; a `PreToolUse` hook; drop the rule and narrow the owner's local `allow` | **A `PreToolUse` hook, `.claude/hooks/guard-git-push.mjs`,** registered in `.claude/settings.json` for every `Bash` call. It reads the command Claude Code passes on stdin, splits it at `;`, `&`, `\|` and newlines, finds each `git … push` (skipping `VAR=value` prefixes and git's own options, such as `-C dir`), and refuses with exit code 2 a `+` or `:` refspec, `--force*`, `--mirror`, `--delete`, `--prune`, `--tags`, `--follow-tags` or a short-flag group containing `f` or `d`. Anything else is left to the permission rules. Recording the gaps would leave the mistakes decision 19 is about uncaught. A narrower local `allow` is personal, not committed, and still cannot exclude `:branch`. The extra flags are all forms of what decision 19 already forbids. |
| 2 | The deny rules | Replace them with the hook; keep them beside it | **Keep the twelve rules that work, remove the broken one.** They are simple, readable in the settings file, and still stop the common forms if the hook cannot run (for example, Node missing from the `PATH`, which Claude Code reports as a hook error without blocking). Removing the broken rule also removes the startup warning. |
| 3 | Language and tests | A shell script with `jq`; a Node script; Python | **A Node script with no dependencies, tested with Node's built-in runner** (`node --test`). Node is already the project's runtime ([ADR 0005](0005-development-environment.md)); `jq` is not installed, and a shell parser for git's options would be harder to read and test. The tests are a table of commands to allow and to refuse, plus one run of the script itself to check the exit code. |
| 4 | Where its purpose is written | A comment in the settings file; a status message; a header comment in the script | **A header comment in the script.** `settings.json` is strict JSON, so it cannot hold comments, and Claude Code's hook entries have no description field; the closest, `statusMessage`, is spinner text that would flash on every shell command. The script's name says what it does, and its header says why and points here. |

## Consequences

- **The hook guards against mistakes, not against a determined attacker,** like the deny rules: it does not interpret subshells, `eval`, aliases or scripts. GitHub's rulesets ([ADR 0009](0009-git-workflow.md)) and the reviewer on `demo` (ADR 0012, decision 16) stay the real boundaries.
- **Every shell command Claude runs starts a short Node process first.** It takes a few tens of milliseconds.
- **The hook and its tests live outside the toolchain** until there is one: [OP-062](../open-points.md#op-062) brings them under ESLint, Prettier and CI in PH-01 and PH-02.
- **The living docs are updated:** `git-workflow.md` (what enforces Claude's push guardrails), the threat model (Claude Code's guards), the glossary (a Claude Code hook) and `CLAUDE.md` (don't work around the hook either).
