# Open points

Everything that is still undecided or not yet done and has been left to a later topic or phase: decisions to take, checks to run, documents to write, settings to apply. One list, so nothing deferred in an ADR, a guide or a review is forgotten. Why the register exists is recorded in [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 1.

## Contents

- [How it works](#how-it-works)
- [Before the roadmap](#before-the-roadmap)
- [Development environment phase](#development-environment-phase)
- [Walking skeleton](#walking-skeleton)
- [CI/CD phase](#cicd-phase)
- [Feature phases](#feature-phases)
- [Unassigned](#unassigned)
- [Closed](#closed)

## How it works

- **One entry per open point**, with a stable ID (`OP-001`, `OP-002`, …) that ADRs, specs, plans, PRs and commits can refer to. IDs are never reused.
- **Each entry says** what is open, where it came from (a link to the ADR decision, guide or audit finding) and its status: **open**, or **in progress** with a link to the branch or PR working on it.
- **Entries are grouped by where they will be settled.** Until the roadmap exists (`docs/roadmap.md`), the groups are the topics and kinds of phase the ADRs name. The roadmap brainstorm assigns every entry to a real phase and regroups this page by phase.
- **Adding:** whenever a topic, phase or review defers something, it adds an entry here with the next free ID, in addition to mentioning it where it came up.
- **Using:** each topic or phase brainstorm starts from its group's entries. Before its PR is merged, the phase closes them, or moves them to another group with a note why (the definition of done, [ADR 0011](decisions/0011-design-sanity-check-follow-ups.md), decision 1).
- **Closing:** a settled entry moves to [Closed](#closed) with a link to what settled it (an ADR, a commit, a PR). Closed entries stay as a record; an entry dropped without being done says why.

## Before the roadmap

Foundation topics still to come, and what the roadmap brainstorm itself must settle.

None yet.

## Development environment phase

The first implementation phase: the tooling, configuration and guides of [ADR 0005](decisions/0005-development-environment.md) and [ADR 0007](decisions/0007-testing-strategy.md).

None yet.

## Walking skeleton

The thinnest end-to-end slice (SPA → API → database), built by CI and deployed ([ADR 0004](decisions/0004-implementation-process.md), decision 5), with the AWS infrastructure of [ADR 0008](decisions/0008-hosting.md). The roadmap may split it into several phases.

None yet.

## CI/CD phase

The workflows, settings and release tooling of [ADR 0009](decisions/0009-git-workflow.md) and [ADR 0010](decisions/0010-ci-cd.md). The roadmap may split them across several phases.

None yet.

## Feature phases

Points that belong to the phase building a given requirement area (ACC, LST, ITM, …, SHR, SYN).

None yet.

## Unassigned

Points whose home is not clear yet. The roadmap brainstorm gives each one a group.

None yet.

## Closed

None yet.
