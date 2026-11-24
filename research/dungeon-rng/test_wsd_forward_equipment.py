import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from wsd_forward_equipment import project,source_registry
class Test(unittest.TestCase):
 def test_whole_source_mapping(self):
  flags={'num_fuben':1,'win_wsd':20,'win_wsdex':10}
  for mode in ('wsd','wsdex'):
   r=project(mode,123456,flags)
   self.assertEqual(len(r['results']),4)
   self.assertFalse(r['native_game_future_verified'])
   self.assertEqual(r['draws'],20 if mode=='wsd' else 29)
   for row in r['results']:
    if row['id'] is not None:self.assertIn(row['id'],(4009,4209,4409,4609,4809,5009,5209,5409))
   if mode=='wsdex':self.assertEqual(r['results'][0]['rngNpc'],35603)
 def test_source_only(self):
  with self.assertRaises(KeyError):project('wsd',1,{'num_fuben':1})
  with self.assertRaises(ValueError):project('wsd',0,{'num_fuben':1,'win_wsd':1,'win_wsdex':1})
 def test_reference_projection(self):
  flags={'num_fuben':1,'win_wsd':20,'win_wsdex':10}
  s=project('wsdex',123456,flags)
  self.assertEqual(s['results'][0]['slot'],4)
  self.assertEqual(s['results'][0]['grade'],'청색')
  self.assertEqual(s['results'][0]['id'],5409)
  self.assertEqual(s['results'][2]['slot'],3)
  self.assertEqual(s['results'][2]['grade'],'녹색')
  self.assertEqual(s['results'][2]['id'],4209)
if __name__=='__main__':unittest.main(verbosity=2)