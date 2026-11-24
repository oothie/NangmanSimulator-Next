#!/usr/bin/env python3
"""Original BYJ exit-event fallback, source-bounded from 60014-style Whale event.

This function NEVER draws from seed_byj, NEVER invents the independent JHRandom
state and only reports an *eligible* JHRandom(3,5) grant range. Calling this is
not the same as awarding inventory items or a fully replayed dungeon clear.
"""
from __future__ import annotations
import copy, re

MATERIAL_GROUPS=(tuple(f'drop_byj_{n}' for n in range(1,7)),
                 tuple(f'drop_byj_{n}' for n in range(7,14)))
AWARDS=(3025,3035)


def source_audit(tree:dict)->dict:
    """Fail closed if the actual decrypted exit script differs from assumptions."""
    def key(obj,k):return obj[k] if k in obj else obj[str(k)]
    target=tree
    for k in (1,2,2,2,5,2):target=key(target,k)
    assert target['cond']['json'].replace(' ','')=="GetP('glm_reward')==1"
    body=target['imp_yes']
    assert "SetP('glm_reward',0)" in key(key(body,1),3)
    for position,group,item in ((2,MATERIAL_GROUPS[0],3025),(3,MATERIAL_GROUPS[1],3035)):
        branch=key(key(body,position),2)
        cond=branch['cond']['json']
        keys=re.findall(r"GetP\(\s*'(?P<key>drop_byj_\d+)'\s*\)\s*==\s*0",cond)
        assert len(keys)==len(group) and set(keys)==set(group),(position,keys,group)
        action=key(key(branch['imp_yes'],1),3)
        assert re.search(r"SetP\(\s*'rd_reward%d'\s*,\s*%d\s*\)"%(position-1,item),action)
        assert re.search(r"SetP\(\s*'rd_reward%d_num'\s*,\s*JHRandom\(\s*3\s*,\s*5\s*\)\s*\)"%(position-1),action)
    assert "BranchOpenStep('byj_rd',0)" in key(key(body,4),3)
    return {'rewardItems':list(AWARDS),'weightGroups':[list(x) for x in MATERIAL_GROUPS],
            'quantityRange':[3,5],'independentRandom':'JHRandom','seed_byj_calls':0,
            'guard':"GetP('glm_reward')==1"}


def conditionally_plan_exit(global_vars:dict,has_completed_branch:bool|None=None):
    """Resolve only glm_reward subtree; branch prerequisite remains external.

    has_completed_branch False -> known exit path inapplicable.
    None -> upstream GetBranchStep/NpcExist path unknown, no assumed award.
    True -> assume this branch is executed, not that reward physically granted.
    """
    if has_completed_branch is not True:
        return {'status':'unresolved-upstream-exit-path' if has_completed_branch is None else 'not-executed',
                'grants':[],'seedByjDraws':0}
    if global_vars.get('glm_reward',0)!=1:
        return {'status':'glm_reward-not-set','grants':[],'seedByjDraws':0}
    grants=[]
    for group,item in zip(MATERIAL_GROUPS,AWARDS):
        if all(global_vars.get(k,0)==0 for k in group):
            grants.append({'itemId':item,'quantityMin':3,'quantityMax':5,
                           'quantityRng':'JHRandom','isActualQuantityKnown':False})
    return {'status':'eligible-conditional-exit','grants':grants,'seedByjDraws':0,
            'glmRewardAfter':0,'upstreamCompletionAssumed':True}