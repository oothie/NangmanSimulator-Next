"""Fixture-based validation from previously computed public, seed-free comparisons."""
import json,unittest
from pathlib import Path

BASE=Path(__file__).resolve().parent

class LiuGearSequenceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.older=json.loads((BASE/'liu_gear_sensitivity_1123_public.json').read_text())
        cls.latest=json.loads((BASE/'liu_gear_sensitivity_1124_public.json').read_text())
    def test_public_results_never_contain_seeds(self):
        for report in (self.older,self.latest):
            self.assertNotIn('seedAfter',json.dumps(report))
            self.assertEqual(report['clears'],3)
            self.assertEqual(report['gate'],'유씨별원')
    def test_payout_flags_no_effect_across_three_clears(self):
        for report in (self.older,self.latest):
            for step in report['results']['payout_counters_zero_only']:
                self.assertFalse(any([step['equipmentChanged'],step['drawCountChanged'],step['seedChanged']]))
    def test_material_1124_changes_equipment_all_three(self):
        self.assertTrue(all(s['equipmentChanged'] for s in self.latest['results']['material_counters_zero_only']))
    def test_8915_first_clear_latent_equipment_effect_1124(self):
        steps=self.latest['results']['liu_numeric_8915_enabled_only']
        self.assertFalse(steps[0]['equipmentChanged']);self.assertTrue(steps[0]['seedChanged'])
        self.assertTrue(steps[0]['drawCountChanged'])
        self.assertTrue(all(s['equipmentChanged'] for s in steps[1:]))
    def test_8915_may_act_immediately_on_older_start(self):
        self.assertTrue(self.older['results']['liu_numeric_8915_enabled_only'][0]['equipmentChanged'])
if __name__=='__main__':unittest.main()