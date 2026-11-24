#!/usr/bin/env python3
"""Tamper-evident prospective validation for four released gate equipment RNG.

Forecast is computed once, before gameplay. The private sealed forecast must remain
unchanged and is never intended for public GitHub. A public commitment contains no
RNG seeds, account IDs, inventory identifiers, item list, or private save payloads.

Verification consumes the existing sealed result, not a newly calculated forecast.
"""
from __future__ import annotations
import argparse, hashlib, json, secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

GATES = ('연왕부', '창옥', '벽유교', '유씨별원')
ID_SET = frozenset((4009,4209,4409,4609,4809,5009,5209,5409,5609))
SEEDS = {
    '연왕부': ('seed_33654','seed_33653','seed_33652','seed_33650'),
    '창옥': ('seed_dcy_40372','seed_dcy_40373','seed_dcy_40374'),
    '벽유교': ('seed_byj',),
    '유씨별원': ('seed_lsby',),
}
WIN_KEYS = {'연왕부':'win_ywf', '창옥':'win_dcy', '벽유교':'win_byj', '유씨별원':'win_lsby'}


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def sha(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def inventory(save: dict) -> dict[str, tuple[int,int]]:
    """By OnlyID, standard 90-grade items only; duplicate ID fails closed."""
    ret = {}
    for e in save.get('Equips', []):
        if not isinstance(e, dict) or e.get('ID') not in ID_SET:
            continue
        k = str(e.get('OnlyID'))
        if e.get('OnlyID') is None or k in ret:
            raise ValueError('Invalid or duplicate equipment OnlyID')
        if not isinstance(e.get('Color'), int):
            raise ValueError('Equipment color absent for '+k)
        ret[k] = (int(e['ID']), int(e['Color']))
    return ret


def validate_schedule(schedule: list[str]) -> None:
    if not isinstance(schedule,list) or not 1 <= len(schedule) <= 40:
        raise ValueError('Only 1..40 gate clears can be sealed')
    if any(g not in GATES for g in schedule):
        raise ValueError('Only the four released gates may be sealed')


GATE_BOSS_COUNTS = {'연왕부': 4, '창옥': 3, '벽유교': 3, '유씨별원': 3}
GRADE_NAMES = {1: '백색', 2: '녹색', 3: '청색', 4: '자색'}


def validate_forecast_runs(runs: list[dict], schedule: list[str]) -> None:
    """Refuse to seal malformed/incomplete boss or localized equipment outputs."""
    validate_schedule(schedule)
    if not isinstance(runs, list) or len(runs) != len(schedule):
        raise ValueError('Incomplete ordered released-gate forecast')
    for index, (run, gate) in enumerate(zip(runs, schedule), 1):
        if run.get('order') != index or run.get('gate') != gate:
            raise ValueError('Forecast gate order differs from requested order')
        equipment = run.get('equipment')
        if not isinstance(equipment, list) or len(equipment) != GATE_BOSS_COUNTS[gate]:
            raise ValueError('Forecast missing source boss entries for ' + gate)
        seen = set()
        for item in equipment:
            boss = item.get('boss')
            if not isinstance(boss, str) or not boss or boss in seen:
                raise ValueError('Missing or duplicated Korean boss name')
            seen.add(boss)
            eid = item.get('equipmentId')
            if eid is None:
                if item.get('equipmentName') is not None or item.get('grade') is not None:
                    raise ValueError('No-drop source contains inconsistent equipment')
            else:
                code = item.get('gradeCode')
                if not isinstance(eid, int) or isinstance(eid, bool) or eid not in ID_SET:
                    raise ValueError('Unrecognized 90-grade general equipment ID')
                if not isinstance(code, int) or isinstance(code, bool) or code not in GRADE_NAMES:
                    raise ValueError('Invalid equipment color code')
                if item.get('grade') != GRADE_NAMES[code]:
                    raise ValueError('Color code and Korean grade disagree')
                if not isinstance(item.get('equipmentName'), str) or not item['equipmentName'].strip():
                    raise ValueError('Korean equipment name missing; cannot seal numeric-only item')

def seal(before: dict, source_root: Path, registry: Path,
         schedule: list[str], *, nonce: str|None=None,
         liu_key_evidence:dict|None=None) -> tuple[dict, dict]:
    validate_schedule(schedule)
    from mixed_gate_schedule import run_order
    from liu_key_evidence_ledger import ownership_timeline
    timeline = None
    if liu_key_evidence is not None:
        timeline, _ = ownership_timeline(schedule, liu_key_evidence)
    after_model, result = run_order(before, source_root, registry, schedule,
                                    **({'liu_key_ownership':timeline} if timeline is not None else {}))
    validate_forecast_runs(result['runs'], schedule)
    expected = []
    boss_forecast = []
    for run in result['runs']:
        for item in run['equipment']:
            boss_forecast.append({'order':run['order'], 'gate':run['gate'],
                                  'boss':item['boss'], 'equipmentName':item['equipmentName'],
                                  'grade':item['grade'], 'equipmentId':item['equipmentId'],
                                  'gradeCode':item.get('gradeCode')})
            if item['equipmentId'] is not None:
                expected.append([int(item['equipmentId']), int(item['gradeCode'])])
    seed_keys = sorted({k for gate in schedule for k in SEEDS[gate]})
    expected_seeds = {key: after_model['Rnds']['Sds'][key] for key in seed_keys}
    win_keys = sorted({WIN_KEYS[gate] for gate in schedule})
    wins = {key: after_model['globalVariable'][key] for key in win_keys}
    start_items = inventory(before)
    record = {
        'schema': 'nangman.released4.equipment.holdout.v1',
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'schedule': list(schedule),
        'start_inventory_ids': sorted(start_items),
        'start_inventory_fingerprint': sha(start_items),
        'expected_equipment': expected,
        'expected_boss_equipment': boss_forecast,
        'liu_key_evidence_digest': sha(liu_key_evidence) if liu_key_evidence is not None else None,
        'liu_key_ownership_timeline': timeline,
        'expected_end_seeds': expected_seeds,
        'expected_win_counters': wins,
        'starting_save_digest': hashlib.sha256(canonical(before)).hexdigest(),
        'nonce': nonce or secrets.token_hex(32),
        'constraints': [
            'Only 4 released gates in exactly the sealed sequence',
            'No extra activities that consume these gate RNG lanes',
            'Do not sell/dismantle newly dropped items before saving the after-state',
            'Unsupported special RNG branch changes invalidate rather than silently match',
        ],
    }
    public = {
        'schema': 'nangman.released4.equipment.commitment.v1',
        'created_utc': record['created_utc'],
        'gate_count': len(schedule),
        'equipment_count': len(expected),
        'sealed_sha256': sha(record),
        'status': 'COMMITTED_BEFORE_PLAY — no gameplay observation included',
    }
    return record, public


def render_private_forecast(record: dict) -> str:
    """Local Korean-language per-boss forecast, with no seed or account data."""
    rows = []
    for item in record.get('expected_boss_equipment', []):
        name = item.get('equipmentName') or '미드랍'
        grade = item.get('grade') or ''
        rows.append(f"{item['order']}회차 · {item['gate']} · {item['boss']} — {name} {grade}".rstrip())
    return '\n'.join(rows)

def check(after: dict, record: dict, public: dict, *, accept_extra: bool=False) -> dict:
    """Never recompute or refit the recorded forecast using after-state."""
    if record.get('schema') != 'nangman.released4.equipment.holdout.v1' or public.get('schema') != 'nangman.released4.equipment.commitment.v1':
        raise ValueError('Unsupported commitment schema')
    validate_schedule(record['schedule'])
    if sha(record) != public.get('sealed_sha256'):
        raise ValueError('Sealed forecast was modified after commitment')
    old_ids = record['start_inventory_ids']
    if len(set(old_ids)) != len(old_ids):
        raise ValueError('Baseline inventory identifiers must be unique')
    now = inventory(after)
    prior = set(old_ids)
    # No inference from new equipment ID alone: only true OnlyID additions.
    added = [v for key,v in sorted(now.items(),key=lambda x:int(x[0])) if key not in prior]
    deleted_baseline = sum(k not in now for k in old_ids)
    baseline_changed = (deleted_baseline == 0 and
                        sha({k:now[k] for k in old_ids}) != record['start_inventory_fingerprint'])
    expected = [tuple(x) for x in record['expected_equipment']]
    rng_actual = after.get('Rnds',{}).get('Sds',{})
    seed_results = {k:(rng_actual.get(k)==v) for k,v in record['expected_end_seeds'].items()}
    state = after.get('globalVariable',{})
    win_results = {k:(state.get(k)==v) for k,v in record['expected_win_counters'].items()}
    # Default strict validation is exact: unexplained extra equipment cannot be ignored.
    if accept_extra:
        # Diagnostic only, deliberately NOT marked as a passing prospective test.
        equip_match = (len(added)>=len(expected) and added[:len(expected)]==expected)
    else:
        equip_match = added==expected
    missing = deleted_baseline > 0
    result = {
        'status': ('INCONCLUSIVE_EXTRA_EQUIPMENT' if accept_extra and len(added)!=len(expected)
                   else 'INCONCLUSIVE_MISSING_BASELINE' if missing
                   else 'INCONCLUSIVE_BASELINE_CHANGED' if baseline_changed
                   else 'INCONCLUSIVE_DIAGNOSTIC_MODE' if accept_extra
                   else 'PASS' if equip_match and all(seed_results.values()) and all(win_results.values())
                   else 'FAIL'),
        'strict_equipment_match': added == expected,
        'diagnostic_equipment_prefix_match': equip_match if accept_extra else None,
        'predicted_count': len(expected),
        'observed_new_90_gear_count': len(added),
        'missing_baseline_items': deleted_baseline,
        'baseline_equipment_changed': baseline_changed,
        'seed_lanes_matched': sum(seed_results.values()),
        'seed_lanes_checked': len(seed_results),
        'win_counters_matched': sum(win_results.values()),
        'win_counters_checked': len(win_results),
        'individual_seed_matches': seed_results,
        'individual_win_matches': win_results,
        'sealed_sha256': public['sealed_sha256'],
        'constraints': record['constraints'],
    }
    return result


def main() -> None:
    import sys
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
    from private_file_guard import assert_output_paths_safe
    p=argparse.ArgumentParser(description='Seal before gameplay, verify after gameplay; private saves never uploaded')
    sub=p.add_subparsers(dest='mode',required=True)
    create=sub.add_parser('seal'); create.add_argument('--before',type=Path,required=True)
    create.add_argument('--source-root',type=Path,required=True)
    create.add_argument('--registry',type=Path,required=True)
    create.add_argument('--schedule',required=True)
    create.add_argument('--private-record',type=Path,required=True)
    create.add_argument('--public-commitment',type=Path,required=True)
    create.add_argument('--show-forecast',action='store_true',help='Print local boss names/equipment/colors, never RNG seeds')
    create.add_argument('--liu-key-evidence',type=Path,help='Private JSON of confirmed key inventory receipt/use events')
    verify=sub.add_parser('verify');verify.add_argument('--after',type=Path,required=True)
    verify.add_argument('--private-record',type=Path,required=True)
    verify.add_argument('--public-commitment',type=Path,required=True)
    verify.add_argument('--out',type=Path,required=True)
    verify.add_argument('--diagnose-extra',action='store_true')
    a=p.parse_args()
    if a.mode=='seal':
        baseline=json.loads(a.before.read_text())
        evidence=(json.loads(a.liu_key_evidence.read_text(encoding='utf-8'))
                  if a.liu_key_evidence is not None else None)
        record,public=seal(baseline,a.source_root,a.registry,a.schedule.split(','),
                           liu_key_evidence=evidence)
        assert_output_paths_safe([a.private_record,a.public_commitment],
                                 [a.before,a.registry,a.source_root,a.liu_key_evidence])
        a.private_record.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
        a.public_commitment.write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n')
        print('SEALED',public['sealed_sha256'],'gates',public['gate_count'],'gear',public['equipment_count'])
        if a.show_forecast: print(render_private_forecast(record))
    else:
        record=json.loads(a.private_record.read_text());public=json.loads(a.public_commitment.read_text());after=json.loads(a.after.read_text())
        result=check(after,record,public,accept_extra=a.diagnose_extra)
        assert_output_paths_safe([a.out],[a.after,a.private_record,a.public_commitment])
        a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print(result['status'],'equipment',result['strict_equipment_match'],'seeds',result['seed_lanes_matched'],'/',result['seed_lanes_checked'])

if __name__=='__main__':main()