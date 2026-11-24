#!/usr/bin/env python3
"""Replay two truly observed BYJ clear intervals; no private seeds in fixture source."""
import copy,json,os,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from byj_stateful_forward import replay_many
BASE=Path(os.environ.get('NANGMAN_RESEARCH_ROOT','/mnt/data/dungeon_native'))
SAVES=BASE/'private_saves';SRC=BASE/'v140/v30'
NPCS=(35219,35214,35221)
class BiyouStatefulTests(unittest.TestCase):
 def get(self,n):return json.loads((SAVES/n).read_text())
 def test_first_clear_two_independent_pairs(self):
  for start,end,calls in [('1122.json','1122v3.json',18),('1123(입장전).json','1124.json',17)]:
   with self.subTest(start=start):
    pre=self.get(start);actual=self.get(end);post,runs=replay_many(pre,SRC,1)
    self.assertEqual(runs[0]['drawCount'],calls)
    self.assertEqual(post['Rnds']['Sds']['seed_byj'],actual['Rnds']['Sds']['seed_byj'])
    self.assertEqual(post['globalVariable']['win_byj'],actual['globalVariable']['win_byj'])
    for npc in NPCS:
     for kind in ('equip','color'):
      key=f'drop_{npc}_{kind}'
      self.assertEqual(post['globalVariable'].get(key),actual['globalVariable'].get(key),(start,key))
 def test_two_clear_real_holdout_crossing_other_gates(self):
  a=self.get('1122.json');mid=self.get('1122v3.json')
  bridge=self.get('1123(입장전).json');final=self.get('1124.json')
  # The intermediate non-BYJ dungeon runs must not change BYJ-specific state.
  self.assertEqual(mid['Rnds']['Sds']['seed_byj'],bridge['Rnds']['Sds']['seed_byj'])
  self.assertEqual(mid['globalVariable']['win_byj'],bridge['globalVariable']['win_byj'])
  for npc in NPCS:
   for k in ('equip','color'):
    key=f'drop_{npc}_{k}'
    self.assertEqual(mid['globalVariable'].get(key),bridge['globalVariable'].get(key))
  pre=copy.deepcopy(a);post,runs=replay_many(a,SRC,2)
  self.assertEqual(a,pre)
  self.assertEqual([x['drawCount'] for x in runs],[18,17])
  for i,expected in enumerate((mid,final)):
   self.assertEqual(runs[i]['seedAfter'],expected['Rnds']['Sds']['seed_byj'])
   for n in NPCS:
    actual=(expected['globalVariable'].get(f'drop_{n}_equip'),expected['globalVariable'].get(f'drop_{n}_color'))
    self.assertEqual(tuple(runs[i]['equipmentSlotGrade'][str(n)]),actual,(i,n))
  self.assertEqual(post['Rnds']['Sds']['seed_byj'],final['Rnds']['Sds']['seed_byj'])
 def test_repeated_and_stepwise_replay_equivalent(self):
  before=self.get('1122.json')
  once,r1=replay_many(before,SRC,1)
  twice,r2=replay_many(once,SRC,1)
  chained,all_runs=replay_many(before,SRC,2)
  self.assertEqual(twice,chained)
  self.assertEqual(r2[0]['seedAfter'],all_runs[1]['seedAfter'])
 def test_reject_missing_branch_step(self):
  before=self.get('1122.json');before['Branch']['byj_bz'].pop('step')
  with self.assertRaises(ValueError):replay_many(before,SRC,1)
 def test_reject_invalid_count(self):
  a=self.get('1122.json')
  for c in (0,-1,21,True,1.5):
   with self.subTest(c=c),self.assertRaises(ValueError):replay_many(a,SRC,c)
if __name__=='__main__':unittest.main()