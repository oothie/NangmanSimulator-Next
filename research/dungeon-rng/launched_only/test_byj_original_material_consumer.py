import unittest,sys,pathlib
ROOT=pathlib.Path(__file__).parent;sys.path.insert(0,str(ROOT))
from byj_original_material_consumer import source_audit,possible_rewards,apply_known_selected_outcomes
class MaterialConsumer(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=pathlib.Path('/mnt/data/dungeon_native/source_original');sys.path[:0]=[str(p/'decoder/selected'),str(p/'decoder/source')]
  from audit_uploaded_whales import whale_extract,decrypt,inner_decode
  from parse_sb3_tables import parse,emulate
  cls.reg=[]
  for i in (1777,2150):
   blob,_=whale_extract(p/'wapp__story__fun.whale',i);dec,_,_=inner_decode(decrypt(blob));tree,_=emulate(parse(dec))
   cls.reg.append(source_audit(tree))
 def test_both_rescue_functions_same_rules(self):
  self.assertEqual(self.reg[0],self.reg[1]);self.assertEqual(len(self.reg[1]['cases']),13)
 def test_guard_requires_rescue(self):self.assertEqual(possible_rewards({},self.reg[1])['status'],'rescue-not-asserted')
 def test_unique_group_candidates(self):
  d={'drop_byj_1':2001,'drop_byj_7':300}
  x=possible_rewards(d,self.reg[1],True);self.assertEqual([g['weightSum'] for g in x['groups']],[2001,300])
  self.assertEqual([[c['itemId'] for c in g['candidates']] for g in x['groups']],[[2601],[3736]])
 def test_separate_counter_increment_and_granted_quantity(self):
  d={'drop_byj_5':502,'drop_byj_8':1008}
  next,e=apply_known_selected_outcomes(d,self.reg[1],{1:5,2:8},True)
  self.assertEqual(next['num_2605_byj'],5);self.assertEqual(next['rd_reward1_num'],2)
  self.assertEqual(next['num_2020_byj'],1);self.assertEqual(next['rd_reward2_num'],1)
  self.assertEqual(next['glm_reward'],1)
 def test_no_rng_guess_or_zero_weight_selection(self):
  with self.assertRaises(ValueError):apply_known_selected_outcomes({'drop_byj_3':1},self.reg[1],{1:4,2:None},True)
 def test_empty_pools_do_not_auto_grant(self):
  d,e=apply_known_selected_outcomes({},self.reg[1],{1:None,2:None},True)
  self.assertEqual(e,[]);self.assertEqual(d['glm_reward'],1)
if __name__=='__main__':unittest.main()