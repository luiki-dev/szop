# ADR 0074 — Read-only AWS access phase details

- **Status:** ✅ Accepted
- **Date:** 2026-11-08
- **Refines:** [ADR 0029](0029-aws-account-and-terraform-bootstrap-details.md), decision 3 (a second Identity Center user); [ADR 0063](0063-inactive-ecs-cluster-not-a-leftover.md), decision 1 (the leftovers check asks about more resource types)
- **Extends:** [ADR 0012](0012-security-baseline.md), decision 19 (deny rules for the administrator profile)

## Context

Claude Code ran with `AWS_PROFILE=szop`, which is `AdministratorAccess` on the account: while the owner was signed in, a session could do anything on AWS, and neither a deny rule nor a hook covered `aws` or `terraform` ([OP-142](https://github.com/luiki-dev/szop/issues/422)). The safeguards of [ADR 0012](0012-security-baseline.md) guard CI, not local credentials.

Checking a failed `demo-down` by hand showed why a session needs to read AWS at all ([#421](https://github.com/luiki-dev/szop/issues/421)): the runs of 2026-11-07 and 2026-11-08 failed with nothing of the demo left, because the tagging API listed a deleted ECS service, a task and 7 security group rules for longer than the step's 10-minute wait. The fix of [#373](https://github.com/luiki-dev/szop/issues/373) skips only an `INACTIVE` cluster.

[PH-47](../roadmap.md#ph-47-read-only-aws-access-for-claude-code) settles both. It takes the bounded path: the design was agreed in the brainstorm, and this ADR holds it in place of a spec and a plan ([ADR 0072](0072-phase-approach-per-phase.md), decision 1).

## Changes to the roadmap

- **PH-47 is added** to Stage 4, after [PH-46](../roadmap.md#ph-46-list-items-polish).

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | The phase's approach | The full path. | **Bounded; one new concept, least-privilege local credentials; four tasks; one stop, after Task 1, for the owner's console step.** Claude's recommendation; the owner chose it. |
| 2 | Who Claude Code is on AWS | A second permission set on the owner's user. | **A separate Identity Center user `claude`, with its own MFA and one assignment only.** An SSO token belongs to the user, and `GetRoleCredentials` returns credentials for any role assigned to that user: with a second permission set on the owner's user, the read-only login could still ask for `AdministratorAccess`. The owner chose it. |
| 3 | What it may read | `ReadOnlyAccess` alone; a list of allowed actions written by hand. | **A permission set `ClaudeReadOnly`: `ReadOnlyAccess` plus the denies of `szop-ci-plan`** (secret values, log contents, data reads, billing, personal data). The plan role's list is already checked against `ReadOnlyAccess`. A session's output reaches a third party, so the reasons for a public plan log hold here too. Claude's recommendation; the owner approved it. |
| 4 | The Terraform states | Allow `base/` and `demo/`, as the plan role does. | **Every S3 object read is denied, the states too.** The plan role needs them to plan; Claude Code does not, and CI plans every PR. So a session cannot run `terraform plan` against AWS. Claude's recommendation; the owner approved it. |
| 5 | How the user and permission set are created | Terraform in `infra/base`. | **By hand in the console, with the policy JSON in the [runbook](../operations/demo-environment.md#read-only-access-for-claude-code).** Terraform would have to read and write Identity Center, which means more permissions and more work for one user. Known limit: the copy can drift from `ci_plan_denies`; a note sits beside each, and nothing checks it. Claude's recommendation; the owner approved it. |
| 6 | The login | Reusing the SSO session `szop`. | **A profile `claude-readonly` with its own SSO session of the same name.** The token cache is per session, so a shared session would make the two logins overwrite each other. The name avoids `szop`, so the deny rules of decision 8 do not catch it. Settled while writing the runbook, within the owner's approved design. |
| 7 | How a session gets the profile | The owner exports it before each session; a shell alias. | **`env.AWS_PROFILE` in `.claude/settings.json`**, committed, so every session has it without anyone remembering. Claude's recommendation; the owner approved it. |
| 8 | Deny rules | None, since they can be bypassed. | **`Bash(*--profile szop*)` and `Bash(*AWS_PROFILE=szop*)`, as a seat belt.** They catch a mistake, not a determined command ([ADR 0015](0015-git-push-guard-hook.md)). Claude's recommendation; the owner approved it. |
| 9 | Administrator sign-ins | Leaving the admin login signed in for its 8 hours. | **The owner signs in as administrator for the work only, then runs `aws sso logout`**: a line in the runbook and a row in `/demo-check`. The logout clears every profile's token, so `claude-readonly` needs a new login afterwards. Known limit: while the owner is signed in as administrator, a running session could use that token, since it sits in the same `~/.aws/sso/cache`; only the deny rules cover that. Claude's recommendation; the owner approved it. |
| 10 | The leftovers check ([#421](https://github.com/luiki-dev/szop/issues/421)) | A longer wait, which the 8-hour lag rules out; skipping these types by ARN, which would hide a real leftover. | **`leftovers` keeps its 10-minute wait and also asks each listed resource's own service. It skips an ECS service `INACTIVE` or `MISSING`, a task `STOPPED` or `MISSING`, and a security group rule on `InvalidSecurityGroupRuleId.NotFound`.** A denied call, an API error, a running service or any other type still fails, so the check fails safe. Subnets stay out until they fail a run. The deploy role already allows `ecs:Describe*` and `ec2:Describe*`. Claude's recommendation; the owner approved it. |

## Consequences

- A session reads AWS configuration through `claude-readonly` and cannot change anything, read a secret value, a log line or a Terraform state.
- A session cannot help with what those denies hide: the owner reads a log or a state, as the administrator, and pastes what is needed.
- The owner signs in twice on the same machine, as two users, so the read-only login runs in a private browser window.

## Settled while building

- **Checked on AWS, 2026-11-08, with the login of `claude-readonly`:** the identity is the role `ClaudeReadOnly` of the user `claude`; reads work; `ec2 create-vpc --dry-run` answers `UnauthorizedOperation`; SSM, Secrets Manager, S3 objects, log lines and Cost Explorer answer with an explicit deny.
- **Checked in a new headless session:** `env.AWS_PROFILE` overrides an inherited `AWS_PROFILE`, and both deny rules refuse a command. A session that started before the settings changed keeps the inherited value.
- **The deny rules match the command's text, not what it does:** they also refuse a harmless command that holds those words, such as a commit message or `gh pr create --body`. Such text goes in a file (`--body-file`), or is reworded.
- **`/demo-check` tells Claude to ask the owner for CloudWatch's log lines** on a failed demo, since decision 3 hides them from it. `gh run` logs stay readable.
