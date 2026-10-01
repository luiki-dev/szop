## What and why

<!-- What this PR changes and why. The title follows Conventional Commits: it becomes the merge commit's message. -->

## Links

- Roadmap phase:
- Spec:
- Plan:
- Requirement IDs:
- ADRs:
- Open points (closed, re-assigned or added):

<!-- Write "none" for links that do not apply. -->

## How it was tested

<!-- Which tests were added or changed, and what was checked by hand. -->

## Definition of done

<!-- What each item means, which PRs need which items, and when the demo check must be repeated: docs/development/definition-of-done.md. Mark an item that does not apply as "➖ N/A: <reason>". In brackets: who makes the item true; the owner verifies all of them. -->

- [ ] Tests pass, at the right layers (Claude)
- [ ] Surviving mutants reviewed, when domain rules changed (Claude → owner)
- [ ] CI is green (CI)
- [ ] Deployed and checked on the demo, covering the final head, with a Lighthouse run when the UI changed (owner): <!-- link to the demo-up run, and the commit it deployed -->
- [ ] `infra/base` changes applied from this branch (owner; applied again from `main` once the PR is merged or closed)
- [ ] Living docs updated: architecture, stack overview, glossary, threat model, visual design, functional requirements, roadmap status (Claude)
- [ ] Guides updated (Claude)
- [ ] Significant decisions have ADRs (Claude → owner)
- [ ] Open points closed, re-assigned or added in `docs/open-points.md` (Claude)
- [ ] Commits and the PR title follow Conventional Commits; in a phase, commits follow the plan's tasks (Claude)
- [ ] UI changes shown: screenshots of phone (light and dark) and desktop (light) (Claude)
