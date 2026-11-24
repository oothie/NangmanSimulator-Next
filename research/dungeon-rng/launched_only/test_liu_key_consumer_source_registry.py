import json
import unittest
from pathlib import Path
from liu_key_consumer_contract import original_key_rule,evaluate_key_consumer

HERE=Path(__file__).resolve().parent
REGISTRY=HERE/'SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json'

class OriginalRegistryTests(unittest.TestCase):
 def test_actual_source_key_contract(self):
  registry=json.loads(REGISTRY.read_text(encoding='utf-8'))
  rule=original_key_rule(registry)
  self.assertEqual(rule['itemId'],8915)
  self.assertEqual(rule['flag'],'drop_8915_35264')
  self.assertEqual(rule['quantityPerDelivery'],1)
  self.assertTrue(rule['eligibilityOnly'])
 def test_persistent_flag_not_inventory(self):
  registry=json.loads(REGISTRY.read_text(encoding='utf-8'))
  status=evaluate_key_consumer(registry,current_flag=1,new_roll_confirmed=False,consumer_delivered=None)
  self.assertEqual(status['creditedInventoryCount'],0)
if __name__=='__main__':unittest.main()
