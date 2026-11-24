import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from wxj_forward import simulate,original_orders
from dungeon_v103.wxj_v103 import replay,source_orders
class Tests(unittest.TestCase):
 def fixture(self,n):
  s={k:123456789+i*100+n*137 for i,k in enumerate(('seed_wxj_50100','seed_wxj_50106','seed_wxj_50111','seed_dcy_50111'))}
  f={'win_wxj':n%16}
  for npc,items in [(50100,[4432,9254,2929]),(50106,[7364,9254,2928]),(50111,[9252,9254,8315,7191,2927])]:
   for item in items:f[f'drop_{item}_{npc}']=0;f[f'roll_{item}_{npc}']=0
  for npc,ids in [(50100,[2601,2603,2604,2605,2606,2607,2641]),(50106,[3028,3029,3030,2000,2001,2002])]:
   for item in ids:f[f'num_{item}_{npc}']=0
  return s,f
 def test_source_eight(self):
  o=original_orders();self.assertEqual(len(o),8)
  self.assertNotEqual(o['14'],source_orders()['14'])
 def test_500_synthetic(self):
  diffs=dict(seed=0,equipment=0,draws=0)
  for n in range(1,501):
   s,f=self.fixture(n)
   old=replay(s,f,source_orders(),research_only=True)
   r=simulate(s,f)
   diffs['seed']+=old['seeds']!=r['seedsAfter']
   diffs['equipment']+=old['rows']!=r['equipmentRows']
   diffs['draws']+=len(old['trace'])!=r['rngCalls']
   self.assertEqual(len(r['equipmentRows']),3)
  self.assertEqual(diffs,dict(seed=500,equipment=500,draws=500))
 def test_four_seeds(self):
  s,f=self.fixture(10);r=simulate(s,f)
  self.assertEqual(len(r['seedsAfter']),4)
  self.assertTrue(any(t[1]=='seed_dcy_50111' for t in r['trace']))
  self.assertTrue(any(t[1]=='seed_wxj_50111' for t in r['trace']))
if __name__=='__main__':unittest.main(verbosity=2)