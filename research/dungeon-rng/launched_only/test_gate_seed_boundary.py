import copy
import unittest
from gate_seed_boundary import GATE_SEEDS, ALL_GATES, audit_gate_seed_transition

class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.before={'Rnds':{'Sds':{key:100 for key in ALL_GATES}}}
        self.after=copy.deepcopy(self.before)
        self.after['Rnds']['Sds']['seed_byj']=123
        self.producer={'seed_byj':123}

    def test_only_target_lane_mutates(self):
        result=audit_gate_seed_transition(self.before,self.after,'벽유교',self.producer)
        self.assertEqual(result['changedGateSeedLanes'],['seed_byj'])
        self.assertEqual(result['unexpectedCrossGateLanes'],[])

    def test_cross_gate_lane_mutation_rejected(self):
        self.after['Rnds']['Sds']['seed_lsby']=999
        with self.assertRaisesRegex(ValueError,'Unexpected other-gate'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',self.producer)

    def test_missing_producer_lane_rejected(self):
        with self.assertRaisesRegex(ValueError,'Producer seed key'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',{})

    def test_extra_producer_lane_rejected(self):
        with self.assertRaisesRegex(ValueError,'Producer seed key'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',{'seed_byj':123,'seed_lsby':100})

    def test_producer_value_not_applied_rejected(self):
        with self.assertRaisesRegex(ValueError,'disagree'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',{'seed_byj':124})

    def test_missing_start_seed_rejected(self):
        del self.before['Rnds']['Sds']['seed_lsby']
        with self.assertRaisesRegex(ValueError,'Missing'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',self.producer)

    def test_boolean_seed_rejected(self):
        self.before['Rnds']['Sds']['seed_lsby']=True
        with self.assertRaisesRegex(ValueError,'integer'):
            audit_gate_seed_transition(self.before,self.after,'벽유교',self.producer)

    def test_unchanged_target_lane_is_valid(self):
        result=audit_gate_seed_transition(self.before,self.before,'벽유교',{'seed_byj':100})
        self.assertEqual(result['unchangedExpectedLanes'],['seed_byj'])

    def test_all_four_gate_profiles_are_disjoint(self):
        self.assertEqual(sum(map(len,GATE_SEEDS.values())),len(ALL_GATES))
        self.assertEqual(len(ALL_GATES),9)

    def test_non_gate_lanes_can_change_without_false_assertion(self):
        self.after['Rnds']['Sds']['aidrop90']=500
        result=audit_gate_seed_transition(self.before,self.after,'벽유교',self.producer)
        self.assertEqual(result['changedGateSeedLanes'],['seed_byj'])

if __name__=='__main__':unittest.main()
