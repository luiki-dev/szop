---
name: finish-phase
description: Finishes a phase branch, or any other branch such as an ADR made outside a phase, with the checks on the final head, the whole-branch review on Opus, one triage of the findings and the PR. Run at the finishing stage by its opening prompt, by the owner, or by Claude when a plan's last task is done. Replaces `superpowers:finishing-a-development-branch` (ADR 0059, decision 8).
---

# Finish a phase

After [ADR 0059](../../../docs/decisions/0059-session-skills.md), decisions 6 to 8. The steps marked _phase only_ are skipped on a branch outside a phase (an ADR, a chore). The skill points to other documents and does not restate them: the tracking steps are in `/phase-tracking`, the PR's items in `.github/pull_request_template.md`, the demo check in the [definition of done](../../../docs/development/definition-of-done.md#the-demo-check).

From `superpowers:finishing-a-development-branch` it keeps the checks on the final head and the rule never to force-push a rejected push. It drops the menu, the local merge and the worktree cleanup. It never merges, never triggers `demo-up` or `demo-down`, and never removes a worktree.

1. **Check the final head.** The branch is pushed and `git status -sb` is clean. Run `pnpm check`. When `git diff --name-only $(git merge-base main HEAD)` touches `apps/`, `packages/` or `e2e/`, run `pnpm test:e2e` too (a branch of docs and `.claude/` only has nothing for it to catch). A failure stops everything until it is fixed; a green run from an earlier commit does not count.
2. **Whole-branch review on Opus.** Dispatch a reviewer with `model: opus`, using the prompt `code-reviewer.md` of `superpowers:requesting-code-review`, from the merge base with `main` to the head, and tell it to read `docs/superpowers/plans/CLAUDE.md` first. Its Critical, Important and Minor stay as the severity.
3. **Merge the list.** Put the review's findings together with the `## Findings` table of the ledger (`.superpowers/sdd/<plan>/progress.md`). Without a ledger, the review's findings are the list. Duplicates become one line. A finding marked fixed in the table is checked in the code: dropped only if it is fixed there, otherwise it stays in the list.
4. **One triage message to the owner.** Findings grouped 🔴 Critical, 🟠 Important, ⚪ Minor, numbered across the groups, each with what, where, the recommendation (fix now, open point, bug, drop) and a reason in one sentence. End with how to answer. Nothing found: say so and go on. Example:

   ```text
   🟠 Important
   1. Stale route in the setup guide (docs/development/setup.md:42). Fix now: a one-line change.
   ⚪ Minor
   2. Unused export in apps/web/src/lib (cn.ts:9). Open point: no caller yet, a later phase may use it.

   Answer like: "now: 1; OP: 2; the rest dropped".
   ```

5. **Act on the answer.**
   - Fixes in one round: an implementer on Sonnet, with its review; committed and pushed.
   - Open points and bugs through `/phase-tracking`, as sub-issues of the phase that will settle them, each with its source.
   - The dropped ones noted as declined in the phase ADR's "Settled while building" _(phase only)_.
6. **Token usage** _(phase only)_: `scripts/token-usage.py --branch <branch>`, kept for the PR.
7. **`/phase-tracking`, "Before opening the PR".**
8. **Open the PR** from the template: a Conventional Commits title, the definition of done items ticked or `➖ N/A`, "Checked at the demo:" left for `/demo-check`, the token usage section _(phase only)_, the `skip-changelog` label when the release notes need no line. Never merge. A rejected push is never forced.
9. **Wrap up.** If the branch is in a worktree, say so and that it is removed after the merge. Offer `/demo-check` when the definition of done needs one.
