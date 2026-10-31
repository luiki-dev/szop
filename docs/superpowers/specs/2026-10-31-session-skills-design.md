# Session skills: design

The decisions are in [ADR 0059](../../decisions/0059-session-skills.md), which is made outside a phase, on the branch `chore/adr-0059-session-skills`. This spec holds what each skill does, what changes in which file and how it is checked.

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [/handoff](#handoff)
  - [The findings list](#the-findings-list)
  - [/finish-phase](#finish-phase)
  - [/demo-check](#demo-check)
  - [CLAUDE.md and the execution rules](#claudemd-and-the-execution-rules)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check-1)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

Make the three moments that repeat in every phase work the same way each time: handing a stage over to a new session, finishing a branch with one decision about the review findings, and the demo check as one list with who does what. This work is not a roadmap phase.

## Decisions

[ADR 0059, decisions](../../decisions/0059-session-skills.md#decisions).

## The design

Each skill is a `SKILL.md` in `.claude/skills/<name>/`, in the shape of `/phase-tracking` and `/new-adr`: a frontmatter `description` that names when to run it, then the steps. The skills point to the documents that hold the rules and their reasons instead of repeating them.

### /handoff

**Two modes:** without arguments it writes a handoff; with `resume <branch>` it picks one up.

**Writing (the owner runs it):**

1. **Put the work away.** If an edit is half done, finish the step or commit it as work in progress on the branch; never leave it uncommitted. Push the branch. In the execution stage, the ledger in `.superpowers/sdd/<plan>/` is current (finished tasks, rulings, the findings list).
2. **Write `.superpowers/handoff/<branch>.md`**, the branch name with `/` replaced by `-`, overwriting an earlier one. Its sections, in this order:
   - **Stage and next step:** one line each, such as "Execution of PH-16a" and "Task 6, not started".
   - **Branch and head:** the branch, the last commit's hash and subject, and that it is pushed.
   - **Read first:** the documents in reading order, with paths (spec, plan, the ledger, the phase ADR).
   - **Decided in the conversation:** what the owner decided that no committed document holds yet, one line each. Empty is fine.
   - **Waiting on the owner:** owner steps, reviews or answers the next session must not start without.
   - **Rules for this stage:** only what goes beyond the repo-wide rules, such as "stop after every task" or "the owner asked to run tasks 4 to 6 without stopping".
3. **Give the prompt** in a code block:

   ```text
   /handoff resume <branch>
   <stage>; next: <next step>
   ```

   In a cloud session, or when the owner says the next session runs in the cloud, the prompt instead carries the file's whole content after the first line, and the file is not written. Since the ledger is local too, the prompt then also carries what the next stage needs from it: the finished tasks, the rulings and the findings list _(Claude's call)_. Whether the session runs in the cloud is the owner's word or the environment (the builder picks the signal).
4. **Say where the file is** (its full path) and that the session can be closed.

**Resuming (the first message of a new session):**

1. `git status -sb`: the checkout is clean and on the named branch. If not, stop and tell the owner; never switch branches in a checkout that holds someone else's changes.
2. Read `.superpowers/handoff/<branch>.md`, or the content in the prompt. If neither is there, work from the prompt's second line and the stage's documents. Compare the file's head commit with `git log -1`: on a mismatch, stop and tell the owner what the file says and what git says, and wait for them to say which to trust _(Claude's call)_.
3. Read the documents under **Read first**.
4. Confirm in two or three lines: the stage, what is done, the next step, and what waits on the owner. Then wait for the owner's go, unless the file's rules say to go on.

### The findings list

The ledger of a plan's execution (`.superpowers/sdd/<plan>/progress.md`) gets a section of its own, `## Findings`, a table every task adds to:

| # | Severity | Source | Where | Finding |
|---|---|---|---|---|
| F1 | Minor | Task 1 review | `docs/development/tools/drizzle.md` | Still says Szop has no tables yet |

- **Severity** is the reviewer's: Critical, Important or Minor.
- **Source** is the task and who found it (review, implementer, the owner).
- A finding fixed later in the execution is marked fixed with the commit, not deleted, so the triage can check it.
- The execution's log keeps its own lines (dispatched, done, review clean) but no longer lists the deferred findings.
- The coordinating session writes the list from the reviews and the implementers' reports; implementers do not edit the ledger.
- A branch with no ledger (executed without a plan's workspace) has no list: the whole-branch review's findings go straight to the triage _(Claude's call)_.

### /finish-phase

Run at the finishing stage, by the opening prompt, by the owner, or by Claude when the last task of a plan is done. It finishes a phase branch, or any other branch (such as an ADR made outside a phase), skipping the steps marked _phase only_.

1. **Check the final head.** The branch is pushed and clean; `pnpm check` passes on it, and `pnpm test:e2e` too when the branch changes code (`apps/`, `packages/`, `e2e/`) _(Claude's call: a branch of docs and `.claude/` only has nothing for the end-to-end tests to catch)_. A failure stops everything until it is fixed. A green run from an earlier commit does not count.
2. **Whole-branch review on Opus** (`model: opus`), from the merge base with `main` to the head, with the reviewer prompt of `superpowers:requesting-code-review` (`code-reviewer.md`), told to read `docs/superpowers/plans/CLAUDE.md` first _(Claude's call: the same review as today, no prompt of our own)_. Its findings join the findings list, its Critical, Important and Minor kept as the severity.
3. **Merge the list.** Duplicates become one line; a finding marked fixed is checked in the code and dropped if it is.
4. **One triage message to the owner:** the findings grouped 🔴 Critical, 🟠 Important, ⚪ Minor, numbered, each with what, where, the recommendation (fix now, open point, bug, drop) and a reason in one sentence. The message ends with how to answer, such as "now: 1, 4; OP: 2; bug: 7; the rest dropped". Nothing found: say so and go on.
5. **Act on the answer:**
   - fixes in one round (an implementer on Sonnet, its review), committed and pushed;
   - open points and bugs through `/phase-tracking`, as sub-issues of the phase that will settle them, each with its source;
   - the dropped ones noted as declined in the phase ADR's "Settled while building" _(phase only)_.
6. **Token usage** _(phase only)_: `scripts/token-usage.py --branch <branch>`, for the PR.
7. **`/phase-tracking`, "Before opening the PR".**
8. **Open the PR** from the template: a Conventional Commits title, the definition of done items ticked or `➖ N/A`, "Checked at the demo:" left for `/demo-check`, the token usage section _(phase only)_, the `skip-changelog` label when the release notes need no line. Never merge.
9. **Wrap up:** if the branch is in a worktree, say so and that it is removed after the merge; offer `/demo-check` when the definition of done needs one.

From the superpowers skill it keeps the checks on the final head and the rule never to force-push a rejected push. It drops the menu, the local merge and the worktree cleanup.

### /demo-check

Run after the PR opens, on the branch's final head, by the owner or offered by `/finish-phase`.

1. **Work out the list:** the fixed steps of [the demo check](../../development/definition-of-done.md#the-demo-check), whether the branch changes `infra/base` (then sign-in and apply come first), whether it changes the UI (then Lighthouse), and the behaviors in the spec's "Demo check".
2. **One message with the whole list,** a table:

   | # | Who | Where | Check | Reply |
   |---|---|---|---|---|
   | 1 | Owner | Terminal: `aws sso login --profile szop` | Signed in | — |
   | 2 | Owner | GitHub → Actions → demo-up → Run workflow → branch `<branch>`, then approve the `demo` environment | Run started | "demo is up" after the run is green |
   | 3 | Claude | `curl https://szop.dzwoniec.com/api/health` | `ok`, commit `<head>` | — |

   The **Where** column links the runbook section for each owner step; the sections exist already ([Sign in from the CLI](../../operations/demo-environment.md#5-sign-in-from-the-cli), [Applying base](../../operations/demo-environment.md#applying-base), [Pressing the button](../../operations/demo-environment.md#pressing-the-button), [With the button](../../operations/demo-environment.md#with-the-button) under tearing down). The message ends with the two replies Claude waits for. If the owner says at the start that they do everything, every row is theirs, Lighthouse included, and they reply once at the end with the report's path.
3. **After "demo is up":** Claude follows the run if it is still going (`gh run watch`), then checks:
   - `/api/health` answers `ok` with the head commit;
   - `http://` redirects to `https://`;
   - the console on `/` and on the phase's screens shows no messages (Chrome DevTools MCP);
   - Lighthouse with its default mobile profile on `/`: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT reported ([NFR-3](../../requirements/NFR-non-functional-requirements.md#nfr-3)), for a branch that changes the UI.

   One line per check back to the owner. On a failure, Claude looks at the logs ([the runbook's debugging section](../../operations/demo-environment.md#debugging)) before reporting.
4. **After the owner's second reply** (the behaviors, `demo-down` done): a short summary, each check ✅ or ❌, and the "Checked at the demo:" line filled in the PR from the spec. The owner ticks `Demo check`.

Claude never triggers `demo-up` or `demo-down`.

### CLAUDE.md and the execution rules

- **`CLAUDE.md`, "Git workflow":** the bullet about worktrees and local merges says to finish a branch with `/finish-phase`, not the superpowers skill.
- **`CLAUDE.md`, "Working with Claude":** a bullet naming the three skills and when each runs.
- **`CLAUDE.md`, the icons:** the severity icons 🔴 🟠 ⚪ also mark a review finding's severity.
- **`docs/superpowers/plans/CLAUDE.md`:** the review findings rule points to the findings list and `/finish-phase`; a rule that a deferred finding goes into the list in the task's turn; the finishing step is `/finish-phase`, never `superpowers:finishing-a-development-branch`.

## Acceptance criteria

None: this work changes how sessions run, not Szop's behavior.

## Tests

- **`/handoff`, by hand:** on this branch, run `/handoff`; the file appears at `.superpowers/handoff/chore-adr-0059-session-skills.md` with every section, and the prompt has the two lines. A new session started with that prompt confirms the stage and next step without being told anything else. Then make a commit after the handoff and resume again: the session stops on the head mismatch.
- **`/finish-phase` and `/demo-check`:** read against the steps above at the review; their first real run is the next phase's finishing stage, and anything that goes wrong there is fixed in that phase.
- `pnpm check` passes, and every link in the changed docs resolves.

## Documentation

- **`docs/development/working-with-claude.md`:** the opening prompts table uses `/handoff resume` for a continued stage and `/finish-phase` for finishing; the ledger paragraph names the findings list; restart or compact mentions `/handoff`.
- **`docs/development/definition-of-done.md`:** "The demo check" says it is run with `/demo-check`, and item 4 that Claude may run the checks that need no owner.
- **`docs/development/phase-walkthrough.md`:** the finishing and demo steps name the skills, where it describes them.
- **`docs/decisions/0052-working-with-claude.md`:** a `➕ Extended by ADR 0059` note in decision 2.
- **`docs/decisions/0054-leaner-documentation.md`:** a `✏️ Refined by ADR 0059` note in decision 2.
- **`docs/glossary.md`:** "handoff" if the docs use it as a term.

## Demo check

➖ N/A: no deployed behavior changes.

## Risks

- **A resumed session trusts a stale handoff file:** the file names the head commit, and resume compares it with `git log`; a mismatch is reported before anything else.
- **Lighthouse's command-line tool does not run in WSL** or differs from the Chrome panel: the owner saves the report from Chrome and Claude reads it, as today.
- **`superpowers:subagent-driven-development` still starts its own finishing skill:** the rule in `plans/CLAUDE.md` is what the executing session reads; the owner may have to say "`/finish-phase`" the first time.
- **The findings list is skipped by an implementer:** the coordinator writes the list from the reviews, not the implementers.

## Out of scope

- `/start-phase` and a script for the docs' consistency rules (ADR 0059, decision 1).
- Starting new sessions automatically.
- Committing the handoff file.
- Changing the demo check's list of steps.

## Left to the builder

- The wording inside the three skills, as long as every step above is kept.
- How the Lighthouse command-line tool is run (a one-off `npx` with a pinned version, which Chrome) and where its report is saved, within the scratchpad. No dependency or script is added to the repository _(Claude's call)_.
- A read-through of `/finish-phase` and `/demo-check` against this spec as the plan's last task.
- Whether the skills need supporting files next to `SKILL.md`, such as a template for the handoff file or the demo table.
