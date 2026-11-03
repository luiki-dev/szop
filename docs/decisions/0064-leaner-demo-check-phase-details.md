# ADR 0064 — Leaner demo check (PH-44)

- **Status:** ✅ Accepted
- **Date:** 2026-11-03
- **Refines:** [ADR 0008](0008-hosting.md), decision 29; [ADR 0013](0013-visual-design.md), decision 4; [ADR 0059](0059-session-skills.md), decision 9
- **Revisits:** [ADR 0062](0062-urgent-security-fixes.md), decision 5

## Context

Every phase PR has needed a demo check ([definition of done](../development/definition-of-done.md), item 4): `demo-up`, checks in the browser, `demo-down`. A fresh demo takes about 10 minutes to come up after the approval and as long to go down. Any later commit that touches the code means doing it again. The owner finds the waiting the costly part, more than the checking.

Most of what the demo checks does not need AWS. CI already runs the E2E journeys in three browsers, starts the image next to PostgreSQL and runs two instances behind nginx ([ci-cd.md](../development/ci-cd.md)). Most of what CI leaves out can run on the owner's machine too: HTTPS, `Secure` cookies, TLS to the database, `db-setup`, the CSP in the built app and Lighthouse. Only a few things need AWS: Terraform applying, IAM, the ECS task with its secrets, the load balancer, the certificate and DNS, and RDS's own certificate authority.

The owner also withdrew the fine-grained GitHub token that ADR 0062, decision 5, gave Claude sessions ([#360](https://github.com/luiki-dev/szop/issues/360)). It could not write to the project, so the owner had to set fields by hand at the start of this phase.

The owner settled the direction in the brainstorm on 2026-11-03; the [spec](../superpowers/specs/2026-11-03-PH-44-leaner-demo-check-design.md) holds the design.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | When the demo is needed | Every phase PR (until now); only before a release; when the diff changes what only AWS can show | **When the diff changes what only AWS can show:** Terraform under `infra/` (beyond a provider lock bump, decision 3), the demo workflows, or a behavior the spec says only AWS can show. The demo then checks what the PR changed, plus the health check. Every other PR, phase or not, needs no demo. _(the owner's choice)_ |
| 2 | What runs locally | Everything in CI; a local script run on every PR; a local script run on the owner's decision | **A local production-like environment and a script, never in CI** _(the owner's choice: CI was made shorter in PH-41 and should stay that way)_. `/demo-check` reads the diff and proposes which local checks to run and why. The owner decides which of them run at all, and Claude runs them. A check the owner declines is not deferred: it is dropped. |
| 3 | Checks "just in case" | Do them in the PR; drop them; defer them | **Deferred to the next demo that decision 1 calls for, and no later than the fourth phase PR after the oldest deferred check** _(the owner's choice)_. A check is "just in case" when the diff could affect AWS without changing it directly, such as an AWS provider bump in `infra/*/.terraform.lock.hcl`. Deferred checks are listed in one GitHub issue; the demo that runs them ticks them. If no demo was needed by the fourth phase PR, that PR runs one to clear the list. |
| 4 | When a check is repeated | Any later code commit (until now); only commits in its own area | **Only when a later commit changes what the check covers.** The demo is repeated only for a later commit in decision 1's area. A local check is re-run, on the owner's decision, only when a later commit changes what it covers. |
| 5 | Where the spec's behaviors are checked | On the demo (until now); locally | **In the local production-like environment**, unless the spec says a behavior needs AWS _(Claude's proposal, accepted with the scope)_. A spec's "Demo check" section says where each behavior is checked. |
| 6 | Lighthouse | On the demo (ADR 0013, decision 4); locally | **Locally, against the production-like environment over HTTPS**, for a PR that changes the UI. Lighthouse throttles the network and CPU itself, so the numbers stay comparable with the demo's. |
| 7 | The local environment | A new tool such as mkcert; certificates committed to the repository; certificates made by `openssl` at each run | **A `prodlike` Compose profile:** the image, nginx in front of it with TLS on `https://localhost:8443` and a redirect from `http://localhost:8082`, as the load balancer does, and a PostgreSQL of its own with TLS on. The script makes a throwaway certificate authority and its certificates with `openssl` into an ignored folder at each run. Nothing is committed and nothing new is installed. |
| 8 | TLS to a local database | A third `DATABASE_TLS` value; `NODE_EXTRA_CA_CERTS` (ignored when `ca` is passed, as `createDatabase` does); a CA file setting | **An optional `DATABASE_CA_FILE`**: the certificate authority that `verify-full` checks against, the RDS bundle when it is unset. AWS sets nothing new, so its behavior does not change. |
| 9 | `/demo-check` | The fixed list (ADR 0059, decision 9); a list worked out from the diff | **One message, worked out from the diff:** each proposed check with its bucket (AWS, local or deferred) and the reason, then the owner's choice, then the run. ADR 0059's table form stays. |
| 10 | The definition of done's item 4 | Keep "Deployed and checked"; one item for every hand check | **One item, `Checks`:** ticked when the checks the owner chose passed, `➖ N/A` when the owner chose none. The PR keeps the line "Checked by hand:" with the linked IDs of the criteria checked locally or on the demo, and adds "Deferred:" with the link to the deferred-checks issue when the PR deferred a check. |
| 11 | Claude's reach on GitHub | Keep the fine-grained token; a second account for Claude; the owner's own login | **The owner's own login** (`gh auth login`, scopes `repo`, `project`, `workflow`) _(the owner's choice)_. The fine-grained token is deleted. The deny rules in `.claude/settings.json` and the push hook stay the only guard against a merge, a re-run or a deployment approval, as they were before ADR 0062. |

## Consequences

- Most phases need no demo at all; the owner spends the local checks' minutes only on what the diff touches.
- An AWS-only regression that no decision-1 PR exercises can stay hidden for up to four phases. Decision 3 bounds it.
- `apps/api` gains one optional setting, `DATABASE_CA_FILE`, and the API reads it at startup.
- The local environment needs Docker, which the setup guide installs, and `openssl`, which Ubuntu ships. The owner's browser warns about the throwaway certificate the first time.
- A Claude session can now do whatever the owner's login can. The [threat model](../architecture/threat-model.md) says so.

## Changes to the roadmap

- PH-44 added in Stage 4, after PH-43.

## Settled while building
