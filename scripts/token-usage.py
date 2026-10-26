#!/usr/bin/env python3
"""Token usage report for Szop's Claude Code sessions, as Markdown on stdout.

Ported from the frozen analysis in docs/audits/2026-10-26-token-usage/
(usage.py, phases.py, sub.py); the definitions are in the "Measuring" section of
docs/superpowers/specs/2026-10-26-working-with-claude-design.md. Standard library only.

    python3 scripts/token-usage.py [--phase PH-NN | --branch NAME]
        [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--by-phase]
        [--projects DIR] [--usage-log FILE]

Cost units are Opus input-token equivalents (input 1, cache write 1.25, cache read 0.1,
output 5; Sonnet 0.6x, Haiku 0.2x).
"""
import argparse
import collections
import csv
import glob
import json
import os
import re
import statistics
import sys
from datetime import datetime

# The audit's numbers (docs/audits/2026-10-26-token-usage.md#baseline). They are constants on
# purpose: a later change to this script must not move the baseline. Shares are fractions,
# contexts are tokens, phase_cost is in cost units.
BASELINE = {
    'phase_cost': 9864966,
    'median_ctx': 201577,
    'share_above_200k': 0.6595,
    'peak_ctx': 396105,
    'sessions_per_phase': 2.0,
    'idle_rebuild_share': 0.0485,
    'opus_implementer_share': 0.4553,
}

MODEL_W = {'opus': 1.0, 'sonnet': 0.6, 'haiku': 0.2}
IDLE_SECONDS = 3600
IDLE_MIN_WRITE = 30000


def model_weight(model):
    for k, v in MODEL_W.items():
        if k in (model or ''):
            return v
    return 0.0


def call_cost(u, model):
    return model_weight(model) * (
        u.get('input_tokens', 0) + 1.25 * u.get('cache_creation_input_tokens', 0)
        + 0.1 * u.get('cache_read_input_tokens', 0) + 5 * u.get('output_tokens', 0))


def phase_of(branch):
    m = re.search(r'ph-(\d+[a-z]?)', branch)
    return 'PH-' + m.group(1).upper() if m else None


def fail(message, code):
    print(f'error: {message}', file=sys.stderr)
    sys.exit(code)


def load_calls(root):
    """Every assistant call under root, deduplicated across files (first record kept)."""
    rows, seen = [], set()
    for path in glob.glob(os.path.join(root, '**/*.jsonl'), recursive=True):
        is_sub = '/subagents/' in path
        desc = ''
        if is_sub:
            meta = path[:-len('.jsonl')] + '.meta.json'
            if os.path.exists(meta):
                with open(meta) as fh:
                    desc = json.load(fh).get('description', '')
        session = path.split('/')[-3] if is_sub else os.path.basename(path)[:-len('.jsonl')]
        with open(path) as fh:
            for n, line in enumerate(fh, 1):
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get('type') != 'assistant':
                    continue
                msg = d.get('message') or {}
                model = msg.get('model', '')
                if model == '<synthetic>':
                    continue
                for field, value in (('timestamp', d.get('timestamp')),
                                     ('message.usage', msg.get('usage'))):
                    if not value:
                        fail(f'{path}:{n}: missing {field}', 2)
                key = d.get('requestId') or msg.get('id')
                if key in seen:
                    continue
                seen.add(key)
                u = msg['usage']
                rows.append(dict(
                    session=session, sub=is_sub, file=path, desc=desc, model=model,
                    branch=d.get('gitBranch') or '', ts=d['timestamp'], u=u,
                    cost=call_cost(u, model),
                    ctx=sum(u.get(k, 0) for k in (
                        'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'))))
    return rows


def by_session(rows):
    """Main-session calls per session, in time order."""
    out = collections.defaultdict(list)
    for r in sorted((r for r in rows if not r['sub']), key=lambda r: r['ts']):
        out[r['session']].append(r)
    return out


def session_branch_counts(sessions, project):
    """Per main session, the most frequent value of project(branch), or None."""
    out = {}
    for s, calls in sessions.items():
        c = collections.Counter(project(r['branch']) for r in calls if project(r['branch']))
        out[s] = c.most_common(1)[0][0] if c else None
    return out


def select_sessions(sessions, phase, branch):
    if branch and not phase_of(branch):
        top = session_branch_counts(sessions, lambda b: b or None)
        return {s for s, b in top.items() if b == branch}
    wanted = phase or phase_of(branch)
    return {s for s, p in session_branch_counts(sessions, phase_of).items() if p == wanted}


def phase_rows(rows, sessphase):
    """Rows per phase, by the audit's rule: the session's phase, else the call's own branch."""
    out = collections.defaultdict(list)
    for r in rows:
        p = sessphase.get(r['session']) or phase_of(r['branch'])
        if p:
            out[p].append(r)
    return out


def idle_rebuild_cost(sessions):
    total = 0.0
    for calls in sessions.values():
        for a, b in zip(calls, calls[1:]):
            gap = (datetime.fromisoformat(b['ts'].replace('Z', '+00:00'))
                   - datetime.fromisoformat(a['ts'].replace('Z', '+00:00'))).total_seconds()
            write = b['u'].get('cache_creation_input_tokens', 0)
            if gap > IDLE_SECONDS and write > IDLE_MIN_WRITE:
                total += model_weight(b['model']) * 1.25 * write
    return total


def opus_implementer_share(rows):
    cost = collections.Counter()
    for r in rows:
        if r['sub'] and r['desc'].startswith('Implement'):
            for fam in ('opus', 'sonnet'):
                if fam in r['model']:
                    cost[fam] += r['cost']
    both = cost['opus'] + cost['sonnet']
    return cost['opus'] / both if both else None


def weekly_limit(path, sessions):
    """(sum of increases, sessions covered, skipped rows), or None when the file is missing."""
    if not os.path.exists(path):
        return None
    per_session, skipped = collections.defaultdict(list), 0
    with open(path, newline='') as fh:
        for i, row in enumerate(csv.reader(fh)):
            if i == 0 and row and row[0] == 'timestamp':
                continue
            if len(row) != 7:
                skipped += 1
                continue
            try:
                pct = float(row[5])
            except ValueError:
                skipped += 1
                continue
            if row[1] in sessions:
                per_session[row[1]].append((row[0], pct))
    total = 0.0
    for points in per_session.values():
        points.sort()
        for (_, prev), (_, cur) in zip(points, points[1:]):
            total += cur - prev if cur >= prev else cur
    return total, len(per_session), skipped


def tokens(n):
    return f'{round(n / 1000)}k'


def units(n):
    return f'{n / 1e6:.1f}M'


def share(x):
    return f'{100 * x:.1f}%' if x < 0.1 else f'{100 * x:.0f}%'


def show(value, fmt):
    return '—' if value is None else fmt(value)


def report(rows, sessions, all_phases, args):
    """The Markdown report for rows, whose main calls are grouped in sessions."""
    main = [r for r in rows if not r['sub']]
    total = sum(r['cost'] for r in rows)
    main_cost = sum(r['cost'] for r in main)
    subs = {r['file'] for r in rows if r['sub']}
    dates = sorted(r['ts'][:10] for r in rows)

    if args.phase or args.branch:
        phase_cost = total
        per_phase = len(sessions)
    else:
        costs = [sum(r['cost'] for r in v) for v in all_phases.values()]
        phase_cost = statistics.median(costs) if costs else None
        counts = [len({r['session'] for r in v if not r['sub']}) for v in all_phases.values()]
        per_phase = statistics.median(counts) if counts else None
    above = sum(r['cost'] for r in main if r['ctx'] >= 200e3)
    limit = weekly_limit(args.usage_log, set(sessions))

    notes = []
    if limit is None:
        weekly = '—'
        notes.append(f'The usage log {args.usage_log} was not found, so the weekly limit is not measured.')
    else:
        weekly = f'{limit[0]:.0f}%'
        if limit[1] < len(sessions):
            notes.append(f'The usage log covers {limit[1]} of {len(sessions)} main sessions.')
        if limit[2]:
            notes.append(f'{limit[2]} usage log row(s) skipped as malformed.')

    b = BASELINE
    table = [
        ('Phase cost in units', show(phase_cost, units), show(b['phase_cost'], units), '≥25% lower'),
        ('Median context per main-session call',
         show(main and statistics.median(r['ctx'] for r in main), tokens),
         show(b['median_ctx'], tokens), 'below 120k'),
        ('Share of main-session cost above 200k',
         show(above / main_cost if main_cost else None, share),
         show(b['share_above_200k'], share), 'below 20%'),
        ('Peak context', show(max((r['ctx'] for r in main), default=None), tokens),
         show(b['peak_ctx'], tokens), 'below 300k (auto-compact)'),
        ('Main sessions per phase', show(per_phase, lambda x: f'{x:.1f}'),
         show(b['sessions_per_phase'], lambda x: f'{x:.1f}'), '3 or more'),
        ('Cache rebuilds after idle, share of cost',
         show(idle_rebuild_cost(sessions) / total if total else None, share),
         show(b['idle_rebuild_share'], share), 'lower'),
        ("Opus share of implementer subagents' cost",
         show(opus_implementer_share(rows), share),
         show(b['opus_implementer_share'], share), 'near 0'),
        ('Weekly limit used during the phase', weekly, '—', 'from the CSV, informational'),
    ]
    out = [f'Sessions: {len(sessions)} main, {len(subs)} subagent transcripts · '
           f'calls from {dates[0]} to {dates[-1]}', '',
           '| Indicator | This selection | Baseline | Target |', '|---|---|---|---|']
    out += [f'| {" | ".join(row)} |' for row in table]
    if notes:
        out += ['', 'Notes:'] + [f'- {n}' for n in notes]
    return '\n'.join(out)


def by_phase_table(rows, phases):
    out = ['| Phase | Cost units | Main sessions | Peak context | First call | Last call |',
           '|---|---|---|---|---|---|']
    for p, prows in sorted(phases.items(), key=lambda x: -sum(r['cost'] for r in x[1])):
        main = [r for r in prows if not r['sub']]
        dates = sorted(r['ts'][:10] for r in prows)
        out.append(f'| {p} | {units(sum(r["cost"] for r in prows))} | '
                   f'{len({r["session"] for r in main})} | '
                   f'{show(max((r["ctx"] for r in main), default=None), tokens)} | '
                   f'{dates[0]} | {dates[-1]} |')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description='Token usage report for Szop sessions.')
    sel = ap.add_mutually_exclusive_group()
    sel.add_argument('--phase', metavar='PH-NN', type=str.upper)
    sel.add_argument('--branch', metavar='NAME')
    ap.add_argument('--since', metavar='YYYY-MM-DD')
    ap.add_argument('--until', metavar='YYYY-MM-DD')
    ap.add_argument('--by-phase', action='store_true')
    ap.add_argument('--projects', default='~/.claude/projects/-home-lemekk-workspace-szop/')
    ap.add_argument('--usage-log', default='~/.claude/usage-log.csv')
    args = ap.parse_args()
    args.projects = os.path.expanduser(args.projects)
    args.usage_log = os.path.expanduser(args.usage_log)

    rows = [r for r in load_calls(args.projects)
            if (not args.since or r['ts'][:10] >= args.since)
            and (not args.until or r['ts'][:10] <= args.until)]
    if not rows:
        fail('no calls found in the period', 1)
    sessions = by_session(rows)
    sessphase = session_branch_counts(sessions, phase_of)
    phases = phase_rows(rows, sessphase)

    if args.by_phase:
        print(by_phase_table(rows, phases))
        return

    if args.phase or args.branch:
        chosen = select_sessions(sessions, args.phase, args.branch)
        if not chosen:
            fail(f'no sessions found for {args.phase or args.branch}', 1)
        rows = [r for r in rows if r['session'] in chosen]
        sessions = {s: v for s, v in sessions.items() if s in chosen}
    print(report(rows, sessions, phases, args))


if __name__ == '__main__':
    main()
