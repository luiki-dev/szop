---
name: new-adr
description: The rules for writing a new ADR in docs/decisions/, or a note on an earlier ADR's decision. Run it when a new ADR is created (a significant architecture, technology, tooling or process decision), when a new ADR supersedes, refines, extends, completes or revisits a decision of an earlier one, and to check an ADR's number again before opening a PR.
---

# New ADR

`docs/decisions/` holds ADR-style decision records, numbered `NNNN-short-title.md`. Add a new ADR for every significant decision (architecture, technology, tooling, process).

## The number

The highest number in `docs/decisions/` on `origin/main` and on every open branch, plus one. Check it when the ADR is created and again before the PR, since another branch may have taken it:

```bash
git fetch
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin/); do git ls-tree --name-only "$b" docs/decisions/; done | grep -oE '[0-9]{4}-[^/]*\.md$' | cut -c1-4 | sort -u | tail -1 | awk '{printf "%04d\n", $1+1}'
```

Once the branch's own ADR is pushed, the command counts it, so it prints that number plus one; if the highest number is your own ADR, there is no clash.

## The file

`docs/decisions/NNNN-short-title.md`, in the shape of the recent ADRs; take [ADR 0056](../../../docs/decisions/0056-claude-code-tooling.md) as the model:

- the title line (`# ADR NNNN — Title`);
- **Status:** `✅ Accepted`; **Date:**; the relation headers when they apply (`Refines:`, `Extends:`, `Supersedes:`, `Completes:`, `Revisits:` …);
- `## Context`;
- `## Decisions`: a table with the columns `#`, Decision, Options considered, Outcome, the outcome saying who chose it;
- `## Consequences`.

## Rules

- **Don't rewrite an accepted ADR:** supersede it with a new one.
- **Mechanical changes that keep the meaning are allowed:** status lines, status icons, links.
- **A new ADR that supersedes, refines, extends, completes or revisits a decision of an earlier one notes it in two places:**
  - the new ADR's header (`Refines:`, `Extends:` …);
  - when it names a decision, a line at the bottom of that decision's cell in the earlier ADR: `<br>✏️ **Refined by [ADR NNNN](…), decision N:** …`, oldest first. The icon follows the writing style: ✏️ refined, ➕ extended, 🧩 completed, 🔍 revisited, 🔁 superseded.
- **The earlier ADR's status line gets a note only when the whole ADR is superseded or deprecated** (🔁 Superseded, ⛔ Deprecated).
- **These notes count as mechanical changes.**

## Tracking

- **Outside a phase:** an `adr` issue, closed by the PR:

  ```bash
  gh issue create --repo luiki-dev/szop --label adr --title "ADR NNNN <title>" --body "<body>"
  ```

  The body is as in [ADR issues](../../../docs/development/project-tracking.md#adr-issues). Add the issue to the project with the `item-add` command in [phase-tracking, Commands](../phase-tracking/SKILL.md#commands).
- **Inside a phase:** the phase ADR is created with its spec and has no issue of its own; follow [the specs rules](../../../docs/superpowers/specs/CLAUDE.md).
