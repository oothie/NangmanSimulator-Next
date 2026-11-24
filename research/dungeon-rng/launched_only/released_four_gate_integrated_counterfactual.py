#!/usr/bin/env python3
"""Source-bounded simultaneous special-reward / normal-equipment sensitivity replay.

This models changes to *specific persistent counters*, not a real never-played account.
For never-claimed predictions, missing ownership, temporary scoped flags and historical
initialisation mean scenarios are hypotheses. The private save never leaves this process.
"""
from __future__ import annotations
import argparse,copy,json
from pathlib import Path
from launched_gate_forward import replay,GATES
from released_special_state_compare import compare
from material_weight_counterfactual import simulate
from byj_original_material_prestage import apply as byj_prestage
from byj_material_lifecycle import trace_lifecycle


def make_scenarios(save:dict,awards:dict,materials:dict):
    base=copy.deepcopy(save)
    out={'completed':base}
    payout_keys={r['countKey'] for r in awards['awards'] if r['countKey'] and r['countScope']!='temp'}
    material_keys={r['counter'] for r in materials['producerCaps']}
    def modified(name,keys,first_reward=False):
        s=copy.deepcopy(base);g=s['globalVariable']
        for key in keys:g[key]=0
        if first_reward:g['first_rdward']=0
        out[name]=s
    modified('payout_counters_zero_only',payout_keys)
    modified('material_counters_zero_only',material_keys)
    modified('both_counters_zero_same_initialization',payout_keys|material_keys)
    modified('both_counters_zero_fresh_byj',payout_keys|material_keys,True)
    # Numeric game property 8915 is NOT the payout count get_8915 nor the
    # previous reward flag drop_8915_35264. It guards a RNG draw itself.
    variant=copy.deepcopy(base);variant['globalVariable']['8915']=1
    out['liu_numeric_8915_enabled_only']=variant
    return out


def summary_scenario(save,source_root,registry,awards,materials):
    # All four launched gates, one clear each. No order-dependent state carry-over
    # between unrelated dungeons: all evaluate the same independently supplied save.
    result=replay(save,source_root,registry,1,1)
    gates={}
    for run in result['runs']:
        gates[run['gate']]={
            'draws':run['draws'],
            'equipment':[(e['npc'],e['equipmentId'],e['grade']) for e in run['equipment']],
            'seedAfter':run['seedAfter'],
            'branch37':run.get('branch37')}
    # Special payout is a guarded consumer condition, not automatic granted award.
    guards=compare(save,awards,materials)
    byj_state,byj_stage=byj_prestage(save)
    # The existing BYJ boss replay starts at step 25. The material state from
    # source steps 10-23 is audited, but its battle grant consumer is not.
    return gates,guards,byj_stage


def analyze(save,source_root,registry,awards,materials,byj_material_registry=None):
    cases=make_scenarios(save,awards,materials)
    baseline,baseguard,baseprestage=summary_scenario(cases['completed'],source_root,registry,awards,materials)
    output={'scope':list(GATES),'status':'CONDITIONAL source-backed sensitivity; NOT an independently observed never-claimed account',
            'baselineCounterfactual':baseguard['totals'],
            'limitations':['get_* counters do not establish inventory ownership or temp-scoped GetP',
              'num_* reset changes historical accumulated rewards without undoing wins/seed',
              'BYJ first_rdward=0 is a fresh-initialization sensitivity, not proof of historical initial state',
              'per-gate one-clear; actual special payout event and ownership mutation not replayed',
              'BYJ source steps 10-23 material initialization is audited, but the separate battle material grant consumer is not included in boss replay',
              'unobserved post-award consumer actions and alternate script versions remain outside this model'],
            'scenarios':{}}
    for label,case in cases.items():
        res,guards,prestage=summary_scenario(case,source_root,registry,awards,materials)
        bygate={}
        for gate,b in baseline.items():
            x=res[gate]
            eq0=b['equipment'];eq1=x['equipment']
            bygate[gate]={
                'drawCountBaseline':b['draws'],'drawCountScenario':x['draws'],
                'drawsChanged':b['draws']!=x['draws'],
                'seedChanged':b['seedAfter']!=x['seedAfter'],
                'equipmentChanged':eq0!=eq1,
                'equipmentBaseline':[{'npc':npc,'id':item,'grade':col} for npc,item,col in eq0],
                'equipmentScenario':[{'npc':npc,'id':item,'grade':col} for npc,item,col in eq1],
                'branch37Changed':b['branch37']!=x['branch37'],
                'fullOriginalSpecialEventCovered':False,
                'producerStagesCovered':'boss-only 25+; material consumer 24 excluded' if gate=='벽유교' else 'producer modeled, reward post-award ownership not fully executed'}
        byj_rescue=None
        if byj_material_registry is not None:
            # Hypothesis only: force the *temporary rescue guard* to zero.
            # This does NOT claim the user actually visited the hostage or
            # that an event-weighted result has been selected.
            rescue_assumption=copy.deepcopy(case)
            rescue_assumption['globalVariable']['glm_reward']=0
            byj_rescue=trace_lifecycle(rescue_assumption,byj_material_registry['original'],
                rescue_executed=True,exit_completed=None)
        output['scenarios'][label]={
            'gates':bygate,
            'payoutIfSpecialRollSucceeds':guards['totals']['payoutBlockCount'],
            'materialWeightChanges':guards['totals']['changedMaterialFresh'],
            'byjRescueHypothetical':None if byj_rescue is None else {
                'status':byj_rescue['rescue']['status'],
                'weightGroups':[{'group':g['group'],'weightSum':g['weightSum'],
                                 'candidateCount':len(g['candidates'])}
                        for g in byj_rescue['rescue']['groups']],
                'outcome':byj_rescue['exit']['status'],
                'actualAwardUnknown':True},
            'byjMaterialPrestage':{'initialized':prestage['initialized'],
                 'activeKeys':prestage['entriesActive'],
                 'totalWeight':prestage['materialWeightTotal'],
                 'totalWeightChangedFromBaseline':prestage['materialWeightTotal']!=baseprestage['materialWeightTotal'],
                 'rngDrawsConsumed':prestage['rngDrawsConsumed']}}
    return output


def public_summary(result:dict):
    return {'scope':result['scope'],'status':result['status'],
       'limitations':result['limitations'],
       'scenarios':{name:{gate:{key:value for key,value in row.items() if key in
            ('drawsChanged','seedChanged','equipmentChanged','branch37Changed')}
          for gate,row in scenario['gates'].items()}
         for name,scenario in result['scenarios'].items()},
       'byjRescueHypothetical':{name:scenario['byjRescueHypothetical']
          for name,scenario in result['scenarios'].items()
          if scenario.get('byjRescueHypothetical') is not None}}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--save',required=True,type=Path)
    p.add_argument('--v30-root',required=True,type=Path)
    p.add_argument('--registry',required=True,type=Path)
    p.add_argument('--special-award-registry',required=True,type=Path)
    p.add_argument('--special-material-registry',required=True,type=Path)
    p.add_argument('--byj-material-rescue-registry',type=Path,help='Optional original 13-case rescue consumer registry; non-deterministic chooser is never guessed')
    p.add_argument('--local-output',type=Path,help='Private output: includes observed seeds; never publish.')
    a=p.parse_args()
    result=analyze(json.loads(a.save.read_text()),a.v30_root,a.registry,
      json.loads(a.special_award_registry.read_text()),
      json.loads(a.special_material_registry.read_text()),
      json.loads(a.byj_material_rescue_registry.read_text()) if a.byj_material_rescue_registry else None)
    if a.local_output:a.local_output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(public_summary(result),ensure_ascii=False,indent=2))

if __name__=='__main__':main()