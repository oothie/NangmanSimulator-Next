#!/usr/bin/env python3
"""Enumerate expressly hypothetical 8915 receipt/use histories between two saves.

No inference from get_8915 or drop_8915_35264. Each hypothetical key is
received after a Liu clear and consumed only in a following inter-clear gap
(or before the final endpoint save). Missing real chronology remains unknown.
"""
from __future__ import annotations
from itertools import product
from typing import Callable
from pathlib import Path
import copy


def enumerate_key_histories(*, start_qty:int, end_qty:int, liu_clears:int,
                            assumed_receipts:int, assumed_consumptions:int,
                            max_histories:int=256) -> list[dict]:
    vals=(start_qty,end_qty,liu_clears,assumed_receipts,assumed_consumptions,max_histories)
    if any(type(v) is not int for v in vals) or any(v<0 for v in vals):
        raise ValueError('Quantities, clear count and history cap must be nonnegative integers')
    if liu_clears<1 or liu_clears>12 or max_histories<1:
        raise ValueError('1..12 clears and a positive history cap required')
    if assumed_receipts>liu_clears:
        raise ValueError('At most one 8915 key may be granted per Liu clear in this model')
    if start_qty+assumed_receipts-assumed_consumptions!=end_qty:
        raise ValueError('Hypothetical receipt/use counts do not reconcile with endpoint saves')
    histories=[]
    # consumption before each clear, receipt after each clear; the last
    # consumption slot is the gap between final clear and endpoint save.
    for receipt in product((0,1),repeat=liu_clears):
        if sum(receipt)!=assumed_receipts:continue
        for consumption in product((0,1),repeat=liu_clears+1):
            if sum(consumption)!=assumed_consumptions:continue
            count=start_qty
            entry=[]
            valid=True
            for i in range(liu_clears):
                count-=consumption[i]
                if count<0:valid=False;break
                entry.append(count>0)
                # recovered original producer condition: no 8915 roll if held
                if receipt[i] and count>0:valid=False;break
                count+=receipt[i]
            if not valid or count-consumption[-1]!=end_qty:continue
            histories.append({'atEntryHeld':entry,
                              'receivedAfterClear':list(receipt),
                              'usedBeforeEachClear':list(consumption[:-1]),
                              'usedBeforeEndpoint':consumption[-1],
                              'condition':'HYPOTHETICAL_NOT_OBSERVED'})
            if len(histories)>max_histories:
                raise ValueError('Hypothetical key history search exceeds safety cap')
    return histories


def compare_possible_equipment(before:dict,source_root:Path,registry:Path,
                               schedule:list[str],histories:list[dict],
                               replay:Callable|None=None)->dict:
    """Replay each distinct entry timeline, never publish private RNG seeds."""
    if replay is None:
        from mixed_gate_schedule import run_order
        replay=run_order
    expected=sum(g=='유씨별원' for g in schedule)
    timelines={tuple(h['atEntryHeld']) for h in histories}
    if not timelines or any(len(t)!=expected for t in timelines):
        raise ValueError('Invalid hypothesized Liu entry timelines')
    out=[]
    for timeline in sorted(timelines):
        _,result=replay(copy.deepcopy(before),source_root,registry,schedule,
                        liu_key_ownership=list(timeline))
        runs=result['runs']
        if len(runs)!=len(schedule) or any(r.get('gate')!=g for r,g in zip(runs,schedule)):
            raise ValueError('Incomplete modeled gate schedule')
        picks=[]
        for r in runs:
            picks.append({'gate':r['gate'],'clear':r['clear'],
                          'equipment':[{'boss':e['boss'],
                                        'equipmentName':e.get('equipmentName') or '미드랍',
                                        'grade':e.get('grade')} for e in r['equipment']]})
        out.append({'entryHeldTimeline':list(timeline),'gateEquipment':picks,
                    'status':'CONDITIONAL_NOT_VERIFIED'})
    return {'status':'HYPOTHETICAL_NO_SINGLE_FORECAST',
            'historyCount':len(histories),'uniqueEntryTimelines':len(out),
            'paths':out,'noRngSeedsOrInventoryIds':True}


def main() -> None:
    import argparse
    import json
    from liu_key_save_pair_audit import audit_save_pair
    parser=argparse.ArgumentParser(description='Hypothetical key history search; does not infer receipts from get_8915')
    parser.add_argument('--before',type=Path,required=True)
    parser.add_argument('--after',type=Path,required=True)
    parser.add_argument('--schedule',required=True,help='e.g. 유씨별원,창옥,유씨별원,유씨별원')
    parser.add_argument('--assumed-receipts',type=int,required=True)
    parser.add_argument('--assumed-consumptions',type=int,required=True)
    parser.add_argument('--source-root',type=Path)
    parser.add_argument('--registry',type=Path)
    args=parser.parse_args()
    if (args.source_root is None)!=(args.registry is None):
        parser.error('Both --source-root and --registry are required to compute equipment')
    before=json.loads(args.before.read_text(encoding='utf-8'))
    after=json.loads(args.after.read_text(encoding='utf-8'))
    comparison=audit_save_pair(before,after)
    schedule=args.schedule.split(',')
    if comparison['liuWinCounterChange'] is not None and comparison['liuWinCounterChange']!=schedule.count('유씨별원'):
        raise ValueError('Entered Liu count disagrees with actual save win counter delta')
    histories=enumerate_key_histories(
        start_qty=comparison['startHeldQuantity'],end_qty=comparison['endHeldQuantity'],
        liu_clears=schedule.count('유씨별원'),assumed_receipts=args.assumed_receipts,
        assumed_consumptions=args.assumed_consumptions)
    out={'status':'EXPLICIT_HYPOTHETICAL_RECEIPT_USE_ASSUMPTION',
         'assumptions':{'received':args.assumed_receipts,'consumed':args.assumed_consumptions},
         'endpointAudit':comparison, 'hypotheticalHistoryCount':len(histories),
         'hypotheticalHistories':histories}
    if args.source_root is not None:
        out['conditionalEquipment']=compare_possible_equipment(before,args.source_root,args.registry,schedule,histories)
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()