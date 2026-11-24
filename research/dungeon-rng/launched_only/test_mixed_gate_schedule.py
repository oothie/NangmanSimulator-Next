#!/usr/bin/env python3
"""Original-source equipment ID/grade mixed-gate order; historical save data local only."""
import copy,json,os,unittest
from pathlib import Path
from mixed_gate_schedule import run_order
BASE=Path(os.environ.get('NANGMAN_RESEARCH_ROOT','/mnt/data/dungeon_native'))
SOURCE=BASE/'v140/v30';REG=BASE/'next/gate-60-source-registry.json'
ORDER=['벽유교','창옥','연왕부','유씨별원','유씨별원','유씨별원']
class MixedGateTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.before=json.loads((BASE/'private_saves/1123(입장전).json').read_text())
  cls.after=json.loads((BASE/'private_saves/1124.json').read_text())
  cls.post,cls.report=run_order(cls.before,SOURCE,REG,ORDER)
 def test_history_all_nine_producer_seeds(self):
  seeds=['seed_byj','seed_lsby','seed_dcy_40372','seed_dcy_40373','seed_dcy_40374',
         'seed_33654','seed_33653','seed_33652','seed_33650']
  for name in seeds:self.assertEqual(self.post['Rnds']['Sds'][name],self.after['Rnds']['Sds'][name],name)
 def test_history_win_counters(self):
  for name in ('win_byj','win_dcy','win_ywf','win_lsby'):
   self.assertEqual(self.post['globalVariable'][name],self.after['globalVariable'][name],name)
 def test_history_thirteen_equipment_id_and_grade_sequence(self):
  predicted=[(item['equipmentId'],item['gradeCode']) for run in self.report['runs']
             for item in run['equipment'] if item['equipmentId'] is not None]
  self.assertEqual(len(predicted),13)
  ids={e['OnlyID'] for e in self.before['Equips']}
  actual=sorted((e for e in self.after['Equips'] if e['OnlyID'] not in ids and e['ID'] in
        {4009,4209,4409,4609,4809,5009,5209,5409,5609}),key=lambda x:x['OnlyID'])
  self.assertEqual(len(actual),16)
  self.assertEqual(predicted,[(e['ID'],e['Color']) for e in actual[:13]])
 def test_per_gate_sequences_order_permuted_in_current_model(self):
  alt=['유씨별원','창옥','유씨별원','연왕부','벽유교','유씨별원']
  _,other=run_order(self.before,SOURCE,REG,alt)
  for gate in ('유씨별원','창옥','연왕부','벽유교'):
   get=lambda report:[[(e['equipmentId'],e.get('gradeCode')) for e in r['equipment']]
                      for r in report['runs'] if r['gate']==gate]
   self.assertEqual(get(self.report),get(other),gate)
 def test_no_mutation_and_no_unreleased_mode(self):
  before=copy.deepcopy(self.before)
  _,_report=run_order(before,SOURCE,REG,['유씨별원'])
  self.assertEqual(before,self.before)
  for bad in ([],['문향교'],['무신전'],['벽유교 본단'],['연왕부']*41):
   with self.assertRaises(ValueError):run_order(self.before,SOURCE,REG,bad)
if __name__=='__main__':unittest.main()