import json,unittest
from pathlib import Path
from byj_story_roll_conditional import intervals,apply_observed_story_rolls
from byj_story_roll_source_audit import build
ROOT=Path(__file__).resolve().parent
registry=json.loads((ROOT/'BYJ_ORIGINAL_MATERIAL_CASES_20261124.json').read_text())['original']

class TestByjStoryRoll(unittest.TestCase):
 def setUp(self):
  self.gv={'glm_reward':0}
  for c in registry['cases']:self.gv[c['weightProperty']]=c['index']*10
 def test_original_60014_two_prototypes(self):
  d=build();a=d['statementDispatch']
  self.assertEqual(a['seedKeyRollCheckMode']['getStoryRndPc'],19)
  self.assertEqual(a['seedKeyRollCheckMode']['intRandPc'],22)
  self.assertEqual(a['seedkeyroll']['getRandsPc'],29)
  self.assertEqual(a['seedkeyroll']['getRandBetweenPc'],32)
 def test_13_key_types_two_original_scripts(self):
  d=build();self.assertEqual(len(d['equivalentRescueScripts']),2)
  for row in d['equivalentRescueScripts']:
   self.assertEqual(sum(len(g['typedInsertion']) for g in row['rolls']),13)
   for g in row['rolls']:
    self.assertTrue(all(v['key']==f"GetP('drop_byj_{v['index']}')" for v in g['typedInsertion']))
 def test_order(self):
  v=intervals(self.gv,registry)
  self.assertEqual([r['index'] for r in v['groups'][0]['intervals']],[3,4,1,6,2,5])
  self.assertEqual([r['index'] for r in v['groups'][1]['intervals']],[7,8,10,9,13,11,12])
 def test_full_support_no_gaps(self):
  out=intervals(self.gv,registry)
  for group in out['groups']:
   self.assertEqual(group['intervals'][0]['start'],1)
   self.assertEqual(group['intervals'][-1]['end'],group['total'])
   for a,b in zip(group['intervals'],group['intervals'][1:]):self.assertEqual(a['end']+1,b['start'])
 def test_observed_rolls_apply_first_boundaries(self):
  v=apply_observed_story_rolls(self.gv,registry,{1:1,2:1})
  self.assertEqual(v['selected'],{1:3,2:7})
  self.assertEqual(v['globalVariables']['glm_reward'],1)
  self.assertEqual(v['changes'][0]['itemId'],2603)
  self.assertEqual(v['changes'][1]['itemId'],3736)
 def test_observed_rolls_apply_last_boundaries(self):
  x=intervals(self.gv,registry);rolls={g['group']:g['total'] for g in x['groups']}
  v=apply_observed_story_rolls(self.gv,registry,rolls)
  self.assertEqual(v['selected'],{1:5,2:12})
 def test_zero_weights_filtered(self):
  for c in registry['cases']:
   if c['index']!=6 and c['index']!=13:self.gv[c['weightProperty']]=0
  x=intervals(self.gv,registry)
  self.assertEqual([q['index'] for q in x['groups'][0]['intervals']],[6])
  self.assertEqual([q['index'] for q in x['groups'][1]['intervals']],[13])
 def test_empty_roll_requires_zero(self):
  for c in registry['cases']:
   if c['rewardGroup']==1:self.gv[c['weightProperty']]=0
  with self.assertRaisesRegex(ValueError,'zero-weight'):
   apply_observed_story_rolls(self.gv,registry,{1:0,2:1})
  with self.assertRaises(ValueError):apply_observed_story_rolls(self.gv,registry,{1:1,2:1})
 def test_no_synthesized_seed(self):
  v=intervals(self.gv,registry)
  self.assertEqual(v['unknownRngState'],'JHTaskStatementsRoll.lua original implementation not recovered')
  self.assertNotIn('generatedSeed',v)
  self.assertEqual(v['gameRuntimeOrderVerified'],False)
 def test_invalid_rolls(self):
  with self.assertRaises(ValueError):apply_observed_story_rolls(self.gv,registry,{1:1,2:999999})
  with self.assertRaises(ValueError):apply_observed_story_rolls(self.gv,registry,{1:1})
 def test_guard(self):
  self.gv['glm_reward']=1
  self.assertEqual(intervals(self.gv,registry)['status'],'already-rewarded')
if __name__=='__main__':unittest.main()