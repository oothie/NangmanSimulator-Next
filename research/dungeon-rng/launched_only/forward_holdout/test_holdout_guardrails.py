import unittest,copy
from sealed_equipment_holdout import check,sha

class Guardrails(unittest.TestCase):
 def setUp(self):
  self.old={'11':(5009,2)}
  self.record={'schema':'nangman.released4.equipment.holdout.v1', 'schedule':['유씨별원'],
    'start_inventory_ids':['11'], 'start_inventory_fingerprint':sha(self.old),
    'expected_equipment':[[4009,1]], 'expected_end_seeds':{'seed_lsby':99},
    'expected_win_counters':{'win_lsby':2}, 'constraints':[]}
  self.public={'schema':'nangman.released4.equipment.commitment.v1'}
  self.public['sealed_sha256']=sha(self.record)
  self.after={'Equips':[{'OnlyID':11,'ID':5009,'Color':2},{'OnlyID':12,'ID':4009,'Color':1}],
    'Rnds':{'Sds':{'seed_lsby':99}},'globalVariable':{'win_lsby':2}}
 def test_exact_strict_pass(self):
  self.assertEqual(check(self.after,self.record,self.public)['status'],'PASS')
 def test_diagnostic_mode_never_passes(self):
  self.assertEqual(check(self.after,self.record,self.public,accept_extra=True)['status'],'INCONCLUSIVE_DIAGNOSTIC_MODE')
 def test_replaced_baseline_never_passes(self):
  state=copy.deepcopy(self.after);state['Equips'][0]['Color']=3
  x=check(state,self.record,self.public)
  self.assertEqual(x['status'],'INCONCLUSIVE_BASELINE_CHANGED')
  self.assertTrue(x['baseline_equipment_changed'])
 def test_deleted_baseline_never_passes(self):
  state=copy.deepcopy(self.after);state['Equips']=state['Equips'][1:]
  self.assertEqual(check(state,self.record,self.public)['status'],'INCONCLUSIVE_MISSING_BASELINE')
 def test_wrong_item_fails(self):
  state=copy.deepcopy(self.after);state['Equips'][1]['Color']=2
  self.assertEqual(check(state,self.record,self.public)['status'],'FAIL')
 def test_seed_mismatch_fails(self):
  state=copy.deepcopy(self.after);state['Rnds']['Sds']['seed_lsby']=98
  self.assertEqual(check(state,self.record,self.public)['status'],'FAIL')
if __name__=='__main__':unittest.main()
