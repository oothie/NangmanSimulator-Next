#!/usr/bin/env python3
"""문향교 original 8 TDUP/TSET types -> original event RNG replay (source-model pairs)."""
from pathlib import Path
import sys,json,argparse
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dungeon_v103'))
from wxj_v103 import replay,source_orders

def original_orders(proof=None):
 proof=proof or json.loads((ROOT/'WXJ_8_SOURCE_TYPED_TABLES.json').read_text())
 expected=source_orders();orders={}
 for k,entry in proof['originalTables'].items():
  old=expected[k]
  values=[v[2:] for v in entry['modelPairs']]
  if sorted(old)!=sorted(values):raise ValueError('Original typed key does not match reconstructed WXJ entry: '+k)
  orders[k]=values
 if set(orders)!=set(expected) or len(orders)!=8:raise ValueError('WXJ original 8 tables incomplete')
 return orders

def simulate(seeds,flags):
 result=replay(seeds,flags,original_orders(),research_only=True)
 # Be explicit about the two different lane names attached to third boss.
 trace=result['trace']
 return {'gate':'문향교','equipmentRows':result['rows'],'seedsAfter':result['seeds'],
         'rngCalls':len(trace),'trace':trace,'nativeRuntimePairsObserved':False,
         'originalTypedKeySourcesVerified':True,'independentFutureGameValidated':False,
         'caution':'Original SBv3 typed keys + LuaJIT beta3 hash model, not an actual device oracle.'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--save',type=Path,required=True)
 a=p.parse_args();s=json.loads(a.save.read_text())
 seeds=s.get('Rnds',{}).get('Sds',{})
 needed=('seed_wxj_50100','seed_wxj_50106','seed_wxj_50111','seed_dcy_50111')
 if any(k not in seeds for k in needed):raise KeyError('Missing one or more 100-grade WXJ original RNG seeds: '+','.join(x for x in needed if x not in seeds))
 print(json.dumps(simulate({k:seeds[k] for k in needed},s['globalVariable']),ensure_ascii=False,indent=2))
if __name__=='__main__':main()