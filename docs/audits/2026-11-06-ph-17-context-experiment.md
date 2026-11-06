# PH-17 context-size experiment

[PH-17 List items](../roadmap.md#ph-17-list-items) runs as one large phase, merged back from PH-17a and PH-17b, to see two things:

- how much context each part of a large phase takes in the main agent (brainstorm, spec, plan, session handoffs, each task of the execution);
- how `/compact` behaves in a long execution that runs through every task without stopping for the owner.

It is an experiment the owner chose. It goes against [ADR 0014](../decisions/0014-roadmap.md), decision 6 (a phase holds at most one big concept), for this phase only, and needs no ADR.

## Contents

- [Rules](#rules)
- [Measuring](#measuring)
- [Auto-compact](#auto-compact)
- [Results](#results)
- [Findings](#findings)

## Rules

1. **PH-17a and PH-17b are one phase, PH-17**, on issue [#46](https://github.com/luiki-dev/szop/issues/46); #290 and #291 are closed as not planned.
2. **The stages stay as in [ADR 0052](../decisions/0052-working-with-claude.md):** brainstorm and spec in one session, `/session-handoff`, the plan, `/session-handoff`, the execution, then `/finish-phase`.
3. **The execution runs through every task of the plan without stopping for the owner,** whether it is subagent-driven or inline.
4. **Above 150k, Claude stops.** In any part of the phase (brainstorm, spec, plan, execution, finishing), when the main agent's context passes 150k at the end of a step (a task, in the execution), Claude stops and asks the owner to run `/compact`. Claude cannot run `/compact` itself: it is a built-in command only the owner can type. After it, Claude takes the next step. Subagents' contexts do not count.
5. **Claude measures the context** at each point listed in [Measuring](#measuring), and at `/finish-phase` fills in [Results](#results) and shows the table to the owner.

## Measuring

The context size is the sum of `input_tokens`, `cache_creation_input_tokens` and `cache_read_input_tokens` of the main agent's last API call, read from the session's transcript in `~/.claude/projects/-home-lemekk-workspace-szop/<session id>.jsonl`. The value after `/compact` is the first call after it.

Points measured:

- the start and end of the brainstorm, the spec and the plan;
- just before each `/session-handoff`, and at the start of each session resumed from one;
- in the execution: at the start of each task, after it, and after each `/compact`.

## Auto-compact

What the Claude Code documentation says (checked on 2026-11-06):

- **The threshold can be set:** `/autocompact 150k` (saved per model in user settings), `autoCompactWindow` in a settings file, `claude --autocompact 150k` for one launch, or the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` variable, from 100k to 1M tokens. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` can only lower the default percentage.
- **The default for Opus 5.5 is about 967k:** models with a native 1M window compact just before it fills, which is why sessions here reach 300k and more without compacting.
- **When it runs:** the documentation does not say whether it waits for the end of a turn. It runs as the context approaches the threshold, so in a long turn it can come between two tool calls, in the middle of a task; the work goes on from the summary.

This experiment uses the manual `/compact` of [Rules](#rules), rule 4, so each compaction falls between two tasks.

## Results

Filled in at `/finish-phase`. Sizes in thousands of tokens.

| Element of the phase | Context before | Context after |
|---|---|---|
| Brainstorm | | |
| Spec | | |
| Session handoff 1 | | |
| Plan | | |
| Session handoff 2 | | |
| Task 1 | | |

## Findings

Filled in at `/finish-phase`.
