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
 def test_two_sequential_dcy_clears(self):
  out=replay(self.a,SRC,REG,1,1,dcy_clears=2)
  dcy=[run for run in out['runs'] if run['gate']=='창옥']
  self.assertEqual(len(dcy),2)
  self.assertEqual([r['draws'] for r in dcy],[19,23])
  self.assertEqual([r['clear'] for r in dcy],[1,2])
  for result in dcy:
   self.assertEqual(len(result['equipment']),3)
   self.assertEqual(list(result['seedAfter']),['seed_dcy_40372','seed_dcy_40373','seed_dcy_40374'])
  for key,value in dcy[0]['seedAfter'].items():
   self.assertEqual(value,self.b['Rnds']['Sds'][key])
 def test_dcy_clear_count_invalid(self):
  for n in (0,21):
   with self.subTest(n=n),self.assertRaises(ValueError):replay(self.a,SRC,REG,1,1,dcy_clears=n)
 def test_two_sequential_byj_clears(self):
  before=json.loads((SAVES/'1122.json').read_text())
  out=replay(before,SRC,REG,1,1,byj_clears=2)
  runs=[r for r in out['runs'] if r['gate']=='벽유교']
  self.assertEqual([r['draws'] for r in runs],[18,17])
  targets=[json.loads((SAVES/name).read_text()) for name in ('1122v3.json','1124.json')]
  for row,expected in zip(runs,targets):
   self.assertEqual(row['seedAfter']['seed_byj'],expected['Rnds']['Sds']['seed_byj'])
   for equip in row['equipment']:
    self.assertEqual(equip.get('slot'),expected['globalVariable'].get(f"drop_{equip['npc']}_equip"))
 def test_byj_invalid_clear_count(self):
  for n in (0,21):
   with self.subTest(n=n),self.assertRaises(ValueError):replay(self.a,SRC,REG,1,1,byj_clears=n)
 def test_no_unreleased_gate_output(self):
  self.assertFalse(set(r['gate'] for r in self.f['runs']) & set(FROZEN))
 def test_optional_special_consumer_summary(self):
  d=replay(self.a,SRC,REG,1,1,
      BASE/'launched_only/SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json',
      BASE/'launched_only/MATERIAL_CAP_SOURCE_20261124.json')
  special=d['specialRewardCounterfactual']
  self.assertEqual(special['totals']['payoutRules'],40)
  self.assertEqual(special['totals']['materialEntries'],46)
  self.assertEqual(special['totals']['changedMaterialFresh'],22)
  self.assertNotIn('specialRewardCounterfactual',self.f)
  with self.assertRaises(ValueError):replay(self.a,SRC,REG,1,1,BASE/'launched_only/SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json')
 def test_two_sequential_ywf_clears(self):
  first=json.loads((SAVES/'1122v3.json').read_text())
  mid=json.loads((SAVES/'1123(입장전).json').read_text())
  two=replay(first,SRC,REG,1,2)['runs'][:2]
  expected_ends=[mid,self.b]
  self.assertEqual([x['draws'] for x in two],[24,22])
  for i,(run,target) in enumerate(zip(two,expected_ends)):
   self.assertEqual(run['gate'],'연왕부')
   for key,value in run['seedAfter'].items():self.assertEqual(value,target['Rnds']['Sds'][key],(i,key))
   for e in run['equipment']:
    npc=e['npc'];slot=target['globalVariable'].get(f'drop_{npc}_equip')
    self.assertEqual(e.get('slot'),slot,(i,npc,'slot'))
    if slot is not None:
     self.assertEqual(e['gradeCode'],target['globalVariable'][f'drop_{npc}_color'],(i,npc,'grade'))
  with self.assertRaises(ValueError):replay(first,SRC,REG,1,0)

if __name__=='__main__':unittest.main()