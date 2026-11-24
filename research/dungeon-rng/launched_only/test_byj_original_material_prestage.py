import copy,json,unittest
from pathlib import Path
from byj_original_material_prestage import apply,decode
SAVES=Path(__file__).resolve().parent.parent/'private_saves'
class BYJPrestage(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.save=json.loads((SAVES/'1124.json').read_text())
 def test_original_full_key_count(self):
  a,b=decode();self.assertEqual(len(a),13);self.assertEqual(len(b),13)
  self.assertEqual(a['drop_byj_1'],2001)
 def test_completed_state_does_not_reinitialize(self):
  s,report=apply(self.save);self.assertFalse(report['initialized']);self.assertEqual(report['rngDrawsConsumed'],0)
  self.assertEqual(s['globalVariable']['first_rdward'],1)
 def test_fresh_byj_initializes_then_caps(self):
  s=copy.deepcopy(self.save);v=s['globalVariable'];v['first_rdward']=0
  for i in range(1,14):v.pop('drop_byj_'+str(i),None)
  _,caps=decode();
  for _,key,_,_ in caps:v[key]=0
  n,r=apply(s)
  self.assertTrue(r['initialized']);self.assertEqual(r['entriesActive'],13)
  self.assertEqual(n['globalVariable']['first_rdward'],1)
  self.assertEqual(r['materialWeightTotal'],sum(decode()[0].values()))
 def test_reinitialized_capped_entries_stay_missing(self):
  s=copy.deepcopy(self.save);v=s['globalVariable'];v['first_rdward']=0
  _,caps=decode();step,counter,cap,key=caps[0];v[counter]=cap
  n,r=apply(s)
  self.assertNotIn(key,n['globalVariable']);self.assertIn(key,r['removedByCap'])
 def test_preserve_caller(self):
  s=copy.deepcopy(self.save);apply(s);self.assertEqual(s,self.save)
if __name__=='__main__':unittest.main()