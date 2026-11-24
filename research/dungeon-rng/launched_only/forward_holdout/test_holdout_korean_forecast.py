import copy, unittest
from sealed_equipment_holdout import check, render_private_forecast, sha

class KoreanForecast(unittest.TestCase):
 def setUp(self):
  self.record={'schema':'nangman.released4.equipment.holdout.v1','schedule':['연왕부'],
               'start_inventory_ids':[],'start_inventory_fingerprint':sha({}),
               'expected_equipment':[[5009,3]],
               'expected_boss_equipment':[
                {'order':1,'gate':'연왕부','boss':'이총관','equipmentName':'자미아대','grade':'청색','equipmentId':5009,'gradeCode':3},
                {'order':1,'gate':'연왕부','boss':'하상','equipmentName':None,'grade':None,'equipmentId':None,'gradeCode':None}],
               'expected_end_seeds':{'seed_33654':123},'expected_win_counters':{'win_ywf':1},'constraints':[]}
  self.public={'schema':'nangman.released4.equipment.commitment.v1','sealed_sha256':sha(self.record)}
  self.after={'Equips':[{'OnlyID':1,'ID':5009,'Color':3}],'Rnds':{'Sds':{'seed_33654':123}},'globalVariable':{'win_ywf':1}}

 def test_localized_names(self):
  text=render_private_forecast(self.record)
  self.assertIn('연왕부 · 이총관 — 자미아대 청색',text)
  self.assertIn('연왕부 · 하상 — 미드랍',text)
  self.assertNotIn('seed_33654',text)

 def test_preview_does_not_change_commitment(self):
  old=copy.deepcopy(self.record);render_private_forecast(self.record)
  self.assertEqual(self.record,old)
  self.assertEqual(self.public['sealed_sha256'],sha(self.record))

 def test_older_sealed_record_supported(self):
  old=copy.deepcopy(self.record);del old['expected_boss_equipment']
  old_pub={**self.public,'sealed_sha256':sha(old)}
  self.assertEqual(render_private_forecast(old),'')
  self.assertEqual(check(self.after,old,old_pub)['status'],'PASS')

 def test_mismatch_detected_despite_korean_display(self):
  after=copy.deepcopy(self.after);after['Equips'][0]['Color']=2
  self.assertEqual(check(after,self.record,self.public)['status'],'FAIL')

if __name__=='__main__':unittest.main()
