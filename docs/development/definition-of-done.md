# Definition of done

The checklist a piece of work must meet before its PR is merged. This page is its one home: the [PR template](../../.github/pull_request_template.md) mirrors it as checkboxes, and other documents link here instead of restating it. It started as [ADR 0004](../decisions/0004-implementation-process.md), decision 7, was refined by [ADR 0007](../decisions/0007-testing-strategy.md) (decision 20), [ADR 0008](../decisions/0008-hosting.md) (decision 29) and [ADR 0010](../decisions/0010-ci-cd.md), was gathered here by [ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 3, and was extended by [ADR 0013](../decisions/0013-visual-design.md) (a Lighthouse run in the demo check, screenshots of UI changes).

## The checklist

**Who** names who makes the item true:

- **Claude** does the work: writes the tests, code, docs and commits, and fixes what fails.
- **Claude → owner**: Claude prepares it (runs mutation testing and proposes what to do with each survivor, drafts the ADR), and the owner decides.
- **Owner**: only the owner can do it. The owner presses `demo-up` and `demo-down` and checks the demo (Claude triggers them only when asked), and applies `infra/base` with their own AWS credentials.
- **CI** runs the checks; Claude fixes what it reports.

Whoever made an item true, **the owner verifies every item when reviewing the PR**, and the merge is the approval.

| # | Item | Who | What it means | Source |
|---|---|---|---|---|
| 1 | **Tests pass, at the right layers** | Claude | New behavior has tests at the lowest layer that can prove it; a phase that completes a use case adds its E2E journey; every bug fix has a regression test; every suite is green. | ADR 0007, decisions 16 and 20 |
| 2 | **Surviving mutants reviewed** | Claude → owner | When the phase changes domain rules in `packages/shared`, mutation testing (`pnpm test:mutation`) was run and each surviving mutant was either killed by a new test or accepted with a reason in the PR. | ADR 0007, decision 19 |
| 3 | **CI is green** | CI | Every required check passed on the PR's final head. | ADR 0010, decision 8 |
| 4 | **Deployed and checked** | Owner | A demo environment was created from the image of a commit on the branch, its health check passed, the phase's behavior worked in a browser, a Lighthouse run on a phone profile showed the Core Web Vitals within [NFR-3](../requirements/functional-requirements.md#nfr-3) (for a phase that changes the UI), and the environment was destroyed. The PR links the `demo-up` run and names the commit it deployed. The check must cover the final head: see [when the demo check must be repeated](#when-the-demo-check-must-be-repeated). | ADR 0008, decision 29; ADR 0010, decision 2; ADR 0013, decision 4 |
| 5 | **`infra/base` changes applied from the branch** | Owner | If the phase changes `infra/base`, the owner applied it from the branch before the demo check, since the demo depends on it. After the merge, or if the PR is closed without merging, the owner applies it again from `main`, so AWS matches `main`. | ADR 0010, decision 14; ADR 0011, decision 9 |
| 6 | **Living docs updated** | Claude | Architecture, stack overview and glossary; the threat model when an actor or entry point was added; the visual design doc when the design system changed; the functional requirements when behavior changed; the roadmap status, which during the GitHub tracking trial mirrors the phase's issue and its project fields, the source. | ADR 0004, decision 7; ADR 0012, decision 2; ADR 0013, decision 22; ADR 0024, decision 14 |
| 7 | **Guides updated** | Claude | Every guide the change affects: `setup.md` and the tool pages, `testing.md`, the runbook, `ci-cd.md`, `git-workflow.md`, `github-settings.md`, and this page. | ADR 0005, decision 15; ADR 0007, decision 22; ADR 0008, decision 31; ADR 0009, decisions 15 and 17; ADR 0010, decision 22 |
| 8 | **Significant decisions have ADRs** | Claude → owner | A decision about architecture, technology, tooling or process is recorded in a new ADR, with the options considered. | ADR 0004, decision 7 |
| 9 | **Open points handled** | Claude | The phase's entries in [open-points.md](../open-points.md) are closed or re-assigned with a reason, and anything newly deferred is added; during the GitHub tracking trial this happens on their issues first, and the register mirrors them. | ADR 0011, decision 1; ADR 0024, decision 14 |
| 10 | **Commits follow the convention** | Claude | Commit messages and the PR title follow Conventional Commits; in a phase, commits follow the plan's tasks. | ADR 0009, decisions 3 and 9 |
| 11 | **UI changes shown** | Claude | A PR that changes what users see includes screenshots of it: phone in light and dark mode, desktop in light mode. A phase that designed new screens also committed its approved mockups next to its spec. | ADR 0013, decision 21 |

## Items that don't apply: N/A with a reason

An item that doesn't apply is marked **"➖ N/A: *reason*"**, never a bare N/A, so the reviewer sees it was considered. **Its checkbox stays unchecked:** a tick means the item was done, and ➖ is an outcome of its own, so the reason goes after the item's text, as in `- [ ] CI is green (CI): ➖ N/A: CI does not exist yet`. For example:

- "➖ N/A: CI does not exist yet"
- "➖ N/A: no image or infrastructure change"
- "➖ N/A: no domain rules changed"

## Which PRs need which items

- **A phase PR** meets every item, or marks it N/A with a reason.
- **Any other PR** (a foundation ADR, a documentation fix, a Dependabot update, the release PR) meets items 1, 3 and 10, and items 6–9 and 11 when it changes what they cover. **The demo check (item 4) is the owner's call**: requiring it would mean a 10–15 minute spin-up for each of the week's Dependabot PRs. Those are covered by CI instead (see [OP-032](../open-points.md#op-032)).

## When the demo check must be repeated

A demo check counts for the PR's final head only if **no later commit changed anything that goes into the image or `infra/`**: application code, dependencies and the lockfile, the Dockerfile, the Terraform code.

- A review fix to the code needs a new check.
- *Update branch* bringing in a dependency bump from `main` needs a new check, since the merged head was never built.
- A documentation-only commit, or *Update branch* bringing in only documentation, does not.

The check being repeated is the same as the first: `demo-up` on the branch (it redeploys if the demo is still up), check, `demo-down`. The PR's link is updated to the new run.
