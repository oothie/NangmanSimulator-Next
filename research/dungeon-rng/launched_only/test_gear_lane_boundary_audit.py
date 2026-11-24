"""Privacy-safe tests for field/equipment seed lane boundaries in four launched gates."""
import copy,json,os,unittest
from pathlib import Path
from mixed_gate_schedule import run_order
from gear_lane_boundary_audit import GEAR_IDS,GATE_LANES,SCHEDULE,summarize,gear_signature
BASE=Path(os.environ.get('NANGMAN_RESEARCH_ROOT','/mnt/data/dungeon_native'))
SRC=BASE/'v140/v30'
REG=BASE/'next/gate-60-source-registry.json'
class GearLaneBoundaryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.b=json.loads((BASE/'private_saves/1123(입장전).json').read_text())
  cls.a=json.loads((BASE/'private_saves/1124.json').read_text())
  cls.summary=summarize(cls.b,cls.a,SRC,REG)
  cls.end,cls.report=run_order(cls.b,SRC,REG,SCHEDULE)
 def test_all_nine_equipment_seed_lanes_changed_in_real_save_diff(self):
  self.assertEqual(self.summary['changedEquipmentSeedTypes'],9)
  self.assertEqual(set(self.summary['changedEquipmentIdNames']),set(GEAR_IDS))
 def test_model_does_not_claim_to_predict_equipment_affix_seeds(self):
  self.assertTrue(self.summary['postEdsUnchanged'])
  self.assertNotEqual(self.a['Rnds']['Eds'],self.end['Rnds']['Eds'])
 def test_model_only_advances_nine_gate_specific_sds_lanes(self):
  self.assertTrue(self.summary['reportedGateLanesOnly'])
  self.assertEqual(self.summary['reportedOriginalGateLaneCount'],9)
 def test_historical_13_matches_16_new_equips_prefix(self):
  self.assertEqual(self.summary['reportedEquipmentIdsAndGrade'],13)
  self.assertEqual(self.summary['new90EquipmentInAfterSave'],16)
  self.assertTrue(self.summary['matchingContiguousPredictedPrefix'])
 def test_changing_all_equipment_seeds_does_not_change_model_item_or_color(self):
  mutated=copy.deepcopy(self.b)
  for i in GEAR_IDS:
   x=str(i)
   mutated['Rnds']['Eds'][x]=((mutated['Rnds']['Eds'][x]+1000003)%2147483646)+1
  _,new_report=run_order(mutated,SRC,REG,SCHEDULE)
  self.assertEqual(gear_signature(self.report),gear_signature(new_report))
 def test_field_aidrop_mdrop_unchanged_in_historical_pair_but_npc_seed_changed(self):
  self.assertEqual(self.summary['fieldDropSdsChangedBetweenSavePair'],0)
  self.assertGreaterEqual(self.summary['fieldDropSdsLaneCount'],20)
  self.assertTrue(self.summary['fieldMonsterNpcSeedsChanged']['seed_35256'])
  self.assertTrue(self.summary['globalStoryRandChanged'])
 def test_field_aidrop_and_mdrop_perturbation_does_not_change_current_gate_model(self):
  altered=copy.deepcopy(self.b)
  for key in list(altered['Rnds']['Sds']):
   if key.startswith('aidrop') or key=='mdrop':
    orig=altered['Rnds']['Sds'][key]
    altered['Rnds']['Sds'][key]=(orig+31337)%2147483646+1
  _,new=run_order(altered,SRC,REG,SCHEDULE)
  self.assertEqual(gear_signature(new),gear_signature(self.report))
 def test_other_sds_changed_in_actual_history_and_cannot_be_attributed(self):
  self.assertGreater(self.summary['otherChangedSaveSdsCount'],0)
 def test_two_mixed_order_permutations_preserve_per_gate_item_color_in_model(self):
  for order in [list(reversed(SCHEDULE)), ['연왕부','유씨별원','벽유교','유씨별원','창옥','유씨별원']]:
   _,report=run_order(self.b,SRC,REG,order)
   for gate in set(SCHEDULE):
    seq=lambda rs:[tuple((e['equipmentId'],e.get('gradeCode')) for e in r['equipment']) for r in rs['runs'] if r['gate']==gate]
    self.assertEqual(seq(self.report),seq(report),gate)
if __name__=='__main__':unittest.main()