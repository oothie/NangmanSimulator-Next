import copy
import unittest
from liu_key_evidence_ledger import ownership_timeline

class EvidenceLedgerTests(unittest.TestCase):
    def setUp(self):
        self.order=['유씨별원','창옥','유씨별원','유씨별원','연왕부','유씨별원']
        self.events={'initialQuantity':0,'afterLiu':[
            {'received':0,'consumed':0,'confirmedNoOtherChange':True},
            {'received':1,'consumed':0,'confirmedNoOtherChange':True},
            {'received':0,'consumed':1,'confirmedNoOtherChange':True},
            {'received':0,'consumed':0,'confirmedNoOtherChange':True},
        ]}
    def test_prior_v78_sequence_carries_confirmed_key(self):
        timeline,log=ownership_timeline(self.order,self.events)
        self.assertEqual(timeline,[False,False,True,False])
        self.assertTrue(log[1]['ownedAfterClear'])
        self.assertFalse(log[2]['ownedAfterClear'])
    def test_existing_key_skips_draw_while_held(self):
        self.events['initialQuantity']=1
        statuses,_=ownership_timeline(self.order,self.events)
        self.assertEqual(statuses,[True,True,True,True])
    def test_original_not_mutated(self):
        original=copy.deepcopy(self.events)
        ownership_timeline(self.order,self.events)
        self.assertEqual(self.events,original)
    def test_stale_drop_flag_never_credited(self):
        self.events['drop_8915_35264']=1
        with self.assertRaisesRegex(ValueError,'Explicit'):
            ownership_timeline(self.order,self.events)
    def test_unknown_activity_stops(self):
        self.events['afterLiu'][1]['confirmedNoOtherChange']=False
        with self.assertRaisesRegex(ValueError,'Unobserved'):
            ownership_timeline(self.order,self.events)
    def test_insufficient_consumption_stops(self):
        self.events['afterLiu'][0]['consumed']=1
        with self.assertRaisesRegex(ValueError,'exceeds'):
            ownership_timeline(self.order,self.events)
    def test_negative_grant_stops(self):
        self.events['afterLiu'][1]['received']=-1
        with self.assertRaisesRegex(ValueError,'nonnegative'):
            ownership_timeline(self.order,self.events)
    def test_boolean_qty_stops(self):
        self.events['initialQuantity']=True
        with self.assertRaisesRegex(ValueError,'nonnegative'):
            ownership_timeline(self.order,self.events)
    def test_partial_event_stops(self):
        self.events['afterLiu'][0].pop('confirmedNoOtherChange')
        with self.assertRaisesRegex(ValueError,'Each clear'):
            ownership_timeline(self.order,self.events)
    def test_missing_clear_event_stops(self):
        self.events['afterLiu'].pop()
        with self.assertRaisesRegex(ValueError,'One confirmed'):
            ownership_timeline(self.order,self.events)
    def test_other_gates_do_not_consume_event(self):
        timeline,_=ownership_timeline(['창옥','유씨별원'],{'initialQuantity':2,'afterLiu':[{'received':0,'consumed':0,'confirmedNoOtherChange':True}]})
        self.assertEqual(timeline,[True])
    def test_no_unreleased_only_schedule(self):
        with self.assertRaisesRegex(ValueError,'One confirmed'):
            ownership_timeline(['창옥'],{'initialQuantity':0,'afterLiu':[]})
if __name__=='__main__':unittest.main()
