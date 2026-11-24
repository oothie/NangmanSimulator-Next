#!/usr/bin/env python3
"""Replays 60014 BYJ boss RNG from independently decrypted 35227_1.lua.
One unresolved outside-script branch: GetBranchStep('byj_bz')<0.
Does not claim full game reward grant or actual 60014 LuaJIT runtime fidelity.
"""
import sys,json,re,copy
from pathlib import Path
R=Path(__import__('os').environ['BYJ_SOURCE_MODEL_DIR'])
sys.path.insert(0,str(R));sys.path.insert(0,str(R.parent))
from v16_luajit_source_table import SourceTable
from replay_60014_lsby import draw
S=json.loads((R/'35227_1.lua.reconstructed.json').read_text())['3']
BEFORE=json.load(open(str(R/'fixtures/1122_minimal.json')))
AFTER=json.load(open(str(R/'fixtures/1122v3_minimal.json')))

def node_keys(step):
    src=S[str(step)]['2'];return [int(k) if k.strip()==k and k.isdigit() else k for k in src if k!='key']

def choose(step,roll):
    keys=node_keys(step);t=SourceTable(1);t.put('key')
    for k in keys:t.put(k)
    order=[k for k in t.order() if k!='key'];cum=0
    for k in order:
        cum+=int(str(k).strip())
        if roll<=cum:return k,order
    raise AssertionError((step,roll,order))

def replay(allow_37, before=BEFORE):
    gv=copy.deepcopy(before['globalVariable']);seed=before['Rnds']['Sds']['seed_byj'];trace=[];out={};win=gv.get('win_byj',0)
    def rng(step,kind,bound):
        nonlocal seed
        old=seed;seed,n=draw(seed,bound);trace.append(dict(step=step,kind=kind,old_seed=old,bound=bound,roll=n,new_seed=seed));return n
    def unique(step,bound,condition,yes,no=None):
        roll=rng(step,'conditional',bound);hit=condition(roll)
        if hit:
            if yes:yes()
        elif no:no()
        return hit
    def drop_gate(step,boss,limit):
        hit=rng(step,'equip_gate',100);key,order=choose(step,hit)
        if str(key).strip()=='50' and isinstance(key,str) and key.endswith(' '):
            out[f'{boss}_equip']=rng(step,'equipment_slot',limit)
        else:out[f'{boss}_equip']=None
        out[f'{boss}_gate']={'roll':hit,'key':repr(key),'order':[repr(k) for k in order]}
    def color(step,boss):
        roll=rng(step,'color',100);k,o=choose(step,roll)
        val={50:1,30:2,15:3,5:4}.get(k)
        if val is None:val={50:1,30:2,15:3,5:4}[int(str(k).strip())]
        out[f'{boss}_color']=val
        out[f'{boss}_color_info']={'roll':roll,'key':repr(k),'order':[repr(x) for x in o]}
    if win>2:
        unique(25,1000,lambda n:n-win<=70 and not gv.get('drop_7264_35219'),lambda:gv.__setitem__('drop_7264_35219',1),lambda:gv.pop('drop_7264_35219',None))
    unique(26,1000,lambda n:n-win<=70 and not gv.get('drop_7265_35219'),lambda:gv.__setitem__('drop_7265_35219',1),lambda:gv.pop('drop_7265_35219',None))
    drop_gate(27,35219,4);color(28,35219)
    def roll2922_true():
        gv['drop_2922_35214']=1;gv['roll_2922_35214']=gv.get('roll_2922_35214',0)-55
    def roll2922_false():
        gv['roll_2922_35214']=gv.get('roll_2922_35214',0)+45;gv.pop('drop_2922_35214',None)
    unique(29,100,lambda n:n-gv.get('roll_2922_35214',0)<45,roll2922_true,roll2922_false)
    if win>10:
        unique(30,1000,lambda n:n-win<=50 and not gv.get('drop_7262_35214'),lambda:gv.__setitem__('drop_7262_35214',1),lambda:gv.pop('drop_7262_35214',None))
        unique(31,1000,lambda n:n-win<=50 and not gv.get('drop_7263_35214'),lambda:gv.__setitem__('drop_7263_35214',1),lambda:gv.pop('drop_7263_35214',None))
    drop_gate(32,35214,4);color(33,35214)
    def roll2923_true():
        gv['drop_2923_35221']=1;gv['roll_2923_35221']=gv.get('roll_2923_35221',0)-55
    def roll2923_false():
        gv['roll_2923_35221']=gv.get('roll_2923_35221',0)+45;gv.pop('drop_2923_35221',None)
    unique(34,100,lambda n:n-gv.get('roll_2923_35221',0)<45,roll2923_true,roll2923_false)
    if win>5:
        unique(35,1000,lambda n:n-win<=50 and not gv.get('drop_7267_35221'),lambda:gv.__setitem__('drop_7267_35221',1),lambda:gv.pop('drop_7267_35221',None))
    unique(36,1000,lambda n:n-win<=100 and not gv.get('drop_7266_35221'),lambda:gv.__setitem__('drop_7266_35221',1),lambda:gv.pop('drop_7266_35221',None))
    if allow_37 and win>=10 and not gv.get('glm_open'):
        def roll3970_true():
            gv['drop_3970_35221']=1;gv['roll_3970_35221']=gv.get('roll_3970_35221',0)-50
        def roll3970_false():
            gv['roll_3970_35221']=gv.get('roll_3970_35221',0)+10;gv.pop('drop_3970_35221',None)
        unique(37,100,lambda n:n-gv.get('roll_3970_35221',0)<10,roll3970_true,roll3970_false)
    drop_gate(38,35221,4);color(39,35221)
    checks={k:{'pred':v,'actual':AFTER['globalVariable'].get(k)} for k,v in gv.items() if k.startswith(('roll_2922_35214','roll_2923_35221','roll_3970_35221'))}
    for boss in [35219,35214,35221]:
        for suffix in ['equip','color']:
            k=f'{boss}_{suffix}';actual=AFTER['globalVariable'].get(f'drop_{boss}_{suffix}')
            checks[k]={'pred':out.get(k),'actual':actual}
    return {'branch_37':allow_37,'draws':len(trace),'start_seed':before['Rnds']['Sds']['seed_byj'],'calculated_seed':seed,'observed_seed':AFTER['Rnds']['Sds']['seed_byj'],'seed_match':seed==AFTER['Rnds']['Sds']['seed_byj'],'checks':checks,'trace':trace,'boss':out,'post_globalVariable':gv}

def main():
    runs=[replay(b) for b in [False,True]]
    p=R/'v19_byj_replay.json';p.write_text(json.dumps({'source':'35227_1.lua directly decrypted from uploaded wapp__story__fun.whale','runs':runs},ensure_ascii=False,indent=2))
    for r in runs:
        print('branch37',r['branch_37'],'draws',r['draws'],'seed',r['calculated_seed'],'observed',r['observed_seed'],'match',r['seed_match'])
        print('checks',r['checks'])
    return runs
if __name__=='__main__':main()