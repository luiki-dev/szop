# CLAUDE.md

Szop is a web application for tracking shopping lists (groceries and general shopping). See `README.md` for the high-level description.

## Project purpose (from the README disclaimer)

This project is primarily a **learning project**. The owner wants to learn:

- the superpowers workflow (brainstorming → spec → plan → implementation), and
- popular web application technologies.

How to work on it:

- **Go step by step.** Every element of building the app is its own deliberate step that the owner wants to follow and understand: project setup and layout, architecture, technology choices, CI/CD, building, testing, deployment, and others. Do not bundle several of these into one change or make them silently.
- **Use the superpowers workflow for everything**, not only for features. Setup, tooling, CI/CD and deployment decisions also go through brainstorming and approval.
- **Record decisions in the project documentation.** Capture every decision about architecture, solution design, approaches and other crucial aspects of the implementation, along with the reasoning and the alternatives considered.
- **Explain choices.** When proposing a technology or approach, say why and what the trade-offs are, since learning is a goal in itself.
- **Follow the implementation process in [ADR 0004](docs/decisions/0004-implementation-process.md).** In short: foundation topics (development environment → testing strategy → hosting → git workflow → CI/CD → visual design, the git workflow added by [ADR 0006](docs/decisions/0006-git-workflow-topic.md)) settle direction only; then a living roadmap of phases, starting with a walking skeleton and continuing in vertical slices; each phase gets its own brainstorm, with details decided there, and meets the shared definition of done. The ADR also defines which document owns which facts (requirements, living docs, ADRs, roadmap, specs and plans).

## Git workflow

Follow [ADR 0009](docs/decisions/0009-git-workflow.md) and the guide in `docs/development/git-workflow.md`. In short:

- **Never commit to `main`.** Every change is made on a branch named `type/short-description` (`feat/shopping-lists`, `docs/adr-0010-ci-cd`) and reaches `main` through a pull request. A roadmap phase is one branch and one PR, holding its spec, plan and code.
- **Commit messages follow Conventional Commits** (`type(scope): description`, imperative). Within a phase, commits follow the plan's tasks. So does the PR title, which becomes the merge commit's message.
- **Review your own changes before opening a PR, and fill in the PR template** (`.github/pull_request_template.md`).
- **Address review comments with new commits** on the branch; don't rewrite history once a PR is open. Bring `main` in by merging it, not by rebasing.
- **Never merge a PR**, including release-please's release PR. Only the owner merges; the merge is the approval.

## Documentation

- `docs/requirements/functional-requirements.md` — the living source of truth for functional requirements (FR IDs, use cases, MVP/Later slicing, future extensions). Keep it updated when behavior changes.
- `docs/architecture/architecture.md` — the living technical architecture (components, layering, data model highlights, frontend state, later features). Keep it updated when the design changes.
- `docs/architecture/stack-overview.md` — a learning-oriented explanation of the stack and its concepts. Extend it when a new technology or concept enters the project.
- `docs/glossary.md` — acronyms and terms used in the docs.
- `docs/development/git-workflow.md` — the day-to-day git workflow: branches, commits, PRs, review, merging and releases.
- `docs/development/phase-walkthrough.md` — one example phase end to end: commits, PRs, CI, demo, release-please and version tags, in order.
- `docs/development/github-settings.md` — every GitHub setting the workflow relies on, where it lives in GitHub, and why. Keep it updated when a setting changes.
- `docs/decisions/` — ADR-style decision records, numbered `NNNN-short-title.md`, each with context, options considered, the decision and its consequences. Add a new ADR for every significant decision (architecture, technology, tooling, process), and don't rewrite accepted ones: supersede them with a new ADR.

## Writing style for docs and explanations

- Spell out niche acronyms on first use (for example "single-page application (SPA)") and add them to `docs/glossary.md`. Common ones like API, UI, HTTP, JSON and SQL need no expansion.
