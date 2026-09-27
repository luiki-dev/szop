# ADR 0004 — Implementation process: foundation topics, roadmap and phases

- **Status:** Accepted — decisions 2 and 3 extended by [ADR 0006](0006-git-workflow-topic.md) (git workflow added as a foundation topic); decision 7 refined by [ADR 0007](0007-testing-strategy.md) (what "the tests pass" means)
- **Date:** 2026-09-27

## Context

The [functional requirements](../requirements/functional-requirements.md) ([ADR 0001](0001-functional-requirements-scope.md)) and the [technical architecture](../architecture/architecture.md) ([ADR 0002](0002-technical-architecture.md), [ADR 0003](0003-abuse-protection.md)) are agreed. Before writing any code, the owner wanted to settle how the rest of the project is run.

`CLAUDE.md` already sets the ground rules: go step by step, use the superpowers workflow (brainstorming → spec → plan → implementation) for everything, record decisions. It did not say which topics are still open before implementation can start, in what order to decide them, how implementation is split into pieces, or how the growing set of documents relate to each other.

The owner proposed:

1. Brainstorm the remaining foundation topics: development environment, CI/CD, hosting and visual design.
2. Then write a **roadmap** of implementation **phases**, covering every aspect of the work, not only features: setting up the development environment, the database, CI/CD, visual design, each feature.
3. Implement each phase in its own superpowers cycle: brainstorm the details, plan, execute.
4. Future features extend the roadmap the same way and are implemented as in step 3.

The approach is sound: it is the brainstorming skill's own advice (split a large project into sub-projects, each with its own spec → plan → implementation cycle) applied to the whole project, infrastructure included. The review found risks in how it is carried out, not in the idea. The decisions below address them.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | How much to decide up front | Decide nothing ahead, only phase by phase; decide everything up front in detail; decide direction up front, details per phase | **Two levels.** Foundation brainstorms settle **direction and constraints**, at the level of ADR 0002 ("Fastify, not NestJS", not the list of routes). Each phase's own brainstorm settles the **details**. Deciding everything in detail up front ("big design up front") means deciding without feedback, and parts of it would turn out wrong once they meet reality. Deciding nothing ahead leaves phases free to contradict each other and makes the roadmap impossible to order. |
| 2 | Foundation topics | Development environment, CI/CD, hosting, visual design (as proposed); the same plus testing strategy | **Add testing strategy.** `architecture.md` already lists it as a later step, and it shapes the rest: CI runs the tests, the development environment must support them, and every phase writes them. The smaller open items (email provider, secrets, database backups, monitoring) belong to the **hosting** topic. |
| 3 | Order of the foundation topics | As proposed; ordered by dependency | **Development environment → testing strategy → hosting → CI/CD → visual design.** CI/CD runs the tests and deploys to the hosting, so it comes after both. Visual design is mostly independent and goes last. Each topic is its own brainstorm and gets its own ADR. When a later topic invalidates an earlier decision, a new ADR supersedes it. |
| 4 | Scope of the visual design topic | Every screen up front; everything per screen; a foundation up front, screens per phase | **Foundation up front, screens per phase.** The foundation brainstorm settles the overall look, the styling approach, the component library and the **design tokens** (colors, spacing, typography). Each screen is designed in the phase that builds it. Designing every screen before any exists has the same problem as decision 1. |
| 5 | Shape of the roadmap | Horizontal layers (all infrastructure, then backend, then frontend); walking skeleton, then vertical slices | **Walking skeleton first, then vertical slices.** The walking skeleton is an early phase that builds a trivial slice through every layer: SPA → API → database, tested in CI and deployed to production. It puts every foundation decision to the test while it is still cheap to change. After it, each feature phase is a **vertical slice**: it delivers one capability end to end (database schema, API, UI, tests, deployment). Layered phases would mean a long stretch with nothing running, and would test hosting and CI/CD last, when changing them costs the most. Tooling work can still be its own phase when it stands alone (for example, adding a code formatter). |
| 6 | Roadmap as a document | A fixed plan; a living document | **A living document**, `docs/roadmap.md`: the phases in order, each with its status and links to its spec, plan and the requirement IDs it implements. Requirements are referenced by ID, never restated. Reordering, splitting or adding phases is expected as early phases teach us things, and needs an ADR only when it reflects a significant decision. |
| 7 | When a phase is done | Decided per phase; one shared definition of done | **One shared definition of done:** the tests pass, CI is green, the change is deployed, the living docs are updated (architecture, stack overview, glossary, functional requirements when behavior changed, roadmap status), and significant decisions have ADRs. The CI and deployment items apply from the phase that introduces them. |
| 8 | Process weight per phase | Always the full cycle; weight chosen by the size of the phase | **The brainstorming skill's classification decides.** A phase that adds or restructures components gets the full cycle: brainstorm, written spec, written plan. A small, well-scoped phase takes the **bounded** path: a short design in chat instead of a spec and plan. Every path ends with the owner's approval before implementation starts. A full spec for "add a code formatter" would be ceremony. |
| 9 | Roles of the documents | — | **Each fact has one home; other documents link to it.** See the table below. |
| 10 | Future features | Straight onto the roadmap; through the requirements first | **Through the requirements first.** A new feature gets requirement IDs in the functional requirements (and moves from "future extensions" if it was listed there), then one or more roadmap phases, then the per-phase cycle of decision 8. |

### Document roles

| Document | Answers | Lifecycle |
|---|---|---|
| **Functional requirements** (`docs/requirements/`) | What Szop does | Living; updated when behavior changes |
| **Architecture, stack overview, glossary** (`docs/architecture/`, `docs/glossary.md`) | How Szop is built *now*, and the concepts behind it | Living; updated by every phase that changes them |
| **ADRs** (`docs/decisions/`) | Why a significant decision was made, and what else was considered | Never rewritten once accepted; superseded by a new ADR |
| **Roadmap** (`docs/roadmap.md`) | What is built in which order, and how far along it is | Living; status updated as phases finish |
| **Specs and plans** (`docs/superpowers/specs/`, `docs/superpowers/plans/`) | The detailed design of one phase, and the steps to build it | Working papers for one phase; kept afterwards as history, not updated |

## Consequences

- The next steps are five foundation brainstorms in the order of decision 3, starting with the development environment. Each one ends with an ADR and updates to the living docs.
- The roadmap is written after the foundation topics, as `docs/roadmap.md`. `CLAUDE.md` and the README's documentation list will point to it then.
- The first implementation phases are expected to set up the development environment and then build the walking skeleton. The roadmap decides the exact order.
- Phases are sized so that each ends with something working and, once hosting exists, deployed.
