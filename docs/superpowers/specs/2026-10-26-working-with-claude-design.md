# Working with Claude within the weekly limit: design

The decisions here go into ADR 0052 (Working with Claude within the weekly limit). It is made outside a phase, on the branch `docs/adr-0052-working-with-claude`. This document holds the design behind those decisions.

## Contents

- [Goal](#goal)
- [Why now](#why-now)
- [What the transcripts show](#what-the-transcripts-show)
- [Decisions](#decisions)
- [Design](#design)
  - [A session per stage](#a-session-per-stage)
  - [Context thresholds](#context-thresholds)
  - [Breaks](#breaks)
  - [Subagent models](#subagent-models)
  - [The status line](#the-status-line)
  - [Measuring](#measuring)
  - [The token usage report in a PR](#the-token-usage-report-in-a-pr)
  - [The guide](#the-guide)
  - [Changes to CLAUDE.md](#changes-to-claudemd)
  - [What lives where](#what-lives-where)
- [Tracking](#tracking)
- [Definition of done](#definition-of-done)
- [Order of work](#order-of-work)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

The owner works on a Claude Code Pro subscription, and its weekly limit runs out before the week ends. The goal is **one account that lasts the week at the owner's usual pace**. The Opus session that coordinates the work is the part that must last: when it runs out, everything stops.

What this delivers:

- **Habits:** how a phase is split into sessions, when to restart or compact, how to handle breaks, which model each subagent runs on.
- **Defaults that enforce those habits:** a rule in CLAUDE.md, the default subagent model, and an auto-compact threshold.
- **Signals while working:** the status line shows the context size in tokens and colors it by absolute thresholds.
- **A way to tell whether it works:** a baseline audit of past usage, a script that reports any phase's usage against that baseline, and a token usage section in every phase PR.

The owner sees this as a soft skill, coordinating the work well, and wants to learn it, not only apply it. So the guide explains the reasons behind each habit, the mechanics (the prompt cache, context growth, compaction) and how to read the numbers.

## Why now

The limit ran out several weeks in a row. Two alternatives were looked at first:

- **The next plan up (Max):** about 6× the price, for more than the owner needs.
- **A second account, coordinated by the first:** Anthropic support confirmed it is allowed, but the owner parked it as the candidate [OP-109](https://github.com/luiki-dev/szop/issues/296) to try one account first. Saving on one account also helps if a second one is ever added.

## What the transcripts show

The analysis read every Szop transcript in `~/.claude/projects/` from 2026-09-27 to 2026-10-26. It counted each API call once, even when a resumed session copies earlier calls. It weighted the tokens by list-price ratios, in units of one Opus input token: input 1, cache write 1.25, cache read 0.1, output 5, with Sonnet at 0.6× and Haiku at 0.2× of Opus. These units only approximate how the subscription meters usage. The limit's own percentage is the ground truth, and from now on the CSV log records it ([Measuring](#measuring)).

| Finding | Number |
|---|---|
| Total over the period | ≈270M units |
| Cost by kind of token | cache reads 67.5%, cache writes 20.5%, output 12%, thinking 3.3% of total |
| Main session vs subagents | 78% vs 22% |
| By model and effort | Opus high 62.5%, Opus medium 27%, Sonnet 9% |
| Main session by stage | subagent-driven execution 40%, brainstorming 24%, TDD 10%, writing plans 8% |
| Sessions per phase | almost always one; peaks of 350–700k tokens of context |
| Median context per main-session call | 208k |
| Share of main-session cost spent above 200k of context | 58% |
| Median cost per call by context | 13k units below 100k, 30k at 200–300k, 62k above 500k |
| Cache rebuilds after more than 1 h idle | 4.9% of total |
| Implementer subagents on Opus | 13 agents cost 4.0% of total; 77 on Sonnet cost 4.7% |
| A new session's first call | ≈47k of context; after a compaction ≈57–68k |

The conclusion: **cost tracks how long a session runs, not how big the phase is.** Every call re-reads the whole context from the cache, so a session's cost grows roughly with the square of its length. A phase's cost did not follow its number of tasks. A simulation over the same transcripts estimated the savings:

- restarting at each stage boundary saves about 20% of main-session cost;
- also capping a session at about 150–200k of context saves about 30–35%, after the cost of the restarts.

Both numbers are rough.

## Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | **Make one account last, and park the second account as [OP-109](https://github.com/luiki-dev/szop/issues/296)** _(the owner's choice)_. | Max plan; a second Claude account coordinated by the first; Codex on a Plus plan as the worker. | Max costs about 6× for more than is needed. A second agent adds coordination, and the coordinator remains the bottleneck. Savings on one account help either way. |
| 2 | **A session per stage of a phase:** brainstorm and spec together, then the plan, then execution, then finishing (tracking, PR). Each stage starts a new session that reads the committed spec or plan _(Claude's proposal, the owner's choice)_. | One session per phase (today); one session with `/compact` at every stage boundary. | Each stage leaves a committed document the next stage can start from, so a new session loses nothing that matters. A new session starts at ≈47k of context, a compacted one at ≈57–68k carrying a lossy summary. The brainstorm stays with the spec because the reasoning behind the spec exists only in that conversation. |
| 3 | **Within a long stage (mostly execution), restart or `/compact` when the context passes about 150–200k** _(Claude's proposal, the owner's choice)_. | No cap; auto-compact only. | Above 200k, every call costs two or more times what it costs below 100k, and 58% of main-session cost was spent there. A restart costs about one or two calls at 400k. During execution, the plan and the commits on the branch are the state, so a new session can continue from them. |
| 4 | **Auto-compact at 300k for Opus 5.5 as a safety net** _(the owner's choice; already set with `/autocompact`)_. | The default window of 1M; a lower threshold such as 200k. | It catches a session that was left running too long. A threshold at 200k would compact sessions that are about to end anyway, mid-task, when a restart at a stage boundary would be cleaner. |
| 5 | **Before a break longer than an hour, finish the stage or end the session** _(Claude's proposal, the owner's choice)_. | Leaving the session open. | The prompt cache lives one hour. After that, the next call writes the whole context again at 1.25×. These rebuilds cost 4.9% of the total. |
| 6 | **Implementer subagents run on Sonnet, and the whole-branch review runs on Opus.** The rule goes in CLAUDE.md, and the default subagent model is Sonnet (`CLAUDE_CODE_SUBAGENT_MODEL`), so a dispatch that names no model uses Sonnet _(Claude's proposal, the owner's choice)_. | The rule in CLAUDE.md only; the default only. | The default covers a coordinator that forgets the rule. The rule says when Opus is worth it, so the coordinator names it explicitly for the review. An explicit `model` in a dispatch still wins over the default. The saving is about 4–5% of total. It is small, but it also keeps the Opus share of the limit for the coordinator. |
| 7 | **The status line shows the context in tokens after its percentage (`[#         ] 13% 131k`), colored by absolute thresholds: green below 150k, yellow 150–200k, red above 200k** _(the owner's choice)_. | Colors by percentage of the window (today: yellow from 50%, red from 75%). | With a 1M window, 50% is 500k, far past the point where calls become expensive. The thresholds match decision 3. |
| 8 | **The status line also appends the limit usage to a CSV log, at most once a minute** _(Claude's proposal, the owner's choice)_. | Reading the percentages by hand; nothing at all. | The 5-hour and weekly percentages are the only true measure of the limit, and Claude Code shows them but does not keep them. The log connects them to a session and a branch, so a phase's share of the week can be read back. |
| 9 | **A script reports any phase's usage from the transcripts and the CSV, against a baseline from the audit `2026-10-26-token-usage.md`. The usage is judged after 3–4 phases** _(Claude's proposal, the owner's choice)_. | Comparing weeks only; no measurement. | Weeks differ in how much work they hold. A phase is the unit of work, and the leading indicators show whether the habits are followed even before the totals move. |
| 10 | **Before opening a phase's PR, Claude runs the report and puts a "Token usage" section in the PR description** _(the owner's choice: semi-automatic)_. | A hook or CI job; only on request. | CI cannot see the transcripts, and they live only on the machine that ran the session. A step in the existing checklist costs nothing to remember, and the numbers stay with the phase they describe. The script can also be run by hand at any time. |
| 11 | **Transcripts are kept for 365 days** (`cleanupPeriodDays`, already set) _(the owner's choice)_. | The default of 30 days. | The baseline and every later report are computed from transcripts, and the default would have started deleting the baseline's first files within days. |
| 12 | **A guide, `docs/development/working-with-claude.md`** _(the name is the owner's choice)_. | A section in `phase-walkthrough.md`. | The walkthrough explains what happens in a phase as process. This guide is about coordinating the work well, a skill of its own. |
| 13 | **The size of a phase stays as [ADR 0014](../../decisions/0014-roadmap.md), decision 6, sets it** _(Claude's proposal; the owner asked whether phases should shrink)_. | A smaller limit on tasks per plan, or a limit on lines of plan. | The transcripts show cost tracks session length, not task count. Sessions per stage address that directly. The evaluation after 3–4 phases can revisit this. |
| 14 | **The thresholds and targets for the evaluation:** median context per main-session call below 120k; share of main-session cost above 200k below 20%; per-phase cost at least 25% below the baseline median; the owner not running out of the weekly limit before its reset _(Claude's call; the owner can change the numbers in the ADR)_. | No targets. | Without a target, "it works" cannot be told from "it changed". The first three are leading indicators. The last one is the success criterion itself. |

## Design

### A session per stage

| Stage | Starts from | Ends with | Typical size |
|---|---|---|---|
| Brainstorm and spec | the phase's roadmap entry and its open-point issues | the spec committed, reviewed by the builder check | one session |
| Plan | the committed spec | the plan committed | one new session |
| Execution | the committed plan and the branch | all tasks committed and reviewed | one or more new sessions; restart or `/compact` above about 150–200k |
| Finishing | the branch | tracking done, the PR opened with its token usage section | a new session, or the end of the last execution session when its context is still small |

A stage ends when its document or commits are on the branch, never in the middle of a task. The guide gives the opening prompt for each stage. For example, "Plan PH-NN from `docs/superpowers/specs/<spec>.md`" or "Execute the plan `<plan>.md`; tasks 1–3 are committed". It also lists what a new session should read first.

Restarting versus compacting:

- **At a stage boundary:** start a new session (`/clear`). The committed document is a better hand-off than a summary.
- **Within a stage:** `/compact` with a short instruction (what is done, what is next) keeps the working state the plan does not hold, for example a failing test being chased. A new session is also fine when the last task was just committed.
- **Remote Control:** `/clear` and `/compact` work from the phone and the web, and the connection to the session stays; `/resume` is local only.

### Context thresholds

| Context | Status line | What to do |
|---|---|---|
| below 150k | green | work on |
| 150–200k | yellow | finish the current task, then restart or `/compact` |
| above 200k | red | restart or `/compact` at the next safe point |
| 300k | — | auto-compact steps in (safety net) |

### Breaks

The prompt cache lives one hour on a subscription. Before a break longer than that, finish the stage, or note where the work stands and end the session. Coming back to an idle session costs a full cache write of its context. The guide explains this with the 4.9% figure.

### Subagent models

- **Implementers, spec-compliance reviews, small searches:** Sonnet, the default.
- **The whole-branch review at the end of execution, and any task the plan marks as hard** (a tricky design, a security-sensitive change): Opus, named explicitly in the dispatch.
- **When an implementer on Sonnet fails a task twice:** retry it on Opus, and note it in the PR's token usage section.

The superpowers `subagent-driven-development` skill already asks for "the least powerful model that can handle each role", so this rule makes its choice concrete. The default goes in the `env` of the project's `.claude/settings.json`, so it is versioned, reviewed in the PR and also applies in cloud sessions _(Claude's call)_.

The order of precedence comes from the Agent tool's own description. An explicit `model` in the dispatch wins. Next comes the agent definition's `model`, then the configured default subagent model, and last the parent's model. The work checks both ends: a dispatch without a model runs on Sonnet, and a dispatch with `model: opus` still runs on Opus. If the second check fails, the work stops and the owner decides, since decision 6 would then need another route.

### The status line

Changes to `~/.claude/statusline-command.sh`:

- **Tokens after the percentage:** `[#         ] 13% 131k`. The tokens are the current context size (the last call's input, cache write and cache read). They are taken from the status line's `context_window` input, which carries `current_usage`, `context_window_size` and `used_percentage`. To see which field gives that number, a temporary line in the script copies one real input to the scratchpad, and the line is removed afterwards. The fallback is `used_percentage × context_window_size`.
- **One `python3` call per field stays as it is.** Refactoring the script is out of scope.
- **Color by absolute thresholds:** green below 150k, yellow 150–200k, red above 200k. The bar's fill stays the percentage of the window.
- **The CSV log** `~/.claude/usage-log.csv` gets one row per minute at most. It is skipped when the last row is less than 60 seconds old.
  - Columns: `timestamp` (ISO 8601, UTC), `session_id`, `branch`, `model`, `five_hour_pct`, `seven_day_pct`, `context_tokens`.
  - The header is written when the file is created. A failure to write must never break the status line.
  - Rows are written only when the rate-limit fields are present.

The script lives outside the repository. The guide shows the relevant parts and says where the file is.

### Measuring

**The baseline audit,** `docs/audits/2026-10-26-token-usage.md`, records the period, the method (deduplication, cost units, phase attribution) and the findings above. It also records the baseline value of every indicator below, plus the median per-phase cost. It follows the layout of the existing audits.

**The analysis behind the audit** is kept in `docs/audits/2026-10-26-token-usage/`. These are the scripts that produced this design's numbers: `usage.py` (the main tables), `phases.py`, `extra.py`, `sim.py` and `sub.py`. Each takes the transcript directory as its argument. They are frozen with the audit, and they define the terms below.

- **A call:** one API call. Calls are deduplicated by `requestId`, or by the message `id` when the request ID is missing. The deduplication runs across all files, since a resumed or forked session copies earlier calls into its own file. Records with the model `<synthetic>` are skipped.
- **A main-session call:** a call from a transcript outside a `subagents/` directory.
- **The context of a call:** its `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
- **A phase's sessions:** each main session goes to the phase whose `ph-NN` branch it was on most often, and its subagents go with it. Sessions with no `ph-NN` branch belong to no phase. They count in the totals but not in phase figures.
- **The baseline phases:** every phase with sessions in the period 2026-09-27 to 2026-10-26. The audit lists them.

**The script,** `scripts/token-usage.py`, is ported from that analysis. It depends only on the Python standard library. It reads `~/.claude/projects/-home-lemekk-workspace-szop/` (its subagent transcripts included) and, when present, `~/.claude/usage-log.csv`. Other project directories (worktrees, other machines, cloud sessions) are out of its scope. The baseline values are stored as constants in the script, each citing the audit. Recomputing them live would let a later change to the script quietly move the baseline _(Claude's call)_. The script gets no unit tests. Its check is that it reproduces the audit's numbers. It is a development tool, the first Python file in `scripts/`, and needs only `python3`, which WSL already has _(Claude's call)_.

- **Phase attribution:** a main session belongs to the phase whose `ph-NN` branch it was on most often, and its subagents go with it.
- **Report for one phase:** `--phase PH-NN` or `--branch <name>`.
- **Report for a period:** `--since` and `--until`.
- **Output:** Markdown, ready to paste into a PR.

The indicators, each with its baseline:

| Indicator | Baseline | Target |
|---|---|---|
| Phase cost in units | the median of the baseline phases | ≥25% lower |
| Median context per main-session call | 208k | below 120k |
| Share of main-session cost above 200k | 58% | below 20% |
| Peak context | 350–700k | below 300k (auto-compact) |
| Main sessions per phase | ~1 | 3 or more |
| Cache rebuilds after idle, share of cost | 4.9% | lower |
| Opus share of implementer subagents' cost | ≈46% | near 0 |
| Weekly limit used during the phase | — (no log before) | from the CSV, informational |

The weekly-limit row comes from the CSV. It sums the increases of `seven_day_pct` over the rows of the phase's sessions, starting again after each reset. The report says plainly when the CSV is missing or covers only part of the phase.

**The evaluation** follows 3–4 phases finished with these habits. It compares their reports with the baseline and the targets in decision 14. It adds its findings to the guide, and if the targets need to change, it records that in a new ADR or in an audit of its own. A ⬜ open-point issue tracks it ([Tracking](#tracking)).

### The token usage report in a PR

A new step in CLAUDE.md's "Before opening the PR" list: run `scripts/token-usage.py --branch <the phase branch>` and put its output under a "Token usage" heading in the PR description. Non-phase PRs may include it, but don't have to.

The PR template and `definition-of-done.md` do not change. The report is a measurement, not a quality bar a PR must meet. If the owner wants it there later, it can be added _(Claude's call)_.

### The guide

`docs/development/working-with-claude.md`, a living doc with a Contents section:

- **Why this matters:** the limit, the coordinator as the bottleneck.
- **How usage builds up:** context and the prompt cache, why cost grows with session length, what compaction does, and the numbers from the audit.
- **A phase in sessions:** the stage table, the opening prompts, restart versus compact, Remote Control.
- **Reading the status line:** the thresholds, and what to do at each color.
- **Breaks and the cache.**
- **Choosing models:** the coordinator, subagents, effort.
- **Measuring:** the CSV, the script, the report in a PR, the evaluation.
- **The settings involved:**
  - `autoCompactWindow`, `cleanupPeriodDays` and `statusLine`, in user settings;
  - `CLAUDE_CODE_SUBAGENT_MODEL`, in project settings.

### Changes to CLAUDE.md

- **A new short section, "Working with Claude":**
  - a session per stage;
  - restart or `/compact` above 150–200k of context;
  - before a break longer than an hour, finish the stage;
  - implementers on Sonnet, the whole-branch review on Opus named explicitly;
  - a link to the guide and to ADR 0052.
- **In "Before opening the PR":** the token usage report step.
- **In "Documentation":** a line for the guide.
- **Elsewhere:** `docs/development/scripts.md` covers the `package.json` scripts. If it also lists the files in `scripts/`, the new script gets an entry there; if not, the guide alone describes it.

### What lives where

| Thing | Where | Versioned |
|---|---|---|
| ADR 0052, the guide, the audit, the script, CLAUDE.md, the default subagent model | the repository | yes |
| The status line script, the CSV log | `~/.claude/` | no; the guide describes them |
| `autoCompactWindow` 300k, `cleanupPeriodDays` 365 | `~/.claude/settings.json` | no; already set |

## Tracking

- **The `adr` issue:** "ADR 0052 Working with Claude within the weekly limit", labelled `adr`, created when the ADR is written. Its body follows the earlier ADR issues: the decision record link and "Landed in". The PR closes it.
- **[OP-109](https://github.com/luiki-dev/szop/issues/296):** already a ⬜ candidate. The ADR links it as the parked alternative.
- **The evaluation:** a new open-point issue with the next free `OP-` ID, "Evaluate the token-saving habits after 3–4 phases". It is labelled `open-point`, with no parent and ⬜ Backlog. Its body lists the targets. The owner moves it to 📌 Todo when 3–4 phases have run with these habits. "How items move" has no row for an open point settled outside a phase, so this is _Claude's call_. It is not a `candidate`, because it will be done.
- **Who creates the issues:** Claude, as "How items move" says for an `adr` issue, during the last task.
- **ADR 0052's number:** 0050 is missing from `main`. PH-40 took 0051 while PH-41 (whose entry promises "an ADR when a decision is significant") was already under way, so 0050 is taken to be PH-41's. If PH-41 ends with another number, nothing collides. Before the PR, check `main` again for 0052.
- **Notes in earlier ADRs:** only [ADR 0004](../../decisions/0004-implementation-process.md) gets an "extended" note, on the decision that defines the stages of a phase. [ADR 0014](../../decisions/0014-roadmap.md), decision 6, is restated, not changed, so it gets no note _(Claude's call)_.
- **The PR:** labelled `skip-changelog`, since it changes process and Claude Code's settings, not the app.

## Definition of done

This is a docs and process PR. The relevant items of `definition-of-done.md` apply. In addition:

- ADR 0052 is written. Its header notes whom it extends: [ADR 0004](../../decisions/0004-implementation-process.md) for the stages of a phase. If an earlier ADR's decision is affected, it gets the matching note.
- The guide, the audit, the script and the CLAUDE.md changes are in.
- Each glossary entry for a new niche term is added (for example "prompt cache", "compaction", "cost unit").
- The script runs on this machine and reproduces the audit's baseline numbers, within rounding. Its output for a past phase, for example PH-40, is shown in the PR as an example.
- The status line shows the tokens and the new colors, and writes CSV rows. This is checked by piping a sample input into the script. It is not part of the PR, so the PR description says it was done.
- The default subagent model is set. A test dispatch without a model runs on Sonnet, and one with `model: opus` runs on Opus, as seen in each one's transcript.

## Order of work

1. **The script and the audit:** `scripts/token-usage.py` and `docs/audits/2026-10-26-token-usage.md`, the numbers checked against this design.
2. **The status line** in `~/.claude`: tokens, colors, the CSV. Checked with sample input.
3. **ADR 0052.**
4. **The guide.**
5. **CLAUDE.md, the default subagent model in `.claude/settings.json`, the glossary and the other docs it touches.**
6. **Tracking and the PR:** the `adr` issue, the evaluation open point, and the PR with an example token usage section.

## Risks

- **The cost units are not the subscription's meter.** The real limit may weigh cache reads or models differently. The CSV of real percentages is the check, and the evaluation compares both.
- **Transcripts live on one machine.** A phase worked partly in a cloud session or on another computer is under-counted. The report says what it found, and the PR notes the gap.
- **Undocumented transcript format.** The JSONL layout can change with a Claude Code update. The script fails loudly on a missing field instead of silently reporting zero.
- **Sonnet implementers may need more retries.** That can eat the saving. The retry rule and the Opus share in the report make this visible.
- **Habits erode in long sessions.** The status line colors are the reminder that does not depend on memory.
- **Editing `.claude/settings.json` touches the file that holds the deny rules** ([ADR 0012](../../decisions/0012-security-baseline.md), decision 19). The change adds only `env`, and the deny rules stay as they are.

## Out of scope

- A second account or another agent ([OP-109](https://github.com/luiki-dev/szop/issues/296)).
- Changing the phase size rule (decision 13).
- Automating the report in CI or a hook (decision 10).
- A dashboard or charts of the CSV. The script's text output is enough until the evaluation shows otherwise.
- Trimming CLAUDE.md or the skills to shrink the starting context (≈47k). That might be worth an audit later, but it is not part of this work.

## Left to the builder

- **The script's internal structure,** and its flags beyond `--phase`, `--branch`, `--since` and `--until`.
- **The exact wording of the guide, the ADR and the CLAUDE.md lines,** in the project's writing style.
- **Change detection:** whether CI's change detection treats `scripts/token-usage.py` as code. If it does, and that starts jobs needlessly, note it in the PR rather than changing CI here.
- **Which `context_window` field gives the context size in tokens,** checked on a captured input ([The status line](#the-status-line)).
