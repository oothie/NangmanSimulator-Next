#!/usr/bin/env python3
"""Compare two real saves' 8915 inventory without guessing intermediate ownership.

The key is in save['Items'], not globalVariable['8915']. 'get_8915' is
historical/statistical and must not be interpreted as current possession.
The report omits account IDs, seed values, and other private save data.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

KEY_ID = 8915


def _nonnegative(value, label):
    if type(value) is not int or value < 0:
        raise ValueError(f'{label} must be a nonnegative integer')
    return value


def key_quantity(save: dict) -> int:
    """Strictly parse 8915 stacks from actual Korean Items[{ID,Num,...}]."""
    if not isinstance(save, dict) or not isinstance(save.get('Items'), list):
        raise ValueError('Korean save Items array required')
    total = 0
    for item in save['Items']:
        if not isinstance(item, dict):
            raise ValueError('Malformed save item entry')
        if item.get('ID') == KEY_ID:
            total += _nonnegative(item.get('Num'), '8915 item Num')
    return total


def _counter(save: dict, name: str):
    state = save.get('globalVariable')
    if not isinstance(state, dict):
        raise ValueError('globalVariable missing from save')
    value = state.get(name)
    return None if value is None else _nonnegative(value, name)


def audit_save_pair(before: dict, after: dict) -> dict:
    start, end = key_quantity(before), key_quantity(after)
    get_a, get_b = _counter(before, 'get_8915'), _counter(after, 'get_8915')
    win_a, win_b = _counter(before, 'win_lsby'), _counter(after, 'win_lsby')
    if win_a is not None and win_b is not None and win_b < win_a:
        raise ValueError('win_lsby decreased; incompatible chronological saves')
    if get_a is not None and get_b is not None and get_b < get_a:
        raise ValueError('get_8915 decreased; rollback/reentry history requires manual inspection')
    get_delta = None if get_a is None or get_b is None else get_b - get_a
    clears = None if win_a is None or win_b is None else win_b - win_a
    return {
        'itemName': '고리의 열쇠',
        'startHeldQuantity': start,
        'endHeldQuantity': end,
        'inventoryDelta': end - start,
        'get8915CounterChange': get_delta,
        'liuWinCounterChange': clears,
        'intermediateOwnership': 'UNKNOWN_REQUIRES_PER_CLEAR_RECEIPT_OR_USE_RECORD',
        'reason': 'Two endpoint inventories and an acquisition counter do not establish which clear held the key',
        'noRawSaveOrRngSeeds': True,
    }


def validate_ledger_against_pair(before: dict, after: dict, schedule: list[str],
                                 evidence: dict) -> dict:
    """Reconcile externally confirmed per-clear events against actual save endpoints."""
    from liu_key_evidence_ledger import ownership_timeline
    snapshot = audit_save_pair(before, after)
    timeline, log = ownership_timeline(schedule, evidence)
    if evidence['initialQuantity'] != snapshot['startHeldQuantity']:
        raise ValueError('Ledger initial key quantity differs from the real starting save')
    expected_clears = sum(g == '유씨별원' for g in schedule)
    if snapshot['liuWinCounterChange'] is not None and snapshot['liuWinCounterChange'] != expected_clears:
        raise ValueError('Ledger schedule differs from actual Liu win-counter delta')
    final = evidence['initialQuantity'] + sum(e['received'] - e['consumed'] for e in evidence['afterLiu'])
    if final != snapshot['endHeldQuantity']:
        raise ValueError('Ledger final key quantity differs from the real ending save')
    # Historical get_8915 has not been independently proven to equal receipt
    # count across all paths; report differences but never make that assumption.
    return {'status': 'ENDPOINTS_CONSISTENT_NOT_PROOF_OF_INTERMEDIATE_HISTORY',
            'entryHeldTimeline': timeline,
            'reconciledEndQuantity': final,
            'observedHistoricalGetCountChange': snapshot['get8915CounterChange'],
            'ledgerConfirmedReceiptCount': sum(e['received'] for e in evidence['afterLiu']),
            'getCounterEqualsConfirmedReceipts': (
                None if snapshot['get8915CounterChange'] is None else
                snapshot['get8915CounterChange'] == sum(e['received'] for e in evidence['afterLiu'])),
            'noRawSaveOrRngSeeds': True}


def main():
    parser = argparse.ArgumentParser(description='Private 8915 save endpoint audit, no RNG seeds logged')
    parser.add_argument('--before', type=Path, required=True)
    parser.add_argument('--after', type=Path, required=True)
    parser.add_argument('--schedule', help='Optional ordered gate clears, for confirmed ledger reconciliation')
    parser.add_argument('--evidence', type=Path, help='Optional local confirmed key ledger')
    args = parser.parse_args()
    if bool(args.schedule) != bool(args.evidence):
        parser.error('Supply both --schedule and --evidence, or neither')
    before = json.loads(args.before.read_text(encoding='utf-8'))
    after = json.loads(args.after.read_text(encoding='utf-8'))
    result = audit_save_pair(before, after)
    if args.evidence is not None:
        evidence = json.loads(args.evidence.read_text(encoding='utf-8'))
        result['ledgerReconciliation'] = validate_ledger_against_pair(
            before, after, args.schedule.split(','), evidence)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()