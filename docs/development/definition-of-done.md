# Definition of done

The checklist a piece of work must meet before its PR is merged. This page is its one home: the [PR template](../../.github/pull_request_template.md) mirrors it as checkboxes, and other documents link here instead of restating it. It started as [ADR 0004](../decisions/0004-implementation-process.md), decision 7, was refined by [ADR 0007](../decisions/0007-testing-strategy.md) (decision 20), [ADR 0008](../decisions/0008-hosting.md) (decision 29) and [ADR 0010](../decisions/0010-ci-cd.md), was gathered here by [ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 3, was extended by [ADR 0013](../decisions/0013-visual-design.md) (a Lighthouse run in the demo check, screenshots of UI changes), and was shortened in the PR by [ADR 0054](../decisions/0054-leaner-documentation.md), decision 8 (short labels, a bare `➖ N/A`, one demo item).

## The checklist

**Who** names who makes the item true:

- **Claude** does the work: writes the tests, code, docs and commits, and fixes what fails.
- **Claude → owner**: Claude prepares it (runs mutation testing and proposes what to do with each survivor, drafts the ADR), and the owner decides.
- **Owner**: only the owner can do it. The owner presses `demo-up` and `demo-down` and checks the demo (Claude triggers them only when asked), and applies `infra/base` with their own AWS credentials.
- **CI** runs the checks; Claude fixes what it reports.

Whoever made an item true, **the owner verifies every item when reviewing the PR**, and the merge is the approval.

| # | Item | Who | What it means | Source |
|---|---|---|---|---|
| 1 | **Tests pass, at the right layers** (`Tests`) | Claude | New behavior has tests at the lowest layer that can prove it; a phase that completes a use case adds its E2E journey; every bug fix has a regression test; every suite is green. Every acceptance criterion the PR marks ✅ has a test whose name starts with its ID, or is marked as checked at the demo. | ADR 0007, decisions 16 and 20; ADR 0051, decision 4 |
| 2 | **Surviving mutants reviewed** (`Mutants`) | Claude → owner | When the phase adds or changes logic that is mutated, mutation testing (`pnpm test:mutation`) was run and each surviving mutant was either killed by a new test or accepted with a reason in the code (`// Stryker disable next-line <Mutator>: <reason>`); the PR states the score and what was done. | ADR 0007, decision 19; ADR 0055, decision 3 |
| 3 | **CI is green** (`CI green`) | CI | Every required check passed on the PR's final head. | ADR 0010, decision 8 |
| 4 | **Deployed and checked** (`Demo check`) | Owner | A demo environment was created from the image of a commit on the branch, its health check passed, the phase's behavior worked in a browser, a Lighthouse run on a phone profile showed the Core Web Vitals within [NFR-3](../requirements/NFR-non-functional-requirements.md#nfr-3) (for a phase that changes the UI), and the environment was destroyed. The owner follows [the demo check](#the-demo-check) and ticks the item; the PR records nothing else, except the line "Checked at the demo:" with the linked IDs of the criteria checked there, which Claude fills from the spec. Claude may run the checks that need no owner (health, redirect, console, Lighthouse) with `/demo-check`. The check must cover the final head: see [when the demo check must be repeated](#when-the-demo-check-must-be-repeated). | ADR 0008, decision 29; ADR 0010, decision 2; ADR 0013, decision 4 |
| 5 | **`infra/base` changes applied from the branch** (`infra/base applied`) | Owner | If the phase changes `infra/base`, the owner applied it from the branch before the demo check, since the demo depends on it. After the merge, or if the PR is closed without merging, the owner applies it again from `main`, so AWS matches `main`. | ADR 0010, decision 14; ADR 0011, decision 9 |
| 6 | **Living docs updated** (`Living docs`) | Claude | Architecture, stack overview and glossary; the threat model when an actor or entry point was added; the visual design doc when the design system changed; the functional requirements when behavior changed: the statuses of the acceptance criteria the phase finalized, started or delivered, each requirement's line and the index's status table, which match, and a criterion marked "to check at the next demo" turned ✅ once it is listed under the PR's ticked demo item; the roadmap's stage tables, which mirror the status on GitHub (the source). | ADR 0004, decision 7; ADR 0012, decision 2; ADR 0013, decision 22; ADR 0027, decisions 3 and 4; ADR 0051, decisions 2 and 15 |
| 7 | **Guides updated** (`Guides`) | Claude | Every guide the change affects: `setup.md` and the tool pages, `testing.md`, the runbook, `ci-cd.md`, `git-workflow.md`, `github-settings.md`, and this page. | ADR 0005, decision 15; ADR 0007, decision 22; ADR 0008, decision 31; ADR 0009, decisions 15 and 17; ADR 0010, decision 22 |
| 8 | **Significant decisions have ADRs** (`ADRs`) | Claude → owner | A decision about architecture, technology, tooling or process is recorded in a new ADR, with the options considered. | ADR 0004, decision 7 |
| 9 | **Open points handled** (`Open points`) | Claude | Open points closed, re-assigned or added on GitHub (`open-point` issues); the whole-branch review's findings that are not fixed are listed to the owner, and the ones the owner chooses are open-point issues; the rest are noted as declined in the phase ADR. | ADR 0011, decision 1; ADR 0027, decision 2 |
| 10 | **Commits follow the convention** (`Conventional Commits`) | Claude | Commit messages and the PR title follow Conventional Commits; in a phase, commits follow the plan's tasks. | ADR 0009, decisions 3 and 9 |
| 11 | **UI changes shown** (`Screenshots`) | Claude | A PR that changes what users see includes screenshots of it: phone in light and dark mode, desktop in light mode. A phase that designed new screens also committed its approved mockups next to its spec. | ADR 0013, decision 21 |

## Items that don't apply

An item that doesn't apply replaces its checkbox with **➖ N/A**, without a reason, as in `- ➖ N/A Mutants`. ➖ is an outcome of its own: a tick means the item was done.

## The demo check

The owner's list for item 4. `/demo-check` runs it as one list of who does what; Claude does the checks that need no owner (health, redirect, console, Lighthouse), and never presses `demo-up` or `demo-down`:

1. Run `demo-up` on the branch. The deployed commit is the PR's final head.
2. `/api/health` answers `ok` with that commit.
3. `http://` redirects to `https://` ([NFR-4](../requirements/NFR-non-functional-requirements.md#nfr-4)).
4. The console shows no CSP errors and no other messages.
5. Lighthouse, on a phone profile, on `/`: LCP ≤ 2.5 s and CLS ≤ 0.1, with TBT standing in for INP in the lab ([NFR-3](../requirements/NFR-non-functional-requirements.md#nfr-3)). Only for a phase that changes the UI.
6. The behaviors in the spec's demo check.
7. Run `demo-down`.

Tick `Demo check` in the PR when all of it passed. The PR does not record the runs, the commit or the scores.

## Which PRs need which items

- **A phase PR** meets every item, or marks it `➖ N/A`.
- **Any other PR** (a foundation ADR, a documentation fix, a Dependabot update, the release PR) meets items 1, 3 and 10, and items 6–9 and 11 when it changes what they cover. **The demo check (item 4) is the owner's call**: requiring it would mean a 10–15 minute spin-up for each of the week's Dependabot PRs. Those are covered by CI instead: the `docker` job builds the image of every code PR and starts it next to PostgreSQL ([ADR 0028](../decisions/0028-container-image-details.md), decision 4; [OP-032](https://github.com/luiki-dev/szop/issues/69)).

## When the demo check must be repeated

A demo check counts for the PR's final head only if **no later commit changed anything that goes into the image or `infra/`**: application code, dependencies and the lockfile, the Dockerfile, the Terraform code.

- A review fix to the code needs a new check.
- *Update branch* bringing in a dependency bump from `main` needs a new check, since the merged head was never built.
- A documentation-only commit, or *Update branch* bringing in only documentation, does not.

The check being repeated is the same as the first: `demo-up` on the branch (it redeploys if the demo is still up), check, `demo-down`. The owner checks that the `demo-up` run is the one for the final head.
