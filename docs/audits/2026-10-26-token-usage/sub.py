exec(open('usage.py').read().split("print(f'API calls")[0])
agg=collections.defaultdict(lambda:[0.0,set()])
for r in rows:
    if r['sub']:
        k=' '.join(r['agentDesc'].split()[:2]); k=re.sub(r'\d+','N',k)
        if k.startswith(('Implement','Review','Final','Whole','Re-review')):
            a=agg[(k,mfam(r['model']))]; a[0]+=r['cost']; a[1].add(r['session']+r['agentDesc'])
for k,v in sorted(agg.items()): print(k, f'{100*v[0]/TOTAL:.1f}%', len(v[1]),'agents')
