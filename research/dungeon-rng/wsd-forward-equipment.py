#!/usr/bin/env python3
"""Research-only wsd/wsdex source-weighted forward replay and Korean 90-grade equipment mapping.
Only original event interpreter + exact SBv3 typed keys. Current game runtime pairs not proven.
Never exports user saves; outputs only derived result to stdout when called in private/local environment.
"""
from __future__ import annotations
import argparse, json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from wsd_runtime_order import load_manifest,orders_from_manifest,Entry

SOURCE_BASE=ROOT
MODES={'wsd':('숙명',[(35324,35324),(50611,50611),(35306,35306),(35310,35310)]),
       'wsdex':('절세',[(35600,35603),(50611,50611),(35413,35413),(35420,35420)])}

def source_registry(file=SOURCE_BASE/'gate-60-source-registry.json'):
 data=json.loads(Path(file).read_text())
 if len(data['consumers'])!=30:raise ValueError('Unexpected consumer count')
 return data

def project(mode,seed,flags,proof=None,db=None):
 if mode not in MODES:raise ValueError('mode must be wsd or wsdex')
 if not isinstance(seed,int) or seed<1:raise ValueError('seed missing')
 if 'num_fuben' not in flags or 'win_wsd' not in flags or 'win_wsdex' not in flags:raise KeyError('Missing 100-grade dungeon entry state')
 proof=proof or load_manifest();db=db or source_registry()
 row=Entry(mode,seed,flags,orders_from_manifest(mode,proof)).replay()
 label,pairs=MODES[mode]
 out=[]
 for grant,rng in pairs:
  c=next((x for x in db['consumers'] if x['gate']=='무신전' and x['mode']==label and x['grantNpc']==grant),None)
  if c is None or c['rngNpc']!=rng:raise ValueError('Producer/consumer mismatch: '+str(grant))
  slot=row.f.get(f'drop_{rng}_equip')
  color=row.f.get(f'drop_{rng}_color')
  if not slot:
   out.append({'grantNpc':grant,'rngNpc':rng,'equipment':'미드랍','id':None,'grade':None,
               'warning':'Color variable may retain a previous value when no equipment is dropped.'})
   continue
  if not isinstance(slot,int) or slot<1 or slot>len(c['equipmentIds']):raise ValueError('Out-of-range original award slot')
  if color not in (1,2,3,4):raise ValueError('Original color not available')
  name=db['equipmentNames'][str(c['equipmentIds'][slot-1])]
  out.append({'grantNpc':grant,'rngNpc':rng,'equipment':name,
              'id':c['equipmentIds'][slot-1],'grade':['','백색','녹색','청색','자색'][color],
              'slot':slot,'qualityCode':color})
 return {'gate':'무신전','mode':label,'seed_before':seed,'seed_after':row.seed,'draws':len(row.trace),
         'results':out,'native_game_future_verified':False,'source_typed_verified':True,
         'pairs_order_model_only':True,
         'limitations':['Missing GetP reads default to zero in the preexisting restricted interpreter.',
                        'Consumer award application and all real battle RNG remain unverified.',
                        'TDUP source proof is not native live pairs observation.']}

def main():
 p=argparse.ArgumentParser();p.add_argument('--mode',choices=MODES,required=True)
 p.add_argument('--save',type=Path,required=True)
 p.add_argument('--registry',type=Path,default=SOURCE_BASE/'gate-60-source-registry.json')
 a=p.parse_args();s=json.loads(a.save.read_text());
 if 'Rnds' not in s or 'Sds' not in s['Rnds'] or 'seed_wsd' not in s['Rnds']['Sds']:raise KeyError('seed_wsd missing from save')
 result=project(a.mode,s['Rnds']['Sds']['seed_wsd'],s['globalVariable'],db=source_registry(a.registry))
 print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()