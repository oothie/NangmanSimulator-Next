import unittest
from byj_game_roll_runtime_audit import source_proof
class TestOriginalRoll(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.proof=source_proof()
 def test_exact_60014_version_match(self):
  self.assertEqual(len(self.proof['modules']),2)
  self.assertTrue(all(row['sourceVersionV'] for row in self.proof['modules']))
 def test_true_normal_roll_global_api(self):
  self.assertEqual(self.proof['normalRoll']['JHRandomGlobalReadPC'],25)
  self.assertTrue(self.proof['normalRoll']['doesNotDirectlyCallStoryRnd'])
 def test_global_JHRandom_registered(self):
  self.assertEqual(self.proof['JHRandom']['globalAssignmentPC'],19)
  self.assertEqual(self.proof['JHRandom']['functionPrototype'],8)
 def test_core_math_rng_paths_not_conflated(self):
  self.assertEqual(self.proof['JHRandom']['references'],['math.jhrandom','math.random'])
  self.assertTrue(self.proof['JHRandom']['whichPathExecutedNotYetVerified'])
 def test_rescue_two_scans(self):
  self.assertEqual([self.proof['normalRoll']['firstWeightScanPairsPC'],self.proof['normalRoll']['secondWeightScanPairsPC']],[11,29])
if __name__=='__main__':unittest.main()