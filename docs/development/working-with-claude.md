# Working with Claude within the weekly limit

How to coordinate Claude Code so that one Pro subscription lasts the week: how a phase is split into sessions, when to restart or compact, how to handle breaks, which model each subagent runs on, and how to tell whether it works. Coordinating the work well is a skill of its own, so this guide explains the reasons and the mechanics behind each habit, not only the habit. The decisions are in [ADR 0052](../decisions/0052-working-with-claude.md), and the numbers come from the [token usage audit](../audits/2026-10-26-token-usage.md).

## Contents

- [Why this matters](#why-this-matters)
- [How usage builds up](#how-usage-builds-up)
  - [Context and the prompt cache](#context-and-the-prompt-cache)
  - [Why a long session costs more than its length](#why-a-long-session-costs-more-than-its-length)
  - [Compaction](#compaction)
  - [Cost units](#cost-units)
- [A phase in sessions](#a-phase-in-sessions)
  - [The stages](#the-stages)
  - [Opening prompts](#opening-prompts)
  - [Restart or compact](#restart-or-compact)
  - [Remote Control](#remote-control)
- [Reading the status line](#reading-the-status-line)
- [Breaks and the cache](#breaks-and-the-cache)
- [Choosing models](#choosing-models)
- [Measuring](#measuring)
  - [The usage log](#the-usage-log)
  - [The report script](#the-report-script)
  - [Reading the indicators](#reading-the-indicators)
  - [The report in a phase PR](#the-report-in-a-phase-pr)
  - [The evaluation](#the-evaluation)
- [The settings involved](#the-settings-involved)

## Why this matters

A Claude Code Pro subscription has two limits: a 5-hour window and a weekly limit. Szop's weekly limit ran out before the week ended several weeks in a row. The work runs through one main session, the **coordinator**: the session the owner talks to, which brainstorms, writes the spec and the plan, dispatches the subagents and reviews their work. It runs on Opus and spends most of the limit, 78% in the audit. When the limit runs out, the coordinator stops, and so does everything it would have dispatched.

The audit's main finding decides every habit below: **cost tracks how long a session runs, not how big the phase is.** A phase with few tasks run in one long session cost more than a bigger phase split into several sessions. So the habits are about the length of sessions, not about doing less work.

## How usage builds up

### Context and the prompt cache

Every API call sends the model the whole conversation so far: the system prompt, CLAUDE.md, the skills' text, every message and every tool result. That is the call's **context**, counted in tokens. The **context of a call** in the audit and the script is its input tokens plus its cache write tokens plus its cache read tokens: everything the model read for that call.

Re-sending the whole conversation on every call would be expensive, so the API keeps a **prompt cache**: the beginning of the context that was seen in an earlier call is stored for a while and read back at a tenth of the price of new input. Writing to the cache costs a quarter more than plain input. A call therefore pays:

- a cache read for everything up to the end of the previous call;
- a cache write for what is new since then (the last tool result, the last message);
- output for what the model writes, including its thinking.

On a subscription the cache entry lives one hour. A call that comes later than that finds nothing, and writes the whole context to the cache again ([Breaks and the cache](#breaks-and-the-cache)).

### Why a long session costs more than its length

A cache read is cheap per token, but every call reads the whole context again. In a session that adds a similar amount to the context with each call, the context grows in a straight line, and the sum of all the reads grows with the square of the number of calls. Twice as long a session costs roughly four times as much. Cache reads were 67% of all cost in the audit, and the audit's median cost per call shows the effect:

| Context of the call | Median cost per call |
|---|---|
| below 100k | 13k units |
| 100–200k | 20k units |
| 200–300k | 30k units |
| 300–500k | 42k units |
| above 500k | 62k units |

The same work done at 400k of context costs about three times what it costs at 80k. The median main-session call ran at 202k, and 66% of main-session cost was spent at 200k or more.

### Compaction

**Compaction** replaces the conversation with a summary written by the model, so the next call starts from a small context again. `/compact` does it on demand, and can take an instruction about what the summary should keep (`/compact Task 3 is committed; the failing test in list.spec.ts is next`). Auto-compact does it by itself when the context reaches a threshold, set to 300k here ([The settings involved](#the-settings-involved)).

A summary is lossy: details of the working state can go, and the session goes on with what the summary kept. A compacted session restarts at about 57–68k of context, a new session at about 48k: the system prompt, CLAUDE.md and the skills' descriptions. A new session that reads a committed spec or plan starts with less and carries a better hand-off than a summary, which is why a stage boundary is a restart, not a compaction.

### Cost units

The audit and the script measure cost in **cost units**: the price of one Opus input token. They weigh each kind of token by its list price relative to that: input 1, cache write 1.25, cache read 0.1, output 5, with Sonnet at 0.6× and Haiku at 0.2× of Opus. The units only approximate how the subscription meters usage; the limit's own percentage, recorded in [the usage log](#the-usage-log), is the ground truth.

## A phase in sessions

### The stages

A phase on the full path runs as one session per stage ([ADR 0052](../decisions/0052-working-with-claude.md), decision 2). Each stage ends with a committed document or commits, and the next stage starts a new session from them.

| Stage | Starts from | Ends with | Typical size |
|---|---|---|---|
| Brainstorm and spec | the phase's roadmap entry and its open-point issues | the spec committed, reviewed by the builder check | one session |
| Plan | the committed spec | the plan committed | one new session |
| Execution | the committed plan and the branch | all tasks committed and reviewed | one or more new sessions; restart or `/compact` above about 150–200k |
| Finishing | the branch | tracking done, the PR opened with its token usage section | a new session, or the end of the last execution session when its context is still small |

A stage ends when its document or commits are on the branch, never in the middle of a task. The brainstorm and the spec stay in one session, because the reasoning behind the spec exists only in that conversation.

### Opening prompts

A new session needs only a short prompt naming the stage and its document. CLAUDE.md, the memory and the skills load by themselves.

| Stage | Opening prompt | What the session reads first |
|---|---|---|
| Brainstorm and spec | `Brainstorm PH-NN` | the phase's entry in `docs/roadmap.md`, its issue and open-point issues, the requirements it delivers |
| Plan | `Plan PH-NN from docs/superpowers/specs/<spec>.md` | the spec, the files it names |
| Execution | `Execute the plan docs/superpowers/plans/<plan>.md` | the plan, its Global Constraints, the spec |
| Execution, continued | `Execute the plan docs/superpowers/plans/<plan>.md; tasks 1–3 are committed` | the plan, the progress ledger in `.superpowers/sdd/<plan>/progress.md`, `git log` |
| Finishing | `Finish PH-NN: tracking and the PR` | the plan's last task, CLAUDE.md's "Before opening the PR", the branch's diff |

The ledger of a plan's workspace keeps each finished task, the rulings made along the way and the review findings deferred, so a new execution session picks up where the last one stopped without re-reading the whole conversation.

### Restart or compact

- **At a stage boundary:** start a new session (`/clear`). The committed document is a better hand-off than a summary.
- **Within a stage:** `/compact` with a short instruction (what is done, what is next) keeps the working state the plan does not hold, for example a failing test being chased. A new session is also fine when the last task was just committed and pushed.
- **Never in the middle of an edit** that is not committed: finish the step or the task first.

### Remote Control

With Remote Control, a local session can be followed and driven from the phone or the web. `/clear` and `/compact` work from there, and the connection to the session stays. `/resume` works only in the local terminal, so a session to come back to from the phone is better compacted than ended.

## Reading the status line

The status line shows the context of the last call after its percentage of the window: `[#         ] 13% 131k`. The bar's fill is the percentage of the window (1M tokens for Opus 5.5); the color follows the tokens, by absolute thresholds ([ADR 0052](../decisions/0052-working-with-claude.md), decisions 3 and 7):

| Context | Color | What to do |
|---|---|---|
| below 150k | green | work on |
| 150–200k | yellow | finish the current task, then restart or `/compact` |
| above 200k | red | restart or `/compact` at the next safe point |
| 300k | — | auto-compact steps in (safety net) |

The colors are absolute because a percentage of a 1M window says little: 50% is 500k, far past the point where calls become expensive.

The status line is a script outside the repository, `~/.claude/statusline-command.sh`, run by Claude Code through the `statusLine` setting with the session's state as JSON on its input. The tokens are the sum of the `context_window.current_usage` fields, and the color is chosen from them:

```bash
tok_in=$(parse "context_window.current_usage.input_tokens")
tok_create=$(parse "context_window.current_usage.cache_creation_input_tokens")
tok_read=$(parse "context_window.current_usage.cache_read_input_tokens")
tokens=""
if [ -n "$tok_in$tok_create$tok_read" ]; then
    tokens=$(( ${tok_in:-0} + ${tok_create:-0} + ${tok_read:-0} ))
fi
# …
    if [ -n "$tokens" ]; then
        if [ "$tokens" -gt 200000 ]; then
            color="$RED"
        elif [ "$tokens" -ge 150000 ]; then
            color="$YELLOW"
        else
            color="$GREEN"
        fi
        tok_str=$(printf ' %dk' $(( (tokens + 500) / 1000 )))
    fi
```

The tokens shown are rounded to the nearest thousand, so a context of 149.6k shows `150k` in green. The same script also writes [the usage log](#the-usage-log).

## Breaks and the cache

The prompt cache lives one hour on a subscription. After a longer pause, the next call finds nothing in the cache and writes the whole context again, at 1.25× the price of input: a session idle at 300k pays about 375k units for its first call back. In the audit, 73 such rebuilds cost 4.9% of the total.

So, before a break longer than an hour ([ADR 0052](../decisions/0052-working-with-claude.md), decision 5):

- finish the stage, so the next session starts new from its document; or
- note where the work stands (a commit, or a line in the plan's ledger) and end the session.

A short session left idle costs little to rebuild; a long one costs a lot. That is one more reason to keep sessions short.

## Choosing models

**The coordinator** runs on Opus at high effort: it holds the phase together, and a wrong call there costs more than the tokens it saves. Effort is set per model in the user settings (`modelSettings`); higher effort means more thinking, which is billed as output.

**Subagents** run on the model the dispatch asks for ([ADR 0052](../decisions/0052-working-with-claude.md), decision 6):

- **Implementers, spec-compliance reviews, small searches:** Sonnet, the default.
- **The whole-branch review at the end of execution, and any task the plan marks as hard** (a tricky design, a security-sensitive change): Opus, named explicitly in the dispatch (`model: opus`).
- **When an implementer on Sonnet fails a task twice:** retry it on Opus, and note it in the PR's token usage section.

In the audit, 13 implementers on Opus cost 4.0% of the total, and 79 on Sonnet cost 4.7%. Moving implementers to Sonnet saves only a few percent, but it keeps the Opus share of the limit for the coordinator.

A subagent's model is chosen in this order, first match wins:

1. the `model` named in the dispatch;
2. the `model` in the agent's definition (`.claude/agents/*.md`);
3. the default subagent model, `CLAUDE_CODE_SUBAGENT_MODEL`, set to `sonnet` in the project's `.claude/settings.json`;
4. the coordinator's own model.

The default catches a dispatch that forgets the rule; the explicit `model: opus` still wins over it.

## Measuring

### The usage log

The status line appends a row to `~/.claude/usage-log.csv`, a comma-separated values (CSV) file, at most once a minute, whenever Claude Code passes it the rate-limit percentages:

```csv
timestamp,session_id,branch,model,five_hour_pct,seven_day_pct,context_tokens
2026-10-26T22:02:12Z,741bab66-14c3-4d6e-8ff4-826a30684841,docs/adr-0052-working-with-claude,claude-opus-5-5,50,11,155554
```

The timestamp is in Coordinated Universal Time (UTC). The 5-hour and weekly percentages are the limit's own meter, which Claude Code shows but does not keep; the log ties them to a session and a branch. The minute between rows is shared by every open session, so when several sessions run at once, the log holds one row per minute from whichever refreshed first. A failure to write the log never breaks the status line.

### The report script

`scripts/token-usage.py` reads the transcripts in `~/.claude/projects/-home-lemekk-workspace-szop/` (the subagents' too) and the usage log, and prints a Markdown report. It needs only `python3`.

| Run | Reports |
|---|---|
| `python3 scripts/token-usage.py --phase PH-NN` | one phase: its main sessions and their subagents |
| `python3 scripts/token-usage.py --branch <name>` | the sessions on one branch, for work outside a phase |
| `python3 scripts/token-usage.py --since 2026-10-27 --until 2026-11-02` | a period, by date or by UTC timestamp (`--until 2026-10-26T21:37:47`); combines with `--phase` and `--branch` |
| `python3 scripts/token-usage.py --by-phase` | one row per phase: cost, main sessions, peak context, first and last call |
| `python3 scripts/token-usage.py` | everything in the transcripts |

`--projects` and `--usage-log` point it at another transcript directory or log. A main session belongs to the phase whose `ph-NN` branch it was on most often, and its subagents go with it; a session on no phase branch counts in the totals but in no phase. Sessions in a worktree, on another machine or in the cloud are not in these transcripts, so a phase worked there is under-counted.

An example, for [PH-37](../roadmap.md#ph-37-two-tasks):

```markdown
Sessions: 1 main, 2 subagent transcripts · calls from 2026-10-21 to 2026-10-21

| Indicator | This selection | Baseline | Target |
|---|---|---|---|
| Phase cost in units | 4.9M | 9.9M | ≥25% lower |
| Median context per main-session call | 217k | 202k | below 120k |
| Share of main-session cost above 200k | 68% | 66% | below 20% |
| Peak context | 343k | 396k | below 300k (auto-compact) |
| Main sessions per phase | 1.0 | 2.0 | 3 or more |
| Cache rebuilds after idle, share of cost | 0.0% | 4.9% | lower |
| Opus share of implementer subagents' cost | — | 46% | near 0 |
| Weekly limit used during the phase | 0% | — | from the CSV, informational |

Notes:
- The usage log covers 0 of 1 main sessions.
```

The script stops with an error, naming the file and line, when a transcript lacks a field it needs, and when no session matches the phase or branch: a report of zeros would look like a saving.

### Reading the indicators

The baseline column holds the audit's values ([Baseline](../audits/2026-10-26-token-usage.md#baseline)), stored as constants in the script so that a later change to it cannot move them.

| Indicator | What it shows | When it is off |
|---|---|---|
| Phase cost in units | the result: what the phase cost against the median of the 18 complete baseline phases | a phase bigger than usual costs more; read it with the next rows |
| Median context per main-session call | whether sessions stayed short | the restarts did not happen, or happened late |
| Share of main-session cost above 200k | how much was spent where calls are expensive | a stage ran past red |
| Peak context | the longest a session got | a session ran into auto-compact |
| Main sessions per phase | whether the stages ran as sessions of their own | a phase ran in one session |
| Cache rebuilds after idle, share of cost | breaks taken with a session open | a long session was left idle |
| Opus share of implementer subagents' cost | whether implementers ran on Sonnet | a dispatch named Opus, or retries moved to Opus |
| Weekly limit used during the phase | the limit's own meter: the increases of the weekly percentage over the phase's rows, counted again from 0 after a reset | informational; the notes say when the log covers only part of the phase |

The first rows are leading indicators: they show whether the habits were followed before the weekly totals can move.

### The report in a phase PR

Before opening a phase's PR, Claude runs `python3 scripts/token-usage.py --branch <the phase branch>` and puts its output in the PR description under a "Token usage" heading ([ADR 0052](../decisions/0052-working-with-claude.md), decision 10). CI cannot do it: the transcripts live only on the machine that ran the sessions. Non-phase PRs may include it, but don't have to. The section also notes any implementer retried on Opus, and any part of the phase worked in the cloud or on another machine.

### The evaluation

After 3–4 phases worked with these habits, their reports are compared with the baseline and with the targets of [ADR 0052](../decisions/0052-working-with-claude.md), decision 14:

- median context per main-session call below 120k;
- share of main-session cost above 200k below 20%;
- per-phase cost at least 25% below the baseline median;
- the owner not running out of the weekly limit before its reset.

The findings go into this guide. If the targets need to change, that is recorded in a new ADR or an audit of its own. [OP-110](https://github.com/luiki-dev/szop/issues/298) tracks the evaluation.

## The settings involved

| Setting | Where | Value | Why |
|---|---|---|---|
| `autoCompactWindow` | user settings, `~/.claude/settings.json`, under `modelSettings` for `claude-opus-5-5` | `300000` | the safety net for a session left running too long ([ADR 0052](../decisions/0052-working-with-claude.md), decision 4); lower would compact sessions about to end anyway |
| `cleanupPeriodDays` | user settings, `~/.claude/settings.json` | `365` | the baseline and every report are computed from transcripts; the default of 30 days would delete them (decision 11) |
| `statusLine` | user settings, `~/.claude/settings.json` | `bash ~/.claude/statusline-command.sh` | runs the status line, which shows the context and writes the usage log (decisions 7 and 8) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | project settings, `.claude/settings.json`, under `env` | `sonnet` | a dispatch that names no model runs on Sonnet (decision 6); versioned, so it also applies in cloud sessions |

The user settings and the status line script are not in the repository; this guide is their record. `env` is read when a session starts, so a change to it applies from the next session.
