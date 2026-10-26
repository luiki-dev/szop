exec(open('phases.py').read().split("print('## session start")[0])
STAGE={'superpowers:brainstorming':'b','superpowers:writing-plans':'p'}
def sim(cap=None, handoff=20000, base=50000):
    tot=0; new=0
    for v in bysess.values():
        start=None; stage=None; offset=0
        for r in v:
            st=STAGE.get(r['skill'],'e')
            u=r['u']; w=mw(r['model'])
            rd=u.get('cache_read_input_tokens',0)
            c=r['cost']; tot+=c
            if st!=stage:
                stage=st; offset=max(0,r['ctx']-base-(handoff if st!='b' else 0))
            if cap and r['ctx']-offset>cap:
                offset=max(0,r['ctx']-base-handoff)
            rd2=max(0,rd-offset)
            new+=c-w*0.1*(rd-rd2)
    return new/tot
print('reset at stage boundaries: %.0f%% of main-session cost'%(100*sim()))
print('stage reset + cap 200k: %.0f%%'%(100*sim(200000)))
print('stage reset + cap 150k: %.0f%%'%(100*sim(150000)))
print('cap 200k only: %.0f%%'%(100*sim(200000,handoff=20000) if False else 0))
fc=[sum(r['cost'] for r in v[:3]) for v in bysess.values() if len(v)>3]
print('cost of first 3 calls of a session, median units',statistics.median(fc))
import itertools
for lo,hi in ((0,100e3),(100e3,200e3),(200e3,300e3),(300e3,500e3),(500e3,1e7)):
    cs=[r['cost'] for r in main if lo<=r['ctx']<hi]
    print(f'ctx {lo/1e3:.0f}-{hi/1e3:.0f}k median cost/call {statistics.median(cs):.0f}')
