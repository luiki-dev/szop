exec(open('usage.py').read().split("print(f'API calls")[0])
import statistics
main=[r for r in rows if not r['sub']]
cw=lambda r: mw(r['model'])*1.25*r['u'].get('cache_creation_input_tokens',0)
big=[r for r in main if r['u'].get('cache_creation_input_tokens',0)>50000]
print('main calls with cache write >50k:',len(big),'share of all cost from their writes: %.1f%%'%(100*sum(cw(r) for r in big)/TOTAL))
print('all cache writes main: %.1f%%'%(100*sum(cw(r) for r in main)/TOTAL))
print('median main ctx',statistics.median(r['ctx'] for r in main),'median sub ctx',statistics.median(r['ctx'] for r in rows if r['sub']))
# per-session: calls and max ctx
ss=collections.defaultdict(list)
for r in main: ss[r['session']].append(r)
lens=[len(v) for v in ss.values()]
print('main calls per session median',statistics.median(lens),'max',max(lens))
# share of cost in calls after the 150th call of a session
late=sum(r['cost'] for v in ss.values() for r in sorted(v,key=lambda x:x['ts'])[150:])
print('cost in main calls beyond #150 of session: %.1f%%'%(100*late/TOTAL))
