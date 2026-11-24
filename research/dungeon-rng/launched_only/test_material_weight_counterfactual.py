import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path[:0]=[str(ROOT),str(ROOT.parent/'v140/v30'),str(ROOT.parent/'v140/v30/models/liu'),str(ROOT.parent/'v140/v30/models/ywf'),str(ROOT.parent/'v140/v30/models/byj'),str(ROOT.parent/'v140/v30/models/dcy')]
from material_weight_counterfactual import extract,simulate,audit,summary
from experimental_four_gate_engine import report_dcy,report_liu
SAVES=ROOT.parent/'private_saves'
class MaterialStateTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=extract();cls.post=json.loads((SAVES/'1124.json').read_text());cls.pre=json.loads((SAVES/'1123(입장전).json').read_text())
 def test_full_source_material_pool(self):
  self.assertEqual(len(self.data['producerCaps']),46)
  self.assertEqual([sum(r['gate']==g for r in self.data['producerCaps']) for g in ['연왕부','창옥','벽유교','유씨별원']],[9,13,13,11])
  self.assertEqual(len(self.data['byjInitialWeights']),13)
 def test_1124_material_weight_counterfactual(self):
  z=summary(audit(self.data,self.post))
  self.assertEqual([z[g]['actualDynamicSum'] for g in ['연왕부','창옥','벽유교','유씨별원']],[400,4305,7329,480])
  self.assertEqual([z[g]['zeroCountSameInitializationSum'] for g in ['연왕부','창옥','벽유교','유씨별원']],[800,4330,7329,770])
  self.assertEqual([z[g]['freshUnclaimedSum'] for g in ['연왕부','창옥','벽유교','유씨별원']],[800,4330,11870,770])
  self.assertEqual(sum(x['changedFresh'] for x in z.values()),22)
 def test_byj_first_reward_is_not_same_as_just_resetting_counters(self):
  g=self.post['globalVariable'];self.assertEqual(g.get('first_rdward'),1)
  a=simulate(self.data,g);b=simulate(self.data,g,zero_counts=True);c=simulate(self.data,g,zero_counts=True,fresh_byj=True)
  self.assertEqual(sum(v for (gate,_),v in a.items() if gate=='벽유교'),sum(v for (gate,_),v in b.items() if gate=='벽유교'))
  self.assertLess(sum(v for (gate,_),v in a.items() if gate=='벽유교'),sum(v for (gate,_),v in c.items() if gate=='벽유교'))
 def test_get_counters_do_not_affect_ywf_dcy_liu_producer(self):
  for gate,func in [('창옥',lambda s:report_dcy(s)),('유씨별원',lambda s:report_liu(s,1)[1])]:
   base=func(self.pre);changed=copy.deepcopy(self.pre)
   for key in changed['globalVariable']:
    if key.startswith('get_'):changed['globalVariable'][key]=0
   result=func(changed)
   self.assertEqual(base['seed_after'],result['seed_after'],gate)
   self.assertEqual(base['bosses'],result['bosses'],gate)
 def test_material_counter_reset_can_change_rng_seed(self):
  for gate,func in [('창옥',lambda s:report_dcy(s)),('유씨별원',lambda s:report_liu(s,1)[1])]:
   before=func(self.pre);changed=copy.deepcopy(self.pre)
   for key in changed['globalVariable']:
    if key.startswith('num_'):changed['globalVariable'][key]=0
   after=func(changed)
   self.assertNotEqual(before['seed_after'],after['seed_after'],gate)
 def test_source_gate_scope(self):
  self.assertEqual({r['gate'] for r in self.data['producerCaps']},{'연왕부','창옥','벽유교','유씨별원'})
if __name__=='__main__':unittest.main(verbosity=2)