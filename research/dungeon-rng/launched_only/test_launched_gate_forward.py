#!/usr/bin/env python3
"""Historical holdout for four released gates only; private saves never committed."""
import json,os,sys,unittest
from pathlib import Path
from launched_gate_forward import GATES,FROZEN,BOSSES,load_registry,present,replay
BASE=Path(os.environ.get('NANGMAN_RESEARCH_ROOT','/mnt/data/dungeon_native'))
SRC=BASE/'v140/v30'
REG=BASE/'next/gate-60-source-registry.json'
SAVES=BASE/'private_saves'

class LaunchedOnly(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.a=json.loads((SAVES/'1123(입장전).json').read_text())
  cls.b=json.loads((SAVES/'1124.json').read_text())
  cls.f=replay(cls.a,SRC,REG,3)
  cls.pools,cls.names=load_registry(REG)
 def test_scope_freeze(self):
  self.assertEqual(GATES,('연왕부','창옥','벽유교','유씨별원'))
  self.assertEqual(FROZEN,('문향교','무신전','벽유교 본단'))
  self.assertEqual(sum(len(x) for x in BOSSES.values()),13)
  self.assertEqual(len(self.f['runs']),6)
  self.assertEqual([r['gate'] for r in self.f['runs']],['연왕부','창옥','벽유교']+['유씨별원']*3)
 def test_original_pool_rejects_impossible_slot(self):
  with self.assertRaises(ValueError):present('유씨별원',35260,4,2,self.pools,self.names)
  with self.assertRaises(ValueError):present('창옥',40372,1,7,self.pools,self.names)
  with self.assertRaises(ValueError):replay(self.a,SRC,REG,0)
 def test_three_source_seeds(self):
  expected=self.b['Rnds']['Sds']
  for r in self.f['runs']:
   for key,val in r['seedAfter'].items():
    if r['gate']=='유씨별원' and r['clear']<3:continue
    self.assertEqual(expected[key],val,(r['gate'],key))
  start=self.a['globalVariable'];end=self.b['globalVariable']
  for key,count in [('win_ywf',1),('win_dcy',1),('win_byj',1),('win_lsby',3)]:
   self.assertEqual(end[key]-start[key],count)
 def test_holdout_created_equipment_13(self):
  # Source actual game encounter ordering: BYJ, DCY, YWF, three Liu clears.
  order=[self.f['runs'][i] for i in (2,1,0,3,4,5)]
  target=[(x['equipmentId'],x['gradeCode']) for r in order for x in r['equipment'] if x['equipmentId']]
  self.assertEqual(len(target),13)
  existing={e['OnlyID'] for e in self.a['Equips']}
  new=sorted((e for e in self.b['Equips'] if e['OnlyID'] not in existing and e['ID'] in self.names),key=lambda x:x['OnlyID'])
  actual=[(e['ID'],e['Color']) for e in new]
  self.assertEqual(len(new),16)
  matches=[i for i in range(len(actual)-len(target)+1) if actual[i:i+len(target)]==target]
  self.assertEqual(matches,[0])
  self.assertTrue(all(new[i]['OnlyID']+1==new[i+1]['OnlyID'] for i in range(12)))
 def test_no_unreleased_gate_output(self):
  self.assertFalse(set(r['gate'] for r in self.f['runs']) & set(FROZEN))

if __name__=='__main__':unittest.main()