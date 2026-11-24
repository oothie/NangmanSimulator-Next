#!/usr/bin/env python3
"""Direct original-source 40389_1.lua DCY RNG replay; separate sds per boss.
No retrofitted seed changes or fitted bounds. Uses recovered LuaJIT table model v16.
"""
from pathlib import Path
import sys,json,copy,re
R=Path(__import__('os').environ['DCY_SOURCE_MODEL_DIR'])
sys.path[:0]=[str(R),str(R.parent)]
from replay_60014_lsby import draw
from v16_luajit_source_table import SourceTable
S=json.loads((R/'40389_1.lua.reconstructed.json').read_text())['3']
_fixture=json.loads((R/'v21_dcy_minimal_fixture.json').read_text())
BEFORE=_fixture['before']
AFTER=_fixture['after']

def source_typed_key(k):
    if k.isdecimal() and k.strip()==k:return int(k)
    return k

def getp(gv,k):return gv.get(k,0)

def choose(step,roll,gv):
    src=S[str(step)]['2'];t=SourceTable(1);t.put('key');weighted={}
    for key in src:
        if key=='key':continue
        kk=source_typed_key(key);t.put(kk)
        m=re.fullmatch(r"GetP\('([^']+)'\)",key)
        weighted[kk]=getp(gv,m.group(1)) if m else int(key.strip())
    order=[k for k in t.order() if k!='key']
    assert sum(weighted.values())>0,(step,weighted)
    cum=0
    for k in order:
        cum+=weighted[k]
        if roll<=cum:return k,{'weights':{repr(k):v for k,v in weighted.items()},'order':list(map(repr,order)),'cum':cum}
    raise AssertionError((step,roll,weighted,order))

def replay(before=BEFORE, after=AFTER):
    gv=copy.deepcopy(before['globalVariable']);seeds={f'seed_dcy_{npc}':before['Rnds']['Sds'][f'seed_dcy_{npc}'] for npc in (40372,40373,40374)}
    win=getp(gv,'win_dcy');trace=[];out={}
    def rng(step,npc,bound,tag):
        k=f'seed_dcy_{npc}'; old=seeds[k];seeds[k],x=draw(old,bound)
        trace.append({'step':step,'npc':npc,'call':tag,'bound':bound,'seed_before':old,'value':x,'seed_after':seeds[k]});return x
    def cond(step,npc,operand,threshold,initial,value_true,change_true,value_false,change_false,guard=None,bound=1000):
        roll=rng(step,npc,bound,'condition')
        ok=(roll-operand)<threshold if not isinstance(threshold,bool) else False
        if guard is not None: ok=ok and (not getp(gv,guard))
        if ok:
            if value_true is not None: gv[value_true]=1
            if change_true: gv[initial]=getp(gv,initial)+change_true
        else:
            if value_false is not None:gv.pop(value_false,None)
            if change_false:gv[initial]=getp(gv,initial)+change_false
        return ok
    def item_gate(step,npc):
        src=S[str(step)]['2']
        roll=rng(step,npc,100,'equipment_gate');k,order=choose(step,roll,gv)
        out[f'{npc}_equip_gate']={'roll':roll,'key':repr(k),'order':order['order']}
        if isinstance(k,str) and k=='50 ':
            out[f'{npc}_equip']=rng(step,npc,5,'equipment_slot')
            gv[f'drop_{npc}_equip']=out[f'{npc}_equip']
            colorstep=src['50 ']['2']['2']
            color_roll=rng(step,npc,100,'color_gate');ck,info=choose_color(colorstep,color_roll)
            gv[f'drop_{npc}_color']=out[f'{npc}_color']=ck
            out[f'{npc}_color_info']={'roll':color_roll,**info}
        else:
            gv.pop(f'drop_{npc}_equip',None);out[f'{npc}_equip']=None
    def choose_color(colorstep,roll):
        t=SourceTable(1);t.put('key')
        keys=[]
        for x in colorstep:
            if x=='key':continue
            k=source_typed_key(x);keys.append(k);t.put(k)
        order=[k for k in t.order() if k!='key'];cum=0
        for k in order:
            cum+=int(str(k).strip())
            if roll<=cum:return {50:1,30:2,15:3,5:4}[int(str(k).strip())],{'order':list(map(repr,order)),'key':repr(k)}
        raise AssertionError((roll,order))
    def material_roll(step,npc):
        src=S[str(step)]['2'];weight_sum=200
        for k in src:
            m=re.fullmatch(r"GetP\('([^']+)'\)",k)
            if m:weight_sum+=getp(gv,m.group(1))
        roll=rng(step,npc,weight_sum,'weighted_material');k,info=choose(step,roll,gv)
        cmds=[]
        def walk(x):
            if isinstance(x,dict):
                if x.get('2')=='jhLua':cmds.append(x['3'])
                for y in x.values():walk(y)
        walk(src[str(k) if isinstance(k,int) else k]);cmd=' '.join(cmds)
        for mat in re.findall(r"AddP\('num_(\d+)_\d+',\s*1\)",cmd):gv[f'num_{mat}_{npc}']=getp(gv,f'num_{mat}_{npc}')+1
        name=re.search(r"SetP\('name_drop_\d+',\s*(\d+)\)",cmd)
        if name:gv[f'name_drop_{npc}']=int(name.group(1))
        if "RmP('name_drop_" in cmd:gv.pop(f'name_drop_{npc}',None)
        out[f'{npc}_material']={'roll':roll,'range':weight_sum,'key':repr(k),'chosen':int(name.group(1)) if name else None,'order':info['order']}
    # 40372: 4 special calls, nonexclusive
    for step,id_,op,threshold in [(6,'drop_4634_40372',win*2,51),(7,'drop_9072_40372',win,41),(8,'drop_3523_40372',win,201)]:
        x=rng(step,40372,1000,'rare_special')
        if x-op<threshold and not getp(gv,id_): gv[id_]=1
        else: gv.pop(id_,None)
    x=rng(9,40372,1000,'roll_2924')
    if x-getp(gv,'roll_2924_40372')<400:
        gv['drop_2924_40372']=1;gv['roll_2924_40372']=getp(gv,'roll_2924_40372')-600
    else:
        gv['roll_2924_40372']=getp(gv,'roll_2924_40372')+400;gv.pop('drop_2924_40372',None)
    for step,itemid,threshold,weight in [(10,2601,1000,1000),(11,2603,6,25),(12,2604,6,25),(13,2605,6,25),(14,2606,6,25),(15,2607,1000,1000),(16,2641,100,80)]:
        k=f'drop_40372_{step-9}'
        if getp(gv,f'num_{itemid}_40372')<threshold: gv[k]=weight
        else: gv.pop(k,None)
    material_roll(17,40372);item_gate(18,40372)
    # 40373
    for step,key,op,thr in [(19,'drop_4820_40373',win*2,51),(20,'drop_9072_40373',win,41)]:
        x=rng(step,40373,1000,'rare_special')
        if x-op<thr and not getp(gv,key): gv[key]=1
        else: gv.pop(key,None)
    x=rng(21,40373,1000,'roll_2926')
    if x-getp(gv,'roll_2926_40373')<300:
        gv['drop_2926_40373']=1;gv['roll_2926_40373']=getp(gv,'roll_2926_40373')-700
    else:
        gv['roll_2926_40373']=getp(gv,'roll_2926_40373')+400;gv.pop('drop_2926_40373',None)
    for step,itemid,threshold,weight in [(22,3025,1500,1000),(23,3029,500,500),(24,3030,500,500),(25,2000,100,50),(26,2001,100,50),(27,2002,100,50)]:
        k=f'drop_40373_{step-21}'
        if getp(gv,f'num_{itemid}_40373')<threshold: gv[k]=weight
        else: gv.pop(k,None)
    material_roll(28,40373);item_gate(29,40373)
    # 40374
    for step,key,op,thr in [(30,'drop_5218_40374',win*2,51),(31,'drop_9072_40374',win,41),(32,'drop_8295_40374',win,41),(33,'drop_7165_40374',win,21)]:
        x=rng(step,40374,1000,'rare_special')
        if x-op<thr and not getp(gv,key): gv[key]=1
        else: gv.pop(key,None)
    x=rng(34,40374,1000,'roll_2925')
    if x-getp(gv,'roll_2925_40374')<400:
        gv['drop_2925_40374']=1;gv['roll_2925_40374']=getp(gv,'roll_2925_40374')-600
    else:
        gv['roll_2925_40374']=getp(gv,'roll_2925_40374')+400;gv.pop('drop_2925_40374',None)
    item_gate(35,40374)
    # The boss01 payout script consumes an awarded 3523 flag and writes 0.
    # Keep this separate from RNG generation so no seed or weighted roll is fitted.
    stage_after_rng={k:gv.get(k) for k in ('drop_3523_40372','drop_40372_equip','drop_40373_equip','drop_40374_equip')}
    payout=json.loads((R/'dcy_boss01.lua.reconstructed.json').read_text())
    assert "SetP('drop_3523_40372', 0)" in json.dumps(payout,ensure_ascii=False)
    if gv.get('drop_3523_40372')==1: gv['drop_3523_40372']=0
    checks={}
    for k in set(gv)|(set(after['globalVariable']) if after else set()):
        if k.startswith(('drop_4037','drop_4634_40372','drop_9072_4037','drop_3523_40372','drop_4820_40373','drop_5218_40374','drop_8295_40374','drop_7165_40374','drop_2924_40372','drop_2926_40373','drop_2925_40374','roll_2924_40372','roll_2926_40373','roll_2925_40374','name_drop_4037')):
            if after and gv.get(k)!=after['globalVariable'].get(k):checks[k]=[gv.get(k),after['globalVariable'].get(k)]
    return {'source':'direct 40389_1.lua from uploaded wapp__story__fun.whale','win_dcy':win,'per_boss_draws':{k:sum(t['npc']==int(k.split('_')[-1]) for t in trace) for k in seeds},'calculated_seeds':seeds,'observed_seeds':({k:after['Rnds']['Sds'][k] for k in seeds} if after else None),'seed_matches':({k:seeds[k]==after['Rnds']['Sds'][k] for k in seeds} if after else None),'item_and_color':out,'post_globalVariable':gv,'post_rng_pre_payout':stage_after_rng,'variable_mismatches':checks,'trace':trace}

if __name__=='__main__':
 r=replay();forward=replay(AFTER,after=None)
 (R/'v21_dcy_original_replay.json').write_text(json.dumps({'observed_replay':r,'next_conditional':forward},indent=2,ensure_ascii=False))
 print('draws',r['per_boss_draws'])
 print('seeds',r['calculated_seeds'])
 print('observed',r['observed_seeds'])
 print('seed matches',r['seed_matches'])
 print('item and color',r['item_and_color'])
 print('VARIABLE MISMATCHES',r['variable_mismatches'])
