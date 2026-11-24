#!/usr/bin/env python3
"""Conditional BYJ consecutive replay from original 35227_1.Lua entry, no rare item predictions.

A negative branch step is held constant across simulated clears. If in-game branch
progress changes, the next clear requires an actual new save before claiming accuracy.
"""
from __future__ import annotations
import copy,importlib.util,os,sys
from pathlib import Path

BOSSES=(35219,35214,35221)

def replay_many(before:dict,source_root:Path,clears:int=2):
    if not isinstance(clears,int) or isinstance(clears,bool) or not 1<=clears<=20:raise ValueError('clears must be 1..20')
    source_root=source_root.resolve()
    for p in (source_root,source_root/'models/ywf',source_root/'models/liu',source_root/'models/byj'):
        if str(p) not in sys.path:sys.path.insert(0,str(p))
    previous=os.environ.get('BYJ_SOURCE_MODEL_DIR')
    os.environ['BYJ_SOURCE_MODEL_DIR']=str(source_root/'models/byj')
    try:
        file=Path(__file__).resolve().parent/'byj_forward_source_copy.py'
        spec=importlib.util.spec_from_file_location('byj_original_state_capture',file)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        if previous is None:os.environ.pop('BYJ_SOURCE_MODEL_DIR',None)
        else:os.environ['BYJ_SOURCE_MODEL_DIR']=previous
    current=copy.deepcopy(before);out=[]
    for i in range(1,clears+1):
        branch=current.get('Branch',{}).get('byj_bz')
        step=branch.get('step') if isinstance(branch,dict) else None
        if step is None:raise ValueError('BYJ branch step missing; cannot select original conditional branch')
        allow_37=(int(current['globalVariable'].get('win_byj',0))>=10 and step<0 and not current['globalVariable'].get('glm_open'))
        res=mod.replay(allow_37,current)
        next_state=copy.deepcopy(current)
        gv=res['post_globalVariable']
        for npc in BOSSES:
            slot=res['boss'][f'{npc}_equip'];color=res['boss'][f'{npc}_color']
            ek=f'drop_{npc}_equip';ck=f'drop_{npc}_color'
            if slot is None:gv.pop(ek,None)
            else:gv[ek]=slot
            # In the original producer, a color roll happens even on a no-drop branch.
            gv[ck]=color
        gv['win_byj']=int(current['globalVariable'].get('win_byj',0))+1
        next_state['globalVariable']=gv
        next_state['Rnds']['Sds']['seed_byj']=res['calculated_seed']
        out.append({'clear':i,'drawCount':res['draws'],'seedBefore':current['Rnds']['Sds']['seed_byj'],
                    'seedAfter':res['calculated_seed'],'branch37':allow_37,
                    'equipmentSlotGrade':{str(n):(res['boss'][f'{n}_equip'],res['boss'][f'{n}_color']) for n in BOSSES},
                    'winBefore':current['globalVariable'].get('win_byj',0),'winAfter':gv['win_byj'],
                    'caveat':'Branch state assumed stable between simulated clears; no cross-mode state change modeled'})
        current=next_state
    return current,out