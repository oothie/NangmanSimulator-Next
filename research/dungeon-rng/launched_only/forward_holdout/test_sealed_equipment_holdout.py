import copy,hashlib,json,sys,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=HERE.parent
sys.path.insert(0,str(BASE));sys.path.insert(0,str(HERE))
from sealed_equipment_holdout import seal,check,sha,inventory
PRIVATE=Path('/mnt/data/dungeon_native')
SOURCE=PRIVATE/'v140/v30'
REG=PRIVATE/'next/gate-60-source-registry.json'
ORDER=['벽유교','창옥','연왕부','유씨별원','유씨별원','유씨별원']
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.before=json.loads((PRIVATE/'private_saves/1123(입장전).json').read_text())
  cls.after=json.loads((PRIVATE/'private_saves/1124.json').read_text())
  cls.record,cls.pub=seal(cls.before,SOURCE,REG,ORDER,nonce='00'*32)
 def test_exact_sealed_history_is_not_future_prediction(self):
  # Historical run is only a plumbing test; prior observations must not be called blind.
  r=check(self.after,self.record,self.pub,accept_extra=True)
  self.assertEqual(r['predicted_count'],13)
  self.assertEqual(r['observed_new_90_gear_count'],16)
  self.assertTrue(r['diagnostic_equipment_prefix_match'])
  self.assertFalse(r['strict_equipment_match'])
  self.assertEqual(r['status'],'INCONCLUSIVE_EXTRA_EQUIPMENT')
  self.assertEqual(r['seed_lanes_checked'],9)
  self.assertEqual(r['seed_lanes_matched'],9)
 def test_strict_historical_extra_gear_is_failure(self):
  r=check(self.after,self.record,self.pub)
  self.assertEqual(r['status'],'INCONCLUSIVE_MISSING_BASELINE')
  self.assertFalse(r['strict_equipment_match'])
 def test_tampering_any_predicted_grade_detected(self):
  forged=copy.deepcopy(self.record)
  forged['expected_equipment'][0][1]=4
  with self.assertRaisesRegex(ValueError,'modified'):
   check(self.after,forged,self.pub)
 def test_public_commitment_has_no_private_seeds_or_item_sequence(self):
  self.assertEqual(set(self.pub),{'schema','created_utc','gate_count','equipment_count','sealed_sha256','status'})
  self.assertEqual(len(self.pub['sealed_sha256']),64)
  self.assertNotIn('seed_byj',json.dumps(self.pub))
  self.assertNotIn('OnlyID',json.dumps(self.pub))
 def test_mismatched_seed_is_detected(self):
  tampered=copy.deepcopy(self.after);tampered['Rnds']['Sds']['seed_byj']+=1
  r=check(tampered,self.record,self.pub,accept_extra=True)
  self.assertEqual(r['seed_lanes_matched'],8)
  self.assertNotEqual(r['status'],'PASS')
 def test_cannot_claim_deleted_or_missing_baseline(self):
  tampered=copy.deepcopy(self.after);seen=set(self.record['start_inventory_ids'])
  tampered['Equips']=[x for x in tampered['Equips'] if str(x.get('OnlyID')) not in seen]
  r=check(tampered,self.record,self.pub)
  self.assertEqual(r['status'],'INCONCLUSIVE_MISSING_BASELINE')
 def test_synthetic_untouched_forecast_can_pass_strictly(self):
  after=copy.deepcopy(self.before)
  used={int(e['OnlyID']) for e in after['Equips']}
  next_id=max(used)+1
  for eid,color in self.record['expected_equipment']:
   while next_id in used:next_id+=1
   after['Equips'].append({'OnlyID':next_id,'ID':eid,'Color':color})
   used.add(next_id);next_id+=1
  after['Rnds']['Sds'].update(self.record['expected_end_seeds'])
  after['globalVariable'].update(self.record['expected_win_counters'])
  res=check(after,self.record,self.pub)
  self.assertEqual(res['status'],'PASS')
  self.assertTrue(res['strict_equipment_match'])
 def test_synthetic_wrong_gear_cannot_pass(self):
  after=copy.deepcopy(self.before)
  next_id=max(int(e['OnlyID']) for e in after['Equips'])+1
  for eid,color in self.record['expected_equipment']:
   after['Equips'].append({'OnlyID':next_id,'ID':eid,'Color':color})
   next_id+=1
  last=after['Equips'][-1];last['Color']=1 if last['Color']!=1 else 2
  after['Rnds']['Sds'].update(self.record['expected_end_seeds'])
  after['globalVariable'].update(self.record['expected_win_counters'])
  res=check(after,self.record,self.pub)
  self.assertEqual(res['status'],'FAIL')
  self.assertFalse(res['strict_equipment_match'])
 def test_unknown_mode_blocked(self):
  with self.assertRaisesRegex(ValueError,'released'):
   seal(self.before,SOURCE,REG,['문향교'])
 def test_no_input_mutation(self):
  before=copy.deepcopy(self.before)
  seal(before,SOURCE,REG,['연왕부'],nonce='aa'*32)
  self.assertEqual(before,self.before)
if __name__=='__main__':unittest.main()