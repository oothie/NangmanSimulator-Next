#!/usr/bin/env python3
"""Original BYJ rescue-weight branches with source-order intervals.

All RNG outputs are provided by caller (documented explicitly); no forged seed,
StoryRnd state, or simulated real-game result is produced here.
"""
from __future__ import annotations
from byj_original_material_consumer import apply_known_selected_outcomes,possible_rewards

ORDERS={1:(3,4,1,6,2,5),2:(7,8,10,9,13,11,12)}

def intervals(global_vars:dict,registry:dict,assume_rescue=True)->dict:
    base=possible_rewards(global_vars,registry,assume_rescue)
    if base['status']!='conditional-weighted-candidates':
        return {'status':base['status'],'groups':[],'gameRuntimeOrderVerified':False}
    res=[]
    for group in base['groups']:
        n=group['group'];weights={c['index']:c for c in group['candidates']};start=1;rows=[]
        for idx in ORDERS[n]:
            c=weights.get(idx)
            if c is None:continue
            value=c['weight']
            if type(value) is not int or value<=0:raise ValueError(f'Unverified integer weight for {idx}: {value}')
            rows.append({'index':idx,'start':start,'end':start+value-1,
                         'weight':value,'itemId':c['itemId'],'rewardQuantity':c['rewardQuantity'],
                         'counter':c['counter'],'counterIncrement':c['counterIncrement']})
            start+=value
        assert start-1==group['weightSum'],(start,group['weightSum'])
        res.append({'group':n,'total':start-1,'intervals':rows,'sourceOrder':list(ORDERS[n]),
                    'rollFrom':'getStoryRnd().intRand(...); exact return range not independently verified'})
    return {'status':'source-model-conditional','groups':res,'gameRuntimeOrderVerified':False,
            'unknownRngState':'getStoryRnd, NOT seed_byj'}

def apply_observed_story_rolls(global_vars,registry,rolls:dict[int,int],assume_rescue=True):
    """Resolve observed one-based rolls to source-ordered branches.

    These are externally supplied *actual* intRand outcomes, NOT generated
    predictions. The 1-based convention is a hypothesis until native intRand
    implementation is verified.
    """
    if set(rolls)!={1,2}:raise ValueError('Require both group rolls')
    info=intervals(global_vars,registry,assume_rescue)
    if info['status']!='source-model-conditional':raise ValueError(info['status'])
    chosen={}
    for group in info['groups']:
        g=group['group'];roll=rolls[g]
        if not isinstance(roll,int) or isinstance(roll,bool):raise TypeError('integer roll required')
        if group['total']==0:
            raise ValueError('Original getStoryRnd.intRand(0) behavior unverified; cannot select empty group')
        if roll<1 or roll>group['total']:raise ValueError(f'roll {roll} outside 1..{group["total"]}')
        opts=[v for v in group['intervals'] if v['start']<=roll<=v['end']]
        assert len(opts)==1
        chosen[g]=opts[0]['index']
    new,effects=apply_known_selected_outcomes(global_vars,registry,chosen,True)
    return {'sourceOrderAssumption':True,'givenRolls':dict(rolls),'selected':chosen,
            'changes':effects,'globalVariables':new,
            'warning':'Game runtime intRand range, underlying story RNG state and actual pairs order not yet verified'}