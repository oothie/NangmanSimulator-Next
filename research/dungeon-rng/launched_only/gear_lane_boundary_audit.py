#!/usr/bin/env python3
"""Scope audit for four released gate gear ID/grade RNG vs independent item seeds.

Reads private saves locally only; emits summary without seed values or inventories.
This audit does not claim equipment affix/option prediction, field RNG replay, or
full native LuaJIT pairs() agreement.
"""
from __future__ import annotations
import argparse, copy, json
from pathlib import Path
from mixed_gate_schedule import run_order

GEAR_IDS=(4009,4209,4409,4609,4809,5009,5209,5409,5609)
GATE_LANES=('seed_byj','seed_lsby','seed_dcy_40372','seed_dcy_40373','seed_dcy_40374',
            'seed_33654','seed_33653','seed_33652','seed_33650')
SCHEDULE=['벽유교','창옥','연왕부','유씨별원','유씨별원','유씨별원']

def summarize(before:dict,after:dict,source_root:Path,registry:Path,order=None):
    if order is None: order=SCHEDULE
    post,report=run_order(before,source_root,registry,order)
    b=before['Rnds'];a=after['Rnds'];p=post['Rnds']
    eds_changed=sorted(int(k) for k in GEAR_IDS if b['Eds'].get(str(k))!=a['Eds'].get(str(k)))
    other_sds_changed=sorted(k for k in a['Sds'] if b['Sds'].get(k)!=a['Sds'].get(k) and k not in GATE_LANES)
    field_keys=sorted(k for k in b['Sds'] if k.startswith('aidrop') or k=='mdrop')
    field_changed=sorted(k for k in field_keys if b['Sds'].get(k)!=a['Sds'].get(k))
    updated_gate_sds=sorted(k for k in p['Sds'] if b['Sds'].get(k)!=p['Sds'].get(k))
    predicted=[(e['equipmentId'],e['gradeCode']) for run in report['runs'] for e in run['equipment'] if e['equipmentId'] is not None]
    existing_ids={eq['OnlyID'] for eq in before.get('Equips',[])}
    actual=sorted((eq for eq in after.get('Equips',[]) if eq['OnlyID'] not in existing_ids and eq['ID'] in GEAR_IDS),key=lambda eq:eq['OnlyID'])
    actual_pairs=[(eq['ID'],eq['Color']) for eq in actual]
    return {'schedule':[{'gate':g,'clear':report['counts'][g]} for g in dict.fromkeys(order)],
            'changedEquipmentSeedTypes':len(eds_changed),
            'changedEquipmentIdNames':eds_changed,
            'reportedEquipmentIdsAndGrade':len(predicted),
            'new90EquipmentInAfterSave':len(actual_pairs),
            'matchingContiguousPredictedPrefix':predicted==actual_pairs[:len(predicted)],
            'reportedOriginalGateLaneCount':len(updated_gate_sds),
            'reportedGateLanesOnly':set(updated_gate_sds)==set(GATE_LANES),
            'postEdsUnchanged':p['Eds']==b['Eds'],
            'otherChangedSaveSdsCount':len(other_sds_changed),
            'fieldDropSdsLaneCount':len(field_keys),
            'fieldDropSdsChangedBetweenSavePair':len(field_changed),
            'fieldMonsterNpcSeedsChanged':{k:(b['Sds'].get(k)!=a['Sds'].get(k)) for k in ('seed_32299','seed_35256')},
            'globalStoryRandChanged':b.get('S')!=a.get('S'),
            'limits':['Historical before/after inventory sequence does not prove individual boss attribution',
                      'Equipment Eds is not advanced by this four-gate equipment ID/grade forecast',
                      'Other save activities cannot be attributed to these gates from only a two-save diff',
                      'Even when field aidrop/mdrop seeds are unchanged, an NPC-specific spawn seed or global RNG may change',
                      'Prospective field->dungeon equipment affix/option RNG remains unverified']}

def gear_signature(report:dict):
    return tuple((run['gate'],run['clear'],tuple((e['equipmentId'],e.get('gradeCode')) for e in run['equipment'])) for run in report['runs'])

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--before',type=Path,required=True)
    p.add_argument('--after',type=Path,required=True)
    p.add_argument('--source-root',type=Path,required=True)
    p.add_argument('--registry',type=Path,required=True)
    p.add_argument('--safe-report',type=Path)
    args=p.parse_args()
    summary=summarize(json.loads(args.before.read_text()),json.loads(args.after.read_text()),args.source_root,args.registry)
    payload=json.dumps(summary,ensure_ascii=False,indent=2)+'\n'
    if args.safe_report:args.safe_report.write_text(payload,encoding='utf-8')
    else: print(payload)