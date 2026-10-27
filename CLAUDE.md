# CLAUDE.md

Szop is a web application for tracking shopping lists (groceries and general shopping). See `README.md` for the high-level description.

## Project purpose

This project is primarily a **learning project**. The owner wants to learn:

- the superpowers workflow (brainstorming → spec → plan → implementation), and
- popular web application technologies.

How to work on it:

- **Go step by step.** Every element of building the app is its own deliberate step that the owner wants to follow and understand: project setup and layout, architecture, technology choices, CI/CD, building, testing, deployment, and others. Do not bundle several of these into one change or make them silently.
- **Use the superpowers workflow for everything**, not only for features. Setup, tooling, CI/CD and deployment decisions also go through brainstorming and approval.
- **Record decisions in the project documentation.** Capture every decision about architecture, solution design, approaches and other crucial aspects of the implementation, along with the reasoning and the alternatives considered.
- **Explain choices.** When proposing a technology or approach, say why and what the trade-offs are, since learning is a goal in itself.
- **Keep phases small** ([ADR 0014](docs/decisions/0014-roadmap.md), decision 6). A phase brings at most one big concept new to the project, and its plan has about 3 to 8 tasks. When a brainstorm or plan grows past that, propose a split on the roadmap before planning or executing; the owner may also ask for one at any time.
- **Follow the implementation process in [ADR 0004](docs/decisions/0004-implementation-process.md).** In short: foundation topics (development environment → testing strategy → hosting → git workflow → CI/CD → security baseline → visual design, the git workflow added by [ADR 0006](docs/decisions/0006-git-workflow-topic.md) and the security baseline by [ADR 0011](docs/decisions/0011-design-sanity-check-follow-ups.md)) settle direction only; then a living roadmap of phases, starting with a walking skeleton and continuing in vertical slices ([`docs/roadmap.md`](docs/roadmap.md), shaped by [ADR 0014](docs/decisions/0014-roadmap.md)); each phase gets its own brainstorm, with details decided there, and meets the shared definition of done. The ADR also defines which document owns which facts (requirements, living docs, ADRs, roadmap, specs and plans).

## Git workflow

Follow [ADR 0009](docs/decisions/0009-git-workflow.md) and the guide in `docs/development/git-workflow.md`. In short:

- **Never commit to `main`.** Every change is made on a branch named `type/short-description` (`feat/shopping-lists`, `docs/adr-0010-ci-cd`) and reaches `main` through a pull request. A roadmap phase is one branch and one PR, holding its code and, on the full path of ADR 0004, decision 8, its spec and plan.
- **Commit messages follow Conventional Commits** (`type(scope): description`, imperative). Within a phase, commits follow the plan's tasks. The PR title follows Conventional Commits too, since it becomes the merge commit's message.
- **Review your own changes before opening a PR, and fill in the PR template** (`.github/pull_request_template.md`).
- **Label a PR `skip-changelog` when readers of the release notes do not need it** (Claude Code's settings, process docs): the notes list one line per merged PR ([ADR 0042](docs/decisions/0042-releases-details.md)).
- **Address review comments with new commits** on the branch; don't rewrite history once a PR is open. Bring `main` in by merging it, not by rebasing.
- **Never merge a PR**, including release-please's release PR. Only the owner merges; the merge is the approval.
- **Never trigger `demo-up` or `demo-down`** unless the owner asks ([ADR 0010](docs/decisions/0010-ci-cd.md), consequences).
- **Don't work around the deny rules in `.claude/settings.json` or the push hook in `.claude/hooks/`** ([ADR 0012](docs/decisions/0012-security-baseline.md), decision 19; [ADR 0015](docs/decisions/0015-git-push-guard-hook.md)). They back the rules above; if one blocks something the owner asked for, say so and let the owner run it.
- **When a superpowers skill offers a git worktree or a local merge, don't take it.** Work on a plain branch in the main checkout (ADR 0009, decision 5), and finish by pushing the branch and opening a PR.

## Project tracking

Follow [ADR 0024](docs/decisions/0024-github-project-tracking.md), [ADR 0027](docs/decisions/0027-open-points-on-github.md) and `docs/development/project-tracking.md`. **GitHub** (the issues and the fields of the [Szop project](https://github.com/users/luiki-dev/projects/3)) holds the status and the open points; **`roadmap.md`** holds each phase's plan and mirrors the status in its stage tables; **`docs/requirements/`** holds each requirement's acceptance criteria and their status ([ADR 0051](docs/decisions/0051-acceptance-criteria.md)). Every step below says which side it changes.

During a phase:

- **When a phase's brainstorm starts, before the first question:**
  - On GitHub: the phase issue's Status → 🚧 In progress; Finished (the merge date) set on the previous phase's issue and on every `adr` issue closed since.
  - On GitHub: read the phase's open-point issues (its sub-issues and the issues its **Also** section lists).
- **During the brainstorm:** review with the owner the acceptance criteria of every requirement the phase delivers, and the whole list of any requirement still ❔ Criteria not finalized ([ADR 0051](docs/decisions/0051-acceptance-criteria.md)).
- **In the phase branch's first commit:**
  - In the repo: the phase's row in the `roadmap.md` stage table → 🚧.
  - On GitHub: the phase issue's Started field → that commit's date.
- **When the spec or plan is committed:**
  - In the repo: its link in the phase's row of the `roadmap.md` stage table; with the spec (or a bounded phase's first commit after its design), the criteria the phase delivers set to 🚧, the requirements it reviewed marked ✅ Criteria finalized, and the index updated.
  - On GitHub: the phase issue's Spec or Plan field.
- **When the phase's owner steps change:**
  - On GitHub: owner-step issues added, or closed as not planned with the reason.
  - In the repo: the phase entry's **Owner steps** in `roadmap.md` updated.
- **Before opening the PR:**
  - On GitHub: every open-point issue of the phase closed (with a "settled by" comment) or re-assigned; the phase issue's body updated if its `roadmap.md` entry changed.
  - In the repo: the stage table row in line with GitHub, with the PR link; every criterion the PR delivers ✅, with a test whose name starts with its ID; each requirement's line and the index updated.
  - In the PR description: `Closes #<phase issue>` and `Closes #<open-point issue>` for each one it settles, and a list of every issue change the PR made.
  - In the PR description: a "Token usage" section with the output of `scripts/token-usage.py --branch <the phase branch>`.
- **At the end of a phase:** propose the next phase. The owner moves its issue and its open-point issues to 📌 Todo on GitHub.
- **Never set ✅ Done on GitHub by hand:** merging the PR closes the issues, and the project's workflow sets it.

Open points (all on GitHub; no document lists them):

- **Something is left to a later phase or topic:** a new open-point issue with the next free `OP-` ID ([how to find it](docs/development/project-tracking.md#checking-with-gh)), labelled `open-point`, a sub-issue of the phase that will settle it (a candidate has none), and mentioned as a link where it came up.
- **Part of an open point is done:** the part ticked in the issue with its PR; the issue re-parented to the phase doing the next part, its Status set to ⬜ Backlog, or 📌 Todo if that phase is already picked.
- **An open point moves to another phase:** re-parented, with a History line in its body.
- **An open point gains or loses a part in another phase:** that phase issue's **Also** section updated.
- **An open point is dropped:** closed as not planned, with the reason as a comment.
- **Anything else** (a phase split, a candidate picked up, an item blocked, an ADR made outside a phase): look up its row in [How items move](docs/development/project-tracking.md#how-items-move).

## Working with Claude

Follow [ADR 0052](docs/decisions/0052-working-with-claude.md) and the guide in `docs/development/working-with-claude.md`, which holds the reasons. In short:

- **A session per stage:** brainstorm and spec, plan, execution, finishing; each starts a new session from the committed document or commits of the last ([A phase in sessions](docs/development/working-with-claude.md#a-phase-in-sessions)).
- **Restart or `/compact` above 150–200k of context**, never in the middle of an uncommitted edit ([Reading the status line](docs/development/working-with-claude.md#reading-the-status-line)).
- **Before a break longer than an hour, finish the stage:** the prompt cache lives one hour, and the first call after it writes the whole context again ([Breaks and the cache](docs/development/working-with-claude.md#breaks-and-the-cache)).
- **Implementers on Sonnet, the default; the whole-branch review on Opus, named explicitly** (`model: opus`) ([Choosing models](docs/development/working-with-claude.md#choosing-models)).

## Documentation

- `docs/requirements/` — the living source of truth for what Szop does: `functional-requirements.md` is the index (how requirements and their acceptance criteria are written, the status of every requirement, the assumptions, actors and domain concepts, MVP/Later slicing and future extensions); one file per area, `<AREA-CODE>-<full-area-name>.md` (such as `ACC-accounts-and-guest-mode.md`, and `NFR-non-functional-requirements.md` for browsers, accessibility, performance and security), holds each requirement with its acceptance criteria and their status; `UC-use-cases.md` holds the use cases. Keep it updated when behavior changes or a phase finalizes, starts or delivers criteria.
- `docs/architecture/architecture.md` — the living technical architecture (components, layering, data model highlights, frontend state, later features). Keep it updated when the design changes.
- `docs/architecture/stack-overview.md` — a learning-oriented explanation of the stack and its concepts. Extend it when a new technology or concept enters the project.
- `docs/architecture/threat-model.md` — what Szop protects, who can act through which path, and what guards each entry point. Keep it updated when an actor or entry point is added.
- `docs/architecture/aws-resources.md` — diagrams of every AWS resource the Terraform configurations in `infra/` create, grouped by service and marked by stack, with the references between them. Keep it updated when a resource, or a reference between resources, is added, changed or removed in `infra/`.
- `docs/architecture/visual-design.md` — the living design system: the look, design tokens, typography, brand, and the layout and interaction principles every screen follows, with the approved mockups in `docs/architecture/visual-design/`. Keep it updated when the design system changes.
- `docs/glossary.md` — acronyms and terms used in the docs.
- `docs/roadmap.md` — the phases in order, grouped into stages, each with its goal, what it delivers, the owner's steps and its status. Keep a phase's row updated when its work starts, when its PR opens and before it is merged. It is the source of each phase's plan; the phase issue's body is a copy, updated when the PR that changes the entry opens.
- `docs/development/project-tracking.md` — how the phases, open points and decision work are tracked as GitHub issues on the Szop project: labels, milestones, fields, statuses, how items move. GitHub is the source of status, open points and what comes next, and `roadmap.md` is the source of each phase's plan ([ADR 0027](docs/decisions/0027-open-points-on-github.md)).
- `docs/development/git-workflow.md` — the day-to-day git workflow: branches, commits, PRs, review, merging and releases.
- `docs/development/ci-cd.md` — how CI checks every PR: the workflows and jobs, `ci-ok` and the required checks, change detection, reading a failed run, Dependabot and the rules for every workflow. Keep it updated when a workflow changes.
- `docs/operations/demo-environment.md` — the runbook for Szop's environment on AWS: the one-time account setup, applying and destroying `infra/bootstrap`, and later applying base and spinning the demo up and down. Keep it updated when an infrastructure step changes.
- `docs/development/testing.md` — how Szop is tested: the layers, running the suites, writing each kind of test, and the rules. Read it before writing or changing tests, and keep it updated when a test layer or tool changes.
- `docs/development/definition-of-done.md` — the one definition of done: every item, what it means, which PRs need it, and when the demo check must be repeated. The PR template mirrors it.
- `docs/development/phase-walkthrough.md` — one example phase end to end: commits, PRs, CI, demo, release-please and version tags, in order.
- `docs/development/working-with-claude.md` — working with Claude Code within the weekly limit: how usage builds up, a phase in sessions, the status line, choosing models, and measuring a phase with `scripts/token-usage.py`. Keep it updated when a habit, a threshold or the script changes.
- `docs/development/github-settings.md` — every GitHub setting the workflow relies on, where it lives in GitHub, and why. Keep it updated when a setting changes.
- `docs/development/scripts.md` — every script in the `package.json` files: what it runs, when to run it, and which CI job or git hook runs it. Keep it updated when a script is added, changed or removed.
- `docs/development/setup.md` — the setup guide, from a clean Windows machine to passing checks, and the setup script of a Claude Code session in the cloud. Keep it updated when a tool or a step changes.
- `docs/development/tools/` — one page per development tool: what it is, why it was chosen, its configuration explained. Keep a tool's page updated when its configuration changes.
- `docs/decisions/` — ADR-style decision records, numbered `NNNN-short-title.md`, each with context, options considered, the decision and its consequences. Add a new ADR for every significant decision (architecture, technology, tooling, process), and don't rewrite accepted ones: supersede them with a new ADR. Mechanical changes that keep the meaning (status lines, status icons, links) are allowed. When a new ADR supersedes, refines, extends, completes or revisits a decision of an earlier one, note it in three places: the new ADR's header (`Refines:`, `Extends:` …), the earlier ADR's status line, and, when it names a decision, a line at the bottom of that decision's cell (`<br>✏️ **Refined by [ADR NNNN](…), decision N:** …`, oldest first). These notes count as mechanical changes.
- `docs/archive/` — frozen records (the old open points register), never a source. Read its `CLAUDE.md` before using anything in it.

## Writing style for docs and explanations

- Spell out niche acronyms on first use (for example "single-page application (SPA)") and add them to `docs/glossary.md`. Common ones like API, UI, HTTP, JSON and SQL need no expansion.
- **Every written status or outcome gets its icon**, placed before the word, which stays (`✅ Accepted`, `⬜ Open`, `🎯 [MVP]`), so searching and screen readers still work. Legends list each icon with its word. No icons in headings: they change the heading's anchor. Use one vocabulary everywhere, and extend this list when a new status appears:
  - ✅ done or in force: ADR accepted, open point closed, finding fixed, phase done, `✅ Done` on the project
  - ⬜ open or not started: open point open, phase not started, `⬜ Backlog` on the project
  - 📌 to do next: `📌 Todo` on the project, an item picked to be done next
  - 🚧 in progress: open point or phase being worked on, `🚧 In progress` on the project
  - ⏳ deferred or waiting: finding deferred to an open point, `⏳ Blocked` on the project
  - ✖️ rejected or dropped: finding rejected, open point dropped without being done, `✖️ Dropped` on the project
  - ❌ failed or blocking: a failed plan, a blocking finding in the PR comment
  - ❔ pending: not decided or triaged yet, a draft acceptance criterion, a list of criteria not finalized
  - ➡️ moved: an acceptance criterion moved to another requirement, under a new ID
  - 📝 proposed, 🔁 superseded, ⛔ deprecated: ADR states
  - ✏️ refined, ➕ extended, 🧩 completed, 🔍 revisited (and 🔁 superseded): how a later ADR affected a decision, in the notes at the bottom of its cell
  - ➖ not applicable: `➖ N/A: reason` in the definition of done and the PR template
  - 🎯 MVP, 🔜 Later, 💡 future extension, 🚫 out of scope: release slicing in the requirements
- **Refer to requirements, use cases and requirement areas by link, never by plain ID**: `[ACC-1](../requirements/ACC-accounts-and-guest-mode.md#acc-1)`, `[UC-3](../requirements/UC-use-cases.md#uc-3-shop-in-a-store)`, `[SHR](../requirements/SHR-sharing.md)` (the path relative to the document). Link every mention, not only the first. Headings and code stay plain. Audits are point-in-time records and stay as written.
- Long documents (roughly over 100 lines, with several sections: guides, walkthroughs, living docs) start with a `## Contents` section right after the introduction, linking every `##` and `###` heading. Keep it in sync when headings change. ADRs and the glossary don't need one.
