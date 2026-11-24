import copy
import json
import unittest
from pathlib import Path
from liu_key_8915_branch_compare import run_key_sensitivity


class LiuKeyBranches(unittest.TestCase):
    def setUp(self):
        self.start={'globalVariable':{'get_8915':25,'num_8915_35264':5,'8915':19},'Rnds':{'Sds':{'seed_lsby':100}}}
        self.original=copy.deepcopy(self.start)
        self.seen=[]

    def replay(self, state, root, registry, schedule):
        self.seen.append(copy.deepcopy(state))
        held=state['globalVariable']['8915'] == 1
        runs=[]
        for order,gate in enumerate(schedule,1):
            value = 5009 if not held else 5209
            runs.append({'order':order,'gate':gate,'draws':19 if held else 20,
                         'seedAfter':{'seed_lsby':44 if held else 55},
                         'equipment':[{'boss':'고리','equipmentId':value,
                                       'equipmentName':'자미아대' if not held else '오잠보갑',
                                       'grade':'백색'}]})
        return state, {'runs':runs}

    def test_divergence_and_equipment_names(self):
        out=run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],self.replay)
        self.assertEqual(out['firstDivergenceOrder'],1)
        self.assertEqual(out['runs'][0]['changedBosses'],['고리'])
        self.assertTrue(out['runs'][0]['drawCountDiffers'])
        self.assertEqual(out['runs'][0]['differingSeedLaneNames'],['seed_lsby'])
        self.assertEqual(out['runs'][0]['heldEquipment'][0]['equipmentName'],'오잠보갑')

    def test_source_untouched_and_noncounter_key_isolated(self):
        run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],self.replay)
        self.assertEqual(self.start,self.original)
        self.assertEqual([s['globalVariable']['8915'] for s in self.seen],[0,1])
        self.assertEqual([s['globalVariable']['get_8915'] for s in self.seen],[25,25])

    def test_no_seeds_or_inventory_identifiers_emitted(self):
        out=run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],self.replay)
        dumped=json.dumps(out)
        self.assertNotIn('OnlyID',dumped)
        self.assertNotIn('get_8915',dumped)
        self.assertNotIn('"seed_lsby": 44',dumped)
        self.assertNotIn('"seed_lsby": 55',dumped)

    def test_missing_liu_fails_closed(self):
        with self.assertRaisesRegex(ValueError,'include 유씨별원'):
            run_key_sensitivity(self.start,Path('.'),Path('registry'),['창옥'],self.replay)

    def test_malformed_replay_fails(self):
        def short(state,*_):return state,{'runs':[]}
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],short)

    def test_identical_branches_not_assumed_divergence(self):
        def identical(state,root,registry,schedule):
            return state,{'runs':[{'gate':'유씨별원','draws':19,'seedAfter':{'seed_lsby':8},
                    'equipment':[{'boss':'고리','equipmentId':None,'equipmentName':None,'grade':None}]}]}
        out=run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],identical)
        self.assertFalse(out['pathsDiffer'])
        self.assertIsNone(out['firstDivergenceOrder'])

    def test_reordered_bosses_rejected(self):
        def different_order(state,root,registry,schedule):
            held=state['globalVariable']['8915']==1
            names=['고리','윤무'] if held else ['윤무','고리']
            return state,{'runs':[{'gate':'유씨별원','draws':19,'seedAfter':{'seed_lsby':8},
                    'equipment':[{'boss':name,'equipmentId':None} for name in names]}]}
        with self.assertRaisesRegex(ValueError,'boss order'):
            run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],different_order)

    def test_seed_key_mismatch_rejected(self):
        def mismatched(state,root,registry,schedule):
            held=state['globalVariable']['8915']==1
            return state,{'runs':[{'gate':'유씨별원','draws':19,
                       'seedAfter':{'seed_lsby':8} if held else {'seed_byj':8},
                       'equipment':[{'boss':'고리','equipmentId':None}]}]}
        with self.assertRaisesRegex(ValueError,'seed ownership'):
            run_key_sensitivity(self.start,Path('.'),Path('registry'),['유씨별원'],mismatched)

if __name__=='__main__':unittest.main()