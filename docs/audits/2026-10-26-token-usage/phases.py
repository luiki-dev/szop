import os
exec(open(os.path.join(os.path.dirname(__file__), 'usage.py')).read().split("print(f'API calls")[0])
import statistics

# compaction markers per session
comp = collections.defaultdict(list)
for f in glob.glob(os.path.join(ROOT, '*.jsonl')):
    for line in open(f):
        if 'compact_boundary' in line:
            d = json.loads(line)
            if d.get('subtype') != 'compact_boundary':
                continue
            comp[os.path.basename(f)[:-6]].append((d['timestamp'], d['compactMetadata'].get('preTokens'), d['compactMetadata'].get('trigger')))

main = [r for r in rows if not r['sub']]
bysess = collections.defaultdict(list)
for r in sorted(main, key=lambda r: r['ts']):
    bysess[r['session']].append(r)

print('## session start: context of first call')
firsts = [v[0]['ctx'] for v in bysess.values()]
print('median', statistics.median(firsts), 'min', min(firsts), 'max', max(firsts))
firsts5 = [v[4]['ctx'] for v in bysess.values() if len(v) > 5]
print('ctx at 5th call median', statistics.median(firsts5))

print('\n## compactions: pre tokens -> ctx of next call')
for s, lst in comp.items():
    for ts, pre, trig in lst:
        nxt = next((r for r in bysess.get(s, []) if r['ts'] > ts), None)
        print(s[:8], trig, pre, '->', nxt['ctx'] if nxt else None)

# phase id from branch
def phase(b):
    m = re.search(r'ph-(\d+[a-z]?)', b)
    return 'PH-' + m.group(1).upper() if m else None

print('\n## per phase (share of total; main/sub; sessions; peak ctx)')
sessphase = {}
for s_, v in bysess.items():
    c_ = collections.Counter(phase(r['branch']) for r in v if phase(r['branch']))
    sessphase[s_] = c_.most_common(1)[0][0] if c_ else None
ph = collections.defaultdict(lambda: dict(cost=0, main=0, sub=0, sess=set(), peak=0, calls=0, stages=collections.Counter()))
for r in rows:
    p = sessphase.get(r['session']) or phase(r['branch'])
    if not p:
        continue
    a = ph[p]
    a['cost'] += r['cost']; a['calls'] += 1
    a['sub' if r['sub'] else 'main'] += r['cost']
    if not r['sub']:
        a['sess'].add(r['session']); a['peak'] = max(a['peak'], r['ctx'])
        st = r['skill'] or 'none'
        st = {'superpowers:brainstorming': 'brainstorm', 'superpowers:writing-plans': 'plan',
              'superpowers:subagent-driven-development': 'exec', 'superpowers:executing-plans': 'exec',
              'superpowers:test-driven-development': 'exec', 'superpowers:finishing-a-development-branch': 'finish'}.get(st, 'other')
        a['stages'][st] += r['cost']
tasks = {}
for f in glob.glob(os.path.expanduser('~/workspace/szop/docs/superpowers/plans/*PH-*.md')):
    m = re.search(r'PH-(\d+[a-z]?)', f)
    tasks['PH-' + m.group(1).upper()] = (len(re.findall(r'^##+ Task \d', open(f).read(), re.M)), sum(1 for _ in open(f)))
print(f'{"phase":8} {"total%":>6} {"main%":>6} {"sub%":>5} {"sess":>4} {"peakctx":>8} {"tasks":>5} {"planln":>6}  brainstorm/plan/exec/finish/other % of phase')
for p, a in sorted(ph.items(), key=lambda x: -x[1]['cost']):
    t = tasks.get(p, ('-', '-'))
    s = a['stages']; c = a['main'] or 1
    print(f'{p:8} {100*a["cost"]/TOTAL:6.1f} {100*a["main"]/TOTAL:6.1f} {100*a["sub"]/TOTAL:5.1f} {len(a["sess"]):4} {a["peak"]//1000:7}k {t[0]:>5} {t[1]:>6}  '
          + '/'.join(f'{100*s[k]/c:.0f}' for k in ('brainstorm', 'plan', 'exec', 'finish', 'other')))

print('\n## per main session: calls, first ctx, peak ctx, cost share')
for s, v in sorted(bysess.items(), key=lambda x: -sum(r['cost'] for r in x[1]))[:15]:
    sk = []
    for r in v:
        k = (r['skill'] or '-').replace('superpowers:', '')
        if not sk or sk[-1] != k:
            sk.append(k)
    print(s[:8], len(v), v[0]['ctx'] // 1000, max(r['ctx'] for r in v) // 1000, f'{100*sum(r["cost"] for r in v)/TOTAL:.1f}%', v[0]['branch'][:35], '>'.join(sk)[:120])

# thinking share of output
th = sum(((r['u'].get('output_tokens_details') or {}).get('thinking_tokens', 0)) * 5 * mw(r['model']) for r in rows)
print('\nthinking tokens share of total cost: %.1f%%' % (100 * th / TOTAL))
# idle cache rebuilds: big cache write after > 1h gap
gaps = 0; gc = 0
for v in bysess.values():
    for a, b in zip(v, v[1:]):
        dt = (datetime.fromisoformat(b['ts'].replace('Z', '+00:00')) - datetime.fromisoformat(a['ts'].replace('Z', '+00:00'))).total_seconds()
        if dt > 3600 and b['u'].get('cache_creation_input_tokens', 0) > 30000:
            gaps += 1; gc += mw(b['model']) * 1.25 * b['u']['cache_creation_input_tokens']
print('cache rebuilds after >1h idle:', gaps, 'share %.1f%%' % (100 * gc / TOTAL))
