#!/usr/bin/env python3
"""Local holdouts; original private saves are read only at runtime."""
import copy,json,os,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dcy_stateful_forward import replay_many
BASE=Path(os.environ.get('NANGMAN_RESEARCH_ROOT','/mnt/data/dungeon_native'))
SRC=BASE/'v140/v30'; SAVES=BASE/'private_saves'
NPCS=(40372,40373,40374)
class ChangokStatefulReplay(unittest.TestCase):
 def read(self,name):return json.loads((SAVES/name).read_text())
 def test_historical_two_independent_save_pairs(self):
  for start,end in [('1122.json','1122v3.json'),('1123(입장전).json','1124.json')]:
   with self.subTest(start=start):
    before=self.read(start);actual=self.read(end)
    after,forecast=replay_many(before,SRC,1)
    self.assertEqual(len(forecast),1)
    self.assertEqual(after['globalVariable']['win_dcy'],actual['globalVariable']['win_dcy'])
    self.assertEqual(forecast[0]['drawCount'],19)
    for npc in NPCS:
     key=f'seed_dcy_{npc}'
     self.assertEqual(after['Rnds']['Sds'][key],actual['Rnds']['Sds'][key],(start,key))
     for kind in ('equip','color'):
      k=f'drop_{npc}_{kind}'
      self.assertEqual(after['globalVariable'].get(k),actual['globalVariable'].get(k),(start,k))
 def test_two_clears_stateful_no_mutation_and_reproducible(self):
  before=self.read('1123(입장전).json');original=copy.deepcopy(before)
  after,runs=replay_many(before,SRC,2)
  self.assertEqual(before,original)
  self.assertEqual([r['drawCount'] for r in runs],[19,23])
  self.assertEqual([r['winBefore'] for r in runs],[349,350])
  self.assertEqual([r['winAfter'] for r in runs],[350,351])
  again,rs2=replay_many(before,SRC,2)
  self.assertEqual(after,again);self.assertEqual(runs,rs2)
  self.assertNotEqual(runs[0]['seedAfter'],runs[1]['seedAfter'])
 def test_round_two_is_actual_second_round_from_mutated_round_one(self):
  before=self.read('1123(입장전).json')
  intermediate,first=replay_many(before,SRC,1)
  finished,second=replay_many(intermediate,SRC,1)
  direct,runs=replay_many(before,SRC,2)
  self.assertEqual(finished,direct)
  self.assertEqual(second[0]['equipmentSlotGrade'],runs[1]['equipmentSlotGrade'])
  self.assertEqual(second[0]['seedBefore'],runs[1]['seedBefore'])
 def test_input_validation(self):
  before=self.read('1123(입장전).json')
  for n in (-1,0,21,1.5,True):
   with self.subTest(n=n),self.assertRaises(ValueError):replay_many(before,SRC,n)
if __name__=='__main__':unittest.main()