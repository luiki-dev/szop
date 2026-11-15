# ADR 0077 — Only the owner's account merges into `main`

- **Status:** ✅ Accepted
- **Date:** 2026-11-15
- **Extends:** [ADR 0009](0009-git-workflow.md), decision 13 (a second ruleset on `main`, see decision 1)

## Context

Since [PH-49](../roadmap.md#ph-49-reproducible-docker-sandbox-setup), Claude Code in the Docker Sandbox acts as the machine account `luiki-dev-claude`, a collaborator with Write ([ADR 0076](0076-docker-sandbox-setup-phase-details.md)). The [ruleset for `main`](../development/github-settings.md#ruleset-for-main) asks for one approval from someone other than the author and for green checks; once both are there, anyone with Write can merge. The machine account cannot approve its own PR, so it cannot merge one. It can approve any other: a PR a session on WSL opened from the owner's account, a Dependabot PR, release-please's release PR. Holding that account's token, Claude in the sandbox could approve such a PR and merge it ([OP-148](https://github.com/luiki-dev/szop/issues/440), found by the owner after merging #439).

Only the deny rules in `.claude/settings.json` stood in the way. They cover `gh pr merge*` and `gh api *merge*` but not `gh pr review`, and they match command patterns, not permissions ([ADR 0012](0012-security-baseline.md), decision 19). A personal repository has no role between Write and Admin. [ADR 0062](0062-urgent-security-fixes.md), "Consequences", already named the fix: a second account for Claude, kept off a "Restrict updates" bypass list.

GitHub's documentation says "Restrict updates" lets only actors with bypass permission push to the matching branches. It does not say in so many words that a PR's merge counts as such a push, nor how a bypass in one ruleset sits with the rules of another that targets the same branch. The rollout tests both (decision 5).

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Who can merge into `main` | A second ruleset with only **Restrict updates**, its bypass the admin role; **Restrict updates** added to the `main` ruleset, its bypass the admin role; only deny rules and the corrected docs; nothing, since the gap closes once every PR comes from the sandbox | **A second branch ruleset, `main-merge`, on the default branch, with only Restrict updates and the Repository admin role on its bypass list.** The admin role is the owner's account alone, so only the owner merges; the `main` ruleset keeps its empty bypass list, so the approval and the checks still bind the owner too. Restrict updates in the `main` ruleset would put the admin's bypass on all its rules, so the owner, and Claude on WSL with the owner's credentials, could merge without approval or checks. Deny rules alone are patterns, not permissions. Waiting does not help: the Dependabot and release PRs are authored by bots, which the machine account can approve, and WSL sessions stay possible. Claude's recommendation; the owner chose it. |
| 2 | The bypass mode | **Always allow**; **For pull requests only** | **For pull requests only**: the admin's bypass covers only merging a PR, never a direct push. The `main` ruleset already asks for a PR, so this changes nothing for the owner today; it keeps the new ruleset from opening a path if the other is ever changed. Claude's call. |
| 3 | Claude approving a PR | Leave it to the ruleset; deny rules for it too | **Deny rules for `gh pr review*`, `gh pr * review*` and `gh api *reviews*`.** After decision 1 the machine account's approval can no longer lead to its own merge, but it would still count as the approval the owner relies on when reading a PR. Like the merge rules, they also refuse a few reads, such as `gh pr view --json reviews`. From the issue; Claude's wording. |
| 4 | Claude on WSL, with the owner's credentials | Close it too; leave it as ADR 0062 accepted it | **Left as accepted.** The owner's account is the admin, so the bypass of decision 1 covers it; the `main` ruleset's approval and checks still apply, and the deny rules and the habit stand before a merge, as before. The gap shrinks as the work moves to the sandbox. Claude's call. |
| 5 | Rollout and the test | Apply and trust the docs; apply and test on a real PR | **The owner adds the ruleset while this ADR's PR is open, then tests it on the next PR the machine account opens** (the sandbox's time zone): (a) the owner, before approving, tries to merge it as `luiki-dev`, which must be refused for the missing approval; (b) the owner approves it as `luiki-dev`; (c) the machine account runs `gh pr merge --merge`, from a command the owner runs in the sandbox, which must be refused; (d) the owner merges it as `luiki-dev`. This ADR's PR is merged after the test, with the results in its description. The owner's choice. |

## Consequences

- [GitHub settings](../development/github-settings.md#ruleset-for-merging-into-main) records the new ruleset, its order of applying and its check, and corrects the machine account's line: it cannot merge any PR, not only its own.
- The [threat model](../architecture/threat-model.md) lists the new ruleset among the guards on the machine account.
- An admin bypass on a ruleset is new to Szop's rulesets: until now, only the release App bypassed one (the version tags'). The owner is kept off that one because Claude on WSL pushes with the owner's credentials; here the owner's bypass gives no more than the owner already had, since the other ruleset still binds the merge.
- If the test fails at (c), Restrict updates does not cover a PR's merge, and this ADR is revisited before its PR is merged. If it fails at (a), the bypass reaches across rulesets, and the bypass mode or the approach is revisited.
