#!/usr/bin/env python3
"""Four Korean released gates, source-grounded ordered one-clear-at-a-time replay.

Each run advances the same state in chronological order. For non-observed future
sequences this is a research forecast, not validated actual game RNG.
"""
from __future__ import annotations
import argparse,copy,json,sys
from pathlib import Path
from launched_gate_forward import BOSSES,GATES,load_registry,present
from gate_seed_boundary import audit_gate_seed_transition
from liu_key_timeline import validate_key_timeline,set_key_before_liu,parse_cli_timeline
from liu_key_evidence_ledger import ownership_timeline
from private_file_guard import assert_output_paths_safe
from liu_key_consumer_contract import audit_confirmed_key_ledger

MAX_EVENTS=40

def run_order(before:dict,source_root:Path,registry:Path,schedule:list[str], *,
              liu_key_ownership:list[bool]|None=None):
    if not isinstance(schedule,list) or not schedule or len(schedule)>MAX_EVENTS:
        raise ValueError('Schedule must have between 1 and 40 gate clears')
    if any(g not in GATES for g in schedule):
        raise ValueError('Only released gates supported: '+','.join(GATES))
    validate_key_timeline(schedule,liu_key_ownership)
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
        assumed_key_status=(set_key_before_liu(state,liu_key_ownership,counts[gate])
                            if gate=='유씨별원' else None)
        prior_state=copy.deepcopy(state)
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
        seed_boundary=audit_gate_seed_transition(prior_state,state,gate,seeds)
        records.append({'order':len(records)+1,'gate':gate,'clear':counts[gate],'draws':draws,
                        'seedAfter':seeds,'equipment':eq,'seedBoundary':seed_boundary,
                        'key8915AssumedHeld':assumed_key_status})
    return state,{'runs':records,'counts':counts,
                  'status':'source-modeled; prior save holdouts only; not independently verified future output'}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--save',type=Path,required=True)
    p.add_argument('--source-root',type=Path,required=True)
    p.add_argument('--registry',type=Path,required=True)
    p.add_argument('--schedule',required=True,help='Comma-separated: 벽유교,창옥,연왕부,유씨별원')
    p.add_argument('--liu-key-ownership',help='Explicit 8915 status per Liu clear: held,unheld,held; no automatic inference')
    p.add_argument('--liu-key-evidence',type=Path,help='Local verified inventory/reward ledger JSON; cannot combine with --liu-key-ownership')
    p.add_argument('--liu-key-consumer-trace',type=Path,help='Local verified fresh-roll and actual consumer delivery trace JSON')
    p.add_argument('--liu-key-consumer-registry',type=Path,help='Recovered original special-consumer registry for 8915 contract audit')
    p.add_argument('--output-private',type=Path,help='PRIVATE output includes RNG seeds; do not share')
    a=p.parse_args()
    if a.liu_key_ownership is not None and a.liu_key_evidence is not None:
        p.error('--liu-key-ownership and --liu-key-evidence cannot be combined')
    schedule=a.schedule.split(',')
    timeline=parse_cli_timeline(a.liu_key_ownership)
    consumer_args=(a.liu_key_consumer_trace,a.liu_key_consumer_registry)
    if any(v is not None for v in consumer_args) and (a.liu_key_evidence is None or not all(v is not None for v in consumer_args)):
        p.error('Consumer trace and source registry must be provided together with --liu-key-evidence')
    if a.liu_key_evidence is not None:
        evidence=json.loads(a.liu_key_evidence.read_text(encoding='utf-8'))
        if all(v is not None for v in consumer_args):
            source=json.loads(a.liu_key_consumer_registry.read_text(encoding='utf-8'))
            trace=json.loads(a.liu_key_consumer_trace.read_text(encoding='utf-8'))
            timeline,_=audit_confirmed_key_ledger(schedule,evidence,source,trace)
        else:
            timeline,_=ownership_timeline(schedule,evidence)
    _,out=run_order(json.loads(a.save.read_text()),a.source_root,a.registry,schedule,
                    liu_key_ownership=timeline)
    if a.output_private:
        assert_output_paths_safe([a.output_private],[a.save,a.liu_key_evidence,a.registry,a.source_root,
                                                   a.liu_key_consumer_trace,a.liu_key_consumer_registry])
        a.output_private.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    else:
        for r in out['runs']:
            print(r['order'],r['gate'],r['clear'],'난수 호출',r['draws'])
            print(' / '.join(f"{x['boss']} {x['equipmentName'] or '미드랍'} {x['grade'] or ''}" for x in r['equipment']))
            if r['key8915AssumedHeld'] is not None:
                print('고리의 열쇠 가정:', '보유' if r['key8915AssumedHeld'] else '미보유')