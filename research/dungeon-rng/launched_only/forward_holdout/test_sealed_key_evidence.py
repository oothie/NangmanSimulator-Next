import copy
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch
from sealed_equipment_holdout import seal,check,sha

class SealedKeyEvidence(unittest.TestCase):
 def setUp(self):
  self.before={'Equips':[],'Rnds':{'Sds':{'seed_lsby':100}},'globalVariable':{'win_lsby':1}}
  self.schedule=['유씨별원']
  self.ledger={'initialQuantity':0,'afterLiu':[{'received':1,'consumed':0,'confirmedNoOtherChange':True}]}
  self.captured=[]
  def fake_replay(before, source, registry, schedule, **kwargs):
   self.captured.append(kwargs)
   after=copy.deepcopy(before)
   after['Rnds']['Sds']['seed_lsby']=555
   after['globalVariable']['win_lsby']=2
   items=[{'boss':'윤무','equipmentId':None,'equipmentName':None,'grade':None},
          {'boss':'고리','equipmentId':5209,'equipmentName':'오잠보갑','grade':'백색','gradeCode':1},
          {'boss':'이뢰운','equipmentId':None,'equipmentName':None,'grade':None}]
   return after,{'runs':[{'order':1,'gate':'유씨별원','equipment':items}]}
  self.fake=types.ModuleType('mixed_gate_schedule')
  self.fake.run_order=fake_replay
 def call_seal(self,evidence):
  with patch.dict(sys.modules,{'mixed_gate_schedule':self.fake}):
   return seal(self.before,Path('.'),Path('registry'),self.schedule,nonce='ab'*32,liu_key_evidence=evidence)
 def test_confirmed_ledger_used(self):
  record,public=self.call_seal(self.ledger)
  self.assertEqual(self.captured[-1]['liu_key_ownership'],[False])
  self.assertEqual(record['liu_key_evidence_digest'],sha(self.ledger))
  self.assertEqual(record['liu_key_ownership_timeline'],[False])
  self.assertEqual(public['equipment_count'],1)
 def test_public_does_not_expose_private_key_events(self):
  _,public=self.call_seal(self.ledger)
  self.assertNotIn('liu_key',str(public))
  self.assertNotIn('received',str(public))
 def test_unverified_ledger_is_rejected(self):
  bad=copy.deepcopy(self.ledger)
  bad['afterLiu'][0]['confirmedNoOtherChange']=False
  with self.assertRaisesRegex(ValueError,'Unobserved'):
   self.call_seal(bad)
  self.assertEqual(self.captured,[])
 def test_default_preserves_previous_replay(self):
  record,_=self.call_seal(None)
  self.assertEqual(self.captured[-1],{})
  self.assertIsNone(record['liu_key_ownership_timeline'])
 def test_original_save_and_ledger_not_mutated(self):
  before=copy.deepcopy(self.before); evidence=copy.deepcopy(self.ledger)
  self.call_seal(self.ledger)
  self.assertEqual(self.before,before)
  self.assertEqual(self.ledger,evidence)
 def test_tampering_private_ledger_digest_changes_commitment(self):
  record,public=self.call_seal(self.ledger)
  record['liu_key_evidence_digest']='bad'
  after={'Equips':[],'Rnds':{'Sds':{'seed_lsby':555}},'globalVariable':{'win_lsby':2}}
  with self.assertRaisesRegex(ValueError,'modified'):
   check(after,record,public)
if __name__=='__main__': unittest.main()
