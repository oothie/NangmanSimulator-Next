#!/usr/bin/env python3
"""Equipment-first dependency audit. Only trace special mechanics changing equip outcome / future seed.

A save counterfactual is NOT evidence of how a never-claimed account reached that state.
No personal seeds are printed or committed.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from released_four_gate_integrated_counterfactual import analyze

GATES = ('연왕부','창옥','벽유교','유씨별원')
SCENARIOS = ('payout_counters_zero_only','material_counters_zero_only',
             'both_counters_zero_same_initialization','both_counters_zero_fresh_byj',
             'liu_numeric_8915_enabled_only')

def summarize(audit:dict)->dict:
    if tuple(audit['scope'])!=GATES: raise ValueError('Unexpected gate set')
    result={'goal':'predict ordinary equipment ID and color; special drops tracked only if consequential',
            'caveat':'Counterfactuals at unchanged starting seeds; not real unclaimed historical game saves',
            'gateDependencies':{},'priorityOrder':[]}
    for gate in GATES:
        cases=[]
        for label in SCENARIOS:
            row=audit['scenarios'][label]['gates'][gate]
            equipment=bool(row['equipmentChanged']); future=bool(row['seedChanged'] or row['drawsChanged'])
            cases.append({'scenario':label,'equipmentChanged':equipment,
                         'futureStateChanged':future,'drawCountChanged':bool(row['drawsChanged']),
                         'branch37Changed':bool(row['branch37Changed'])})
        material=next(c for c in cases if c['scenario']=='material_counters_zero_only')
        payout=next(c for c in cases if c['scenario']=='payout_counters_zero_only')
        if payout['equipmentChanged'] or payout['futureStateChanged']:
            payout_policy='required-by-current-sensitive-replay'
        else:payout_policy='not-required-for-current-equipment-replay'
        material_policy=('required-equipment' if material['equipmentChanged'] else
                         'required-future-seed' if material['futureStateChanged'] else
                         'not-required-in-current-boss-replay')
        byj_incomplete=gate=='벽유교'
        if byj_incomplete:
            material_policy='unproven-full-entry-path; keep separate, do not assert independence'
        result['gateDependencies'][gate]={
           'payoutCounterPolicy':payout_policy,'materialCounterPolicy':material_policy,
           'specialMaterialRollNeededNow':gate=='유씨별원' or bool(material['equipmentChanged']) or bool(material['futureStateChanged']),
           'originalMaterialConsumerMandatory':False,
           'scopeIncomplete':byj_incomplete,
           'caseResults':cases}
    result['priorityOrder']=['유씨별원: RNG-influencing material weights and numeric GetP(8915) conditional call',
      '창옥: material counter changes both equipment and seed in tested states',
      '연왕부: material counter changes future seed in tested states',
      '벽유교: preserve source entry code; test whether rescue JHRandom shares or affects equipment RNG before implementing it']
    return result

def run(save, v30_root, registry, awards, materials):
    a=analyze(json.loads(Path(save).read_text()),Path(v30_root),Path(registry),
      json.loads(Path(awards).read_text()),json.loads(Path(materials).read_text()))
    return summarize(a)

def main():
    p=argparse.ArgumentParser();p.add_argument('--save',required=True,type=Path)
    p.add_argument('--v30-root',required=True,type=Path);p.add_argument('--registry',required=True,type=Path)
    p.add_argument('--awards',required=True,type=Path);p.add_argument('--materials',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    args=p.parse_args();summary=run(args.save,args.v30_root,args.registry,args.awards,args.materials)
    args.output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'gatePolicies':{g:{k:v for k,v in data.items() if k!='caseResults'}
                       for g,data in summary['gateDependencies'].items()},
                      'output':str(args.output)},ensure_ascii=False,indent=2))
if __name__=='__main__':main()