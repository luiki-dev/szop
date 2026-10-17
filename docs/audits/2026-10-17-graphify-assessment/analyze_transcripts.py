"""Token-usage analysis of Claude Code transcripts for the szop project."""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path.home() / ".claude/projects/-home-lemekk-workspace-szop"
REPO = "/home/lemekk/workspace/szop/"
SKIP = set(sys.argv[1:])  # session ids to leave out


def text_len(content):
    if isinstance(content, str):
        return len(content)
    if isinstance(content, list):
        return sum(len(c.get("text", "")) if isinstance(c, dict) else len(str(c)) for c in content)
    return 0


def category(path):
    p = path.replace(REPO, "")
    if p.startswith("/"):
        return "outside repo"
    if p.startswith("docs/superpowers/"):
        return "docs: specs and plans"
    if p.startswith("docs/decisions/"):
        return "docs: ADRs"
    if p.startswith("docs/archive/"):
        return "docs: archive"
    if p.startswith("docs/"):
        return "docs: living docs and guides"
    if p.endswith(".md"):
        return "other .md (README, CLAUDE.md…)"
    if re.search(r"\.(ts|tsx|js|mjs|tf|hcl|sql|css|html)$", p):
        return "code"
    return "config and other"


def parse(path):
    """Return API calls (deduped by requestId) and tool results, in order."""
    calls, results, uses, seen = [], [], {}, {}
    for line in path.open(encoding="utf-8"):
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = d.get("message") or {}
        if d.get("type") == "assistant":
            for block in msg.get("content") or []:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    uses[block["id"]] = block
            rid = d.get("requestId") or msg.get("id")
            if rid and msg.get("usage"):
                # A response is logged once per content block; the last line has the final usage.
                u = msg["usage"]
                cc = u.get("cache_creation") or {}
                call = {
                    "inp": u.get("input_tokens", 0),
                    "cc1h": cc.get("ephemeral_1h_input_tokens", u.get("cache_creation_input_tokens", 0) if not cc else 0),
                    "cc5m": cc.get("ephemeral_5m_input_tokens", 0),
                    "cr": u.get("cache_read_input_tokens", 0),
                    "out": u.get("output_tokens", 0),
                    "model": msg.get("model", "?"),
                }
                if rid in seen:
                    calls[seen[rid]] = call
                else:
                    seen[rid] = len(calls)
                    calls.append(call)
        elif d.get("type") == "user" and isinstance(msg.get("content"), list):
            for block in msg["content"]:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    use = uses.get(block.get("tool_use_id"), {})
                    results.append({"tool": use.get("name", "?"), "input": use.get("input", {}),
                                    "chars": text_len(block.get("content")), "after": len(calls)})
    return calls, results


def weighted(c):
    # Input-price units: uncached 1x, cache write 1h 2x / 5m 1.25x, cache read 0.1x, output 5x.
    return c["inp"] + 2 * c["cc1h"] + 1.25 * c["cc5m"] + 0.1 * c["cr"] + 5 * c["out"]


sessions = defaultdict(lambda: {"calls": [], "results": [], "agents": 0, "first_ctx": None, "title": ""})
for f in sorted(ROOT.glob("*.jsonl")) + sorted(ROOT.glob("*/subagents/*.jsonl")):
    sid = f.stem if f.parent == ROOT else f.parent.parent.name
    if sid in SKIP:
        continue
    calls, results = parse(f)
    s = sessions[sid]
    if f.parent == ROOT:
        if calls:
            c = calls[0]
            s["first_ctx"] = c["inp"] + c["cc1h"] + c["cc5m"] + c["cr"]
        for line in f.open(encoding="utf-8"):
            if '"custom-title"' in line:
                try:
                    s["title"] = json.loads(line).get("customTitle", s["title"])
                except json.JSONDecodeError:
                    pass
    else:
        s["agents"] += 1
    n = len(calls)
    for r in results:
        r["carried"] = n - r["after"]  # later API calls in the same transcript re-send it
    s["calls"] += calls
    s["results"] += results

tot = Counter()
per_session = []
by_tool, by_cat = Counter(), Counter()
carried_cat = Counter()
file_reads, file_sessions = Counter(), defaultdict(set)
read_whole, read_partial = 0, 0
for sid, s in sessions.items():
    if not s["calls"]:
        continue
    w = sum(weighted(c) for c in s["calls"])
    for k in ("inp", "cc1h", "cc5m", "cr", "out"):
        tot[k] += sum(c[k] for c in s["calls"])
    tot["calls"] += len(s["calls"])
    tot["weighted"] += w
    res_tok = sum(r["chars"] for r in s["results"]) / 4
    per_session.append((w, sid, s["title"], len(s["calls"]), s["agents"], res_tok, s["first_ctx"]))
    for r in s["results"]:
        tok = r["chars"] / 4
        by_tool[r["tool"]] += tok
        if r["tool"] == "Read":
            fp = r["input"].get("file_path", "")
            cat = category(fp)
            by_cat[cat] += tok
            # Written once (2x) then read back on every later call (0.1x).
            carried_cat[cat] += tok * (2 + 0.1 * r["carried"])
            rel = fp.replace(REPO, "")
            file_reads[rel] += 1
            file_sessions[rel].add(sid)
            if r["input"].get("offset") or r["input"].get("limit"):
                read_partial += 1
            else:
                read_whole += 1

M = 1e6
print(f"Sessions: {len(per_session)}  (subagent transcripts: {sum(s['agents'] for s in sessions.values())})")
print(f"API calls: {tot['calls']}")
print(f"Input tokens: uncached {tot['inp']/M:.2f}M, cache write {(tot['cc1h']+tot['cc5m'])/M:.1f}M, cache read {tot['cr']/M:.1f}M; output {tot['out']/M:.2f}M")
print(f"Weighted (input-price units): {tot['weighted']/M:.1f}M")
parts = {"cache write": 2*tot['cc1h']+1.25*tot['cc5m'], "cache read": 0.1*tot['cr'], "output": 5*tot['out'], "uncached input": tot['inp']}
print("Weighted split:", ", ".join(f"{k} {v/tot['weighted']:.0%}" for k, v in parts.items()))

firsts = sorted(x[6] for x in per_session if x[6])
print(f"\nContext at a session's first call: median {firsts[len(firsts)//2]:,} tokens, min {firsts[0]:,}, max {firsts[-1]:,}")
ws = sorted(x[0] for x in per_session)
print(f"Weighted per session: median {ws[len(ws)//2]/M:.2f}M, top {ws[-1]/M:.1f}M")

print("\nTool results by tool (≈tokens, chars/4):")
total_res = sum(by_tool.values())
for t, v in by_tool.most_common(12):
    print(f"  {t:<22}{v/1e3:>9.0f}k  {v/total_res:>4.0%}")

print("\nRead results by file category: tokens returned | weighted incl. re-sending on later turns")
tc = sum(carried_cat.values())
for cat, v in by_cat.most_common():
    print(f"  {cat:<34}{v/1e3:>8.0f}k  {v/sum(by_cat.values()):>4.0%} | {carried_cat[cat]/M:>6.1f}M  {carried_cat[cat]/tc:>4.0%}")
print(f"  Reads: {read_whole} whole-file, {read_partial} with offset/limit")
print(f"  Read results ≈ {tc/tot['weighted']:.0%} of all weighted spend (rough estimate; ignores compaction)")

print("\nMost-read files (reads / sessions):")
for f, n in file_reads.most_common(15):
    print(f"  {n:>4} / {len(file_sessions[f]):>3}  {f}")

print("\nTop sessions by weighted spend:")
for w, sid, title, n, ag, rt, fc in sorted(per_session, reverse=True)[:12]:
    print(f"  {w/M:>6.1f}M  calls {n:>4}  agents {ag:>3}  tool-results {rt/1e3:>6.0f}k  {title[:45]}  {sid[:8]}")
