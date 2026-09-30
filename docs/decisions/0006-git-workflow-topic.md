# ADR 0006 — Git workflow as a foundation topic

- **Status:** ✅ Accepted — completed by [ADR 0009](0009-git-workflow.md) (the git workflow itself; direct commits to `main` end with it)
- **Date:** 2026-09-27
- **Extends:** decisions 2 and 3 of [ADR 0004](0004-implementation-process.md) (foundation topics and their order)

## Context

ADR 0004 lists five foundation topics to decide before the roadmap: development environment, testing strategy, hosting, CI/CD and visual design. None of them covers the **git workflow**: the branching model, whether changes must go through pull requests (PRs), code review, branch protection, the merge strategy and commit conventions.

The git workflow is tightly coupled to CI/CD. A PR is what triggers CI, branch protection is what makes a passing CI mandatory before merging, and the branching model decides what the pipeline does. It also matters beyond a solo project's usual needs: most of Szop's code is written by Claude Code, so a PR is a natural place for the owner to review that work before it reaches `main`.

## Decision

**The git workflow is a foundation topic of its own, brainstormed right before CI/CD.** The order of the foundation topics becomes:

development environment → testing strategy → hosting → **git workflow** → CI/CD → visual design

The workflow itself is decided in that topic's brainstorm and recorded in its own ADR. This ADR only adds the topic. It is kept separate from CI/CD, rather than folded into it, because the CI/CD brainstorm is already large and working with git deserves its own look in a learning project.

## Consequences

- Until the git workflow ADR exists, changes are committed directly to `main`. Only documentation changes before then: the first code arrives in the development environment setup phase, after all foundation topics and the roadmap.
- The CI/CD topic builds on the git workflow decisions.
