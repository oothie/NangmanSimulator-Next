"""Local/private regression; original save bytes never published."""
import copy,json,unittest
from pathlib import Path
from released_four_gate_integrated_counterfactual import analyze,make_scenarios,public_summary
BASE=Path(__file__).resolve().parent
ROOT=BASE.parent
class IntegratedSpecialRNG(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.save=json.loads((ROOT/'private_saves/1124.json').read_text())
  cls.award=json.loads((BASE/'SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json').read_text())
  cls.mat=json.loads((BASE/'MATERIAL_CAP_SOURCE_20261124.json').read_text())
  cls.original=copy.deepcopy(cls.save)
  cls.result=analyze(cls.save,ROOT/'v140/v30',ROOT/'next/gate-60-source-registry.json',cls.award,cls.mat)
 def test_scenarios_do_not_modify_input(self):self.assertEqual(self.save,self.original)
 def test_no_unreleased_gates(self):
  self.assertEqual(self.result['scope'],['연왕부','창옥','벽유교','유씨별원'])
  for v in self.result['scenarios'].values():self.assertEqual(set(v['gates']),set(self.result['scope']))
 def test_payout_only_does_not_shift_producer_rng(self):
  for v in self.result['scenarios']['payout_counters_zero_only']['gates'].values():
   self.assertFalse(v['drawsChanged']);self.assertFalse(v['seedChanged']);self.assertFalse(v['equipmentChanged'])
 def test_material_changes_expected_without_seed_leak(self):
  d=self.result['scenarios']['material_counters_zero_only']['gates']
  self.assertTrue(d['창옥']['equipmentChanged']);self.assertTrue(d['창옥']['seedChanged'])
  self.assertTrue(d['유씨별원']['equipmentChanged']);self.assertTrue(d['유씨별원']['drawsChanged'])
  self.assertTrue(d['연왕부']['seedChanged']);self.assertFalse(d['연왕부']['equipmentChanged'])
 def test_ywf_payout_not_same_as_claimed_inventory(self):
  self.assertTrue(all(not r['fullOriginalSpecialEventCovered'] for v in self.result['scenarios'].values() for r in v['gates'].values()))
 def test_8915_numeric_producer_guard(self):
  v=self.result['scenarios']['liu_numeric_8915_enabled_only']['gates']['유씨별원']
  self.assertTrue(v['drawsChanged']);self.assertTrue(v['seedChanged']);self.assertFalse(v['equipmentChanged'])
 def test_byj_fresh_preentry_consumes_no_rng(self):
  current=self.result['scenarios']['completed']['byjMaterialPrestage']
  fresh=self.result['scenarios']['both_counters_zero_fresh_byj']['byjMaterialPrestage']
  self.assertFalse(current['initialized']);self.assertTrue(fresh['initialized'])
  self.assertEqual(current['activeKeys'],7);self.assertEqual(fresh['activeKeys'],13)
  self.assertEqual(current['totalWeight'],7329);self.assertEqual(fresh['totalWeight'],11870)
  self.assertEqual(fresh['rngDrawsConsumed'],0)
  # Critical: the existing BYJ boss-only replay excludes material reward consumer
  self.assertIn('consumer 24 excluded',self.result['scenarios']['completed']['gates']['벽유교']['producerStagesCovered'])
 def test_public_output_never_shows_private_seed_values(self):
  published=json.dumps(public_summary(self.result),ensure_ascii=False)
  self.assertNotIn('seedAfter',published);self.assertNotIn('equipmentBaseline',published)
  self.assertNotIn('equipmentScenario',published)
  self.assertNotIn('OnlyID',published)
 def test_second_save_counterfactual_is_not_overfit_to_1124(self):
  other=json.loads((ROOT/'private_saves/1123(입장전).json').read_text())
  d=analyze(other,ROOT/'v140/v30',ROOT/'next/gate-60-source-registry.json',self.award,self.mat)
  for v in d['scenarios']['payout_counters_zero_only']['gates'].values():
   self.assertFalse(v['seedChanged']);self.assertFalse(v['equipmentChanged'])
  self.assertTrue(d['scenarios']['material_counters_zero_only']['gates']['연왕부']['equipmentChanged'])
  self.assertTrue(d['scenarios']['liu_numeric_8915_enabled_only']['gates']['유씨별원']['equipmentChanged'])
 def test_reset_material_counts_does_not_recover_byj_removed_keys(self):
  cur=self.result['scenarios']['completed']['byjMaterialPrestage']
  zero=self.result['scenarios']['material_counters_zero_only']['byjMaterialPrestage']
  self.assertEqual(cur['totalWeight'],zero['totalWeight'])
  self.assertFalse(zero['initialized'])
 def test_structural_counterfactual_not_fresh_account_claim(self):
  self.assertIn('NOT an independently observed',self.result['status'])
if __name__=='__main__':unittest.main()

class BYJOriginalConsumerIntegrated(unittest.TestCase):
 def test_optional_original_rescue_candidate_output_without_rng_guess(self):
  from released_four_gate_integrated_counterfactual import analyze,public_summary
  save=json.loads((ROOT/'private_saves/1124.json').read_text())
  a=json.loads((BASE/'SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json').read_text())
  m=json.loads((BASE/'MATERIAL_CAP_SOURCE_20261124.json').read_text())
  consumer=json.loads((BASE/'BYJ_ORIGINAL_MATERIAL_CASES_20261124.json').read_text())
  report=analyze(save,ROOT/'v140/v30',ROOT/'next/gate-60-source-registry.json',a,m,consumer)
  current=report['scenarios']['completed']['byjRescueHypothetical'];fresh=report['scenarios']['both_counters_zero_fresh_byj']['byjRescueHypothetical']
  self.assertEqual(current['weightGroups'][0]['group'],1)
  self.assertEqual(len(current['weightGroups']),2)
  self.assertTrue(current['actualAwardUnknown'])
  self.assertEqual(current['outcome'],'blocked-pending-unknown-rescue-selection')
  self.assertGreater(fresh['weightGroups'][0]['weightSum'],0)
  self.assertNotIn('seedAfter',json.dumps(public_summary(report)))