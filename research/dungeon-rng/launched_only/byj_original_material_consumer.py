#!/usr/bin/env python3
"""Source-audited BYJ hostage rescue material reward consumer (36274/36275).

Original events use *dynamic-weight* branch keys `GetP('drop_byj_N')`,
not sequential IF tests. The native RNG for this event-weighted chooser remains
unverified; no selection/seed value is guessed. A caller can submit selected
outcome indices to apply ONLY the original counter and reward-variable effects.
"""
from __future__ import annotations
import re,copy,hashlib
from dataclasses import dataclass,asdict
from typing import Any

GROUPS=(tuple(range(1,7)),tuple(range(7,14)))
ASSIGN=re.compile(r"(?P<op>SetP|AddP)\(\s*'(?P<key>(?:num_\d+_byj|rd_reward[12](?:_num)?))'\s*,\s*(?P<amount>\d+)\s*\)")


def source_audit(tree:dict)->dict:
    """Require exact original per-case actions and guard; inspect all 13 cases."""
    def key(v,k):return v[k] if k in v else v[str(k)]
    assert "GetP('glm_reward')==0"==re.sub(r'\s+','',tree['cond']['json'])
    stages=key(tree,1)
    assert "SetP('glm_reward',1)" in key(key(stages,10),3)
    cases=[]
    for step,group in ((8,GROUPS[0]),(9,GROUPS[1])):
        table=key(key(stages,step),2)
        actual={int(x) for item in table for x in re.findall(r"^GetP\('drop_byj_(\d+)'\)$",str(item))}
        assert actual==set(group),(step,actual,group)
        for index in group:
            action=key(key(table[f"GetP('drop_byj_{index}')"],1),3)
            commands=[{'op':m['op'],'key':m['key'],'amount':int(m['amount'])} for m in ASSIGN.finditer(action)]
            assert len(commands)==3,(index,action,commands)
            assert commands[0]['op']=='AddP' and commands[0]['key'].startswith('num_')
            assert commands[1]=={'op':'SetP','key':f'rd_reward{1 if step==8 else 2}','amount':int(commands[0]['key'].split('_')[1])}
            assert commands[2]['op']=='SetP' and commands[2]['key']==f'rd_reward{1 if step==8 else 2}_num'
            cases.append({'index':index,'weightProperty':f'drop_byj_{index}',
                          'rewardGroup':1 if step==8 else 2,
                          'itemId':commands[1]['amount'],
                          'actualRewardQuantity':commands[2]['amount'],
                          'counter':commands[0]['key'],'counterIncrement':commands[0]['amount'],
                          'sourceEffects':commands})
    assert len(cases)==13
    return {'guard':"GetP('glm_reward') == 0",'guardType':'pre-rescue',
            'randomMechanism':'event-weighted-choice (native RNG not yet established)',
            'setsGlmRewardTo':1,'cases':cases}


def possible_rewards(global_vars:dict,registry:dict,assume_rescue:bool=False)->dict:
    """Return conditional support, never sample unknown native selection."""
    if not assume_rescue:return {'status':'rescue-not-asserted','groups':[]}
    if global_vars.get('glm_reward',0)!=0:return {'status':'already-rewarded','groups':[]}
    output=[]
    for group in (1,2):
        pool=[]
        for row in registry['cases']:
            if row['rewardGroup']!=group:continue
            weight=global_vars.get(row['weightProperty'],0)
            if not isinstance(weight,(int,float)) or weight<0:raise ValueError('Invalid weight '+row['weightProperty'])
            if weight>0:pool.append({'index':row['index'],'weight':weight,'itemId':row['itemId'],
                                      'rewardQuantity':row['actualRewardQuantity'],
                                      'counter':row['counter'],'counterIncrement':row['counterIncrement']})
        output.append({'group':group,'candidates':pool,'weightSum':sum(x['weight'] for x in pool),
                       'selectionNotYetDetermined':True})
    return {'status':'conditional-weighted-candidates','groups':output,
            'weightedEngine':'original GetP branch keys; selection implementation not independently proven',
            'independentSeedUnknown':True}


def apply_known_selected_outcomes(global_vars:dict,registry:dict,outcomes:dict[int,int|None],assume_rescue:bool=False):
    """Deterministic conditional effects only, for actual externally known outcomes.

    Require explicit outcomes for both groups, including None when no positive
    weight exists. No RNG or award is invented.
    """
    if not assume_rescue:raise ValueError('Rescue event not known to have executed')
    if global_vars.get('glm_reward',0)!=0:raise ValueError('Rescue already claimed')
    if set(outcomes)!={1,2}:raise ValueError('Both outcome groups must be supplied')
    options=possible_rewards(global_vars,registry,True)['groups']
    new=global_vars.copy();effects=[]
    for row in options:
        group=row['group'];picked=outcomes[group]
        allowed={x['index'] for x in row['candidates']}
        if not allowed:
            if picked is not None:raise ValueError('No weighted candidate but forced selection')
            continue
        if picked not in allowed:raise ValueError(f'Unknown or zero-weight selection group {group}: {picked}')
        source=next(x for x in registry['cases'] if x['index']==picked)
        for effect in source['sourceEffects']:
            if effect['op']=='AddP':new[effect['key']]=new.get(effect['key'],0)+effect['amount']
            else:new[effect['key']]=effect['amount']
        effects.append({'group':group,'case':picked,'itemId':source['itemId'],
                        'rewardQuantity':source['actualRewardQuantity'],
                        'counterDelta':source['counterIncrement']})
    new['glm_reward']=1
    return new,effects