import copy
import unittest
from liu_key_consumer_contract import original_key_rule,evaluate_key_consumer,audit_confirmed_key_ledger

RULE={'schema':'special-consumer-v1','awards':[{
    'gate':'유씨별원','script':'lsby_boss3.recovered.sbc','npc':35264,
    'item':8915,'quantity':1,'flag':'drop_8915_35264',
    'flagCondition':'== 1','countKey':None,
    'consumerCondition':"GetP('drop_8915_35264') == 1"}]}

class ConsumerTests(unittest.TestCase):
 def setUp(self):
  self.registry=copy.deepcopy(RULE)
 def test_original_rule(self):
  self.assertEqual(original_key_rule(self.registry)['requiredFlagValue'],1)
 def test_old_flag_cannot_be_auto_credited(self):
  got=evaluate_key_consumer(self.registry,current_flag=1,new_roll_confirmed=False,consumer_delivered=None)
  self.assertEqual(got['creditedInventoryCount'],0)
 def test_new_roll_alone_not_received(self):
  got=evaluate_key_consumer(self.registry,current_flag=1,new_roll_confirmed=True,consumer_delivered=None)
  self.assertEqual(got['status'],'POSSIBLE_AWARD_UNCONFIRMED')
  self.assertEqual(got['creditedInventoryCount'],0)
 def test_observed_consumer_receipt(self):
  got=evaluate_key_consumer(self.registry,current_flag=1,new_roll_confirmed=True,consumer_delivered=True)
  self.assertEqual(got['creditedInventoryCount'],1)
 def test_impossible_receipt_rejected(self):
  with self.assertRaisesRegex(ValueError,'conflicts'):
   evaluate_key_consumer(self.registry,current_flag=0,new_roll_confirmed=True,consumer_delivered=True)
 def test_stale_receipt_rejected(self):
  with self.assertRaisesRegex(ValueError,'conflicts'):
   evaluate_key_consumer(self.registry,current_flag=1,new_roll_confirmed=False,consumer_delivered=True)
 def test_stale_flag_not_assumed_award(self):
  got=evaluate_key_consumer(self.registry,current_flag=2,new_roll_confirmed=True,consumer_delivered=False)
  self.assertEqual(got['creditedInventoryCount'],0)
 def test_original_metadata_modified_rejected(self):
  self.registry['awards'][0]['quantity']=2
  with self.assertRaisesRegex(ValueError,'mismatch'):
   original_key_rule(self.registry)
 def test_duplicate_original_award_rejected(self):
  self.registry['awards'].append(copy.deepcopy(self.registry['awards'][0]))
  with self.assertRaisesRegex(ValueError,'Exactly one'):
   original_key_rule(self.registry)
 def test_boolean_as_flag_rejected(self):
  with self.assertRaisesRegex(ValueError,'integer'):
   evaluate_key_consumer(self.registry,current_flag=True,new_roll_confirmed=True,consumer_delivered=False)
 def test_verified_three_clear_carryover(self):
  schedule=['유씨별원','창옥','유씨별원','유씨별원']
  evidence={'initialQuantity':0,'afterLiu':[
   {'received':0,'consumed':0,'confirmedNoOtherChange':True},
   {'received':1,'consumed':0,'confirmedNoOtherChange':True},
   {'received':0,'consumed':0,'confirmedNoOtherChange':True}]}
  trace=[{'freshRollObserved':True,'flagAtConsumer':0,'deliveryObserved':False},
         {'freshRollObserved':True,'flagAtConsumer':1,'deliveryObserved':True},
         {'freshRollObserved':False,'flagAtConsumer':1,'deliveryObserved':False}]
  timeline,log=audit_confirmed_key_ledger(schedule,evidence,self.registry,trace)
  self.assertEqual(timeline,[False,False,True])
  self.assertEqual(log[1]['consumerStatus'],'CONFIRMED_DELIVERY')
 def test_missing_consumer_evidence_rejected(self):
  evidence={'initialQuantity':0,'afterLiu':[{'received':0,'consumed':0,'confirmedNoOtherChange':True}]}
  with self.assertRaisesRegex(ValueError,'trace'):
   audit_confirmed_key_ledger(['유씨별원'],evidence,self.registry,[])
 def test_consumption_cannot_be_forged_by_flag(self):
  evidence={'initialQuantity':1,'afterLiu':[{'received':1,'consumed':0,'confirmedNoOtherChange':True}]}
  trace=[{'freshRollObserved':False,'flagAtConsumer':1,'deliveryObserved':False}]
  with self.assertRaisesRegex(ValueError,'disagrees'):
   audit_confirmed_key_ledger(['유씨별원'],evidence,self.registry,trace)
 def test_unknown_delivery_is_not_assumed_false(self):
  evidence={'initialQuantity':0,'afterLiu':[{'received':0,'consumed':0,'confirmedNoOtherChange':True}]}
  trace=[{'freshRollObserved':True,'flagAtConsumer':1,'deliveryObserved':None}]
  with self.assertRaisesRegex(ValueError,'Unknown reward'):
   audit_confirmed_key_ledger(['유씨별원'],evidence,self.registry,trace)

if __name__=='__main__':unittest.main()
