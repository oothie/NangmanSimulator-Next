import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from released_special_state_compare import compare
PRIVATE=ROOT.parent/'private_saves/1124.json'
class ReleasedSpecialComparisonTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.s=json.loads(PRIVATE.read_text());cls.db=json.loads((ROOT/'SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json').read_text());cls.mat=json.loads((ROOT/'MATERIAL_CAP_SOURCE_20261124.json').read_text());cls.res=compare(cls.s,cls.db,cls.mat)
 def test_original_scope_and_counts(self):
  self.assertEqual(list(self.res['gates']),['연왕부','창옥','벽유교','유씨별원'])
  self.assertEqual(self.res['totals']['payoutRules'],40)
  self.assertEqual(self.res['totals']['materialEntries'],46)
  self.assertEqual(self.res['totals']['payoutBlockCount'],35)
  self.assertEqual(self.res['totals']['changedMaterialCountOnly'],16)
  self.assertEqual(self.res['totals']['changedMaterialFresh'],22)
 def test_byj_initialization_distinction(self):
  g=self.res['gates']['벽유교']
  self.assertEqual(g['materialWeightCurrent'],g['materialWeightUnclaimedSameInitialization'])
  self.assertNotEqual(g['materialWeightCurrent'],g['materialWeightUnclaimedFreshInitialization'])
  self.assertEqual(g['changedWeightsOnFreshInitialization'],6)
 def test_liu_missing_temp_counter_is_explicit(self):
  self.assertEqual(self.res['gates']['유씨별원']['unknownTempScope'],1)
  self.assertIn('get_8801 temp',self.res['assumptions']['temporaryScope'])
 def test_no_unreleased_modes_and_no_seeds(self):
  self.assertNotIn('문향교',self.res['gates']);self.assertNotIn('무신전',self.res['gates']);self.assertNotIn('벽유교 본단',self.res['gates'])
  self.assertNotIn('Rnds',self.res);self.assertNotIn('globalVariable',self.res)
if __name__=='__main__':unittest.main(verbosity=2)