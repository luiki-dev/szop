# Leaner documentation per phase: design

The decisions are in [ADR 0054](../../decisions/0054-leaner-documentation.md), which is made outside a phase, on the branch `docs/leaner-documentation`. This spec follows its own rules: it links the ADR's decisions instead of repeating them, and holds what changes in which file, and how the result is measured.

## Contents

- [Goal](#goal)
- [Changes by file](#changes-by-file)
  - [The PR template](#the-pr-template)
  - [The definition of done](#the-definition-of-done)
  - [Project tracking](#project-tracking)
  - [Plans and their rules](#plans-and-their-rules)
  - [Specs](#specs)
  - [Other guides](#other-guides)
  - [CLAUDE.md](#claudemd)
  - [Earlier ADRs](#earlier-adrs)
  - [The phase issues](#the-phase-issues)
- [The simulation](#the-simulation)
- [Tracking](#tracking)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

Each phase writes every fact once, in the place the owner reads it, and the PR description holds only what the owner reviews. The input is the [documentation volume audit](../../audits/2026-10-28-documentation-volume.md).

## Changes by file

### The PR template

`.github/pull_request_template.md` becomes four sections:

- **What and why:** the comment keeps the Conventional Commits and `skip-changelog` guidance, and asks for what the PR delivers as bullets plus a link to the phase ADR or the ADR the PR adds ([decision 7](../../decisions/0054-leaner-documentation.md#decisions)).
- **Links:** two lines only, "Acceptance criteria" (✅ and 🚧, linked; "none" when there are none) and "Closes" (one `Closes #N` per line) ([decision 6](../../decisions/0054-leaner-documentation.md#decisions)).
- **Definition of done:** a link to `definition-of-done.md` and one short label per item, for example `Tests`, `Mutants`, `CI green`, `Demo check`, `infra/base applied`, `Living docs`, `Guides`, `ADRs`, `Open points`, `Conventional Commits`, `Screenshots`. The comment says that an item that does not apply replaces its box with `➖ N/A`, as in `- ➖ N/A Mutants` ([decision 8](../../decisions/0054-leaner-documentation.md#decisions)). The demo block with its fixed fields is gone. When the PR has acceptance criteria to be checked at the demo, the `Demo check` item has one line under it, `Checked at the demo:` with their linked IDs, filled by Claude from the spec; the owner's tick confirms them.
- **Token usage:** unchanged, for phase PRs ([decision 9](../../decisions/0054-leaner-documentation.md#decisions)).

"How it was tested" is gone ([decision 1](../../decisions/0054-leaner-documentation.md#decisions)).

The template keeps one shape for every PR. A PR outside a phase writes "none" for a link that does not apply, marks items that do not apply `➖ N/A`, and leaves out "Token usage". An ADR made outside a phase is linked from "What and why" like a phase ADR. _Claude's call._

### The definition of done

`docs/development/definition-of-done.md`:

- **Each item gets the short label** the template uses, next to its name in the table, so the template and the page match.
- **Item 4 (deployed and checked)** keeps the demo check itself: the fixed checks (the `demo-up` run, the deployed commit is the final head, `/api/health`, the HTTPS redirect, the console, Lighthouse on a phone profile with the [NFR-3](../../requirements/NFR-non-functional-requirements.md#nfr-3) thresholds, `demo-down`) and the spec's demo check list. They move from the PR template to this page as a list the owner follows. The PR records only the ticked item.
- **Item 6 (living docs)** drops "the phase issue's body, a copy of the roadmap entry", and says a criterion marked "to check at the next demo" turns ✅ once it is listed under the PR's ticked demo item.
- **"When the demo check must be repeated"** stays; where it relies on the PR naming the deployed commit, it relies on the `demo-up` run instead, which the owner checks.
- **Item 9 (open points)** drops "the PR description lists the changes" and adds that every review finding not fixed is an open-point issue ([decision 2](../../decisions/0054-leaner-documentation.md#decisions)).
- **"Items that don't apply"** says `➖ N/A` replaces the checkbox, without a reason, and gives one example.
- The header's history line adds ADR 0054.

### Project tracking

`docs/development/project-tracking.md`:

- **Phase issue body:** a link to the roadmap entry and the **Also** section; the copy and the rule that `roadmap.md` is mirrored into it go ([decision 5](../../decisions/0054-leaner-documentation.md#decisions)). The rows of "How items move" that update a phase body when its entry changes go, except for **Also**.
- **Open-point issues:** **Source** names the phase, and for a deferred review finding, the review ([decision 2](../../decisions/0054-leaner-documentation.md#decisions)).
- **The PR:** the rule that the PR lists the issue changes goes; `Closes #N` stays ([decision 6](../../decisions/0054-leaner-documentation.md#decisions)).
- **The criteria's statuses** are unchanged ([decision 12](../../decisions/0054-leaner-documentation.md#decisions)).

### Plans and their rules

`docs/superpowers/plans/CLAUDE.md`:

- **Becomes the one home of the repo-wide rules** a plan's implementers follow: branch and git rules, commit messages and trailers, the docs writing style, "after each task", never merge, never trigger the demo workflows, the deny rules ([decision 11](../../decisions/0054-leaner-documentation.md#decisions)).
- **Replaces "Plans repeat these rules"** with: the session that dispatches an implementer pastes this file into the implementer's prompt.
- **Says what a plan holds:** "Order of work" at the top, each task linking its section; Global Constraints with only this phase's constraints; links to the spec for the criteria and the docs to update.

### Specs

No file holds a spec template today; the rule goes in a new `docs/superpowers/specs/CLAUDE.md`, read by the session that writes a spec. It lists a spec's sections ([decision 10](../../decisions/0054-leaner-documentation.md#decisions)): Goal (one sentence and a link to the roadmap entry), a link to the phase ADR's decisions, the design, Acceptance criteria (linked IDs, whole or in part), Tests, Documentation, Demo check, Risks, Out of scope, Left to the builder. And that the phase ADR is created in the same commit as the spec, at ✅ Accepted ([decisions 3 and 4](../../decisions/0054-leaner-documentation.md#decisions)). _Claude's call: a `CLAUDE.md` next to the specs, like the one next to the plans._

### Other guides

Where they restate a changed rule, and only there:

- `docs/development/phase-walkthrough.md`: the ADR is written with the spec; the PR's sections.
- `docs/development/git-workflow.md`: the PR description and its sections.
- `docs/development/working-with-claude.md`: the dispatching session pastes `plans/CLAUDE.md` into the implementer's prompt; the review findings become issues in the review's session.
- `docs/architecture/`: no change.

### CLAUDE.md

- **Project tracking, "Before opening the PR":** the phase body is updated only for **Also**; "a list of every issue change the PR made" goes; every review finding not fixed is an open-point issue before the PR opens.
- **Documentation, `docs/decisions/`:** the note rule becomes two places: the new ADR's header and the decision's cell; the earlier ADR's status line only when the whole ADR is superseded or deprecated ([decision 13](../../decisions/0054-leaner-documentation.md#decisions)).
- **Documentation, `docs/roadmap.md`:** "the phase issue's body is a copy" becomes "the phase issue's body links it".
- **The implementation process line** gains: a phase's ADR is created with its spec.
- **Project tracking, "When the spec or plan is committed":** the phase ADR is created in the spec's commit. The stage table and the project's fields get no ADR link: the spec links the ADR. _Claude's call._
- **Settled while building:** a decision taken during execution is added to the ADR's "Settled while building" in the commit of the task that took it. ADR numbers are checked against `main` and the open branches when the ADR is created and again before the PR, as today.

### Earlier ADRs

Notes in the decisions' cells only, as decision 13 says:

- [ADR 0004](../../decisions/0004-implementation-process.md), decision 9: ✏️ refined by decisions 3, 10, 11 and 13.
- [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 3: ✏️ refined by decision 8; decision 4: ✏️ refined by decisions 3, 10, 11 and 13.
- [ADR 0027](../../decisions/0027-open-points-on-github.md), decision 3: ✏️ refined by decision 5.

### The phase issues

Every open phase issue's body is rewritten to the link and its **Also** section, by a script in the scratchpad that is not committed. Closed phase issues are left as they are: nothing will change their entries again. _Claude's call: the owner asked for the existing issues to be rewritten so they do not drift; a closed phase cannot drift._ Before running it, the builder shows the owner one rewritten body.

## The simulation

At the end, the same sample the audit measured is rewritten under the new rules and counted ([decision 15](../../decisions/0054-leaner-documentation.md#decisions)):

- **The sample:** PH-15a's spec, plan, ADR 0050, phase issue #287's body and PR #306's description, as they are on the PH-15a branch and on GitHub on the day of the simulation.
- **The rewrite:** each one as it would be written under ADR 0054, in the scratchpad. The decisions are not shortened, only moved: a decision in both the spec and the ADR is counted once, in the ADR. The plan is rewritten only where its sections change (Global Constraints, Order of work, the criteria and docs lists); the tasks' steps stay.
- **What is counted:** words and tokens of each artifact, before and after, and the total. Tokens are counted with the Claude API's token counting endpoint when a key is available, otherwise estimated, and the record names the method.
- **What is also counted:** the edits a phase no longer makes (the phase issue's sync, the third place of each ADR note, the plan's copied rules), as a number per phase.
- **Where it goes:** a new audit, `docs/audits/2026-10-28-documentation-volume-simulation.md`, with one table of before and after, linked from ADR 0054's "Settled while building". The rewritten files are not committed. _Claude's call: the first audit stays a point-in-time record._

## Tracking

- **The `adr` issue** [#308](https://github.com/luiki-dev/szop/issues/308), "ADR 0054 Leaner documentation per phase", in 🚧 In progress since 2026-10-28. The PR closes it.
- **The PR** is labelled `skip-changelog`: it changes process docs only.
- **ADR 0054's number:** check `main` and the open branches again before the PR.

## Demo check

➖ N/A: no image or infrastructure change.

## Risks

- **No deployed commit in the PR.** The PR no longer names the commit the demo deployed, so a reviewer cannot check from the PR that the demo covered the final head; the owner, who runs the demo, is the check. The `demo-up` run's logs still name the commit.
- **Subagents without the repo rules.** If the dispatching session forgets to paste `plans/CLAUDE.md`, implementers miss the commit trailers or the docs style. The whole-branch review and commitlint catch most of it.
- **The spec reads less on its own.** The plan writer opens the spec and the ADR. The spec links the ADR's decisions by number.
- **A rewritten phase issue loses text the roadmap does not have.** The builder compares each body with its roadmap entry before rewriting and stops on a difference.

## Out of scope

- Generating the criteria counts by script ([decision 12](../../decisions/0054-leaner-documentation.md#decisions)).
- Changing the token usage section ([decision 9](../../decisions/0054-leaner-documentation.md#decisions)).
- Rewriting finished specs, plans and ADRs, or PH-15a's open PR.
- A CI check of the first-screen JavaScript size.
- Bounded-path phases and non-phase PRs beyond what the template changes for them; the audit did not cover them.

## Left to the builder

- The exact labels and wording in the template, the definition of done and the guides, in the project's writing style.
- How the rewrite script reads each issue's **Also** section.
- The token counting method, if no API key is available.
