# Open Points on GitHub, Plans in the Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every open point, open or closed, is a GitHub issue; `docs/open-points.md` is archived for the records; the living docs link to GitHub; the trial rule gives way to permanent rules; ADR 0027 records it.

**Architecture:** GitHub first (25 closed issues), then the archive (a `git mv`, a banner, a `CLAUDE.md`, the records' links re-pointed), then a scripted rewrite of the living docs' links from an OP → issue map read from GitHub, then the wording by hand, then the ADR. Throwaway scripts live in the scratchpad, never in the repository.

**Tech Stack:** `gh` 2.x (REST and GraphQL), Python 3 for the throwaway scripts, `git mv`, Markdown.

**Spec:** `docs/superpowers/specs/2026-10-11-open-points-on-github-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked](#facts-checked)
- [Task 1: The closed open points become issues](#task-1-the-closed-open-points-become-issues)
- [Task 2: The archive](#task-2-the-archive)
- [Task 3: The living docs' links](#task-3-the-living-docs-links)
- [Task 4: The wording](#task-4-the-wording)
- [Task 5: ADR 0027](#task-5-adr-0027)
- [After tasks 1–5: open the PR](#after-tasks-15-open-the-pr)

## Global Constraints

- Branch `docs/adr-0027-open-points-on-github`, already created and pushed, holding the spec commit; never commit to `main`; no worktree. Before any `git switch`, run `git status -sb`: another session may own the checkout.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **Scratchpad** for every throwaway script and file: `/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad` (written `$SP` below; set it with `SP=…` in each shell). Scripts are never committed.
- **Repository and project:** `luiki-dev/szop`; project 3 of user `luiki-dev`, id `PVT_kwHOEVZTps4BmW8P`; Status field `PVTSSF_lAHOEVZTps4BmW8PzhlAT9c`.
- **The living docs** are `README.md`, `CLAUDE.md`, `.github/**`, and `docs/**` except `docs/superpowers/`, `docs/audits/` and `docs/archive/`. **The records** are `docs/superpowers/specs/`, `docs/superpowers/plans/` and `docs/audits/`. Records keep their wording; only their links to the register change (Task 2).
- **Link targets, exactly:** an open point → `https://github.com/luiki-dev/szop/issues/<N>`; a phase → its phase issue, same form; the board's Open Points view → `https://github.com/users/luiki-dev/projects/3/views/5`; the archive from a record → `../../archive/open-points.md#…` (specs and plans) or `../archive/open-points.md#…` (the audit), anchors unchanged. Link text never changes in the scripted rewrite.
- **Accepted ADRs:** only links change, plus the status-line and cell notes of Task 5 (mechanical changes `CLAUDE.md` allows). Their prose ("the register…") stays.
- **Issue bodies** follow [project tracking, links inside issue bodies](../../development/project-tracking.md#links-inside-issue-bodies): a reference to an open point or phase that has an issue is written `OP-053 (#26)`; every other link is absolute, to the file on `main`.
- Never merge, never delete a branch, never run `gh workflow run`; do not work around `.claude/settings.json` or the push hook.
- Commit messages follow Conventional Commits with the `scope-enum` of `commitlint.config.js` (`adr`, `plan`, `roadmap` here, or no scope; there is **no `open-points` scope**). **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch):
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use; status icons before their word; requirements linked; `## Contents` kept in sync in long documents; no icons in headings; no jokes.

## Review Focus

Inputs the spec implies that no plain run of the scripts exercises; each has its check in the owning task.

1. **A closed entry that refers to another open point** (`[OP-002](#op-002)` inside its text): the new issue must say `OP-002 (#N)`, never a dead `#op-002` anchor or a leftover token. Check: Task 1, step 6.
2. **An ADR that links a closed open point** (ADR 0013 → OP-001, ADR 0014 → OP-002): the rewritten link must open the new closed issue, so Task 3 runs only after Task 1. Check: Task 3, step 4 (titles match link text for every rewritten link).
3. **An anchor that is neither an entry nor a phase group** (`#closed`, `#candidates`, `#how-it-works`, a typo): the rewrite script must stop and list it rather than guess. Check: Task 3, step 2.
4. **The README's different path,** `docs/open-points.md` instead of `../open-points.md`: the script's pattern accepts any `../` depth and an optional `docs/` prefix. Check: Task 3, step 3.
5. **The archive's own links after the move** (it links `decisions/…`, `roadmap.md`, `requirements/…` relatively) and **the records' anchors into it**: both must resolve. Check: Task 2, step 6.

## Facts checked

On 2026-10-11, read from GitHub and the repository:

- **88 register entries, OP-001 to OP-088;** 63 issues labelled `open-point` (60 open). Closed entries with an issue already: OP-012 (#64), OP-057 (#65); OP-067 (#27) is closed on GitHub but still in PH-08's group in the register. The 25 closed entries without an issue are listed in Task 1's mapping table.
- **Open-point issues have no milestone.** The project's auto-add workflow adds any issue labelled `open-point`; closing an issue sets ✅ Done.
- **The views,** read through GraphQL (`projectV2.views`), as the owner set them:

  | # | View | Layout | Filter | Grouped by | Swimlanes | Sorted by | Fields shown |
  |---|---|---|---|---|---|---|---|
  | 1 | Timeline | Roadmap | `label:phase,adr` | Milestone | — | Started, then Order | Title, Assignees, Status |
  | 3 | Backlog | Table | none | Milestone | — | Started, then Order | Title, Status, Labels, Linked pull requests, Sub-issues progress, Started, Finished |
  | 4 | Board | Board | none | Milestone | Status (columns) | Started, then Order | Title, Status, Labels, Linked pull requests, Parent issue, Sub-issues progress, Finished |
  | 5 | Open Points | Table | `label:open-point is:open` | Parent issue | — | Title | Title, Status, Labels |
  | 6 | Next Up | Table | `status:"📌 Todo","⏳ Blocked","🚧 In progress"` | Status | — | none | Title, Labels, Milestone, Parent issue, Sub-issues progress |
  | 7 | Owner Steps | Table | `label:owner` | Parent issue | — | Title | Title, Status, Labels |

  (The API returns the Board's column field as `verticalGroupByFields`; Task 4 re-reads them in case the owner changes them again.)
- **Links into the register in living docs:** 220 entry links (`#op-N`), phase-group links (`#ph-…`, mostly `roadmap.md`'s "Open points:" lines), 3 bare links in ADRs (0011:17, 0014:12, 0024:10), 5 bare links elsewhere (`README.md:98`, `definition-of-done.md:26`, `project-tracking.md:3` and `:35`, `roadmap.md:60`), and plain-text mentions in `CLAUDE.md`, `.github/`, the glossary, the guides and ADRs.
- **Links in the records:** 131 link targets in 10 specs, 58 in 10 plans (both as `../../open-points.md…`), 52 in the audit (`../open-points.md…`).

---

### Task 1: The closed open points become issues

**Files:**
- Modify: this plan (the step ticks and the table of new issue numbers in step 7)
- GitHub: 25 new issues labelled `open-point`, closed, each a sub-issue of its parent

**Interfaces:**
- Consumes: `docs/open-points.md` as it is on the branch (read only).
- Produces: an issue for every register entry, so Task 3's OP → issue map is complete; the table of new numbers in step 7.

**The mapping** (the owner reviews it with this plan; each parent is what settled the entry, from its "Closed:" line):

| Entries | Settled by | Parent |
|---|---|---|
| OP-001 | ADR 0013 | #133 (ADR 0013) |
| OP-002, OP-003, OP-004, OP-031, OP-061 | ADR 0014 | #134 (ADR 0014) |
| OP-005, OP-006, OP-011 | PR #20 | #32 (PH-04) |
| OP-007, OP-058, OP-059 | PR #23 | #35 (PH-06a) |
| OP-008, OP-009 | PR #11 | #29 (PH-01) |
| OP-022 | PR #14 | #30 (PH-02) |
| OP-024 | ADR 0011 | #131 (ADR 0011) |
| OP-034, OP-035, OP-036, OP-037, OP-042, OP-050 | ADR 0012 | #132 (ADR 0012) |
| OP-062, OP-065 | PR #18 | #31 (PH-03) |
| OP-073 | ADR 0022 | #137 (ADR 0022) |

New issues:

| Entry | Issue | Parent |
|---|---|---|
| OP-001 | #167 | #133 |
| OP-002 | #168 | #134 |
| OP-003 | #169 | #134 |
| OP-004 | #170 | #134 |
| OP-005 | #171 | #32 |
| OP-006 | #172 | #32 |
| OP-007 | #173 | #35 |
| OP-008 | #174 | #29 |
| OP-009 | #175 | #29 |
| OP-011 | #176 | #32 |
| OP-022 | #177 | #30 |
| OP-024 | #178 | #131 |
| OP-031 | #179 | #134 |
| OP-034 | #180 | #132 |
| OP-035 | #181 | #132 |
| OP-036 | #182 | #132 |
| OP-037 | #183 | #132 |
| OP-042 | #184 | #132 |
| OP-050 | #185 | #132 |
| OP-058 | #186 | #35 |
| OP-059 | #187 | #35 |
| OP-061 | #188 | #134 |
| OP-062 | #189 | #31 |
| OP-065 | #190 | #31 |
| OP-073 | #191 | #137 |

- [x] **Step 1: Write the generator**

`$SP/closed_issues.py`:

```python
"""Builds the issue title, body and closing comment of every closed register
entry that has no issue yet. Writes one JSON file; creates nothing."""
import json, re, sys

REPO_BLOB = "https://github.com/luiki-dev/szop/blob/main/docs/"
ADR27 = REPO_BLOB + "decisions/0027-open-points-on-github.md"
PARENTS = {
    "OP-001": 133, "OP-002": 134, "OP-003": 134, "OP-004": 134, "OP-031": 134,
    "OP-061": 134, "OP-005": 32, "OP-006": 32, "OP-011": 32, "OP-007": 35,
    "OP-058": 35, "OP-059": 35, "OP-008": 29, "OP-009": 29, "OP-022": 30,
    "OP-024": 131, "OP-034": 132, "OP-035": 132, "OP-036": 132, "OP-037": 132,
    "OP-042": 132, "OP-050": 132, "OP-062": 31, "OP-065": 31, "OP-073": 137,
}


def absolutize(text: str) -> str:
    # [x](#op-002) -> token, resolved to "OP-002 (#N)" once every issue exists.
    text = re.sub(r"\[[^\]]*\]\(#op-(\d+)\)", lambda m: "{{OP-%s}}" % m.group(1), text)
    # Other in-page anchors of the register: absolute, into the archive.
    text = re.sub(r"\]\(#([a-z0-9-]+)\)", r"](" + REPO_BLOB + r"archive/open-points.md#\1)", text)
    # Relative links (relative to docs/): absolute, to the file on main.
    return re.sub(r"\]\((?!https?://|#|mailto:)([^)]+)\)", lambda m: "](" + REPO_BLOB + m.group(1) + ")", text)


register = open("docs/open-points.md", encoding="utf-8").read()
closed = register[register.index("\n## Closed\n"):]
entries = re.split(r"^#### ", closed, flags=re.M)[1:]
out = []
for entry in entries:
    op, rest = entry.split("\n", 1)
    op = op.strip()
    if op not in PARENTS:
        continue
    lines = rest.strip("\n").split("\n")
    text_lines, parts, source, history, status = [], [], None, [], None
    mode = "text"
    for line in lines:
        if line.startswith("- **Parts**"):
            mode = "parts"
        elif line.startswith("  - ") and mode == "parts":
            parts.append(line[4:])
        elif line.startswith("- **Source:**"):
            source, mode = line[len("- **Source:**"):].strip(), "meta"
        elif line.startswith("- **Moved from") or line.startswith("- **Since"):
            history.append(line[2:])
            mode = "meta"
        elif line.startswith("- **Status:**"):
            status, mode = line[len("- **Status:**"):].strip(), "meta"
        elif mode == "text":
            text_lines.append(line)
        elif line.strip():
            sys.exit(f"{op}: unexpected line, extend the parser: {line!r}")
    text = "\n".join(text_lines).strip()
    lead = re.match(r"\*\*(.+?)\*\*", text)
    if not lead or not status or not status.startswith("✅ Closed"):
        sys.exit(f"{op}: no bold lead or no ✅ Closed status")
    title = f"{op} {lead.group(1).rstrip('.:;,')}"
    if len(title) > 80:
        title = title[:79] + "…"
    body = [f"Closed before the register moved to GitHub ([ADR 0027]({ADR27})). "
            f"The register as it was: [docs/archive/open-points.md]({REPO_BLOB}archive/open-points.md#{op.lower()}).",
            "", absolutize(text)]
    if parts:
        body += ["", "### Parts", ""] + [f"- [x] {absolutize(p)}" for p in parts]
    if source:
        body += ["", "### Source", "", absolutize(source)]
    if history:
        body += ["", "### History", ""] + [f"- {absolutize(h)}" for h in history]
    comment = "Settled: " + absolutize(re.sub(r"^✅ Closed:\s*", "", status))
    out.append({"op": op, "title": title, "body": "\n".join(body) + "\n",
                "comment": comment, "parent": PARENTS[op]})

missing = sorted(set(PARENTS) - {o["op"] for o in out})
if missing:
    sys.exit(f"not found in Closed: {missing}")
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(out)} issues prepared")
```

- [x] **Step 2: Generate and inspect, creating nothing**

```bash
SP=/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad
cd /home/lemekk/workspace/szop && python3 "$SP/closed_issues.py" "$SP/closed_issues.json"
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); [print(o['op'], len(o['title']), o['title']) for o in d]; print(d[0]['body']); print(d[0]['comment'])" "$SP/closed_issues.json"
```

Expected: `25 issues prepared`, 25 titles of at most 80 characters, and OP-001's body and comment readable, with absolute links and no relative `](decisions/…)` left. If the parser exits on an unexpected line, extend it for that shape and run again; do not edit the register.

- [x] **Step 3: Check that none of the 25 exists yet**

```bash
gh issue list --repo luiki-dev/szop --label open-point --state all --limit 200 --json title -q '.[].title' | grep -oE '^OP-[0-9]+' | sort > "$SP/existing.txt"
python3 -c "import json,sys; print('\n'.join(o['op'] for o in json.load(open(sys.argv[1]))))" "$SP/closed_issues.json" | sort | comm -12 - "$SP/existing.txt"
```

Expected: no output. Any ID printed already has an issue: stop and report it.

- [x] **Step 4: Create, close and parent the issues, in ID order**

`$SP/create_closed.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SP=/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad
J="$SP/closed_issues.json"
n=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "$J")
: > "$SP/created.tsv"
for i in $(seq 0 $((n - 1))); do
  python3 -c "import json,sys; o=json.load(open(sys.argv[1]))[int(sys.argv[2])]; open(sys.argv[3],'w').write(o['body']); open(sys.argv[4],'w').write(o['comment']); print(o['op']); print(o['title']); print(o['parent'])" "$J" "$i" "$SP/body.md" "$SP/comment.md" > "$SP/meta.txt"
  op=$(sed -n 1p "$SP/meta.txt"); title=$(sed -n 2p "$SP/meta.txt"); parent=$(sed -n 3p "$SP/meta.txt")
  url=$(gh issue create --repo luiki-dev/szop --title "$title" --label open-point --body-file "$SP/body.md")
  num=${url##*/}
  gh api -X POST "repos/luiki-dev/szop/issues/$parent/sub_issues" -F sub_issue_id="$(gh api "repos/luiki-dev/szop/issues/$num" -q .id)" > /dev/null
  gh issue close "$num" --repo luiki-dev/szop --reason completed --comment "$(cat "$SP/comment.md")" > /dev/null
  printf '%s\t%s\t%s\n' "$op" "$num" "$parent" | tee -a "$SP/created.tsv"
done
```

```bash
bash "$SP/create_closed.sh"
```

Expected: 25 lines `OP-NNN<TAB>issue<TAB>parent`. If a call fails midway, do not re-run the script: `created.tsv` lists what exists; finish the rest by hand for the remaining entries only, then continue.

- [x] **Step 5: Resolve the cross-references**

`$SP/resolve_tokens.py`:

```python
"""Replaces {{OP-NNN}} tokens in the new issues' bodies and closing comments
with 'OP-NNN (#N)'. Run after every issue exists."""
import json, re, subprocess, sys

sp = sys.argv[1]
issues = json.loads(subprocess.check_output(
    ["gh", "issue", "list", "--repo", "luiki-dev/szop", "--label", "open-point",
     "--state", "all", "--limit", "200", "--json", "number,title"]))
num = {re.match(r"(OP-\d+)", i["title"]).group(1): i["number"] for i in issues}
for line in open(f"{sp}/created.tsv"):
    op, n, _ = line.rstrip("\n").split("\t")
    body = subprocess.check_output(["gh", "issue", "view", n, "--repo", "luiki-dev/szop", "--json", "body", "-q", ".body"], text=True)
    def fix(t):
        return re.sub(r"\{\{(OP-\d+)\}\}", lambda m: f"{m.group(1)} (#{num[m.group(1)]})", t)
    if "{{OP-" in body:
        open(f"{sp}/fixed.md", "w").write(fix(body))
        subprocess.check_call(["gh", "issue", "edit", n, "--repo", "luiki-dev/szop", "--body-file", f"{sp}/fixed.md"])
        print(f"{op} #{n}: body fixed")
    comments = json.loads(subprocess.check_output(["gh", "api", f"repos/luiki-dev/szop/issues/{n}/comments"]))
    for c in comments:
        if "{{OP-" in c["body"]:
            subprocess.check_call(["gh", "api", "-X", "PATCH", f"repos/luiki-dev/szop/issues/comments/{c['id']}", "-f", f"body={fix(c['body'])}"], stdout=subprocess.DEVNULL)
            print(f"{op} #{n}: comment fixed")
```

```bash
python3 "$SP/resolve_tokens.py" "$SP"
```

- [x] **Step 6: Check the result**

```bash
# Every register entry has exactly one issue; closed exactly when the entry is in Closed (OP-067 is closed on GitHub, still under PH-08 in the register until Task 2).
gh issue list --repo luiki-dev/szop --label open-point --state all --limit 200 --json number,title,state > "$SP/all_ops.json"
python3 - "$SP/all_ops.json" <<'EOF'
import json, re, sys
issues = json.load(open(sys.argv[1]))
ids = [re.match(r"(OP-\d+)", i["title"]).group(1) for i in issues]
reg = open("docs/open-points.md", encoding="utf-8").read()
entries = re.findall(r"^#### (OP-\d+)", reg, re.M)
closed = set(re.findall(r"^#### (OP-\d+)", reg[reg.index("\n## Closed\n"):], re.M)) | {"OP-067"}
state = {re.match(r"(OP-\d+)", i["title"]).group(1): i["state"] for i in issues}
assert len(ids) == len(set(ids)), "an OP has two issues"
assert set(ids) == set(entries), f"mismatch: {set(entries) ^ set(ids)}"
wrong = [op for op in entries if (state[op] == "CLOSED") != (op in closed)]
assert not wrong, f"state mismatch: {wrong}"
print(f"{len(ids)} issues, {sum(s == 'CLOSED' for s in state.values())} closed: OK")
EOF
# No token left, and the parents are right.
for n in $(cut -f2 "$SP/created.tsv"); do gh issue view "$n" --repo luiki-dev/szop --json body,comments -q '.body + ([.comments[].body] | join(""))' | grep -l '{{OP-' > /dev/null && echo "token left in #$n"; done; echo "token check done"
while IFS=$'\t' read -r op n parent; do p=$(gh api graphql -f query="query{repository(owner:\"luiki-dev\",name:\"szop\"){issue(number:$n){parent{number}}}}" -q .data.repository.issue.parent.number); [ "$p" = "$parent" ] || echo "$op #$n parent $p, want $parent"; done < "$SP/created.tsv"; echo "parent check done"
gh project item-list 3 --owner luiki-dev --limit 400 --format json -q '.items[] | select(.status != "✅ Done") | .content.number' | sort > "$SP/notdone.txt"; cut -f2 "$SP/created.tsv" | sort | comm -12 - "$SP/notdone.txt"; echo "board check done"
```

Expected: `88 issues, 28 closed: OK` (OP-012, OP-057, OP-067 and the 25 new; OP-086 closes with the PR), `token check done`, `parent check done` and `board check done` with nothing printed before them. Also read OP-002's new issue (`gh issue view <its number> --repo luiki-dev/szop`) and check that its cross-references read `OP-0NN (#N)`.

- [x] **Step 7: Record the numbers, tick, commit**

Append to this task, under the mapping table, a table `| Entry | Issue | Parent |` with the 25 rows of `created.tsv` (issues as `#N`). Tick this task's boxes, then:

```bash
git add docs/superpowers/plans/2026-10-11-open-points-on-github.md
git commit -F - <<'EOF'
docs(plan): record the closed open points created as issues

The 25 closed register entries without an issue are now closed issues
labelled open-point, each under what settled it.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 2: The archive

**Files:**
- Move: `docs/open-points.md` → `docs/archive/open-points.md`
- Create: `docs/archive/CLAUDE.md`
- Modify: every file in `docs/superpowers/specs/`, `docs/superpowers/plans/` and `docs/audits/` that links the register (link targets only)

**Interfaces:**
- Consumes: Task 1's issues (OP-067's and OP-086's numbers for the last mirror edit: #27, #156).
- Produces: the archive at `docs/archive/open-points.md`, linked only from the records; Task 3 removes the living docs' links to the old path.

- [x] **Step 1: The last mirror edit, before the move**

In `docs/open-points.md`:
- **OP-067:** move the entry from `### PH-08 Container image`'s group to `## Closed`, in ID order; its status line becomes `- **Status:** ✅ Closed: Dependabot's first PR, [#165](https://github.com/luiki-dev/szop/pull/165), passed \`commits\` and kept pnpm 12's lockfile; parts (2) and (3) were done in [#16](https://github.com/luiki-dev/szop/pull/16)`.
- **OP-086:** move it to `## Closed`, in ID order; its status line becomes `- **Status:** ✅ Closed: [ADR 0027](decisions/0027-open-points-on-github.md): open points live on GitHub, closed ones included, and this register is archived`.

- [x] **Step 2: Move it**

```bash
mkdir -p docs/archive && git mv docs/open-points.md docs/archive/open-points.md
```

- [x] **Step 3: Re-point the archive's own links and add the banner**

Its relative links were relative to `docs/`; now they need one more `../`:

```bash
SP=/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad
python3 - <<'EOF'
import re
p = "docs/archive/open-points.md"
s = open(p, encoding="utf-8").read()
s = re.sub(r"\]\((?!https?://|#|mailto:)([^)]+)\)", r"](../\1)", s)
open(p, "w", encoding="utf-8").write(s)
EOF
```

Then, right under the `# Open points` title, insert:

```markdown
> **Frozen on 2026-10-11 by [ADR 0027](../decisions/0027-open-points-on-github.md). Not maintained.** Open points, open and closed, are GitHub issues labelled `open-point`: see the board's [Open Points view](https://github.com/users/luiki-dev/projects/3/views/5). This page keeps the register as it was on that day, for the specs, plans and audits that link to it.
```

- [x] **Step 4: The folder's `CLAUDE.md`**

`docs/archive/CLAUDE.md`:

```markdown
# docs/archive

Frozen records. Nothing in this folder is a source of current state.

- **Never read these files to learn what is open, planned or decided now.** Open points are GitHub issues labelled `open-point` (`gh issue list --repo luiki-dev/szop --label open-point`, or the [Open Points view](https://github.com/users/luiki-dev/projects/3/views/5)); phases and their plans are in `docs/roadmap.md`; decisions are in `docs/decisions/`.
- **Never edit them,** except to fix a link that broke. Specs, plans and audits link here on purpose, to show the state of their day.
- `open-points.md`: the open points register, archived by [ADR 0027](../decisions/0027-open-points-on-github.md).
```

- [x] **Step 5: Re-point the records' links**

```bash
sed -i 's#](\.\./\.\./open-points\.md#](../../archive/open-points.md#g' docs/superpowers/specs/*.md docs/superpowers/plans/*.md
sed -i 's#](\.\./open-points\.md#](../archive/open-points.md#g' docs/audits/*.md
grep -rnE '\]\((\.\./)+open-points\.md' docs/superpowers docs/audits || echo "no record links to the old path"
```

Expected: `no record links to the old path`. Plain-text mentions such as `docs/open-points.md` in a plan's commands stay as written.

- [x] **Step 6: Check every link into and inside the archive**

```bash
python3 - <<'EOF'
import os, re, glob
def slug(h):
    return re.sub(r"[^a-z0-9 _-]", "", h.lower()).replace(" ", "-")
arch = "docs/archive/open-points.md"
heads = {slug(h) for h in re.findall(r"^#+ (.+)$", open(arch, encoding="utf-8").read(), re.M)}
bad = []
files = glob.glob("docs/superpowers/specs/*.md") + glob.glob("docs/superpowers/plans/*.md") + glob.glob("docs/audits/*.md") + [arch]
for f in files:
    for target in re.findall(r"\]\(([^)\s]+)\)", open(f, encoding="utf-8").read()):
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        path, _, anchor = target.partition("#")
        full = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
        if not os.path.exists(full):
            bad.append(f"{f}: missing {target}")
        elif full == os.path.normpath(arch) and anchor and anchor not in heads:
            bad.append(f"{f}: no heading for #{anchor}")
print("\n".join(bad) or "all links resolve")
EOF
```

Expected: `all links resolve`. A missing file that was already missing before this task (check with `git stash` if unsure) is reported to the controller, not fixed here. ADR 0027 does not exist yet: links to `0027-open-points-on-github.md` from the archive are the one expected miss until Task 5; list them and move on.

- [x] **Step 7: Tick, commit**

```bash
git add -A docs/archive docs/superpowers docs/audits
git commit -F - <<'EOF'
docs: archive the open points register

The register moves to docs/archive/ with a banner and a CLAUDE.md saying
nothing there is a source; OP-067 and OP-086 are mirrored as closed one
last time. Specs, plans and the audit link to the archive, anchors
unchanged.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 3: The living docs' links

**Files:**
- Modify: every living doc that links the register (about 40 files: ADRs, guides, tool pages, architecture, `roadmap.md`, glossary, `README.md`)

**Interfaces:**
- Consumes: every open point and phase as an issue (Task 1); the register no longer at `docs/open-points.md` (Task 2).
- Produces: living docs whose links into the register all point to GitHub, except the bare links Task 4 rewords (listed in step 3's output).

- [x] **Step 1: Write the rewrite script**

`$SP/rewrite_links.py`:

```python
"""Rewrites the living docs' links into the register to GitHub. Usage:
rewrite_links.py [--dry-run]. Stops on any anchor it does not know."""
import json, re, subprocess, sys

DRY = "--dry-run" in sys.argv
ISSUE = "https://github.com/luiki-dev/szop/issues/"
VIEW = "https://github.com/users/luiki-dev/projects/3/views/5"
BARE_TO_VIEW = {"docs/decisions/0011-design-sanity-check-follow-ups.md",
                "docs/decisions/0014-roadmap.md",
                "docs/decisions/0024-github-project-tracking.md"}

def titles(label):
    out = subprocess.check_output(["gh", "issue", "list", "--repo", "luiki-dev/szop", "--label", label,
                                   "--state", "all", "--limit", "300", "--json", "number,title"])
    return json.loads(out)

ops = {re.match(r"OP-(\d+)", i["title"]).group(1): i["number"] for i in titles("open-point")}
phases = {}
for i in titles("phase"):
    m = re.match(r"PH-(\d+[a-z]?) ", i["title"])
    if m:
        phases[m.group(1)] = i["number"]

files = subprocess.check_output(["git", "ls-files", "README.md", "CLAUDE.md", ".github", "docs"], text=True).split()
files = [f for f in files if f.endswith((".md", ".yml"))
         and not f.startswith(("docs/superpowers/", "docs/audits/", "docs/archive/"))]

LINK = re.compile(r"\]\(((?:\.\./)*(?:docs/)?)open-points\.md(#[a-z0-9-]+)?\)")
unknown, bare_left, changed = [], [], {}
for f in files:
    s = open(f, encoding="utf-8").read()
    def repl(m):
        anchor = m.group(2)
        if anchor is None:
            if f in BARE_TO_VIEW:
                return f"]({VIEW})"
            bare_left.append(f)
            return m.group(0)
        op = re.fullmatch(r"#op-(\d+)", anchor)
        if op:
            if op.group(1) not in ops:
                unknown.append(f"{f}: {anchor} has no issue")
                return m.group(0)
            return f"]({ISSUE}{ops[op.group(1)]})"
        ph = re.match(r"#ph-(\d+[a-z]?)-", anchor)
        if ph and ph.group(1) in phases:
            return f"]({ISSUE}{phases[ph.group(1)]})"
        unknown.append(f"{f}: unknown anchor {anchor}")
        return m.group(0)
    new = LINK.sub(repl, s)
    if new != s:
        changed[f] = len(LINK.findall(s)) - len(LINK.findall(new))
        if not DRY:
            open(f, "w", encoding="utf-8").write(new)

print(f"{sum(changed.values())} links rewritten in {len(changed)} files" + (" (dry run)" if DRY else ""))
print("bare links left for Task 4:", sorted(set(bare_left)))
if unknown:
    print("UNKNOWN:\n" + "\n".join(unknown))
    sys.exit(1)
```

- [x] **Step 2: Dry run**

```bash
SP=/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad
python3 "$SP/rewrite_links.py" --dry-run
```

Expected: about 250 links in about 40 files, the bare links left for Task 4 (`README.md`, `docs/development/definition-of-done.md`, `docs/development/project-tracking.md`, `docs/roadmap.md`), and no `UNKNOWN` section. If an anchor is unknown, look at it: a typo is fixed by hand in that file first; a section anchor (`#closed`, `#candidates`, `#how-it-works`) is reported to the controller, who rules on its target. Do not extend the script to guess.

- [x] **Step 3: Run it**

```bash
python3 "$SP/rewrite_links.py"
git diff --stat
grep -rnE '\]\([^)]*open-points\.md' README.md CLAUDE.md .github docs --include=*.md --include=*.yml | grep -vE '^docs/(superpowers|audits|archive)/'
```

Expected: the same counts as the dry run; the last command prints only the bare links left for Task 4. Check `README.md`'s link (path `docs/open-points.md`) is among them, not rewritten wrongly.

- [x] **Step 4: Check that every rewritten link opens the right issue**

```bash
python3 - <<'EOF'
import json, re, subprocess
issues = {}
for label in ("open-point", "phase"):
    for i in json.loads(subprocess.check_output(["gh", "issue", "list", "--repo", "luiki-dev/szop", "--label", label, "--state", "all", "--limit", "300", "--json", "number,title"])):
        issues[i["number"]] = i["title"]
diff = subprocess.check_output(["git", "diff", "-U0"], text=True)
bad, n = [], 0
for line in diff.splitlines():
    if not line.startswith("+") or line.startswith("+++"):
        continue
    for text, num in re.findall(r"\[([^\]]+)\]\(https://github\.com/luiki-dev/szop/issues/(\d+)\)", line):
        n += 1
        title = issues.get(int(num), "")
        ident = re.match(r"(OP-\d+|PH-\d+[a-z]?)", text)
        if not ident:
            bad.append(f"link text {text!r} → #{num} ({title}): check by hand")
        elif not title.startswith(ident.group(1)):
            bad.append(f"{text} → #{num} is {title!r}")
print(f"{n} links checked")
print("\n".join(bad) or "every link text matches its issue")
EOF
```

Expected: `every link text matches its issue`, or a short list of links whose text is not an ID (for example "open points register" or "PH-07's group"); open each of those and confirm it by hand in the task's report.

- [x] **Step 5: Tick, commit**

```bash
pnpm lint && pnpm format:check
git add -A README.md CLAUDE.md .github docs docs/superpowers/plans/2026-10-11-open-points-on-github.md
git commit -F - <<'EOF'
docs: link open points and phases to their GitHub issues

Every link into the register from a living document, the ADRs included,
now opens the open point's or the phase's issue; the ADRs' links to the
register itself open the board's Open Points view.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 4: The wording

**Files:**
- Modify: `CLAUDE.md`, `docs/development/project-tracking.md`, `docs/roadmap.md`, `docs/development/definition-of-done.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/open-point.yml`, `docs/development/phase-walkthrough.md`, `docs/glossary.md`, `README.md`, and any other living doc that tells the reader to edit or read the register (search below)

**Interfaces:**
- Consumes: the bare links Task 3 left; the rules of the spec's [Who owns what](../specs/2026-10-11-open-points-on-github-design.md#who-owns-what) and [How work runs day to day](../specs/2026-10-11-open-points-on-github-design.md#how-work-runs-day-to-day).
- Produces: living docs that describe the permanent rules, with nothing left of the trial rule; ADR 0027 (Task 5) links to them.

Read each file before changing it; keep its structure and tone.

- [x] **Step 1: Find every place to reword**

```bash
grep -rnE 'open-points\.md|open points register|the register|trial|mirror' README.md CLAUDE.md .github docs --include=*.md --include=*.yml | grep -vE '^docs/(superpowers|audits|archive|decisions)/'
```

Every hit in a living doc outside `docs/decisions/` is either reworded below or confirmed unrelated ("mirror" of something else) in the task's report.

- [x] **Step 2: `CLAUDE.md`**

- The bullet "**Track what is deferred in `docs/open-points.md`** ([ADR 0011](…)). Whenever something is left to a later topic or phase, add an entry with the next free `OP-` ID. Start every topic or phase brainstorm from its open points, and close or re-assign them before its PR is merged. During the GitHub tracking trial, an open point is added, re-assigned or closed on its issue first, and the register mirrors it ([ADR 0024](…))." becomes: "**Track what is deferred as `open-point` issues on GitHub** ([ADR 0027](docs/decisions/0027-open-points-on-github.md)). Whenever something is left to a later topic or phase, open an issue with the next free `OP-` ID, a sub-issue of the phase that will settle it, and mention it where it came up. Start every topic or phase brainstorm from its open points (the phase issue's sub-issues, read with `gh`), and close or re-assign them before its PR is merged. The PR description lists the issue changes it made."
- In the documentation list: remove the `docs/open-points.md` item; `docs/roadmap.md`'s item says it is the source of each phase's plan, and that the phase issue's body is a copy updated when the PR that changes the entry opens; `docs/development/project-tracking.md`'s item drops "During the trial ([ADR 0024](…)) the issues are the source: change them first, then bring `roadmap.md`, the README's diagram and `open-points.md` in line before each PR" and says instead: "GitHub is the source of status, open points and what comes next; `roadmap.md` of each phase's plan ([ADR 0027](docs/decisions/0027-open-points-on-github.md))"; add an item `docs/archive/` — frozen records (the old open points register), never a source; read its `CLAUDE.md`.

- [x] **Step 3: `docs/development/project-tracking.md`**

- The introduction and "What lives where": the open-point row's source is the issue only; the phase row says `roadmap.md` holds the plan and the issue a copy.
- "Open-point issues": the body no longer starts with a register link; it starts with the open point's text. Closed issues keep their "settled by" comment.
- "How items move": drop every "mirror in the register" step; "An open point is added" uses the next free ID (the highest among issues labelled `open-point`, plus one); "Before a PR, and at the start of a phase" now brings in line only the stage tables, the phase entries' copies in the issues, and the README's diagram.
- "The trial rule" becomes "## Keeping GitHub and the docs in step", with the table of the spec's [Who owns what](../superpowers/specs/2026-10-11-open-points-on-github-design.md#who-owns-what), and the rule that the PR description lists the issue changes it made.
- "Views": re-read the views (`gh api graphql -f query='query{user(login:"luiki-dev"){projectV2(number:3){views(first:20){nodes{number name layout filter groupByFields(first:5){nodes{... on ProjectV2FieldCommon{name}}} verticalGroupByFields(first:5){nodes{... on ProjectV2FieldCommon{name}}} sortByFields(first:5){nodes{direction field{... on ProjectV2FieldCommon{name}}}} fields(first:20){nodes{... on ProjectV2FieldCommon{name}}}}}}}}'`) and write the table of all of them, as the plan's [Facts checked](#facts-checked) shows unless they changed, with Owner Steps added and a "What each is for" line for it ("every owner step, grouped by its phase").
- Keep `## Contents` in sync.

- [x] **Step 4: `docs/roadmap.md`**

- "How it works": the **Open points** item becomes "the phase issue's sub-issues on GitHub; the brainstorm starts from them"; the **On GitHub** item becomes: each phase, open point, owner step and ADR made outside a phase is an issue on the [Szop project](https://github.com/users/luiki-dev/projects/3); this page is the source of each phase's plan, and the phase issue's body is a copy, updated when the PR that changes the entry opens; the status lives on GitHub, and the stage tables and the README's diagram mirror it ([ADR 0027](decisions/0027-open-points-on-github.md)).
- Each phase entry's `- **Open points:**` line (rewritten to the phase issue by Task 3) reads `- **Open points:** the sub-issues of [#36](https://github.com/luiki-dev/szop/issues/36).`, with the phase's own issue. Check that every phase entry has the line in this form.

- [x] **Step 5: The other places**

- `docs/development/definition-of-done.md`, item 9: "Open points closed, re-assigned or added on GitHub (`open-point` issues); the PR description lists the changes."
- `.github/pull_request_template.md`: "- [ ] Open points closed, re-assigned or added on GitHub, and listed above (Claude)", and the Links item "Open points (closed, re-assigned or added):" stays.
- `.github/ISSUE_TEMPLATE/open-point.yml`: its description becomes "An open point: something undecided or undone, left to a later phase."; the field that asked for the register entry's link is removed (read the form; keep the rest).
- `docs/development/phase-walkthrough.md`: every step that edits the register now edits the issue.
- `docs/glossary.md`: the **Open point** entry says open points are GitHub issues labelled `open-point` ([ADR 0027](decisions/0027-open-points-on-github.md)); a **Register** entry, if present, says it is archived in `docs/archive/`.
- `README.md`: the "Open points" line of its documentation list links the board's Open Points view and says what it is.

- [x] **Step 6: Check, tick, commit**

```bash
grep -rnE '\]\([^)]*open-points\.md' README.md CLAUDE.md .github docs --include=*.md --include=*.yml | grep -vE '^docs/(superpowers|audits|archive)/' || echo "no living doc links the register"
grep -rnE 'open-points\.md|During the trial|trial rule' README.md CLAUDE.md .github docs --include=*.md --include=*.yml | grep -vE '^docs/(superpowers|audits|archive|decisions)/' || echo "no trial wording left"
pnpm lint && pnpm format:check
```

Expected: both messages. Then the repository's relative link check:

```bash
for f in README.md CLAUDE.md docs/*.md docs/development/*.md docs/development/tools/*.md docs/architecture/*.md docs/requirements/*.md; do grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done; done; echo "link check done"
```

Expected: `link check done`; links to `decisions/0027-open-points-on-github.md` are the only expected misses until Task 5. Tick this task's boxes, then:

```bash
git add -A README.md CLAUDE.md .github docs docs/superpowers/plans/2026-10-11-open-points-on-github.md
git commit -F - <<'EOF'
docs: describe tracking after the trial

CLAUDE.md, the tracking guide, the roadmap, the definition of done, the
PR template, the open-point form, the walkthrough, the glossary and the
README describe the permanent rules: open points on GitHub, plans in the
roadmap. The tracking guide documents all seven views as they are set.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 5: ADR 0027

**Files:**
- Create: `docs/decisions/0027-open-points-on-github.md`
- Modify: `docs/decisions/0024-github-project-tracking.md`, `docs/decisions/0011-design-sanity-check-follow-ups.md`, `docs/decisions/0014-roadmap.md`, `docs/decisions/0017-readme-roadmap-diagram.md` (status lines and decision cells only)
- GitHub: #166's body

**Interfaces:**
- Consumes: the spec's decisions 1 to 7; what Tasks 1–4 reported; the guides of Task 4 (linked from the Consequences).
- Produces: the ADR every other change links to; the PR closes #156 and #166.

- [x] **Step 1: Write ADR 0027**

In the shape of [ADR 0024](../../decisions/0024-github-project-tracking.md) (read it first):

- Title `# ADR 0027 — Open points on GitHub, plans in the roadmap`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-11`.
- Header lines, in this order: `- **Completes:** [ADR 0024](0024-github-project-tracking.md), decision 2 (the trial ends, see decisions 1 to 7)`; `- **Supersedes:** [ADR 0024](0024-github-project-tracking.md), decision 14 (the trial rule, see decisions 2 to 4); [ADR 0011](0011-design-sanity-check-follow-ups.md), decision 1 (the central register, see decisions 2, 5 and 6)`; `- **Refines:** [ADR 0024](0024-github-project-tracking.md), decisions 1 (GitHub the source of status and open points, `roadmap.md` of a phase's plan, see decision 3) and 11 (the issue's body is a copy, see decision 3); [ADR 0011](0011-design-sanity-check-follow-ups.md), decision 4 (the document roles, see Consequences); [ADR 0014](0014-roadmap.md), decision 4 and [ADR 0017](0017-readme-roadmap-diagram.md), decision 4 (the trial's status rule made permanent, see decision 4)`; `- **Revisits:** [ADR 0024](0024-github-project-tracking.md), decision 3 (closed open points become issues too, see decision 5)`.
- `## Context`: the trial and its evidence, from the spec's [Evidence from the trial](../specs/2026-10-11-open-points-on-github-design.md#evidence-from-the-trial); the brainstorm and the [spec](../superpowers/specs/2026-10-11-open-points-on-github-design.md).
- `## Decisions`: the spec's decisions 1 to 7, copied with their wording, links rewritten for `docs/decisions/` (`../../decisions/X` → `X`, `../../` → `../`). Add what Tasks 1–4 settled as `<br>**Settled while building:** …` where it touches a cell: in decision 5, the 25 issues' parents (the mapping rule) and that cross-references read `OP-NNN (#N)`; anything else the tasks reported differently from the plan.
- `## Consequences`: the 25 closed issues (88 open-point issues in all); `docs/archive/` with its `CLAUDE.md`; the links (living docs to GitHub, records to the archive); the rules in [project tracking](../development/project-tracking.md); the document roles of ADR 0011, decision 4 (the register's row is replaced by the GitHub issues, and `docs/archive/` holds frozen records); the board's views documented; what is lost (open points offline).

- [x] **Step 2: The notes in the earlier ADRs**

Read each status line and cell first, and add in the style of the notes already there:

- **ADR 0024**, status line: append `; decision 2 completed, decision 14 superseded, decisions 1 and 11 refined and decision 3 revisited by [ADR 0027](0027-open-points-on-github.md) (the trial's outcome: open points on GitHub, plans in the roadmap)`. Cells: decision 1 `<br>✏️ **Refined by [ADR 0027](0027-open-points-on-github.md), decision 3:** \`roadmap.md\` is the source of each phase's plan; GitHub of status and open points.`; decision 2 `<br>🧩 **Completed by [ADR 0027](0027-open-points-on-github.md):** the trial ends; open points live on GitHub and the register is archived.`; decision 3 `<br>🔍 **Revisited by [ADR 0027](0027-open-points-on-github.md), decision 5:** the closed entries became closed issues too.`; decision 11 `<br>✏️ **Refined by [ADR 0027](0027-open-points-on-github.md), decision 3:** the body stays, as a copy of the roadmap entry, updated when the PR that changes it opens.`; decision 14 `<br>🔁 **Superseded by [ADR 0027](0027-open-points-on-github.md):** the permanent rules in [project tracking](../development/project-tracking.md).`
- **ADR 0011**, status line: append `; decision 1 superseded and decision 4 refined by [ADR 0027](0027-open-points-on-github.md) (open points are GitHub issues; the register is archived)`. Cells: decision 1 `<br>🔁 **Superseded by [ADR 0027](0027-open-points-on-github.md), decisions 2, 5 and 6:** open points are GitHub issues, open and closed; the register is archived in \`docs/archive/\`.`; decision 4 `<br>✏️ **Refined by [ADR 0027](0027-open-points-on-github.md):** the register's row is replaced by the GitHub issues; \`docs/archive/\` holds frozen records.`
- **ADR 0014**, status line: append `; decision 4 refined by [ADR 0027](0027-open-points-on-github.md) (status from GitHub, mirrored by the stage tables, for good)`. Cell of decision 4: `<br>✏️ **Refined by [ADR 0027](0027-open-points-on-github.md), decision 4:** the project's Status field is the source of a phase's status; the stage tables mirror it; this page stays the source of the phase's plan.`
- **ADR 0017**, status line: append `; decision 4 refined by [ADR 0027](0027-open-points-on-github.md) (the diagram mirrors the project's status, for good)`. Cell of decision 4: `<br>✏️ **Refined by [ADR 0027](0027-open-points-on-github.md), decision 4:** the diagram mirrors the project's status, in the same commit as the stage table.`

- [x] **Step 3: #166's body**

```bash
SP=/tmp/claude-1000/-home-lemekk-workspace-szop/cc894fc3-6c79-426b-9c2a-af47406592d5/scratchpad
gh issue view 166 --repo luiki-dev/szop --json body -q .body
```

It already links ADR 0027 and says "Landed in: the PR that closes this issue"; leave it unless the link is wrong.

- [x] **Step 4: Final checks, tick, commit**

```bash
for f in README.md CLAUDE.md docs/*.md docs/archive/*.md docs/decisions/*.md docs/development/*.md docs/development/tools/*.md docs/architecture/*.md docs/requirements/*.md; do grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done; done; echo "link check done"
grep -rnE '\]\([^)]*open-points\.md' README.md CLAUDE.md .github docs --include=*.md --include=*.yml | grep -vE '^docs/(superpowers|audits|archive)/' || echo "no living doc links the register"
pnpm lint && pnpm format:check
git diff main --stat | tail -3
```

Expected: `link check done` with no `BROKEN`, `no living doc links the register`, lint and format pass. Read the whole diff against the spec's *Goal and success criteria*, one by one, and list any gap in the task's report. Tick this task's boxes, then:

```bash
git add docs
git commit -F - <<'EOF'
docs(adr): add ADR 0027 open points on GitHub, plans in the roadmap

The trial of ADR 0024 ends: open points live on GitHub, closed ones
included, and the register is archived; roadmap.md is the source of each
phase's plan, GitHub of status. Notes in ADR 0024, 0011, 0014 and 0017.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

## After tasks 1–5: open the PR

Only when the owner says so, after reviewing Task 5 and the final whole-branch review.

1. `pnpm lint && pnpm format:check`, and the link checks of Task 5, step 4.
2. Open the PR: title `docs(adr): add ADR 0027 open points on GitHub, plans in the roadmap`; the body fills `.github/pull_request_template.md`, says `Closes #156` and `Closes #166`, lists the issue changes (the 25 closed issues with their parents, #27 closed, #156 and #166 in progress), the definition of done (most items ➖ N/A: no code; item 9 ✅), and notes for the owner: links in living docs now open GitHub; the records still open the archive.
3. After the merge, the owner's or Claude's bookkeeping: #166's Finished date (the merge date).
4. Stop. The owner reviews and merges.
