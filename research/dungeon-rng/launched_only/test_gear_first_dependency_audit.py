import unittest
from gear_first_dependency_audit import summarize,GATES,SCENARIOS

class EquipmentFirstPolicyTests(unittest.TestCase):
    def example(self):
        scenarios={}
        for key in SCENARIOS:
            scenarios[key]={'gates':{gate:{'equipmentChanged':False,'seedChanged':False,
                    'drawsChanged':False,'branch37Changed':False} for gate in GATES}}
        scenarios['material_counters_zero_only']['gates']['연왕부']['seedChanged']=True
        scenarios['material_counters_zero_only']['gates']['창옥']['equipmentChanged']=True
        scenarios['material_counters_zero_only']['gates']['창옥']['seedChanged']=True
        scenarios['material_counters_zero_only']['gates']['유씨별원']['equipmentChanged']=True
        scenarios['liu_numeric_8915_enabled_only']['gates']['유씨별원']['drawsChanged']=True
        return {'scope':list(GATES),'scenarios':scenarios}
    def test_payout_only_is_skipped_without_equipment_effect(self):
        p=summarize(self.example())
        self.assertTrue(all(v['payoutCounterPolicy']=='not-required-for-current-equipment-replay' for v in p['gateDependencies'].values()))
    def test_liu_numeric_condition(self):
        p=summarize(self.example())['gateDependencies']['유씨별원']
        self.assertTrue(next(c for c in p['caseResults'] if c['scenario']=='liu_numeric_8915_enabled_only')['drawCountChanged'])
    def test_changok_equipment_dependency(self):
        p=summarize(self.example())['gateDependencies']['창옥']
        self.assertEqual(p['materialCounterPolicy'],'required-equipment')
    def test_yanwangbu_future_seed_dependency(self):
        p=summarize(self.example())['gateDependencies']['연왕부']
        self.assertEqual(p['materialCounterPolicy'],'required-future-seed')
    def test_byj_incomplete_not_declared_independent(self):
        p=summarize(self.example())['gateDependencies']['벽유교']
        self.assertTrue(p['scopeIncomplete']);self.assertIn('unproven',p['materialCounterPolicy'])
    def test_reject_unreleased(self):
        s=self.example();s['scope'].append('문향교')
        with self.assertRaises(ValueError):summarize(s)
if __name__=='__main__':unittest.main()