import copy
import unittest
from liu_key_timeline import validate_key_timeline, set_key_before_liu, parse_cli_timeline

class TestLiuKeyTimeline(unittest.TestCase):
    def setUp(self):
        self.schedule=['벽유교','유씨별원','창옥','유씨별원','연왕부','유씨별원']
    def test_full_timeline(self):
        self.assertEqual(validate_key_timeline(self.schedule,[False,True,False]),3)
    def test_none_backward_compatible(self):
        self.assertEqual(validate_key_timeline(self.schedule,None),3)
    def test_missing_entry_rejected(self):
        with self.assertRaisesRegex(ValueError,'one status'):
            validate_key_timeline(self.schedule,[False,True])
    def test_extra_entry_rejected(self):
        with self.assertRaisesRegex(ValueError,'one status'):
            validate_key_timeline(self.schedule,[False,True,False,True])
    def test_invalid_status_rejected(self):
        with self.assertRaisesRegex(ValueError,'true/false'):
            validate_key_timeline(self.schedule,[False,1,False])
    def test_no_liu_with_timeline_rejected(self):
        with self.assertRaisesRegex(ValueError,'one status'):
            validate_key_timeline(['벽유교'],[False])
    def test_counter_preservation(self):
        state={'globalVariable':{'get_8915':25,'drop_8915_35264':1}}
        raw=copy.deepcopy(state)
        self.assertTrue(set_key_before_liu(state,[False,True,False],2))
        self.assertEqual(state['globalVariable']['8915'],1)
        self.assertEqual(state['globalVariable']['get_8915'],25)
        self.assertEqual(state['globalVariable']['drop_8915_35264'],1)
        self.assertNotEqual(state,raw)
    def test_changing_between_clears(self):
        state={'globalVariable':{'8915':17}}
        for i,val in enumerate([False,True,False],1):
            self.assertEqual(set_key_before_liu(state,[False,True,False],i),val)
            self.assertEqual(state['globalVariable']['8915'],int(val))
    def test_absent_timeline_does_not_change_state(self):
        state={'globalVariable':{'8915':5}}
        self.assertIsNone(set_key_before_liu(state,None,1))
        self.assertEqual(state['globalVariable']['8915'],5)
    def test_cli_parse(self):
        self.assertEqual(parse_cli_timeline('held,unheld,held'),[True,False,True])
        self.assertIsNone(parse_cli_timeline(None))
    def test_unknown_not_guessed(self):
        with self.assertRaisesRegex(ValueError,'held,unheld'):
            parse_cli_timeline('held,unknown,unheld')
    def test_index_outside_timeline(self):
        with self.assertRaisesRegex(ValueError,'out of'):
            set_key_before_liu({},[True],2)
if __name__=='__main__':unittest.main()
