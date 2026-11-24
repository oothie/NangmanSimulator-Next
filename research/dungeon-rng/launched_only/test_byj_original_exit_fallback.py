import unittest,sys,pathlib
ROOT=pathlib.Path(__file__).parent;sys.path.insert(0,str(ROOT))
from byj_original_exit_fallback import source_audit,conditionally_plan_exit
class ExitFallback(unittest.TestCase):
 def test_default_fails_closed(self):
  self.assertEqual(conditionally_plan_exit({'glm_reward':1})['grants'],[])
 def test_not_eligible(self):
  self.assertEqual(conditionally_plan_exit({'glm_reward':0},True)['grants'],[])
 def test_both_groups_all_zero(self):
  r=conditionally_plan_exit({'glm_reward':1},True)
  self.assertEqual([x['itemId'] for x in r['grants']],[3025,3035]);self.assertEqual(r['seedByjDraws'],0)
 def test_one_group_blocked(self):
  r=conditionally_plan_exit({'glm_reward':1,'drop_byj_3':500},True)
  self.assertEqual([x['itemId'] for x in r['grants']],[3035])
 def test_both_blocked(self):
  r=conditionally_plan_exit({'glm_reward':1,'drop_byj_1':1,'drop_byj_13':1},True)
  self.assertEqual(r['grants'],[])
 def test_original_source(self):
  # Source bytecode is local only, and not committed to the public repo.
  p=pathlib.Path('/mnt/data/dungeon_native/source_original');sys.path[:0]=[str(p/'decoder/selected'),str(p/'decoder/source')]
  from audit_uploaded_whales import whale_extract,decrypt,inner_decode
  from parse_sb3_tables import parse,emulate
  blob,_=whale_extract(p/'wapp__story__event(1).whale',5054)
  decrypted,_,_=inner_decode(decrypt(blob));tree,_=emulate(parse(decrypted))
  audit=source_audit(tree)
  self.assertEqual(audit['rewardItems'],[3025,3035]);self.assertEqual(audit['seed_byj_calls'],0)
if __name__=='__main__':unittest.main()