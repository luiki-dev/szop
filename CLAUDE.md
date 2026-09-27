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
- **Follow the implementation process in [ADR 0004](docs/decisions/0004-implementation-process.md).** In short: foundation topics (development environment → testing strategy → hosting → CI/CD → visual design) settle direction only; then a living roadmap of phases, starting with a walking skeleton and continuing in vertical slices; each phase gets its own brainstorm, with details decided there, and meets the shared definition of done. The ADR also defines which document owns which facts (requirements, living docs, ADRs, roadmap, specs and plans).

## Documentation

- `docs/requirements/functional-requirements.md` — the living source of truth for functional requirements (FR IDs, use cases, MVP/Later slicing, future extensions). Keep it updated when behavior changes.
- `docs/architecture/architecture.md` — the living technical architecture (components, layering, data model highlights, frontend state, later features). Keep it updated when the design changes.
- `docs/architecture/stack-overview.md` — a learning-oriented explanation of the stack and its concepts. Extend it when a new technology or concept enters the project.
- `docs/glossary.md` — acronyms and terms used in the docs.
- `docs/decisions/` — ADR-style decision records, numbered `NNNN-short-title.md`, each with context, options considered, the decision and its consequences. Add a new ADR for every significant decision (architecture, technology, tooling, process), and don't rewrite accepted ones: supersede them with a new ADR.

## Writing style for docs and explanations

- Spell out niche acronyms on first use (for example "single-page application (SPA)") and add them to `docs/glossary.md`. Common ones like API, UI, HTTP, JSON and SQL need no expansion.
