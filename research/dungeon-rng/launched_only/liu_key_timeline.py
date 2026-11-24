"""Explicit, source-constrained 8915 (고리의 열쇠) ownership timeline.

The recovered 35271_1.lua uses numeric GetP(8915), while get_8915 is a
separate historical award counter. These helpers deliberately DO NOT infer
inventory ownership from an award flag, get_8915, or RNG results.
"""
from __future__ import annotations

KEY = '8915'
LIU = '유씨별원'


def validate_key_timeline(schedule: list[str], timeline: list[bool] | None) -> int:
    """Require evidence-provided ownership for every Liu clear, if enabled."""
    if not isinstance(schedule, list) or not schedule:
        raise ValueError('The gate schedule must not be empty')
    count = sum(g == LIU for g in schedule)
    if timeline is None:
        return count
    if not isinstance(timeline, list) or len(timeline) != count:
        raise ValueError('Key timeline must specify one status per 유씨별원 clear')
    if any(type(v) is not bool for v in timeline):
        raise ValueError('Every key status must be explicitly true/false')
    if count == 0:
        raise ValueError('Key ownership timeline requires 유씨별원')
    return count


def set_key_before_liu(state: dict, timeline: list[bool] | None,
                       clear_number: int) -> bool | None:
    """Set the modeling proxy before a Liu clear, never mutate raw save input."""
    if timeline is None:
        return None
    if not 1 <= clear_number <= len(timeline):
        raise ValueError('Liu clear index is out of the supplied timeline')
    value = timeline[clear_number - 1]
    if type(value) is not bool:
        raise ValueError('The 8915 ownership proxy must be a boolean')
    state.setdefault('globalVariable', {})[KEY] = int(value)
    return value


def parse_cli_timeline(text: str | None) -> list[bool] | None:
    """Accepted format: held,unheld,held; no UNKNOWN silently treated as zero."""
    if text is None:
        return None
    tokens = text.split(',')
    terms = {'held': True, 'unheld': False}
    if not tokens or any(t not in terms for t in tokens):
        raise ValueError('Use comma-separated held,unheld for each 유씨별원 clear')
    return [terms[t] for t in tokens]
