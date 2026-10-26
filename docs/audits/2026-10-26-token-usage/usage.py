"""Token usage analysis of Claude Code transcripts.

Cost units: Opus input-token equivalents, using list-price ratios
(input 1, cache write 1.25, cache read 0.1, output 5; Sonnet 0.6x, Haiku 0.2x of Opus).
"""
import json, glob, os, re, sys, collections
from datetime import datetime

ROOT = os.path.expanduser(sys.argv[1])
MODEL_W = {'opus': 1.0, 'sonnet': 0.6, 'haiku': 0.2}


def mw(model):
    for k, v in MODEL_W.items():
        if k in (model or ''):
            return v
    return 0.0


def cost(u, model):
    w = mw(model)
    return w * (u.get('input_tokens', 0) + 1.25 * u.get('cache_creation_input_tokens', 0)
                + 0.1 * u.get('cache_read_input_tokens', 0) + 5 * u.get('output_tokens', 0))


def activity(blocks):
    tools = [b for b in blocks if b.get('type') == 'tool_use']
    if not tools:
        return 'text reply to user'
    t = tools[0]
    name, inp = t.get('name', ''), t.get('input', {}) or {}
    if name in ('Edit', 'Write', 'MultiEdit', 'NotebookEdit'):
        p = inp.get('file_path', '')
        if '/docs/' in p or p.endswith('.md'):
            return 'edit docs (.md)'
        return 'edit code/config'
    if name == 'Bash':
        c = inp.get('command', '')
        if re.search(r'\bgh\b', c):
            return 'bash: gh (GitHub/tracking)'
        if re.search(r'\bgit\b', c):
            return 'bash: git'
        if re.search(r'\b(pnpm|npm|npx|vitest|playwright|mvn|gradle|\./gradlew|docker|terraform|tsc|eslint)\b', c):
            return 'bash: build/test/lint'
        return 'bash: other (grep/cat/ls...)'
    if name in ('Read', 'Grep', 'Glob', 'LS'):
        return 'read/search files'
    if name in ('Agent', 'Task'):
        return 'dispatch subagent'
    if name == 'Skill':
        return 'invoke skill'
    if name.startswith('mcp__'):
        return 'mcp: ' + name.split('__')[1]
    if name in ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList'):
        return 'todo/task list'
    return 'other tool: ' + name


rows = []
seen = {}
for f in glob.glob(os.path.join(ROOT, '**/*.jsonl'), recursive=True):
    is_sub = '/subagents/' in f
    meta = {}
    if is_sub:
        mf = f[:-6] + '.meta.json'
        if os.path.exists(mf):
            meta = json.load(open(mf))
    session = f.split('/')[-3] if is_sub else os.path.basename(f)[:-6]
    skill = None
    for line in open(f):
        try:
            d = json.loads(line)
        except Exception:
            continue
        if d.get('type') != 'assistant':
            continue
        msg = d['message']
        model = msg.get('model', '')
        if model == '<synthetic>':
            continue
        key = d.get('requestId') or msg.get('id')
        blocks = msg.get('content') or []
        for b in blocks:
            if b.get('type') == 'tool_use' and b.get('name') == 'Skill':
                skill = (b.get('input') or {}).get('skill')
        if key in seen:
            # same API call split over several records: merge content for activity
            seen[key]['blocks'] += blocks
            continue
        seen[key] = r = dict(
            session=session, sub=is_sub, agentType=meta.get('agentType'),
            agentDesc=meta.get('description', ''), model=model, effort=d.get('effort'),
            branch=d.get('gitBranch') or '', ts=d.get('timestamp', ''), u=msg.get('usage', {}),
            skill=d.get('attributionSkill') or skill, blocks=list(blocks))
        rows.append(r)

for r in rows:
    r['cost'] = cost(r['u'], r['model'])
    r['act'] = activity(r['blocks'])
    r['ctx'] = sum(r['u'].get(k, 0) for k in ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'))

TOTAL = sum(r['cost'] for r in rows)


def table(title, keyf, n=15, filt=None):
    agg = collections.defaultdict(lambda: [0.0, 0, 0])
    for r in rows:
        if filt and not filt(r):
            continue
        a = agg[keyf(r)]
        a[0] += r['cost']; a[1] += 1; a[2] += r['u'].get('output_tokens', 0)
    sub = sum(a[0] for a in agg.values())
    print(f'\n## {title}  (share of all: {100*sub/TOTAL:.1f}%)')
    print(f'{"key":45} {"share":>7} {"calls":>7} {"cost/call":>9} {"out tok":>9}')
    for k, a in sorted(agg.items(), key=lambda x: -x[1][0])[:n]:
        print(f'{str(k)[:45]:45} {100*a[0]/sub:6.1f}% {a[1]:7} {a[0]/a[1]:9.0f} {a[2]:9}')


def btype(b):
    return b.split('/')[0] if '/' in b else b


def mfam(m):
    return next((k for k in MODEL_W if k in m), m)


print(f'API calls: {len(rows)}, sessions: {len({r["session"] for r in rows})}, total cost units: {TOTAL/1e6:.1f}M')
dates = sorted(r['ts'] for r in rows if r['ts'])
print('range', dates[0][:10], '->', dates[-1][:10])

# cost components
comp = collections.Counter()
for r in rows:
    w = mw(r['model']); u = r['u']
    comp['input'] += w * u.get('input_tokens', 0)
    comp['cache write'] += w * 1.25 * u.get('cache_creation_input_tokens', 0)
    comp['cache read'] += w * 0.1 * u.get('cache_read_input_tokens', 0)
    comp['output'] += w * 5 * u.get('output_tokens', 0)
print('\n## cost components')
for k, v in comp.most_common():
    print(f'{k:15} {100*v/TOTAL:5.1f}%')

table('main session vs subagents', lambda r: 'subagent' if r['sub'] else 'main session')
table('model x effort', lambda r: f'{mfam(r["model"])} / {r["effort"]}')
table('main session: model x effort', lambda r: f'{mfam(r["model"])} / {r["effort"]}', filt=lambda r: not r['sub'])
table('subagents: type / model', lambda r: f'{r["agentType"]} / {mfam(r["model"])}', filt=lambda r: r['sub'])
table('subagents: by task kind', lambda r: re.sub(r'\d+', 'N', ' '.join(r['agentDesc'].split()[:2])), n=25, filt=lambda r: r['sub'])
table('main session: active skill', lambda r: r['skill'], n=20, filt=lambda r: not r['sub'])
table('main session: what the call did', lambda r: r['act'], n=25, filt=lambda r: not r['sub'])
table('subagents: what the call did', lambda r: r['act'], n=15, filt=lambda r: r['sub'])
table('branch type', lambda r: btype(r['branch']), n=12)


def ctxb(c):
    for lim in (50e3, 100e3, 150e3, 200e3, 300e3, 500e3):
        if c < lim:
            return f'<{int(lim/1e3)}k'
    return '>=500k'


table('main session: context size per call', lambda r: ctxb(r['ctx']), filt=lambda r: not r['sub'])

# weekly
wk = collections.Counter()
for r in rows:
    if r['ts']:
        wk[datetime.fromisoformat(r['ts'].replace('Z', '+00:00')).strftime('%G-W%V')] += r['cost']
print('\n## per ISO week (M units)')
for k in sorted(wk):
    print(k, f'{wk[k]/1e6:6.1f}')

# biggest sessions
ss = collections.Counter()
for r in rows:
    ss[r['session']] += r['cost']
print('\n## top sessions')
for s, v in ss.most_common(10):
    br = collections.Counter(r['branch'] for r in rows if r['session'] == s).most_common(1)[0][0]
    print(f'{s[:8]} {100*v/TOTAL:5.1f}% {br}')
