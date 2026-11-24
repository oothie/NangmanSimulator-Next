"""Original 8915 reward-consumer metadata contract for the released Liu gate.

Contract proves only that the recovered reward consumer *permits* payout
when the flag equals 1; it does not prove battle victory, transaction commit,
inventory delivery, or future 8915 acquisition. Do not infer from old flags.
"""
from __future__ import annotations

KEY_ITEM=8915
KEY_NPC=35264
KEY_FLAG='drop_8915_35264'

def original_key_rule(registry: dict) -> dict:
    if not isinstance(registry,dict) or registry.get('schema')!='special-consumer-v1':
        raise ValueError('Original source consumer registry/schema is missing')
    awards=registry.get('awards')
    if not isinstance(awards,list):
        raise ValueError('Original consumer awards missing')
    matches=[r for r in awards if isinstance(r,dict) and r.get('gate')=='유씨별원'
             and r.get('npc')==KEY_NPC and r.get('item')==KEY_ITEM]
    if len(matches)!=1:
        raise ValueError('Exactly one original 8915 consumer award is required')
    r=matches[0]
    required={'script':'lsby_boss3.recovered.sbc','quantity':1,'flag':KEY_FLAG,
              'flagCondition':'== 1','countKey':None,'consumerCondition':"GetP('drop_8915_35264') == 1"}
    for key,value in required.items():
        if r.get(key)!=value:
            raise ValueError('Original 8915 consumer condition mismatch: '+key)
    return {'item':'고리의 열쇠','itemId':KEY_ITEM,'npc':KEY_NPC,
            'flag':KEY_FLAG,'requiredFlagValue':1,'quantityPerDelivery':1,
            'eligibilityOnly':True,'noPayoutCounterLimit':True}

def evaluate_key_consumer(registry:dict, *, current_flag:int,
                          new_roll_confirmed:bool, consumer_delivered:bool|None) -> dict:
    """Conservative evidence classification. No state mutations."""
    rule=original_key_rule(registry)
    if type(current_flag) is not int:
        raise ValueError('Consumer flag must be an integer')
    if type(new_roll_confirmed) is not bool:
        raise ValueError('Fresh producer roll evidence must be boolean')
    if consumer_delivered is not None and type(consumer_delivered) is not bool:
        raise ValueError('Delivery evidence must be boolean or unknown')
    eligible=current_flag==1
    if consumer_delivered is True and (not eligible or not new_roll_confirmed):
        raise ValueError('Receipt evidence conflicts with fresh 8915 producer/consumer contract')
    status=('CONFIRMED_DELIVERY' if consumer_delivered is True
            else 'CONFIRMED_NO_DELIVERY' if consumer_delivered is False
            else 'POSSIBLE_AWARD_UNCONFIRMED' if eligible and new_roll_confirmed
            else 'NOT_CONFIRMED')
    return {**rule,'eligibleByOriginalFlag':eligible,
            'freshProducerRollConfirmed':new_roll_confirmed,
            'status':status,
            'creditedInventoryCount':rule['quantityPerDelivery'] if status=='CONFIRMED_DELIVERY' else 0,
            'note':'Flag 1 and fresh roll do not establish receipt without consumer delivery evidence'}
