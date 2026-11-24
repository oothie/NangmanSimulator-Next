#!/usr/bin/env python3
"""Compare the two *hypothetical* 8915 (고리의 열쇠) ownership paths.

This is a sensitivity experiment, not a save parser and not a proof that the
numeric GetP(8915) is bound to a particular inventory field in the Korean game.
The caller must separately verify the actual ownership/consumption history.
"""
from __future__ import annotations
import argparse
import copy
import json
from pathlib import Path
from typing import Callable

KEY = '8915'


def run_key_sensitivity(before: dict, source_root: Path, registry: Path,
                        schedule: list[str], replay: Callable | None = None) -> dict:
    if not isinstance(before, dict):
        raise ValueError('Source save must be a JSON object')
    if not isinstance(schedule, list) or not schedule or '유씨별원' not in schedule:
        raise ValueError('Schedule must include 유씨별원 to compare the 고리의 열쇠 branch')
    if replay is None:
        from mixed_gate_schedule import run_order
        replay = run_order

    branches = []
    for held in (False, True):
        state = copy.deepcopy(before)
        state.setdefault('globalVariable', {})[KEY] = 1 if held else 0
        _, result = replay(state, source_root, registry, schedule)
        runs = result.get('runs')
        if not isinstance(runs, list) or len(runs) != len(schedule):
            raise ValueError('Incomplete mixed-gate replay in key branch')
        branches.append(runs)

    pair = list(zip(*branches))
    if len(pair) != len(schedule):
        raise ValueError('Inconsistent branch lengths')
    public_runs = []
    first = None
    for index, (none_run, held_run) in enumerate(pair, 1):
        if none_run.get('gate') != schedule[index-1] or held_run.get('gate') != schedule[index-1]:
            raise ValueError('Inconsistent gate ordering between branches')
        def picks(run):
            return [{'boss': x['boss'], 'equipmentName': x.get('equipmentName') or '미드랍',
                     'grade': x.get('grade'), 'equipmentId': x.get('equipmentId')}
                    for x in run['equipment']]
        a, b = picks(none_run), picks(held_run)
        if len(a) != len(b) or [x['boss'] for x in a] != [x['boss'] for x in b]:
            raise ValueError('Producer returned inconsistent boss order')
        changed_bosses = [x['boss'] for x, y in zip(a,b)
                          if (x['equipmentId'],x['grade']) != (y['equipmentId'],y['grade'])]
        sa, sb = none_run.get('seedAfter', {}), held_run.get('seedAfter', {})
        if set(sa) != set(sb):
            raise ValueError('Producer seed ownership differs by 8915 branch')
        differing_seed_names = sorted(k for k in sa if sa[k] != sb[k])
        changed_draws = none_run.get('draws') != held_run.get('draws')
        divergence = bool(changed_bosses or differing_seed_names or changed_draws)
        if first is None and divergence:
            first = index
        public_runs.append({'order':index, 'gate':schedule[index-1],
                            'unheldEquipment':a, 'heldEquipment':b,
                            'changedBosses':changed_bosses,
                            'drawCountDiffers':changed_draws,
                            'differingSeedLaneNames':differing_seed_names,
                            'pathsDiffer':divergence})
    return {'status':'CONDITIONAL_ONLY_NOT_VERIFIED_OWNERSHIP',
            'assumption':'globalVariable["8915"] is a modeling proxy for numeric GetP(8915), not a confirmed inventory binding',
            'keyName':'고리의 열쇠', 'keyId':8915,
            'firstDivergenceOrder':first,
            'pathsDiffer':first is not None, 'runs':public_runs,
            'limitations':['Both branches use the same starting RNG seeds and counters',
                           'Does not model acquiring, spending, or consuming the key after initial state',
                           'Do not treat either branch as a verified future forecast without ownership evidence']}


def main() -> None:
    p=argparse.ArgumentParser(description='Conditional 고리의 열쇠 held/unheld branch comparison; no private seeds printed')
    p.add_argument('--before', type=Path, required=True)
    p.add_argument('--source-root', type=Path, required=True)
    p.add_argument('--registry', type=Path, required=True)
    p.add_argument('--schedule', required=True, help='e.g. 유씨별원,유씨별원,유씨별원')
    p.add_argument('--output', type=Path, help='Optional non-seed conditional comparison JSON. Contains predicted equipment.')
    args=p.parse_args()
    baseline=json.loads(args.before.read_text(encoding='utf-8'))
    result=run_key_sensitivity(baseline,args.source_root,args.registry,args.schedule.split(','))
    payload=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        if args.output.resolve() == args.before.resolve():
            raise ValueError('Output must not overwrite original save')
        args.output.write_text(payload, encoding='utf-8')
    else:
        print(payload)

if __name__ == '__main__':
    main()