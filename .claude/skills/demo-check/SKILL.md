---
name: demo-check
description: Proposes the hand checks a PR's diff calls for (AWS demo, local production-like environment, or deferred), runs the ones the owner chooses as one list of who does what, and keeps the deferred-checks issue. Run after the PR opens, by the owner or offered by `/finish-phase`. Claude never triggers `demo-up` or `demo-down` (ADR 0059, ADR 0064).
---

# Demo check

After [ADR 0059](../../../docs/decisions/0059-session-skills.md), decision 9, refined by [ADR 0064](../../../docs/decisions/0064-leaner-demo-check-phase-details.md). The rules are in [the checks](../../../docs/development/definition-of-done.md#the-checks) of the definition of done; this skill works out which checks the diff calls for, sends them as one list of who does what and runs Claude's part. Claude never triggers `demo-up` or `demo-down`; the owner does.

1. **Read the diff and the inputs:** `git diff --name-only main...HEAD`, and the diff itself where the names are not enough; the spec's "Demo check" section of the phase, if any; the open lines of the [deferred-checks issue](https://github.com/luiki-dev/szop/issues/377) (`gh issue view 377 --repo luiki-dev/szop`).

2. **Sort each check into a bucket** by [the three buckets](../../../docs/superpowers/specs/2026-11-03-PH-44-leaner-demo-check-design.md#the-three-buckets): **AWS** when the diff changes what only AWS can show, **Local** when the production-like environment can show it, **Deferred** when the diff could affect AWS without changing it directly. The table's examples are a guide: give each check the reason the diff calls for it. A check that passed earlier on this PR is repeated only when a later commit changes what it covers (ADR 0064, decision 4).

   **Firefox for Android:** when the diff changes what a phone's keyboard or touch gestures do (the add bar, the haul's drawer, a tap or drag on a list), add a Local row for the owner: those behaviors in Firefox for Android, steps written out, on a phone connected over USB ([the steps](../../../docs/development/testing.md#checking-on-a-phone-over-usb)), at `https://localhost:8443` past the certificate warning. Playwright's phone emulation is Chromium only ([ADR 0073](../../../docs/decisions/0073-list-items-polish-phase-details.md), decision 2).

   **Count the phase PRs** for the deferred-checks issue when it has open lines (ADR 0064, decision 3): the merged PRs whose branch is a phase branch, closed on or after the date of the oldest open line, leaving out the PR that line came from (replace `BRANCH` with its head branch), plus this PR if it is a phase PR.

   ```bash
   gh pr list --repo luiki-dev/szop --state closed --search "closed:>=YYYY-MM-DD" --limit 100 --json headRefName,state --jq '[.[] | select(.state != "CLOSED") | .headRefName | select(test("^[a-z]+/ph-[0-9]+") and . != "BRANCH")] | length'
   ```

   The command never names "merge": the deny rule `gh pr * merge*` would block it. A merged PR's state is `MERGED` and its closing date is its merge date, so `state != "CLOSED"` keeps the merged ones.

   When this PR is the fourth, propose an AWS demo that runs every open line, even if the diff calls for none.

3. **Send one message:** a table of the proposed checks, then the question of which to run. A PR with nothing to propose (documentation, a component covered by E2E) gets one line saying so, and `Checks` is `➖ N/A`. Example:

   | # | Bucket | Check | Why (from the diff) | Who, where |
   |---|---|---|---|---|
   | 1 | Local | `pnpm check:prodlike --keep` | `apps/api/src/security/headers.ts` changes the CSP | Claude |
   | 2 | Local | Lighthouse on `https://localhost:8443/` | `apps/web/src/lists/` changes the UI | Claude |
   | 3 | Local | <one behavior from the spec, steps written out> | the spec lists it as local | Owner, browser at `https://localhost:8443`, past the certificate warning |
   | 4 | AWS | Demo: <what the PR changed>, plus the health check | `infra/demo/ecs.tf` changes the task definition | Owner and Claude, rows below |
   | 5 | Deferred | <what to check at the next demo> | `infra/base/.terraform.lock.hcl` bumps the AWS provider | Added to #377 |

   The owner chooses which run. A check the owner declines is dropped, not deferred; one the owner defers goes to #377.

4. **Run the chosen checks, as one list of who does what.** At most three exchanges in all.

   **Local:** `pnpm check:prodlike --keep`, always with `--keep`, even when no hand check or Lighthouse was chosen. Then, for a PR that changes the UI, Lighthouse on `/` with its default mobile profile: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT reported ([NFR-3](../../../docs/requirements/NFR-non-functional-requirements.md#nfr-3)). Run it from the scratchpad, nothing is added to the repository; re-run a borderline score once:

   ```bash
   npx --yes lighthouse@13.5.0 https://localhost:8443/ --output=json --output-path=<scratchpad>/lighthouse.json --chrome-flags="--headless --ignore-certificate-errors"
   ```

   Then the owner's behaviors as rows with the steps written out, never a pointer to the spec.

   **AWS**, when chosen:

   | # | Who | Where | Check | Reply |
   |---|---|---|---|---|
   | 1 | Owner | Terminal: `aws sso login --profile szop` ([Sign in from the CLI](../../../docs/operations/demo-environment.md#5-sign-in-from-the-cli)) | Signed in | — |
   | 2 | Owner | `infra/base` from the branch ([Applying base](../../../docs/operations/demo-environment.md#applying-base)), only if the diff changes it | Applied | — |
   | 2b | Owner | Terminal: `aws sso logout`, then sign in as `claude-readonly` again ([Signing in as the administrator](../../../docs/operations/demo-environment.md#signing-in-as-the-administrator)) | Administrator signed out | — |
   | 3 | Owner | GitHub → Actions → demo-up → Run workflow → branch `<branch>`, then approve the `demo` environment ([Pressing the button](../../../docs/operations/demo-environment.md#pressing-the-button)) | Run started | "demo is up" after the run is green |
   | 4 | Claude | `curl https://szop.dzwoniec.com/api/health` | `ok`, commit `<head>` | — |
   | 4b | Claude | The redirect from `http://`, the browser console on `/` and the phase's screens (Chrome DevTools MCP), and every open line of #377 Claude can check | No message, each line as written | — |
   | 5a, 5b, … | Owner | <the URL or screen of one AWS behavior, steps written out> | <what the owner should see> | — |
   | 6 | Owner | GitHub → Actions → demo-down ([With the button](../../../docs/operations/demo-environment.md#with-the-button)) | Destroyed | "done" with the behaviors checked, in one reply |

   Rows 1, 2 and 2b are left out when the diff does not change `infra/base`. After "demo is up", follow the run if it is still going (`gh run watch`). On a failure, look at the logs ([the runbook's debugging section](../../../docs/operations/demo-environment.md#debugging)) before reporting; Claude's profile reads AWS's configuration but not CloudWatch's log lines, so ask the owner for those. If the owner says at the start that they do everything, every row is theirs, Lighthouse included, and they reply once at the end with the report's path.

5. **Report and tidy up:** one line per check ✅ or ❌. Update #377: add a line per deferred check (what, the PR, its merge date once merged), tick the lines a demo passed, and fill in a missing merge date. Fill in the PR's "Checked by hand:" line with the linked IDs of the criteria checked, and "Deferred:" with the link to #377 when the PR deferred a check. Run `pnpm check:prodlike --down` when the environment was kept. The owner ticks `Checks`.
