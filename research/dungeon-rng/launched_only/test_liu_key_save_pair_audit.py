import copy
import json
import unittest
from pathlib import Path
from liu_key_save_pair_audit import audit_save_pair, key_quantity, validate_ledger_against_pair


def save(q, get=25, win=138):
    return {'Items': ([{'ID':8915,'Num':q,'OnlyID':123}] if q else []) + [{'ID':5009,'Num':8}],
            'globalVariable': {'get_8915':get,'win_lsby':win,'8915':999}}

class SavePairAuditTests(unittest.TestCase):
    def setUp(self):
        self.before=save(0,25,138)
        self.after=save(0,26,141)
        self.schedule=['벽유교','유씨별원','창옥','유씨별원','유씨별원']
        self.evidence={'initialQuantity':0,'afterLiu':[
            {'received':0,'consumed':0,'confirmedNoOtherChange':True},
            {'received':1,'consumed':0,'confirmedNoOtherChange':True},
            {'received':0,'consumed':1,'confirmedNoOtherChange':True}]}
    def test_endpoint_no_key_but_counter_rose(self):
        result=audit_save_pair(self.before,self.after)
        self.assertEqual((result['startHeldQuantity'],result['endHeldQuantity']),(0,0))
        self.assertEqual(result['get8915CounterChange'],1)
        self.assertEqual(result['liuWinCounterChange'],3)
        self.assertIn('UNKNOWN',result['intermediateOwnership'])
    def test_duplicate_key_stacks_sum(self):
        s=save(2)
        s['Items'].append({'ID':8915,'Num':3})
        self.assertEqual(key_quantity(s),5)
    def test_historical_get_counter_not_inventory(self):
        self.assertEqual(key_quantity(save(0,get=500)),0)
    def test_invalid_item_num_rejected(self):
        s=save(1)
        s['Items'][0]['Num']=True
        with self.assertRaisesRegex(ValueError,'nonnegative'):
            key_quantity(s)
    def test_missing_items_rejected(self):
        with self.assertRaisesRegex(ValueError,'Items'):
            key_quantity({'globalVariable':{}})
    def test_valid_reconciled_ledger(self):
        result=validate_ledger_against_pair(self.before,self.after,self.schedule,self.evidence)
        self.assertEqual(result['entryHeldTimeline'],[False,False,True])
        self.assertEqual(result['status'],'ENDPOINTS_CONSISTENT_NOT_PROOF_OF_INTERMEDIATE_HISTORY')
    def test_wrong_start_rejected(self):
        evidence=copy.deepcopy(self.evidence)
        evidence['initialQuantity']=1
        with self.assertRaisesRegex(ValueError,'starting save'):
            validate_ledger_against_pair(self.before,self.after,self.schedule,evidence)
    def test_wrong_end_rejected(self):
        evidence=copy.deepcopy(self.evidence)
        evidence['afterLiu'][-1]['consumed']=0
        with self.assertRaisesRegex(ValueError,'ending save'):
            validate_ledger_against_pair(self.before,self.after,self.schedule,evidence)
    def test_wrong_clears_rejected(self):
        with self.assertRaisesRegex(ValueError,'win-counter'):
            validate_ledger_against_pair(self.before,self.after,['유씨별원'],{'initialQuantity':0,'afterLiu':[{'received':0,'consumed':0,'confirmedNoOtherChange':True}]})
    def test_counter_and_receipt_mismatch_not_silently_equated(self):
        after=save(0,get=35,win=141)
        got=validate_ledger_against_pair(self.before,after,self.schedule,self.evidence)
        self.assertIs(got['getCounterEqualsConfirmedReceipts'],False)
    def test_no_raw_seed_output(self):
        self.before['Rnds']={'Sds':{'seed_lsby':987654321}}
        result=audit_save_pair(self.before,self.after)
        self.assertNotIn('987654321',json.dumps(result))
    def test_counter_rollback_rejected(self):
        with self.assertRaisesRegex(ValueError,'decreased'):
            audit_save_pair(save(0,27),save(0,26))

if __name__=='__main__':unittest.main()