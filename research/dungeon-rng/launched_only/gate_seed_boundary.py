"""Fail-closed guard against cross-gate RNG lane mutations in mixed replay.

This checks only the nine source-grounded released-gate producer seeds. It does
not assert that other game RNG lanes are independent of dungeon rewards.
"""
from __future__ import annotations

GATE_SEEDS = {
    '연왕부': frozenset(('seed_33654', 'seed_33653', 'seed_33652', 'seed_33650')),
    '창옥': frozenset(('seed_dcy_40372', 'seed_dcy_40373', 'seed_dcy_40374')),
    '벽유교': frozenset(('seed_byj',)),
    '유씨별원': frozenset(('seed_lsby',)),
}
ALL_GATES = frozenset().union(*GATE_SEEDS.values())


def audit_gate_seed_transition(before: dict, after: dict, gate: str, producer_seeds: dict) -> dict:
    """Check the simulated state at the boundary of one cleared gate.

    Report only the *names* of changed lanes, never values from a private save.
    Reject undeclared or missing producer keys and any unexpected gate-lane
    changes. Leave non-gate RNG domains outside this narrowly scoped assertion.
    """
    if gate not in GATE_SEEDS:
        raise ValueError('Only Korean-server released gates are supported')
    expected = GATE_SEEDS[gate]
    if set(producer_seeds) != expected:
        raise ValueError('Producer seed key mismatch for ' + gate)
    old = before.get('Rnds', {}).get('Sds', {})
    new = after.get('Rnds', {}).get('Sds', {})
    if any(key not in old or key not in new for key in ALL_GATES):
        raise ValueError('Missing released gate RNG lane in save or replay')
    if any(isinstance(old[key], bool) or not isinstance(old[key], int) or
           isinstance(new[key], bool) or not isinstance(new[key], int)
           for key in ALL_GATES):
        raise ValueError('Released gate RNG lanes require integer seeds')
    if any(new[key] != val for key, val in producer_seeds.items()):
        raise ValueError('Producer seed and simulated next-state seed disagree')
    changed = {key for key in ALL_GATES if old[key] != new[key]}
    extra = changed - expected
    if extra:
        raise ValueError('Unexpected other-gate RNG mutation: ' + ', '.join(sorted(extra)))
    return {'expectedGateSeedLanes': sorted(expected),
            'changedGateSeedLanes': sorted(changed),
            'unchangedExpectedLanes': sorted(expected - changed),
            'unexpectedCrossGateLanes': []}
