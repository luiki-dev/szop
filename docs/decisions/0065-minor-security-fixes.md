# ADR 0065 — Minor security fixes (PH-43)

- **Status:** ✅ Accepted
- **Date:** 2026-11-04
- **Refines:** [ADR 0015](0015-git-push-guard-hook.md), decision 1; [ADR 0062](0062-urgent-security-fixes.md), decision 5

## Context

The [security audit of 2026-11-01](../audits/2026-11-01-security-audit.md) left a group of minor findings to this phase: the push hook misses some spellings (SEC-08), checking out a fork's branch runs its husky hooks (SEC-09), there is no private way to report a vulnerability (SEC-10), administrators may bypass every environment's rules (SEC-11), the plan role can read the owner's personal data (SEC-19), Let's Encrypt may issue a wildcard that covers the app (SEC-20) and the threat model is behind the code (SEC-21). Two open points join them: [OP-127](https://github.com/luiki-dev/szop/issues/367) (deny rules for `gh api … rerun`, and the reads they block) and [OP-129](https://github.com/luiki-dev/szop/issues/379) (Dependabot alerts for `qs` and `esbuild`). The phase is bounded ([ADR 0004](0004-implementation-process.md), decision 8): this ADR is its design, and there is no spec or plan. Claude proposed the design and the owner approved it in chat on 2026-11-04.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | The push hook's missed spellings | Accept them as gaps; teach the parser | **The parser learns them:** backslash escapes and `$'…'` quotes, `(`, `)`, `{` and `}` as separators, the keywords `if`, `then`, `do`, `else`, `elif`, `while`, `until` and `!`, and the wrappers `env` (with its options and `VAR=` words), `command`, `time`, `nohup` and `xargs` (with its options). A `git -c alias.…` whose value contains `push` is refused outright: finding which alias runs a push is not worth the code. Still a seatbelt, not a boundary (ADR 0015). |
| 2 | `gh api … rerun` and the reads the deny rules block | A new rule; narrower patterns; a note | **`Bash(gh api *rerun*)` is added. The blocked reads stay blocked**, since a glob cannot tell a read from a write; [GitHub settings](../development/github-settings.md) says the owner runs those commands. |
| 3 | A fork's branch on the owner's machine | Switch husky off for everyone; a procedure | **A procedure in the [git workflow guide](../development/git-workflow.md):** read a fork's PR on GitHub, or check it out with `HUSKY=0 gh pr checkout <N>`, and never run `pnpm install` on it. Turning the hooks off for everyone would cost every commit its checks. The threat model notes that this is a procedure, not a barrier. |
| 4 | Reporting a vulnerability | An email address; GitHub's private reporting | **GitHub's private reporting** (owner step, [#361](https://github.com/luiki-dev/szop/issues/361)) and a short `SECURITY.md`: what is in scope, how to report, what to expect (a hobby project, best effort, no bounty) and what is out of scope. |
| 5 | Administrators' bypass | Keep it for emergencies; switch it off | **Off on all four environments** (owner step, [#362](https://github.com/luiki-dev/szop/issues/362)); [GitHub settings](../development/github-settings.md) documents it with a check that covers `github-pages` too. |
| 6 | The plan role and personal data | A custom read policy instead of `ReadOnlyAccess`; more denies | **More denies:** the `DenyAccountContacts` statement becomes `DenyPersonalData` and adds `organizations:*`, `identitystore:*`, `sso-directory:*`, `cloudtrail:LookupEvents`, `ses:ListSuppressedDestinations` and `ses:GetSuppressedDestination`. No Terraform configuration reads them. |
| 7 | Wildcard certificates | An `issuewild` for Amazon; forbid them | **`0 issuewild ";"` on the apex:** no CA may issue a wildcard for the domain. Szop has no wildcard certificate. The owner applies `infra/base` ([#363](https://github.com/luiki-dev/szop/issues/363)). |
| 8 | Dependabot's alerts | Updates; overrides; dismissals | **`qs`, which only Stryker pulls in, gets a `pnpm.overrides` entry for `^6.16.1`. The `esbuild` 0.18 alert is dismissed as vulnerable code not used:** it comes from `drizzle-kit` through `@esbuild-kit`, which builds and never runs `esbuild`'s development server, where the flaw is. |
| 9 | Local configuration files | `.env` only; every `.env*` | **`.env*` is ignored, `.env.example` excepted.** |

## Consequences

- The owner's steps: private vulnerability reporting on, the bypass off on the four environments, and `infra/base` applied from the branch and again from `main` after the merge.
- Claude still cannot run the reads the deny rules block, such as `gh pr view --json mergedAt`; the owner runs them.
- A fork's PR is safe to review only by following the procedure; nothing enforces it.

## Settled while building

- The fork-review procedure (decision 3) changed from `HUSKY=0 gh pr checkout <N>` to a fresh clone, because a fork can ship `.husky/_` hooks that bypass `HUSKY` (found in the whole-branch review).
- The push hook's known gaps stay: `$'…'` decodes only single-character escapes; an alias set through `--config-env`, `GIT_CONFIG_PARAMETERS` or `GIT_CONFIG_KEY_n` and `GIT_CONFIG_VALUE_n` is not refused (decision 1 covers `-c` only); `env -S` is refused outright.
- Decision 6 leaves out the audit's `sso:*`, `cloudtrail:GetQueryResults`, `ses:ListContacts` and `ses:GetContact`: Szop uses no CloudTrail Lake and no SES contact lists, and `sso:*` holds no personal data that `sso-directory:*` and `identitystore:*` do not already cover.
- The threat model's "Links in emails" row stays "stored hashed": SEC-04's part in PH-18 is the log fix, not hashing.
