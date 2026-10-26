## What and why

<!-- What this PR changes and why. The title follows Conventional Commits: it becomes the merge commit's message and the PR's line in the release notes. Label the PR skip-changelog if readers of the release notes do not need it (Claude Code's settings, process docs). -->

## Links

- Roadmap phase:
- Spec:
- Plan:
- Requirements and criteria:
- ADRs:
- Issues changed (open points closed, re-assigned or added; phase bodies updated):
- Issues closed (`Closes #N`, one per line):

<!-- Write "none" for links that do not apply. -->

## How it was tested

<!-- Which tests were added or changed, and what was checked by hand. -->

## Definition of done

<!-- What each item means, which PRs need which items, and when the demo check must be repeated: docs/development/definition-of-done.md. Mark an item that does not apply as "➖ N/A: <reason>" after its text, and leave its box unchecked. In brackets: who makes the item true; the owner verifies all of them. -->

- [ ] Tests pass, at the right layers; every criterion marked ✅ has a test named with its ID, or is checked at the demo (Claude)
- [ ] Surviving mutants reviewed, when domain rules changed (Claude → owner)
- [ ] CI is green (CI)
- [ ] Deployed and checked on the demo, covering the final head, with a Lighthouse run when the UI changed (owner):
  - Fixed checks:
    - `demo-up` run: …
    - Deployed commit (the PR's final head): …
    - `/api/health` answers `ok` with that commit: …
    - Console (no CSP errors, no other messages): …
    - Lighthouse, mobile profile, on `/`:
      - Performance: …
      - Accessibility: …
      - Best Practices: …
      - SEO: …
    - Core Web Vitals ([NFR-3](https://github.com/luiki-dev/szop/blob/main/docs/requirements/functional-requirements.md#nfr-3): LCP ≤ 2.5 s, CLS ≤ 0.1; TBT stands in for INP in the lab):
      - LCP … s
      - CLS …
      - TBT … ms
    - `demo-down` run: …
  - This PR's checks: <!-- one line per behavior to check in a browser, from the spec's demo check, each ending in ": …" for the result -->
- [ ] `infra/base` changes applied from this branch (owner; applied again from `main` once the PR is merged or closed)
- [ ] Living docs updated: architecture, stack overview, glossary, threat model, visual design, functional requirements (criteria statuses, each requirement's line and the index), roadmap status and the issues (Claude)
- [ ] Guides updated (Claude)
- [ ] Significant decisions have ADRs (Claude → owner)
- [ ] Open points closed, re-assigned or added on GitHub, and listed above (Claude)
- [ ] Commits and the PR title follow Conventional Commits; in a phase, commits follow the plan's tasks (Claude)
- [ ] UI changes shown: screenshots of phone (light and dark) and desktop (light) (Claude)
