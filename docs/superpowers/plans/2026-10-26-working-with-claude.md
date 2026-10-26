# Working with Claude within the weekly limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Claude Pro account lasts the week: habits and defaults that keep sessions short, a status line that shows when to restart, and a script that measures each phase against a baseline.

**Architecture:** A standard-library Python script, `scripts/token-usage.py`, ported from the frozen analysis in `docs/audits/2026-10-26-token-usage/`, reports usage from the transcripts and the status line's CSV log. The baseline audit fixes the numbers the script compares against. The rest is documentation (ADR 0052, a guide, CLAUDE.md), one `env` entry in `.claude/settings.json`, and a status line change outside the repository.

**Tech Stack:** Python 3 (standard library only); Bash (the status line); Markdown; `gh` for the issues and the PR.

**Spec:** [`docs/superpowers/specs/2026-10-26-working-with-claude-design.md`](../specs/2026-10-26-working-with-claude-design.md)

## Global Constraints

- **Git:** branch `docs/adr-0052-working-with-claude`. Never commit to `main`, never merge, never trigger `demo-up` or `demo-down`. Commits follow Conventional Commits with an allowed scope (`claude` for the script, the guide, CLAUDE.md and the settings; `audit`; `adr`; `plan`), header at most 100 characters, and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and the executing session's `Claude-Session:` line.
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the branch, then stop and summarize the task for the owner. Start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).
- **Thresholds, exactly:** context green below 150k, yellow 150–200k, red above 200k; auto-compact at 300k; cache lifetime one hour; transcripts kept 365 days.
- **Cost units:** Opus input-token equivalents: input 1, cache write 1.25, cache read 0.1, output 5; Sonnet 0.6×, Haiku 0.2× of Opus.
- **Evaluation targets (decision 14):** median context per main-session call below 120k; share of main-session cost above 200k below 20%; per-phase cost at least 25% below the baseline median; the owner not running out of the weekly limit before its reset.
- **Paths:** transcripts `~/.claude/projects/-home-lemekk-workspace-szop/` (subagents under `<session>/subagents/`); CSV log `~/.claude/usage-log.csv`; status line `~/.claude/statusline-command.sh`; scratch files in the executing session's scratchpad, never committed.
- **CSV columns, in order:** `timestamp,session_id,branch,model,five_hour_pct,seven_day_pct,context_tokens`.
- **Docs style:** niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon, no icons in headings; requirements and use cases linked, never plain IDs; long docs start with a `## Contents` kept in sync; ADR notes in three places (CLAUDE.md, "Documentation"). No jokes in docs, commits or PRs.
- **`.claude/settings.json`:** only an `env` key is added. The deny rules and the hook stay exactly as they are ([ADR 0012](../../decisions/0012-security-baseline.md), decision 19).
- The frozen scripts in `docs/audits/2026-10-26-token-usage/` are never edited.

## Review Focus

1. **The transcript format changes after a Claude Code update** (an assistant record without `message.usage` or `timestamp`). Expected: the script exits non-zero naming the file and line, never reports zeros. Task 1, Step 5, fixture `missing-usage`.
2. **A phase ID with no sessions**, from a typo (`--phase PH-99`) or a phase worked only in the cloud. Expected: an error saying no sessions were found, exit 1, not a table of zeros. Task 1, Step 5, fixture `unknown-phase`.
3. **The weekly limit resets in the middle of a phase**, or the CSV holds a half-written row. Expected: the increase after the reset counts from 0, and the malformed row is skipped and counted in the notes. Task 1, Step 5, fixture `csv-reset`.
4. **A phase ID with a letter** (`feat/ph-14a-design-system`, `--phase ph-14a`). Expected: attributed to `PH-14A`, case-insensitive on input. Task 1, Step 5, fixture `letter-phase`.
5. **The status line's log cannot be written** (a missing directory, a read-only file). Expected: the status line prints as usual, exit 0, nothing on stderr. Task 3, Step 5.

---

## File Structure

| Path | Change |
|---|---|
| `scripts/token-usage.py` | Create (Task 1); baseline constants (Task 2) |
| `docs/audits/2026-10-26-token-usage.md` | Create (Task 2) |
| `~/.claude/statusline-command.sh` | Modify, outside the repository (Task 3) |
| `docs/decisions/0052-working-with-claude.md` | Create (Task 4) |
| `docs/decisions/0004-implementation-process.md` | Status line and decision 8's note only (Task 4) |
| `docs/development/working-with-claude.md` | Create (Task 5) |
| `CLAUDE.md`, `.claude/settings.json`, `docs/glossary.md`, docs that list the development guides | Modify (Task 6) |

`docs/development/scripts.md` lists only `package.json` scripts, so the new script gets no entry there; the guide describes it (the spec's "Changes to CLAUDE.md", last bullet).

---

### Task 1: The usage script

**Files:**
- Create: `scripts/token-usage.py`
- Scratch: `<scratchpad>/fixtures/`, `<scratchpad>/check-fixtures.sh`

**Interfaces:**
- Consumes: the frozen analysis `docs/audits/2026-10-26-token-usage/usage.py` (cost, deduplication, context), `phases.py` (phase attribution, idle rebuilds), `sub.py` (implementer agents).
- Produces, for Tasks 2, 5 and 7:
  - `python3 scripts/token-usage.py [--phase PH-NN | --branch NAME] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--by-phase] [--projects DIR] [--usage-log FILE]`, Markdown on stdout, no heading of its own (the PR puts it under "Token usage").
  - Defaults: `--projects ~/.claude/projects/-home-lemekk-workspace-szop/`, `--usage-log ~/.claude/usage-log.csv`. `--since` and `--until` are inclusive UTC dates on a call's `timestamp`.
  - `BASELINE`: a module-level dict, keys `phase_cost`, `median_ctx`, `share_above_200k`, `peak_ctx`, `sessions_per_phase`, `idle_rebuild_share`, `opus_implementer_share`; values `None` until Task 2.

- [x] **Step 1: Record the frozen analysis's numbers**

Run, from `docs/audits/2026-10-26-token-usage/` (the scripts load `usage.py` by relative path), each with `~/.claude/projects/-home-lemekk-workspace-szop/` as argument: `usage.py`, `extra.py`, `phases.py`, `sub.py`. Save the output to `<scratchpad>/frozen.txt` and note: total cost units; median main-session context (`extra.py`); share of main-session cost at or above 200k (the sum of the `<300k`, `<500k` and `>=500k` rows of `usage.py`'s context table); the idle rebuild share (`phases.py`); the Opus share of the `Implement…` agents (`sub.py`: Opus ÷ (Opus + Sonnet)); each phase's share of total (`phases.py`).

- [x] **Step 2: Implement `scripts/token-usage.py`**

The definitions are the spec's [Measuring](../specs/2026-10-26-working-with-claude-design.md#measuring) section; port them from the frozen scripts, which they must match exactly:

- **Calls:** every `*.jsonl` under `--projects`, recursively. Assistant records only; skip model `<synthetic>`; deduplicate by `requestId`, else `message.id`, across all files, the first record kept. A call is a subagent call when its path contains `/subagents/`; its session is the directory two levels up.
- **Fail loudly:** an assistant record without `timestamp` or `message.usage` stops the script with `error: <file>:<line>: missing <field>` on stderr, exit 2.
- **Cost, context, phase attribution, idle rebuilds:** as in `usage.py` and `phases.py`. Phase IDs come from `ph-(\d+[a-z]?)` in the branch, upper-cased (`PH-14A`). An idle rebuild is a main-session call more than 3600 s after the previous call of its session, with a cache write above 30,000 tokens; its cost is the cache write's (`1.25 × weight × tokens`).
- **Implementer subagents:** subagents whose `.meta.json` description starts with `Implement`.
- **Selection:** `--phase` takes the sessions attributed to that phase (input case-insensitive). `--branch NAME` takes the phase in `NAME` when it holds a `ph-NN`, otherwise the main sessions whose most frequent `gitBranch` is `NAME`. Subagents always go with their session. Neither flag: every call in the period. No session selected: `error: no sessions found for <selection>` on stderr, exit 1.
- **Weekly limit, from the CSV:** the rows whose `session_id` is a selected main session, grouped by session and sorted by `timestamp`. Within a session, each increase of `seven_day_pct` from one row to the next adds to the sum; a drop is a reset and adds the new value. Rows with the wrong number of columns or a non-numeric percentage are skipped and counted. (Pairs are taken within a session, not across sessions, so other work between two sessions is not counted; work in parallel sessions still is, so the figure is an upper bound.)
- **Output:** one line `Sessions: N main, M subagent transcripts · calls from <first date> to <last date>`, then a table `| Indicator | This selection | Baseline | Target |` with the spec's eight indicators in its order and its targets, then a `Notes:` list: the CSV missing, covering K of N main sessions, or skipped rows; nothing when all is well. Token counts as `131k`, costs as `12.3M` units, shares as `58%`. A baseline still `None` prints `—`.
- **`--by-phase`:** instead of the report, a table of every phase in the period: phase, cost units, main sessions, peak context, first and last date.

- [x] **Step 3: Check parity with the frozen analysis**

Run: `python3 scripts/token-usage.py` (no flags) and `python3 scripts/token-usage.py --by-phase`, right after Step 1 so the transcripts are the same.
Expected: total cost, median context, share above 200k, idle share and Opus implementer share equal Step 1's numbers to the printed precision; each phase's cost ÷ total equals `phases.py`'s share to 0.1%. A difference is a porting bug: find it before going on. (Transcripts written between the two runs, such as this session's, can move the totals slightly; if so, run both again back to back.)

- [x] **Step 4: Write the fixtures and their check**

In `<scratchpad>/fixtures/`, one projects directory per case, each a minimal `.jsonl` (two or three assistant records with `requestId`, `timestamp`, `gitBranch`, `message.model`, `message.usage`) and, where needed, a `usage-log.csv`. `<scratchpad>/check-fixtures.sh` runs the script on each with `--projects` and `--usage-log` and asserts:

| Fixture | Command | Expected |
|---|---|---|
| `missing-usage` | `--projects fixtures/missing-usage` | exit 2, stderr names the file, the line and `message.usage` |
| `unknown-phase` | `--projects fixtures/basic --phase PH-99` | exit 1, `no sessions found` |
| `csv-reset` | `--projects fixtures/basic --phase PH-7 --usage-log fixtures/basic/reset.csv`, rows of one session `40, 45, 3, 6` plus one row with five columns | weekly limit `14%` (5 + 3 + 3), notes say 1 row skipped |
| `letter-phase` | `--projects fixtures/letter --phase ph-14a`, branch `feat/ph-14a-design-system` | exit 0, one main session |
| `duplicate` | `--projects fixtures/duplicate`: the same `requestId` in a session file and in a second (resumed) session file | the call counted once |

- [x] **Step 5: Run the fixture check**

Run: `bash <scratchpad>/check-fixtures.sh`
Expected: every case passes. (The fixtures are scratch; the spec gives the script no unit tests.)

- [x] **Step 6: Commit**

```bash
git add scripts/token-usage.py docs/superpowers/plans/2026-10-26-working-with-claude.md
git commit -m "chore(claude): add the token usage report script"
```

---

### Task 2: The baseline audit

**Files:**
- Create: `docs/audits/2026-10-26-token-usage.md`
- Modify: `scripts/token-usage.py` (the `BASELINE` values)

**Interfaces:**
- Consumes: Task 1's CLI.
- Produces: the audit's anchors `#baseline` and `#baseline-phases`, which the script's constants, the ADR and the guide cite; `BASELINE` filled.

- [x] **Step 1: Compute the baseline**

Run: `python3 scripts/token-usage.py --until 2026-10-26` and `python3 scripts/token-usage.py --by-phase --until 2026-10-26`.
The period ends on 2026-10-26 (inclusive, UTC) so the baseline can be recomputed later from the same transcripts. A **baseline phase** is a phase with sessions in the period; the median phase cost uses only the complete ones: a phase that started before the first transcript (its earlier sessions were deleted) or was not merged by 2026-10-26 is listed but marked and left out of the median.

- [x] **Step 2: Write the audit**

Layout as `docs/audits/2026-10-19-scalability-and-isolation-analysis.md`: title, a **Date** / **Status** (a point-in-time record) / **Design** (the spec's link) list, an introduction, `## Contents`, then:

- **Period and method:** the transcripts read and the date range the script reports; deduplication; the cost units and that they only approximate the subscription's meter; phase attribution; the 2026-10-26 cut-off.
- **Findings:** the spec's table, with the values from Step 1 and the frozen scripts; where they differ from the spec's (transcripts of the day added later), the audit's values stand and a line says so.
- **The simulation:** the restart savings from `sim.py` (about 20%; 30–35% with a cap), marked rough.
- **Baseline** (`#baseline`): the spec's indicator table with the computed values.
- **Baseline phases** (`#baseline-phases`): Step 1's `--by-phase` table, with the left-out phases marked and why, and the median.
- **The analysis scripts:** what each file in `2026-10-26-token-usage/` computes, how to run them (from their own folder, with the transcript directory as argument), and that they are frozen; `scripts/token-usage.py` is the maintained port.

- [x] **Step 3: Fill `BASELINE` in `scripts/token-usage.py`**

The values from the audit's Baseline table, with a comment above the dict citing `docs/audits/2026-10-26-token-usage.md#baseline` and saying they are constants on purpose (a change to the script must not move them). `sessions_per_phase` and `peak_ctx` hold the audit's figures as numbers (the median main sessions per complete phase; the median peak context).

- [x] **Step 4: Check the report against the audit**

Run: `python3 scripts/token-usage.py --until 2026-10-26` and `python3 scripts/token-usage.py --phase PH-40`.
Expected: the first one's "This selection" column equals its "Baseline" column for every indicator measured over all sessions (median context, share above 200k, idle share, Opus implementer share); the second prints a full table with a baseline in every row but the weekly limit, and a note that the CSV is missing.

- [x] **Step 5: Commit**

```bash
git add docs/audits/2026-10-26-token-usage.md scripts/token-usage.py docs/superpowers/plans/2026-10-26-working-with-claude.md
git commit -m "docs(audit): add the token usage baseline"
```

---

### Task 3: The status line

**Files:**
- Modify: `~/.claude/statusline-command.sh` (outside the repository; back it up to `<scratchpad>/statusline-command.sh.orig` first)
- Scratch: `<scratchpad>/statusline-input.json`, `<scratchpad>/check-statusline.sh`

**Interfaces:**
- Produces, for Task 1's weekly-limit row and Task 5's guide: `~/.claude/usage-log.csv` in the Global Constraints' columns; the environment variable `USAGE_LOG_FILE` overrides its path (for the checks only, so they never write to the real log).

- [x] **Step 1: Capture a real input**

Add, right after `input=$(cat)`, the temporary line `printf '%s' "$input" > <scratchpad>/statusline-input.json` (the absolute scratchpad path). Wait for the status line to refresh (one reply), then remove the line.
Run: `python3 -c 'import json; d=json.load(open("<scratchpad>/statusline-input.json")); print(json.dumps({k: d.get(k) for k in ("session_id", "model", "context_window", "rate_limits")}, indent=1))'`
Expected: the `context_window` fields. Record which gives the context in tokens: `current_usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens` should match `used_percentage × context_window_size ÷ 100` within a percent. If `current_usage` is missing or differs, use the fallback and say so in the task summary.

- [x] **Step 2: Write `<scratchpad>/check-statusline.sh`**

It builds inputs from the captured one with `python3` (setting the context fields to the token counts below, keeping a 1M window), pipes each to `bash ~/.claude/statusline-command.sh` with `USAGE_LOG_FILE=<scratchpad>/usage-log.csv`, and asserts on `cat -v` of the output:

| Case | Expected |
|---|---|
| 131,000 tokens | `^[[00;32m[#         ] 13% 131k` |
| 160,000 tokens | `^[[00;33m` before `16% 160k` |
| 250,000 tokens | `^[[00;31m` before `25% 250k` |
| first run with `rate_limits` | the log has the header and one row; the row's `session_id`, `branch`, `model` (`model.id`), both percentages and `context_tokens` match the input |
| a second run at once | still one row |
| after `touch -d '2 minutes ago'` on the log | two rows |
| `rate_limits` removed, fresh log path | no file created |

- [x] **Step 3: Run it to see it fail**

Run: `bash <scratchpad>/check-statusline.sh`
Expected: FAIL on the tokens (the script prints `13%` only) and on the log.

- [x] **Step 4: Change the status line**

- **Tokens:** from Step 1's field, printed after the percentage as `%dk` (rounded to the nearest thousand). The bar's fill stays the percentage.
- **Color:** by the tokens: green below 150,000, yellow from 150,000 to 200,000, red above 200,000. The 5-hour and weekly segments keep their percentage colors.
- **Log:** only when both rate-limit percentages are present; skipped when the file was modified less than 60 seconds ago (`stat -c %Y`); the header written when the file is created; `timestamp` from `date -u +%Y-%m-%dT%H:%M:%SZ`. The whole block runs with errors discarded (`2>/dev/null`, `|| true`) so it can never break the status line.
- **One `python3` call per field stays.** The header comment describes the new token segment, its colors and the log.

- [x] **Step 5: Run the checks, including a log that cannot be written**

Run: `bash <scratchpad>/check-statusline.sh`, then the 131,000 case with `USAGE_LOG_FILE=/nonexistent/dir/log.csv` and with a read-only file.
Expected: all cases pass; the unwritable cases print the same line as with a writable log, exit 0, empty stderr.

- [x] **Step 6: See it live and commit the tick**

The status line of the running session shows `… NN% NNNk` in the right color, and `~/.claude/usage-log.csv` gains a row within a minute or two. Only the plan changes in the repository:

```bash
git add docs/superpowers/plans/2026-10-26-working-with-claude.md
git commit -m "docs(plan): tick the status line task"
```

---

### Task 4: ADR 0052

**Files:**
- Create: `docs/decisions/0052-working-with-claude.md`
- Modify: `docs/decisions/0004-implementation-process.md` (status line; decision 8's cell)

**Interfaces:**
- Consumes: the audit's anchors (Task 2).
- Produces: `docs/decisions/0052-working-with-claude.md`, decisions numbered as the spec's 1 to 14, which Tasks 5 to 7 cite by number.

- [x] **Step 1: Check the number**

Run: `git fetch origin main && git ls-tree --name-only origin/main docs/decisions/ | grep -E '005[0-9]'`
Expected: no `0052-`. If it is taken, take the next free number and use it everywhere this plan says 0052, including the branch's other files.

- [x] **Step 2: Write the ADR**

Layout as [ADR 0051](../../decisions/0051-acceptance-criteria.md): title `ADR 0052 — Working with Claude within the weekly limit`; **Status** ✅ Accepted; **Date** 2026-10-26; **Extends:** [ADR 0004](../../decisions/0004-implementation-process.md), decision 8 (a phase on the full path runs as one session per stage). Then:

- **Context:** the spec's [Goal](../specs/2026-10-26-working-with-claude-design.md#goal), [Why now](../specs/2026-10-26-working-with-claude-design.md#why-now) and the headline numbers, linking the audit and the spec.
- **Decisions:** the spec's 14 decisions, in its order, in the ADR's table (`# | Topic | Options considered | Decision and reasoning`), each with who chose it as the spec marks it. Decision 1 links [OP-109](https://github.com/luiki-dev/szop/issues/296); decision 13 cites [ADR 0014](../../decisions/0014-roadmap.md), decision 6 as restated, not changed; decision 9 links the audit's `#baseline`.
- **Consequences:** what changes for the owner and for Claude (sessions per stage, the status line, the report in phase PRs, the CLAUDE.md rule and default subagent model), the risks from the spec's [Risks](../specs/2026-10-26-working-with-claude-design.md#risks), and the evaluation open point (its link is added in Task 7).

- [x] **Step 3: Add the notes to ADR 0004**

Its status line: append `; decision 8 extended by [ADR 0052](0052-working-with-claude.md) (one session per stage of a phase)`. Decision 8's cell: append `<br>➕ **Extended by [ADR 0052](0052-working-with-claude.md), decision 2:** a phase on the full path runs as one session per stage, each starting from the committed spec or plan.`

- [x] **Step 4: Check the links**

Run: `grep -o '](\([^)#]*\)' docs/decisions/0052-working-with-claude.md | sort -u` and open every relative target from `docs/decisions/`.
Expected: each file exists, and each anchor matches a heading in its file.

- [x] **Step 5: Commit**

```bash
git add docs/decisions/0052-working-with-claude.md docs/decisions/0004-implementation-process.md docs/superpowers/plans/2026-10-26-working-with-claude.md
git commit -m "docs(adr): add ADR 0052 working with Claude within the weekly limit"
```

---

### Task 5: The guide

**Files:**
- Create: `docs/development/working-with-claude.md`

**Interfaces:**
- Consumes: ADR 0052's decision numbers (Task 4), the audit's anchors (Task 2), the status line's segment and log (Task 3), the script's CLI (Task 1).
- Produces: the anchors CLAUDE.md links in Task 6: `#a-phase-in-sessions`, `#reading-the-status-line`, `#choosing-models`, `#measuring`.

- [x] **Step 1: Write the guide**

A living doc, written to teach (the owner wants to learn the skill, not only apply it): an introduction linking ADR 0052 and the audit, `## Contents`, and the sections of the spec's [The guide](../specs/2026-10-26-working-with-claude-design.md#the-guide), in its order, as `##` headings:

- **Why this matters**, **How usage builds up** (the prompt cache, why a session's cost grows roughly with the square of its length, compaction, the ≈47k start and 57–68k after a compaction, the cost per call by context from the audit).
- **A phase in sessions:** the spec's stage table, an opening prompt for each stage (`Plan PH-NN from docs/superpowers/specs/<spec>.md`, `Execute the plan <plan>.md; tasks 1–3 are committed`, …) with what a new session reads first, restart versus `/compact`, Remote Control.
- **Reading the status line:** the thresholds table with what to do at each color, the relevant excerpt of `~/.claude/statusline-command.sh` (the token and color part) and where the file lives.
- **Breaks and the cache:** the one-hour lifetime, the 4.9% figure.
- **Choosing models:** the coordinator, subagents (the rules of the spec's [Subagent models](../specs/2026-10-26-working-with-claude-design.md#subagent-models), the retry on Opus after two failures), effort, the order of precedence.
- **Measuring:** the CSV log (columns, once a minute), `scripts/token-usage.py` with its flags and an example of its output, the report in a phase PR, how to read each indicator, the evaluation after 3–4 phases.
- **The settings involved:** a table of `autoCompactWindow`, `cleanupPeriodDays`, `statusLine` (user settings, `~/.claude/settings.json`) and `CLAUDE_CODE_SUBAGENT_MODEL` (project settings, `env`), each with its value and why.

- [x] **Step 2: Check the Contents and the links**

Run: `grep -n '^##' docs/development/working-with-claude.md` and compare with its Contents; check every relative link as in Task 4, Step 4.
Expected: every `##` and `###` heading in the Contents, every link resolves.

- [x] **Step 3: Commit**

```bash
git add docs/development/working-with-claude.md docs/superpowers/plans/2026-10-26-working-with-claude.md
git commit -m "docs(claude): add the guide to working with Claude within the weekly limit"
```

---

### Task 6: CLAUDE.md, the default subagent model and the glossary

**Files:**
- Modify: `CLAUDE.md`, `.claude/settings.json`, `docs/glossary.md`, and every doc that lists the development guides (find them with `grep -rln 'phase-walkthrough.md' --include=*.md . | grep -v -e superpowers -e archive -e audits -e decisions`)

**Interfaces:**
- Consumes: the guide's anchors (Task 5), ADR 0052 (Task 4), the script's CLI (Task 1).
- Produces: the "Before opening the PR" step Task 7 follows.

- [x] **Step 1: Set the default subagent model**

In `.claude/settings.json`, add a top-level `"env": { "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet" }` and change nothing else.
Run: `git diff .claude/settings.json`
Expected: only the `env` lines added.

- [x] **Step 2: Check both ends of the precedence**

The `env` is read when a session starts: restart the session (or start a new one on this branch) first. Then dispatch two trivial agents (`Reply with the word ok`), one with no `model` and one with `model: opus`, and read the `message.model` of each one's transcript under `~/.claude/projects/-home-lemekk-workspace-szop/<session>/subagents/`.
Expected: the first `claude-sonnet-…`, the second `claude-opus-…`. If the second is not Opus, stop: the owner decides (the spec's [Subagent models](../specs/2026-10-26-working-with-claude-design.md#subagent-models)). Note both transcripts' file names for the PR.

- [x] **Step 3: Change CLAUDE.md**

- A new section `## Working with Claude`, after "Project tracking", with the spec's five bullets ([Changes to CLAUDE.md](../specs/2026-10-26-working-with-claude-design.md#changes-to-claudemd)): a session per stage; restart or `/compact` above 150–200k of context; before a break longer than an hour, finish the stage; implementers on Sonnet (the default), the whole-branch review on Opus named explicitly; links to the guide and to ADR 0052. Short: the guide holds the reasons.
- In "Before opening the PR", a new bullet: `In the PR description: a "Token usage" section with the output of scripts/token-usage.py --branch <the phase branch>` (in the list's style).
- In "Documentation", a line for `docs/development/working-with-claude.md` after `phase-walkthrough.md`'s.

- [x] **Step 4: Glossary and the guide lists**

`docs/glossary.md`: the new niche terms in its Terms table, alphabetically, each with a link to the guide: at least *prompt cache*, *compaction*, *cost unit*, *context (of a call)*, *subagent*, *coordinator* — whichever are not there yet. Add the guide to each doc the grep in **Files** found, next to `phase-walkthrough.md`.

- [x] **Step 5: Check**

Run: `pnpm exec prettier --check CLAUDE.md docs/glossary.md docs/development/working-with-claude.md docs/decisions/0052-working-with-claude.md docs/audits/2026-10-26-token-usage.md .claude/settings.json` (skip any file Prettier ignores) and `git diff --stat`.
Expected: no formatting errors; only the files of this task changed.

- [x] **Step 6: Commit**

```bash
git add CLAUDE.md .claude/settings.json docs/glossary.md docs/superpowers/plans/2026-10-26-working-with-claude.md <the guide lists>
git commit -m "docs(claude): add the working-with-Claude rules and the default subagent model"
```

---

### Task 7: Tracking and the PR

**Files:**
- Modify: `docs/decisions/0052-working-with-claude.md` (the evaluation open point's link)

**Interfaces:**
- Consumes: everything above.

- [x] **Step 1: The `adr` issue**

Create `ADR 0052 Working with Claude within the weekly limit`, label `adr`, its body like the earlier `adr` issues (`gh issue list --label adr --state all --limit 3`, then `gh issue view`): the link to the ADR on `main` and "Landed in" the PR (filled after Step 4). Set its fields as "How items move" says for "An ADR is made outside a phase", Started 2026-10-26.

- [x] **Step 2: The evaluation open point**

Find the next free `OP-` ID ([how](../../development/project-tracking.md#checking-with-gh)). Create `OP-NNN Evaluate the token-saving habits after 3–4 phases`, label `open-point`, no parent, ⬜ Backlog. Its body: what to compare (each phase's report against the baseline), the four targets of decision 14, where the findings go (the guide; a new ADR or audit if the targets change), and links to ADR 0052 and the audit on `main`. Add its link to ADR 0052's Consequences.

- [x] **Step 3: The report**

Run: `python3 scripts/token-usage.py --phase PH-40` and `python3 scripts/token-usage.py --branch docs/adr-0052-working-with-claude`.
Expected: two tables; the first is the PR's example, the second this branch's own usage.

- [x] **Step 4: Review, push and open the PR**

Run Task 4, Step 1's check again (another branch may have taken 0052 since). Review the branch's diff against the spec's [Definition of done](../specs/2026-10-26-working-with-claude-design.md#definition-of-done). Commit the ADR link and the ticks (`docs(adr): link the evaluation open point`), push, then `gh pr create` with the title `docs(claude): work with Claude within the weekly limit`, label `skip-changelog`, and the PR template filled in. The description holds: `Closes #<adr issue>`; the list of issue changes (the `adr` issue created, the open point created); a "Token usage" section with both tables of Step 3; that the status line was checked with sample input (Task 3) and is outside the repository; the subagent model check with its two transcripts (Task 6, Step 2); that `scripts/token-usage.py` and `.claude/settings.json` count as code for CI's change detection, so the code jobs run. Then fill "Landed in" in the `adr` issue with the PR's link.

- [x] **Step 5: Check**

Run: `gh pr view --json title,labels,body | head -40` and `gh pr checks`.
Expected: the title and label as above, `Closes #` present, the checks running or passing.
