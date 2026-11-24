#!/usr/bin/env python3
"""Only Korean-server-released four gates; fail-closed source-consumer forward replay.

Original 100-grade experimental modes are strictly excluded. Import replay scripts from
an existing *local* v30 research checkpoint; no source binaries or saves are bundled.
"""
from __future__ import annotations
import argparse, copy, json, sys
from pathlib import Path

GATES = ('연왕부', '창옥', '벽유교', '유씨별원')
FROZEN = ('문향교', '무신전', '벽유교 본단')
BOSSES = {
    '연왕부': [('이총관',33654),('하상',33653),('엽내관',33652),('연왕',33650)],
    '창옥': [('무준신',40372),('이장',40373),('장정',40374)],
    '벽유교': [('독선생',35219),('미',35214),('불로선인',35221)],
    '유씨별원': [('윤무',35260),('고리',35264),('이뢰운',35268)],
}
GRADES = {1:'백색',2:'녹색',3:'청색',4:'자색'}

def load_registry(path:Path):
    db=json.loads(path.read_text(encoding='utf-8'))
    rows={}
    for item in db['consumers']:
        gate=item['gate']
        if gate not in GATES: continue
        if item['mode']!='일반':raise ValueError('Unexpected launched gate mode')
        key=(gate,item['grantNpc'])
        if key in rows:raise ValueError('Duplicated source original pool')
        rows[key]=item['equipmentIds']
    assert len(rows)==13, f'expected 13 source consumers; got {len(rows)}'
    return rows, {int(k):v for k,v in db['equipmentNames'].items()}

def present(gate,npc,slot,grade,pools,names,roll_meta=None):
    if slot is None:
        return {'npc':npc,'status':'미드랍','equipmentId':None,'equipmentName':None,'grade':None}
    if not isinstance(slot,int) or isinstance(slot,bool):raise ValueError('Noninteger source slot')
    pool=pools[(gate,npc)]
    if slot<1 or slot>len(pool):raise ValueError(f'Original slot out of range: {gate}/{npc}/{slot}')
    if isinstance(grade,str):
        grade=next((k for k,v in GRADES.items() if v==grade),None)
    if grade not in GRADES: raise ValueError(f'Grade unknown: {gate}/{npc}/{grade}')
    equipment=pool[slot-1]
    if equipment not in names:raise ValueError(f'Missing Korean equipment name: {equipment}')
    return {'npc':npc,'status':'조건부 예측','equipmentId':equipment,'equipmentName':names[equipment],
            'grade':GRADES[grade], 'slot':slot, 'gradeCode':grade}

def replay(preentry:dict,source_root:Path,registry:Path,liu_clears:int=1,ywf_clears:int=1,
           special_award_registry:Path|None=None,special_material_registry:Path|None=None):
    if (special_award_registry is None)!=(special_material_registry is None):
        raise ValueError('Both special award and material original registries are required')
    if not isinstance(liu_clears,int) or not 1<=liu_clears<=20:raise ValueError('Liu clears 1..20')
    if not isinstance(ywf_clears,int) or not 1<=ywf_clears<=20:raise ValueError('YWF clears 1..20')
    source_root=source_root.resolve()
    if not (source_root/'ywf_33381_replay_v29.py').exists():
        raise FileNotFoundError('Required original 33381 model not found at '+str(source_root))
    for sub in ('models/liu','models/ywf','models/byj','models/dcy','.'):
        sp=str((source_root/sub).resolve())
        if sp not in sys.path:sys.path.insert(0,sp)
    from ywf_33381_replay_v29 import replay as yan_replay
    from experimental_four_gate_engine import report_byj,report_dcy,report_liu
    pools,names=load_registry(registry)
    results=[]
    # YWF source 33381 has a recoverable mutable per-boss seed and reward state.
    # Persist its verified changes between clears; reset no-drop equipment slots but
    # preserve the previous color for a no-drop branch (original SetP semantics).
    ywf_state=copy.deepcopy(preentry)
    for ywf_i in range(1,ywf_clears+1):
        yr=yan_replay(ywf_state)
        eq=[]
        for b,npc in BOSSES['연왕부']:
            rec=yr['bosses'][str(npc)]
            eq.append({'boss':b,**present('연왕부',npc,rec['index'],rec['quality'],pools,names)})
        results.append({'gate':'연왕부','clear':ywf_i,'draws':yr['counts'],
                        'seedAfter':yr['seeds'],'equipment':eq,'source':'33381_1.lua'})
        nxt=copy.deepcopy(ywf_state)
        nxt['globalVariable']=copy.deepcopy(yr['global_state'])
        nxt['Rnds']['Sds'].update(yr['seeds'])
        nxt['globalVariable']['win_ywf']=ywf_state['globalVariable'].get('win_ywf',0)+1
        for _name,npc in BOSSES['연왕부']:
            rec=yr['bosses'][str(npc)]
            slot_key=f'drop_{npc}_equip';color_key=f'drop_{npc}_color'
            if rec['index'] is None:nxt['globalVariable'].pop(slot_key,None)
            else:nxt['globalVariable'][slot_key]=rec['index']
            if rec['quality'] is not None:nxt['globalVariable'][color_key]=rec['quality']
        ywf_state=nxt
    # DCY/BYJ remain one-clear only: their full mutable-state carry-over is not yet audited.
    dc=report_dcy(preentry)
    eq=[]
    for b,npc in BOSSES['창옥']:
        rec=dc['bosses'][str(npc)]
        eq.append({'boss':b,**present('창옥',npc,rec['slot'],rec.get('grade'),pools,names)})
    results.append({'gate':'창옥','clear':1,'draws':dc['call_count'],'seedAfter':dc['seed_after'],'equipment':eq,'source':'40389_1.lua'})
    by=report_byj(preentry)
    if by['selected'] is None:
        # Never silently select branch 37 from an unobserved state.
        raise ValueError('BYJ branch 37 not uniquely determined: both branch forecasts remain required')
    eq=[]
    for b,npc in BOSSES['벽유교']:
        rec=by['selected']['bosses'][str(npc)]
        eq.append({'boss':b,**present('벽유교',npc,rec['slot'],rec.get('grade'),pools,names)})
    results.append({'gate':'벽유교','clear':1,'draws':by['selected']['call_count'],'seedAfter':{'seed_byj':by['selected']['seed_after']},
                    'branch37':by['branch37_applies'],'equipment':eq,'source':'35227_1.lua'})
    current=copy.deepcopy(preentry)
    for i in range(1,liu_clears+1):
        current,li=report_liu(current,i)
        eq=[]
        for b,npc in BOSSES['유씨별원']:
            rec=li['bosses'][b]
            eq.append({'boss':b,**present('유씨별원',npc,rec['slot'],rec.get('grade'),pools,names)})
        results.append({'gate':'유씨별원','clear':i,'draws':li['call_count'],'seedAfter':{'seed_lsby':li['seed_after']},
                        'equipment':eq,'source':'35271_1.lua'})
    result={'status':'research-only—not site verified','releasedGates':list(GATES),'frozenUnreleasedGates':list(FROZEN),
            'basis':'Source-grounded forecast. Not independently validated in future gameplay.', 'runs':results}
    if special_award_registry is not None:
        from released_special_state_compare import compare
        awards=json.loads(special_award_registry.read_text())
        materials=json.loads(special_material_registry.read_text())
        result['specialRewardCounterfactual']=compare(preentry,awards,materials)
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--save',required=True,type=Path);p.add_argument('--v30-root',required=True,type=Path)
    p.add_argument('--registry',required=True,type=Path);p.add_argument('--liu-clears',type=int,default=1);p.add_argument('--ywf-clears',type=int,default=1)
    p.add_argument('--output',type=Path,help='Local private output (may contain RNG seed values)')
    p.add_argument('--special-award-registry',type=Path,help='Source-derived 40 original special consumer rules')
    p.add_argument('--special-material-registry',type=Path,help='Source-derived 46 original material weight caps')
    a=p.parse_args()
    result=replay(json.loads(a.save.read_text()),a.v30_root,a.registry,a.liu_clears,a.ywf_clears,
                  a.special_award_registry,a.special_material_registry)
    payload=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if a.output:a.output.write_text(payload,encoding='utf-8')
    else:print(payload)
if __name__=='__main__':main()