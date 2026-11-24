"""Evidence-based possession transitions for 고리의 열쇠 (8915).

Old V78 research already reconstructed an inventory-based hypothesis and
observed 3/3 boss equipment matches. This module carries ONLY independently
confirmed inventory counts or actual receipt/consumption observations. In
particular it never interprets a persistent drop flag as another award.
"""
from __future__ import annotations
from liu_key_timeline import LIU

def _nonnegative_int(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(name + ' must be a nonnegative integer')
    return value

def ownership_timeline(schedule: list[str], evidence: dict) -> tuple[list[bool],list[dict]]:
    """Return status at each Liu entry and a privacy-safe provenance log.

    Schema:
      initialQuantity: integer confirmed by an inventory observation
      afterLiu: one object per Liu clear:
         received: integer of *confirmed received* keys (zero when observed 0)
         consumed: integer of *confirmed removed* keys
         confirmedNoOtherChange: true if no other inventory changes occurred.
    The last event is checked too; never infer an unobserved grant, and
    never use get_8915 or drop_8915_35264 to count inventory.
    """
    if not isinstance(schedule,list) or not schedule:
        raise ValueError('Schedule required')
    if not isinstance(evidence,dict):
        raise ValueError('Key evidence must be an object')
    if set(evidence) != {'initialQuantity','afterLiu'}:
        raise ValueError('Explicit initialQuantity and afterLiu required')
    quantity=_nonnegative_int(evidence['initialQuantity'],'initialQuantity')
    after=evidence['afterLiu']
    expected=sum(g==LIU for g in schedule)
    if not isinstance(after,list) or len(after)!=expected or not expected:
        raise ValueError('One confirmed inventory event per 유씨별원 clear is required')
    timeline=[]
    log=[]
    for i,event in enumerate(after,1):
        if not isinstance(event,dict) or set(event)!={'received','consumed','confirmedNoOtherChange'}:
            raise ValueError('Each clear requires received, consumed, and confirmedNoOtherChange')
        if event['confirmedNoOtherChange'] is not True:
            raise ValueError('Unobserved inventory activity: refuse to infer key ownership')
        received=_nonnegative_int(event['received'],'received')
        consumed=_nonnegative_int(event['consumed'],'consumed')
        timeline.append(quantity>0)
        if consumed>quantity+received:
            raise ValueError('Confirmed key consumption exceeds available inventory')
        next_quantity=quantity+received-consumed
        log.append({'liuClear':i,'ownedAtEntry':quantity>0,
                    'confirmedRewardCount':received,'confirmedConsumedCount':consumed,
                    'ownedAfterClear':next_quantity>0})
        quantity=next_quantity
    return timeline,log
