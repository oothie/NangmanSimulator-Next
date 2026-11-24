import unittest,sys,pathlib
HERE=pathlib.Path(__file__).parent;sys.path.insert(0,str(HERE))
from byj_material_lifecycle import trace_lifecycle
from byj_original_material_consumer import source_audit
class MaterialLife(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=pathlib.Path('/mnt/data/dungeon_native/source_original');sys.path[:0]=[str(p/'decoder/selected'),str(p/'decoder/source')]
  from audit_uploaded_whales import whale_extract,decrypt,inner_decode
  from parse_sb3_tables import parse,emulate
  b,_=whale_extract(p/'wapp__story__fun.whale',2150);dec,_,_=inner_decode(decrypt(b));t,_=emulate(parse(dec));cls.registry=source_audit(t)
 def test_entry_cannot_imply_rescue(self):
  s={'globalVariable':{'first_rdward':0}}
  r=trace_lifecycle(s,self.registry)
  self.assertTrue(r['materialPrestage']['initialized']);self.assertEqual(r['rescue']['groups'],[])
 def test_unknown_reward_blocks_exit(self):
  s={'globalVariable':{'first_rdward':0}}
  r=trace_lifecycle(s,self.registry,rescue_executed=True,exit_completed=True)
  self.assertEqual(r['exit']['status'],'blocked-pending-unknown-rescue-selection')
 def test_selected_outcomes_cannot_appear_out_of_thin_air(self):
  s={'globalVariable':{'first_rdward':0}}
  r=trace_lifecycle(s,self.registry,selected={1:5,2:9},rescue_executed=True,exit_completed=True)
  self.assertEqual([(x['itemId'],x['rewardQuantity'],x['counterDelta']) for x in r['rescueEffects']],[(2605,2,5),(2021,1,1)])
  self.assertEqual(r['exit']['status'],'eligible-conditional-exit');self.assertEqual(r['exit']['grants'],[])
 def test_cap_pruning_changes_candidates(self):
  s={'globalVariable':{'first_rdward':0,'num_2601_byj':1000}}
  r=trace_lifecycle(s,self.registry,rescue_executed=True)
  keys=[c['index'] for c in r['rescue']['groups'][0]['candidates']]
  self.assertNotIn(1,keys)
 def test_empty_fallback_requires_exit(self):
  s={'globalVariable':{'first_rdward':1,'glm_reward':1}}
  r=trace_lifecycle(s,self.registry,exit_completed=True)
  self.assertEqual([x['itemId'] for x in r['exit']['grants']],[3025,3035])
if __name__=='__main__':unittest.main()