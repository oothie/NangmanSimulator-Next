import unittest
from sealed_equipment_holdout import check,sha

class TimeLeakage(unittest.TestCase):
 def setUp(self):
  self.after={'Equips':[{'OnlyID':3,'ID':5209,'Color':1}],
              'Rnds':{'Sds':{'seed_lsby':33}},'globalVariable':{'win_lsby':7}}
  self.record={'schema':'nangman.released4.equipment.holdout.v1',
   'schedule':['유씨별원'],'start_inventory_ids':[],'start_inventory_fingerprint':sha({}),
   'expected_equipment':[[5209,1]],'expected_end_seeds':{'seed_lsby':33},
   'expected_win_counters':{'win_lsby':7},'constraints':[]}
  self.public={'schema':'nangman.released4.equipment.commitment.v1'}
 def check(self):
  self.public['sealed_sha256']=sha(self.record)
  return check(self.after,self.record,self.public)
 def test_new_retrospective_never_passes(self):
  self.record['evidence_temporality']='RETROSPECTIVE_CONFIRMED_AFTER_CLEAR'
  self.record['liu_key_evidence_digest']='a'*64
  self.assertEqual(self.check()['status'],'INCONCLUSIVE_RETROSPECTIVE_EVIDENCE')
 def test_old_record_with_evidence_never_passes(self):
  self.record['liu_key_evidence_digest']='a'*64
  self.assertEqual(self.check()['status'],'INCONCLUSIVE_RETROSPECTIVE_EVIDENCE')
 def test_no_postclear_evidence_synthetic_pass_unchanged(self):
  self.record['evidence_temporality']='NO_POST_CLEAR_EVIDENCE_USED'
  self.assertEqual(self.check()['status'],'PASS')
 def test_wrong_equipment_not_marked_pass_even_retrospective(self):
  self.record['liu_key_evidence_digest']='a'*64
  self.after['Equips'][0]['Color']=3
  self.assertNotEqual(self.check()['status'],'PASS')
 def test_retrospective_diagnostic_never_passes(self):
  self.record['liu_key_evidence_digest']='a'*64
  self.public['sealed_sha256']=sha(self.record)
  self.assertNotEqual(check(self.after,self.record,self.public,accept_extra=True)['status'],'PASS')
if __name__=='__main__':unittest.main()
