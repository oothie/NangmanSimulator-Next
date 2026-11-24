import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from byjzt_forward import Replay,source_tables,project,D
DB=json.loads((D/'gate-60-source-registry.json').read_text())
class Test(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.p=source_tables()
 @staticmethod
 def seed(n):return {k:n+i for i,k in enumerate(('seed_byjzt','seed_byj','seed_byjzt_50883','seed_byjzt_44122','seed_byjzt_50941','seed_byjzt_44138'))}
 @staticmethod
 def flags():return {'num_fuben':1,'win_byjzt':20,'win_byjztex':5,'roll_9435_50883':0,'roll_9437_50910':0,
   'roll_9438_44122':0,'roll_9432_44122':0,'roll_9435_50941':0,'roll_9437_50950':0,
   'roll_9438_44138':0,'roll_9432_44138':0,
   'byjztex_dy_heisha':0,'byjztex_dy_ss':0,'rxy_xw_2774':0,'rxy_xw_2775':0,
   'drop_9431_44122':0}
 def test_proof(self):
  self.assertEqual({m:len(v['tables']) for m,v in self.p.items()},{'기본':6,'추혼':6})
  for mode,stuff in self.p.items():
   for step,v in stuff['tables'].items():
    self.assertGreaterEqual(v['td_up_pc'],0)
    self.assertFalse(v['game_native_pairs_verified'])
    self.assertEqual(sorted(v['model_pairs_order']),sorted(v['source_typed_writes']))
 def test_synthetic_200(self):
  for mode in ('기본','추혼'):
   for n in range(1,201):
    seeds=self.seed(n);flags=self.flags()
    r=project(mode,seeds,flags,DB)
    self.assertEqual(len(r['rows']),3)
    self.assertGreater(r['rngCalls'],8)
    self.assertFalse(r['realFutureVerified'])
    self.assertEqual(flags,self.flags())
    self.assertEqual(seeds,self.seed(n))
 def test_seed_lanes(self):
  for mode in ('기본','추혼'):
   r=project(mode,self.seed(123456),self.flags(),DB)
   keys={d['seedKey'] for d in r['trace']}
   self.assertIn('seed_byjzt',keys)
   self.assertIn('seed_byj',keys)
   if mode=='기본':self.assertIn('seed_byjzt_50883',keys)
   else:self.assertIn('seed_byjzt_50941',keys)
 def test_fail_closed_seed(self):
  with self.assertRaises(KeyError):project('기본',{'seed_byjzt':2},self.flags(),DB)
 def test_missing_state_recorded(self):
  f=self.flags();del f['win_byjzt']
  r=project('기본',self.seed(100),f,DB)
  self.assertIn('win_byjzt',r['missingGetPAssumedZero'])
if __name__=='__main__':unittest.main(verbosity=2)