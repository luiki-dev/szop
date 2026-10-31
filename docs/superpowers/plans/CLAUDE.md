# Executing a plan

Rules for any session that executes a plan in this folder, whichever method the owner chose at the plan's handoff (subagent-driven or native), and the one home of the repo-wide rules a plan's implementers follow ([ADR 0054](../../decisions/0054-leaner-documentation.md), decision 11). The owner reviews each task as it lands, often remotely, where only pushed changes are visible.

**Dispatching an implementer:** the session that dispatches one tells it, in its prompt, to read this file before its task. An implementer sees only its task's text, not the plan, so it would not come across this file on its own.

## After each task

- **After each task:** commit it, `git push` the phase branch, then stop and summarize the task for the owner. Start the next task only when the owner says so.
- **Tick the task's step boxes** (`- [ ]` → `- [x]`) in the plan, in the task's own commit, so the pushed plan shows progress.
- **Never merge.** The PR opens after the last task, or when the owner asks.

## Repo-wide rules

- **Git:** never commit to `main`; a phase is one branch named `type/ph-NN-short-description`; never merge a PR; never trigger `demo-up` or `demo-down`; don't work around the deny rules in `.claude/settings.json` or the push hook ([ADR 0009](../../decisions/0009-git-workflow.md); [ADR 0012](../../decisions/0012-security-baseline.md), decision 19; [ADR 0015](../../decisions/0015-git-push-guard-hook.md)).
- **Commits:** Conventional Commits with a scope from `commitlint.config.js`, a header of at most 100 characters, ending with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and the executing session's `Claude-Session:` line.
- **Docs style:** the "Writing style for docs and explanations" section of the root [`CLAUDE.md`](../../../CLAUDE.md); no jokes in docs, commits or PRs.
- **Review findings:** every finding a task review or an implementer reports and the task does not fix goes, in that task's turn, into the `## Findings` table of the ledger (`.superpowers/sdd/<plan>/progress.md`), with the columns `# | Severity | Source | Where | Finding`, IDs `F1`, `F2`, … (an example row: `F1 | Minor | Task 1 review | docs/development/tools/drizzle.md | Still says Szop has no tables yet`). The coordinating session writes the table; implementers do not edit the ledger. A finding fixed later is marked fixed with the commit, not deleted. The ledger's log keeps its own lines but does not list deferred findings. The triage after the whole-branch review is `/finish-phase`'s ([ADR 0059](../../decisions/0059-session-skills.md), decisions 6 and 7; [ADR 0054](../../decisions/0054-leaner-documentation.md), decision 2).
- **Finishing:** when the last task is done, finish the branch with `/finish-phase`, never `superpowers:finishing-a-development-branch`, even when the execution skill names it ([ADR 0059](../../decisions/0059-session-skills.md), decision 8).
- **Settled while building:** a decision taken during a task goes into the phase ADR's "Settled while building", in that task's commit.

## What a plan holds

- **"Order of work"** at the top: the tasks in order, each linking its section.
- **Global Constraints** with only this phase's constraints; the repo-wide rules above are not repeated.
- **The criteria and the docs to update** are linked from the spec, not listed again.
- **A line telling implementers to read this file** before their task.
