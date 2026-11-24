import copy,json,unittest
from pathlib import Path
from liu_key_conditional_histories import enumerate_key_histories,compare_possible_equipment,constrain_histories

class Histories(unittest.TestCase):
 def test_one_award_one_use_three_clears(self):
  x=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
  self.assertEqual(len(x),6)
  self.assertEqual({tuple(h['atEntryHeld']) for h in x},
                   {(False,False,False),(False,True,False),(False,True,True),(False,False,True)})
 def test_cannot_receive_while_held(self):
  x=enumerate_key_histories(start_qty=1,end_qty=2,liu_clears=1,assumed_receipts=1,assumed_consumptions=0)
  self.assertEqual(x,[])
 def test_no_change_unheld(self):
  x=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=2,assumed_receipts=0,assumed_consumptions=0)
  self.assertEqual([h['atEntryHeld'] for h in x],[[False,False]])
 def test_inconsistent_endpoint_rejected(self):
  with self.assertRaisesRegex(ValueError,'reconcile'):
   enumerate_key_histories(start_qty=0,end_qty=1,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
 def test_excess_received_rejected(self):
  with self.assertRaisesRegex(ValueError,'At most'):
   enumerate_key_histories(start_qty=0,end_qty=4,liu_clears=3,assumed_receipts=4,assumed_consumptions=0)
 def test_boolean_quantities_rejected(self):
  with self.assertRaisesRegex(ValueError,'integers'):
   enumerate_key_histories(start_qty=True,end_qty=0,liu_clears=1,assumed_receipts=0,assumed_consumptions=1)
 def test_safety_cap(self):
  with self.assertRaisesRegex(ValueError,'safety cap'):
   enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1,max_histories=2)
 def test_compare_unique_timelines_and_no_seed(self):
  before={'Rnds':{'Sds':{'seed_lsby':9999}}}
  seen=[]
  def fake(state,source,registry,schedule,*,liu_key_ownership):
   seen.append(liu_key_ownership)
   return state,{'runs':[{'gate':g,'clear':i+1,
       'equipment':[{'boss':'고리','equipmentName':'오잠보갑' if any(liu_key_ownership) else None,
                     'grade':'백색' if any(liu_key_ownership) else None}],
       'seedAfter':{'seed_lsby':9999}} for i,g in enumerate(schedule)]}
  history=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
  result=compare_possible_equipment(before,Path('.'),Path('registry'),['유씨별원']*3,history,fake)
  self.assertEqual(result['historyCount'],6)
  self.assertEqual(result['uniqueEntryTimelines'],4)
  self.assertEqual(len(seen),4)
  self.assertNotIn('9999',json.dumps(result))
 def test_confirmed_second_receipt_and_third_held_narrow_to_one(self):
  histories=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
  filtered=constrain_histories(histories,confirmed_received_after={2},confirmed_held_at_entry={3})
  self.assertEqual(len(filtered),1)
  self.assertEqual(filtered[0]['atEntryHeld'],[False,False,True])
  self.assertEqual(filtered[0]['usedBeforeEndpoint'],1)
 def test_second_receipt_alone_does_not_conclude_consumption_timing(self):
  histories=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
  filtered=constrain_histories(histories,confirmed_received_after={2})
  self.assertEqual(len(filtered),2)
 def test_invalid_clear_numbers_rejected(self):
  histories=enumerate_key_histories(start_qty=0,end_qty=0,liu_clears=3,assumed_receipts=1,assumed_consumptions=1)
  with self.assertRaisesRegex(ValueError,'exceeds'):
   constrain_histories(histories,confirmed_held_at_entry={4})
 def test_missing_model_run_rejected(self):
  history=[{'atEntryHeld':[False]}]
  def fake(*args,**kwargs):return {},{'runs':[]}
  with self.assertRaisesRegex(ValueError,'Incomplete'):
   compare_possible_equipment({},Path('.'),Path('.'),['유씨별원'],history,fake)
 def test_bad_history_rejected(self):
  with self.assertRaisesRegex(ValueError,'Invalid'):
   compare_possible_equipment({},Path('.'),Path('.'),['유씨별원'],[{'atEntryHeld':[]}],lambda *a,**k:None)
if __name__=='__main__':unittest.main()