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
- **Track what is deferred in `docs/open-points.md`** ([ADR 0011](docs/decisions/0011-design-sanity-check-follow-ups.md)). Whenever something is left to a later topic or phase, add an entry with the next free `OP-` ID. Start every topic or phase brainstorm from its open points, and close or re-assign them before its PR is merged.
- **Follow the implementation process in [ADR 0004](docs/decisions/0004-implementation-process.md).** In short: foundation topics (development environment → testing strategy → hosting → git workflow → CI/CD → security baseline → visual design, the git workflow added by [ADR 0006](docs/decisions/0006-git-workflow-topic.md) and the security baseline by [ADR 0011](docs/decisions/0011-design-sanity-check-follow-ups.md)) settle direction only; then a living roadmap of phases, starting with a walking skeleton and continuing in vertical slices ([`docs/roadmap.md`](docs/roadmap.md), shaped by [ADR 0014](docs/decisions/0014-roadmap.md)); each phase gets its own brainstorm, with details decided there, and meets the shared definition of done. The ADR also defines which document owns which facts (requirements, living docs, ADRs, roadmap, specs and plans).

## Git workflow

Follow [ADR 0009](docs/decisions/0009-git-workflow.md) and the guide in `docs/development/git-workflow.md`. In short:

- **Never commit to `main`.** Every change is made on a branch named `type/short-description` (`feat/shopping-lists`, `docs/adr-0010-ci-cd`) and reaches `main` through a pull request. A roadmap phase is one branch and one PR, holding its code and, on the full path of ADR 0004, decision 8, its spec and plan.
- **Commit messages follow Conventional Commits** (`type(scope): description`, imperative). Within a phase, commits follow the plan's tasks. The PR title follows Conventional Commits too, since it becomes the merge commit's message.
- **Review your own changes before opening a PR, and fill in the PR template** (`.github/pull_request_template.md`).
- **Address review comments with new commits** on the branch; don't rewrite history once a PR is open. Bring `main` in by merging it, not by rebasing.
- **Never merge a PR**, including release-please's release PR. Only the owner merges; the merge is the approval.
- **Never trigger `demo-up` or `demo-down`** unless the owner asks ([ADR 0010](docs/decisions/0010-ci-cd.md), consequences).
- **Don't work around the deny rules in `.claude/settings.json` or the push hook in `.claude/hooks/`** ([ADR 0012](docs/decisions/0012-security-baseline.md), decision 19; [ADR 0015](docs/decisions/0015-git-push-guard-hook.md)). They back the rules above; if one blocks something the owner asked for, say so and let the owner run it.
- **When a superpowers skill offers a git worktree or a local merge, don't take it.** Work on a plain branch in the main checkout (ADR 0009, decision 5), and finish by pushing the branch and opening a PR.

## Documentation

- `docs/requirements/functional-requirements.md` — the living source of truth for functional requirements (FR IDs, use cases, MVP/Later slicing, future extensions) and the non-functional requirements (NFR IDs: browsers, accessibility, performance). Keep it updated when behavior changes.
- `docs/architecture/architecture.md` — the living technical architecture (components, layering, data model highlights, frontend state, later features). Keep it updated when the design changes.
- `docs/architecture/stack-overview.md` — a learning-oriented explanation of the stack and its concepts. Extend it when a new technology or concept enters the project.
- `docs/architecture/threat-model.md` — what Szop protects, who can act through which path, and what guards each entry point. Keep it updated when an actor or entry point is added.
- `docs/architecture/visual-design.md` — the living design system: the look, design tokens, typography, brand, and the layout and interaction principles every screen follows, with the approved mockups in `docs/architecture/visual-design/`. Keep it updated when the design system changes.
- `docs/glossary.md` — acronyms and terms used in the docs.
- `docs/roadmap.md` — the phases in order, grouped into stages, each with its goal, what it delivers, the owner's steps and its status. Keep a phase's row updated when its work starts, when its PR opens and before it is merged.
- `docs/open-points.md` — the register of everything still undecided or undone, grouped by the roadmap's phases. Keep it updated whenever something is deferred or settled.
- `docs/development/git-workflow.md` — the day-to-day git workflow: branches, commits, PRs, review, merging and releases.
- `docs/development/definition-of-done.md` — the one definition of done: every item, what it means, which PRs need it, and when the demo check must be repeated. The PR template mirrors it.
- `docs/development/phase-walkthrough.md` — one example phase end to end: commits, PRs, CI, demo, release-please and version tags, in order.
- `docs/development/github-settings.md` — every GitHub setting the workflow relies on, where it lives in GitHub, and why. Keep it updated when a setting changes.
- `docs/development/setup.md` — the setup guide, from a clean Windows machine to passing checks. Keep it updated when a tool or a step changes.
- `docs/development/tools/` — one page per development tool: what it is, why it was chosen, its configuration explained. Keep a tool's page updated when its configuration changes.
- `docs/decisions/` — ADR-style decision records, numbered `NNNN-short-title.md`, each with context, options considered, the decision and its consequences. Add a new ADR for every significant decision (architecture, technology, tooling, process), and don't rewrite accepted ones: supersede them with a new ADR. Mechanical changes that keep the meaning (status lines, status icons, links) are allowed.

## Writing style for docs and explanations

- Spell out niche acronyms on first use (for example "single-page application (SPA)") and add them to `docs/glossary.md`. Common ones like API, UI, HTTP, JSON and SQL need no expansion.
- **Every written status or outcome gets its icon**, placed before the word, which stays (`✅ Accepted`, `⬜ Open`, `🎯 [MVP]`), so searching and screen readers still work. Legends list each icon with its word. No icons in headings: they change the heading's anchor. Use one vocabulary everywhere, and extend this list when a new status appears:
  - ✅ done or in force: ADR accepted, open point closed, finding fixed, phase done
  - ⬜ open or not started: open point open, phase not started
  - 🚧 in progress: open point or phase being worked on
  - ⏳ deferred or waiting: finding deferred to an open point
  - ✖️ rejected or dropped: finding rejected, open point dropped without being done
  - ❔ pending: not decided or triaged yet
  - 📝 proposed, 🔁 superseded, ⛔ deprecated: ADR states
  - ➖ not applicable: `➖ N/A: reason` in the definition of done and the PR template
  - 🎯 MVP, 🔜 Later, 💡 future extension, 🚫 out of scope: release slicing in the requirements
- **Refer to requirements, use cases and requirement areas by link, never by plain ID**: `[ACC-1](../requirements/functional-requirements.md#acc-1)`, `[UC-3](../requirements/functional-requirements.md#uc-3-shop-in-a-store)`, `[SHR](../requirements/functional-requirements.md#sharing-shr)` (the path relative to the document). Link every mention, not only the first. Headings and code stay plain. Audits are point-in-time records and stay as written.
- Long documents (roughly over 100 lines, with several sections: guides, walkthroughs, living docs) start with a `## Contents` section right after the introduction, linking every `##` and `###` heading. Keep it in sync when headings change. ADRs and the glossary don't need one.
