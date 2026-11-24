#!/usr/bin/env python3
"""Experimental Changok source-based sequential-state replay.

Keeps 40389_1.lua reconstructed producer and consumer mutations separate.
No site changes or private save values are bundled. Research use only.
"""
from __future__ import annotations
import copy, sys, os
from pathlib import Path


def add_source_root(root:Path):
    for p in (root,root/'models/dcy',root/'models/ywf',root/'models/liu'):
        if str(p) not in sys.path:sys.path.insert(0,str(p))


def replay_many(before:dict,source_root:Path,clears:int=2):
    if not isinstance(clears,int) or isinstance(clears,bool) or not 1<=clears<=20:raise ValueError('clears 1..20')
    source_root=source_root.resolve()
    add_source_root(source_root)
    # Use an exact copy of the original v21 source logic with one read-only
    # exposure of its mutated state. Loader uses original 40389 tree and deps.
    import importlib.util
    src=Path(__file__).resolve().parent/'dcy_forward_source_copy.py'
    previous=os.environ.get('DCY_SOURCE_MODEL_DIR')
    os.environ['DCY_SOURCE_MODEL_DIR']=str(source_root/'models/dcy')
    try:
        spec=importlib.util.spec_from_file_location('dcy_original_state_capture',src)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        if previous is None: os.environ.pop('DCY_SOURCE_MODEL_DIR',None)
        else: os.environ['DCY_SOURCE_MODEL_DIR']=previous
    current=copy.deepcopy(before);runs=[]
    for i in range(1,clears+1):
        r=mod.replay(current,after=None)
        nxt=copy.deepcopy(current)
        nxt['globalVariable']=r['post_globalVariable']
        nxt['globalVariable']['win_dcy']=int(current['globalVariable'].get('win_dcy',0))+1
        nxt['Rnds']['Sds'].update(r['calculated_seeds'])
        outcome={}
        for npc in (40372,40373,40374):
            s=str(npc);outcome[s]=(r['item_and_color'].get(s+'_equip'),r['item_and_color'].get(s+'_color'))
        runs.append({'clear':i,'drawCount':len(r['trace']),'seedBefore':{k:current['Rnds']['Sds'][k] for k in r['calculated_seeds']},
                     'seedAfter':r['calculated_seeds'],'equipmentSlotGrade':outcome,
                     'winBefore':current['globalVariable'].get('win_dcy',0),
                     'winAfter':nxt['globalVariable']['win_dcy']})
        current=nxt
    return current,runs

if __name__=='__main__':
    import argparse,json
    p=argparse.ArgumentParser()
    p.add_argument('--source-root',type=Path,required=True)
    p.add_argument('--save',type=Path,required=True)
    p.add_argument('--clears',type=int,default=2)
    p.add_argument('--output',type=Path,required=True,help='PRIVATE: contains RNG seeds')
    a=p.parse_args()
    _,runs=replay_many(json.loads(a.save.read_text()),a.source_root,a.clears)
    a.output.write_text(json.dumps(runs,ensure_ascii=False,indent=2)+'\n')
    print('Saved private local replay; clears=',len(runs))