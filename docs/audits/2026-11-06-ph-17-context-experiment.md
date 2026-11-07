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
| Brainstorm | 60 | 167, then 81 after `/compact` |
| Spec | 100 | 153 |
| Session handoff 1 | 153 | 55 in the plan's session |
| Plan | 55 | 159, then 65 after `/compact`; 73 at the commit |
| Session handoff 2 | 73 | 55 in the execution's session |
| Task 1 | 55 | 129 |
| Task 2 | 129 | 138 |
| Task 3 | 138 | 147 |
| Task 4 (2 fix rounds) | 147 | 170, then 69 after `/compact` |
| Task 5 (1 fix round) | 69 | 84 |
| Task 6 | 84 | 95 |
| Task 7 (1 fix round) | 95 | 119 |
| Task 8 (2 fix rounds) | 119 | 139 |
| Task 9 (`/compact` while its implementer ran) | 139 | 145 before `/compact`, 69 after it, 75 at the end |
| Task 10 | 75 | 82 |
| Task 11 | 82 | 105 |
| Task 12 (1 fix round) | 105 | 123 |
| `/finish-phase` steps 1 to 4 | 123 | 140 |
| Session handoff 3 | 140 | 81 in the finishing session |
| `/finish-phase` step 5 (mockup, 2 fix rounds) to the PR | 81 | 139 |

## Findings

- **The 150k stop fired three times:** at the end of the brainstorm (167k), of the plan's draft (159k) and of Task 4 (170k). Without it, the brainstorm, the plan and the execution would each have gone past 150k; the execution would have reached about 250k.
- **A `/compact` or a handoff brings the context to 55k to 81k.** About 55k is the floor of a new session (system prompt, tools, `CLAUDE.md`, memory, skills); a `/compact` lands 10k to 25k above it, with the summary and the documents read again.
- **A subagent-driven task costs the main agent 7k to 25k,** growing with its fix rounds: 7k to 11k for a task that passed its review at once, 20k to 30k for one with two fix rounds. Twelve tasks fit in one session with two `/compact`s.
- **A `/compact` while an implementer runs did no harm** (Task 9): the controller had nothing uncommitted, and the implementer's work lives in its own context.
- **The token-usage indicators moved as wanted except the cost:** median context per main-session call 112k (baseline 202k), share of main-session cost above 200k 0 % (baseline 66 %), peak 172k (baseline 396k), 7 main sessions. The phase cost 16.3M units against the 9.9M baseline, but PH-17 is two phases merged, so the cost per phase does not compare directly.
- **The whole-branch review found what only real layout shows:** two Important findings (a tap lost after typing, the haul's drawer outside the column), both confirmed in a browser. The first fix needed a second round, because its E2E tests used a mouse and a touch tap orders its events differently.
