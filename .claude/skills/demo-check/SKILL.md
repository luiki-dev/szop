---
name: demo-check
description: Runs the demo check of the definition of done on a PR's final head as one list of who does what. Run after the PR opens, by the owner or offered by `/finish-phase`. Claude never triggers `demo-up` or `demo-down` (ADR 0059).
---

# Demo check

After [ADR 0059](../../../docs/decisions/0059-session-skills.md). The checks themselves are in [the demo check](../../../docs/development/definition-of-done.md#the-demo-check) of the definition of done; this skill turns them into one list of who does what and runs Claude's part. Claude never triggers `demo-up` or `demo-down`; the owner does.

1. **Work out the list** from: the fixed steps of the demo check; whether the branch changes `infra/base` (then the sign-in and the apply come first); whether it changes the UI (then Lighthouse); and the behaviors in the spec's "Demo check" section of the phase.
2. **Send one message with the whole list**, a table, at most three exchanges in all. Example:

   | #   | Who    | Where                                                                                                                                                      | Check                  | Reply                                  |
   | --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------- |
   | 1   | Owner  | Terminal: `aws sso login --profile szop` ([Sign in from the CLI](../../../docs/operations/demo-environment.md#5-sign-in-from-the-cli))                     | Signed in              | —                                      |
   | 2   | Owner  | `infra/base` from the branch ([Applying base](../../../docs/operations/demo-environment.md#applying-base)), only if the diff changes it                    | Applied                | —                                      |
   | 3   | Owner  | GitHub → Actions → demo-up → Run workflow → branch `<branch>`, then approve the `demo` environment ([Pressing the button](../../../docs/operations/demo-environment.md#pressing-the-button)) | Run started | "demo is up" after the run is green |
   | 4   | Claude | `curl https://szop.dzwoniec.com/api/health`                                                                                                                | `ok`, commit `<head>`  | —                                      |
   | 5a, 5b, … | Owner | <the URL or screen of one demo behavior from the spec> | <what the owner should see> | — |
   | 6   | Owner  | GitHub → Actions → demo-down ([With the button](../../../docs/operations/demo-environment.md#with-the-button))                                             | Destroyed              | "done" with the behaviors checked, in one reply             |

   Row 5 stands for one row per behavior in the spec's "Demo check": write the steps out, never point the owner to the spec instead.

   Rows 1 and 2 are left out when the diff does not change `infra/base`. End the message with the two replies Claude waits for: **"demo is up"**, and later the behaviors checked and `demo-down` run. If the owner says at the start that they do everything, every row is theirs, Lighthouse included, and they reply once at the end with the report's path.

3. **After "demo is up"**, follow the run if it is still going (`gh run watch`), then check:
   - `/api/health` answers `ok` with the head commit;
   - `http://` redirects to `https://`;
   - the console on `/` and on the phase's screens shows no messages (Chrome DevTools MCP);
   - for a branch that changes the UI, Lighthouse on `/` with its default mobile profile: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT reported ([NFR-3](../../../docs/requirements/NFR-non-functional-requirements.md#nfr-3)). Run it from the scratchpad, nothing is added to the repository:

     ```bash
     npx --yes lighthouse@13.5.0 https://szop.dzwoniec.com/ --output=json --output-path=<scratchpad>/lighthouse.json --chrome-flags="--headless"
     ```

     If it cannot run (no Chrome for it), the owner saves the report from Chrome and Claude reads the file.

   Report one line per check. On a failure, look at the logs ([the runbook's debugging section](../../../docs/operations/demo-environment.md#debugging)) before reporting.

4. **After the owner's second reply**, give a short summary with each check ✅ or ❌, and fill in the PR's "Checked at the demo:" line with the linked IDs of the criteria the spec lists for the demo. The owner ticks `Demo check`.
