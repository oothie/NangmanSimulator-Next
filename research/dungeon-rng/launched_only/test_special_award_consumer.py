import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path[:0]=[str(ROOT),str(ROOT.parent/'v140/v30'),str(ROOT.parent/'v140/v30/models/liu'),str(ROOT.parent/'v140/v30/models/ywf'),str(ROOT.parent/'v140/v30/models/byj'),str(ROOT.parent/'v140/v30/models/dcy')]
from special_award_consumer import extract,whatif,eligible
from ywf_33381_replay_v29 import replay as replay_ywf
from experimental_four_gate_engine import report_liu
V177=Path('/mnt/data/files/60014_GATE_9MODES_PRIOR_RECOVERY_V177_20261012.zip')
L=ROOT.parent/'source_original'
S=ROOT.parent/'private_saves'
class SpecialConsumerTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.db=extract(V177,L);cls.s=json.loads((S/'1124.json').read_text());cls.a=json.loads((S/'1123(입장전).json').read_text())
 def test_all_released_awards_source(self):
  self.assertEqual(len(self.db['sources']),15)
  self.assertEqual(len(self.db['awards']),40)
  self.assertEqual({gate:sum(r['gate']==gate for r in self.db['awards']) for gate in ['연왕부','창옥','벽유교','유씨별원']}, {'연왕부':12,'창옥':12,'벽유교':9,'유씨별원':7})
  self.assertTrue(all(r['name'].lower().endswith('.sbc') for r in self.db['sources']))
 def test_counterfactual_claimed_state(self):
  rows=whatif(self.db,self.s)
  self.assertEqual(sum(r['claimCountCurrentEligible'] is False for r in rows),35)
  self.assertEqual(sum(r['claimCountZeroEligible'] is True for r in rows),39)
  self.assertEqual(sum(r['doesChangingClaimCountAffectConsumer'] for r in rows),35)
  self.assertEqual(sum(r['claimCountCurrentEligible'] is None for r in rows),1)
 def test_expected_special_caps(self):
  by={(r['npc'],r['item']):r for r in self.db['awards']}
  self.assertEqual((by[40373,2926]['countKey'],by[40373,2926]['cap']),('get_2926',10))
  self.assertEqual((by[33653,2921]['countKey'],by[33653,2921]['cap']),('get_2921',15))
  self.assertEqual((by[35219,7264]['countKey'],by[35219,7264]['cap']),('get_7264',0))
  self.assertIsNone(by[35264,8915]['cap'])
  self.assertEqual(by[35260,8801]['countScope'],'temp')
 def test_reward_count_does_not_change_source_producer_weights(self):
  models=ROOT.parent/'v140/v30';paths=[models/'33381_1_record1910.reconstructed.json',models/'models/dcy/40389_1.lua.reconstructed.json',models/'models/byj/35227_1.lua.reconstructed.json',models/'models/liu/35271_1.lua.reconstructed.json']
  for p in paths:
   self.assertNotRegex(p.read_text(),r"GetP\('get_\d+",p.name)
 def test_ywf_previous_drop_flag_is_not_ownership(self):
  t=copy.deepcopy(self.a)
  keys=['drop_2364_33654','drop_2364_33653','drop_4422_33653','drop_2364_33652','drop_5618_33652','drop_2364_33650','drop_7081_33650','drop_5422_33650']
  for k in keys:t['globalVariable'][k]=0 if self.a['globalVariable'].get(k) else 1
  original=replay_ywf(self.a);flip=replay_ywf(t)
  self.assertEqual(original['trace'],flip['trace']);self.assertEqual(original['seeds'],flip['seeds']);self.assertEqual(original['bosses'],flip['bosses'])
  self.assertNotEqual({k:original['global_state'].get(k) for k in keys},{k:flip['global_state'].get(k) for k in keys})
 def test_liu_numeric_getp_8915_changes_sequence(self):
  alternative=copy.deepcopy(self.a);alternative['globalVariable']['8915']=1
  _,a=report_liu(self.a,1);_,b=report_liu(alternative,1)
  self.assertNotEqual(a['seed_after'],b['seed_after'])
  self.assertNotEqual([(k,v['slot'],v['grade']) for k,v in a['bosses'].items()],[(k,v['slot'],v['grade']) for k,v in b['bosses'].items()])
  self.assertTrue(any(x['name']=='고리 전용 8915' for x in a['trace']))
  self.assertFalse(any(x['name']=='고리 전용 8915' for x in b['trace']))
 def test_no_unreleased_gate_contamination(self):
  self.assertEqual({r['gate'] for r in self.db['awards']},{'연왕부','창옥','벽유교','유씨별원'})
if __name__=='__main__':unittest.main(verbosity=2)