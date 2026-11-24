import unittest
from sealed_equipment_holdout import validate_forecast_runs

class ForecastContract(unittest.TestCase):
 def setUp(self):
  self.schedule=['벽유교']
  self.items=[{'boss':boss,'equipmentId':None,'equipmentName':None,'grade':None}
              for boss in ['독선생','미','불로선인']]
  self.items[1]={'boss':'미','equipmentId':5009,'equipmentName':'자미아대','grade':'청색','gradeCode':3}
  self.runs=[{'order':1,'gate':'벽유교','equipment':self.items}]
 def test_complete_source_rows_can_be_sealed(self):
  validate_forecast_runs(self.runs,self.schedule)
 def test_missing_boss_rejected(self):
  self.items.pop()
  with self.assertRaisesRegex(ValueError,'missing source boss'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_numeric_only_item_rejected(self):
  self.items[1]['equipmentName']=None
  with self.assertRaisesRegex(ValueError,'Korean equipment name missing'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_missing_or_mismatched_color_rejected(self):
  self.items[1]['grade']='녹색'
  with self.assertRaisesRegex(ValueError,'Color code'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_invalid_general_item_rejected(self):
  self.items[1]['equipmentId']=12345
  with self.assertRaisesRegex(ValueError,'Unrecognized'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_duplicate_boss_rejected(self):
  self.items[2]['boss']='독선생'
  with self.assertRaisesRegex(ValueError,'duplicated Korean boss'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_wrong_gate_sequence_rejected(self):
  self.runs[0]['gate']='창옥'
  with self.assertRaisesRegex(ValueError,'order differs'):
   validate_forecast_runs(self.runs,self.schedule)
 def test_no_drop_with_grade_rejected(self):
  self.items[0]['grade']='백색'
  with self.assertRaisesRegex(ValueError,'No-drop'):
   validate_forecast_runs(self.runs,self.schedule)
if __name__=='__main__':unittest.main()
