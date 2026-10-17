"""What fills the context: carried cost by content kind, plus Bash and Read breakdowns."""
import json, re, sys
from collections import Counter
from pathlib import Path
ROOT = Path.home() / ".claude/projects/-home-lemekk-workspace-szop"
REPO = "/home/lemekk/workspace/szop/"
SKIP = set(sys.argv[1:])

def tlen(c):
    if isinstance(c, str): return len(c)
    if isinstance(c, list): return sum(tlen(x.get("text") or x.get("thinking") or x.get("content") or "") if isinstance(x, dict) else len(str(x)) for x in c)
    return 0

def rcat(p):
    if p.startswith(REPO + ".superpowers/"): return "repo .superpowers/ (SDD scratch: constraints, review diffs)"
    if "/.claude/plugins/" in p or "/.claude/skills/" in p: return "skills/plugins"
    if p.startswith("/tmp/"): return "/tmp scratch"
    if "szop-ring-tail" in p: return "other checkout (szop-ring-tail)"
    if not p.startswith(REPO): return "other outside"
    q = p[len(REPO):]
    if q.startswith("docs/superpowers/"): return "docs: specs and plans"
    if q.startswith("docs/decisions/"): return "docs: ADRs"
    if q.startswith("docs/"): return "docs: living docs/guides"
    if q.endswith(".md"): return "root .md (CLAUDE.md, README)"
    if re.search(r"\.(ts|tsx|js|mjs|tf|hcl|sql|css|html)$", q): return "code"
    return "config/other"

def bcat(cmd):
    c = cmd.strip()
    for k, pat in [("git diff/show/log", r"\bgit (diff|show|log)"), ("gh (issues/PRs/API)", r"\bgh "), ("tests/lint/build (pnpm, vitest…)", r"\b(pnpm|npx|vitest|playwright|tsc|eslint|prettier)\b"),
                   ("grep/rg", r"\b(grep|rg)\b"), ("cat/sed/head (file reads)", r"^(cat|sed|head|tail|less|awk)\b|\|\s*(sed|head)"), ("terraform/aws/docker", r"\b(terraform|aws|docker|tflint)\b"), ("git other", r"\bgit ")]:
        if re.search(pat, c): return k
    return "other"

carry, ret, bash, reads = Counter(), Counter(), Counter(), Counter()
for f in list(ROOT.glob("*.jsonl")) + list(ROOT.glob("*/subagents/*.jsonl")):
    sid = f.stem if f.parent == ROOT else f.parent.parent.name
    if sid in SKIP: continue
    items, uses, seen, ncalls = [], {}, set(), 0
    for line in f.open(encoding="utf-8"):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        m = d.get("message") or {}
        t = d.get("type")
        if t == "assistant":
            rid = d.get("requestId") or m.get("id")
            if rid and rid not in seen and m.get("usage"):
                seen.add(rid); ncalls += 1
            for b in m.get("content") or []:
                if not isinstance(b, dict): continue
                if b.get("type") == "tool_use":
                    uses[b["id"]] = b; items.append(("assistant: tool calls", len(json.dumps(b.get("input", {}))), ncalls))
                elif b.get("type") == "text": items.append(("assistant: text", len(b.get("text", "")), ncalls))
                elif b.get("type") == "thinking": items.append(("assistant: thinking", len(b.get("thinking", "")), ncalls))
        elif t == "user":
            c = m.get("content")
            if isinstance(c, str):
                kind = "skill bodies / slash commands" if ("Base directory for this skill" in c or "<command-name>" in c) else ("compaction summary" if "continued from a previous conversation" in c else "user text & reminders")
                items.append((kind, len(c), ncalls))
            elif isinstance(c, list):
                for b in c:
                    if not isinstance(b, dict): continue
                    if b.get("type") == "tool_result":
                        u = uses.get(b.get("tool_use_id"), {})
                        name, n = u.get("name", "?"), tlen(b.get("content"))
                        kind = f"tool result: {name}" if name in ("Bash", "Read", "Agent", "Skill") else "tool result: other"
                        items.append((kind, n, ncalls))
                        if name == "Bash": bash[bcat(u.get("input", {}).get("command", ""))] += n / 4
                        if name == "Read": reads[rcat(u.get("input", {}).get("file_path", ""))] += n / 4
                    elif b.get("type") == "text":
                        tx = b.get("text", "")
                        kind = "skill bodies / slash commands" if "Base directory for this skill" in tx else "user text & reminders"
                        items.append((kind, len(tx), ncalls))
        elif t == "attachment":
            items.append(("attachments (reminders, hook output, file refs)", len(json.dumps(d.get("attachment", {}))), ncalls))
    for kind, n, at in items:
        tok = n / 4
        ret[kind] += tok
        carry[kind] += tok * (2 + 0.1 * (ncalls - at))

tc = sum(carry.values())
print("Context composition (≈tokens added | weighted cost incl. re-sending on later calls):")
for k, v in carry.most_common():
    print(f"  {k:<50}{ret[k]/1e3:>8.0f}k | {v/1e6:>6.1f}M {v/tc:>4.0%}")
print(f"  total estimated {tc/1e6:.1f}M (excludes system prompt + CLAUDE.md base, ~45k per session/agent start)")
print("\nBash output by command kind (≈tokens):")
for k, v in bash.most_common(): print(f"  {k:<40}{v/1e3:>7.0f}k")
print("\nRead output by location (≈tokens):")
for k, v in reads.most_common(): print(f"  {k:<60}{v/1e3:>7.0f}k")
