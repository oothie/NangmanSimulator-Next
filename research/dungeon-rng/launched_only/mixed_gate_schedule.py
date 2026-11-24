#!/usr/bin/env python3
"""Four Korean released gates, source-grounded ordered one-clear-at-a-time replay.

Each run advances the same state in chronological order. For non-observed future
sequences this is a research forecast, not validated actual game RNG.
"""
from __future__ import annotations
import argparse,copy,json,sys
from pathlib import Path
from launched_gate_forward import BOSSES,GATES,load_registry,present

MAX_EVENTS=40

def run_order(before:dict,source_root:Path,registry:Path,schedule:list[str]):
    if not isinstance(schedule,list) or not schedule or len(schedule)>MAX_EVENTS:
        raise ValueError('Schedule must have between 1 and 40 gate clears')
    if any(g not in GATES for g in schedule):
        raise ValueError('Only released gates supported: '+','.join(GATES))
    source_root=source_root.resolve()
    for sub in ('models/liu','models/ywf','models/dcy','models/byj','.'):
        p=str((source_root/sub).resolve())
        if p not in sys.path:sys.path.insert(0,p)
    from ywf_33381_replay_v29 import replay as yan_replay
    from experimental_four_gate_engine import report_liu
    from dcy_stateful.dcy_stateful_forward import replay_many as dc_replay
    from byj_stateful.byj_stateful_forward import replay_many as by_replay
    pools,names=load_registry(registry)
    state=copy.deepcopy(before)
    records=[]
    counts=dict.fromkeys(GATES,0)
    for gate in schedule:
        counts[gate]+=1
        eq=[]
        if gate=='연왕부':
            r=yan_replay(state);draws=r['counts'];seeds=r['seeds']
            for name,npc in BOSSES[gate]:
                rec=r['bosses'][str(npc)]
                eq.append({'boss':name,**present(gate,npc,rec['index'],rec['quality'],pools,names)})
            nxt=copy.deepcopy(state)
            nxt['globalVariable']=copy.deepcopy(r['global_state'])
            nxt['Rnds']['Sds'].update(seeds)
            nxt['globalVariable']['win_ywf']=state['globalVariable'].get('win_ywf',0)+1
            for _,npc in BOSSES[gate]:
                rec=r['bosses'][str(npc)]
                sk=f'drop_{npc}_equip';ck=f'drop_{npc}_color'
                if rec['index'] is None:nxt['globalVariable'].pop(sk,None)
                else:nxt['globalVariable'][sk]=rec['index']
                if rec['quality'] is not None:nxt['globalVariable'][ck]=rec['quality']
            state=nxt
        elif gate=='창옥':
            state,rs=dc_replay(state,source_root,1);r=rs[0];draws=r['drawCount'];seeds=r['seedAfter']
            for name,npc in BOSSES[gate]:
                slot,grade=r['equipmentSlotGrade'][str(npc)]
                eq.append({'boss':name,**present(gate,npc,slot,grade if slot else None,pools,names)})
        elif gate=='벽유교':
            state,rs=by_replay(state,source_root,1);r=rs[0];draws=r['drawCount'];seeds={'seed_byj':r['seedAfter']}
            for name,npc in BOSSES[gate]:
                slot,grade=r['equipmentSlotGrade'][str(npc)]
                eq.append({'boss':name,**present(gate,npc,slot,grade if slot else None,pools,names)})
        elif gate=='유씨별원':
            state,r=report_liu(state,counts[gate]);draws=r['call_count'];seeds={'seed_lsby':r['seed_after']}
            for name,npc in BOSSES[gate]:
                rec=r['bosses'][name]
                eq.append({'boss':name,**present(gate,npc,rec['slot'],rec['grade'],pools,names)})
        else:raise AssertionError(gate)
        records.append({'order':len(records)+1,'gate':gate,'clear':counts[gate],'draws':draws,
                        'seedAfter':seeds,'equipment':eq})
    return state,{'runs':records,'counts':counts,
                  'status':'source-modeled; prior save holdouts only; not independently verified future output'}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--save',type=Path,required=True)
    p.add_argument('--source-root',type=Path,required=True)
    p.add_argument('--registry',type=Path,required=True)
    p.add_argument('--schedule',required=True,help='Comma-separated: 벽유교,창옥,연왕부,유씨별원')
    p.add_argument('--output-private',type=Path,help='PRIVATE output includes RNG seeds; do not share')
    a=p.parse_args()
    _,out=run_order(json.loads(a.save.read_text()),a.source_root,a.registry,a.schedule.split(','))
    if a.output_private:a.output_private.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    else:
        for r in out['runs']:
            print(r['order'],r['gate'],r['clear'],'난수 호출',r['draws'])
            print(' / '.join(f"{x['boss']} {x['equipmentName'] or '미드랍'} {x['grade'] or ''}" for x in r['equipment']))