#!/usr/bin/env python3
"""Source-parsed dynamic material weight counterfactual for four released gates.
Original TDUP/TSET seed/order can be used by the source-research engine; this module
only computes active weights before calling SeedKeyRoll (no extra or skipped RNG).
"""
from __future__ import annotations
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent/'v140/v30'
SOURCES={
 '연왕부': ROOT/'33381_1_record1910.reconstructed.json',
 '창옥': ROOT/'models/dcy/40389_1.lua.reconstructed.json',
 '벽유교': ROOT/'models/byj/35227_1.lua.reconstructed.json',
 '유씨별원': ROOT/'models/liu/35271_1.lua.reconstructed.json',
}
COND=re.compile(r"GetP\('(?P<key>num_\d+_(?:\d+|byj|lsby))'\)\s*>=\s*(?P<cap>\d+)")
ASSIGN=re.compile(r"SetP\('(?P<key>drop_(?:\d+_\d+|byj_\d+|lsby_\d+))'\s*,\s*(?P<weight>\d+)\s*\)")
DELETE=re.compile(r"RmP\('(?P<key>drop_(?:\d+_\d+|byj_\d+|lsby_\d+))'\)")

def extract():
 result=[]
 byj_starts={}
 for gate,filename in SOURCES.items():
  tree=json.loads(filename.read_text())['3']
  starts={}
  if gate=='벽유교':
   actions=tree['10']['2']['imp_yes']
   for op in actions.values():
    for m in ASSIGN.finditer(op.get('3','')):starts[m['key']]=int(m['weight'])
   if len(starts)!=13:raise AssertionError('13 original BYJ initialization weights missing')
   byj_starts=starts.copy()
  for step,v in tree.items():
   if not isinstance(v,dict):continue
   sub=v.get('2')
   if not isinstance(sub,dict):continue
   cond=sub.get('cond',{}).get('json','')
   cm=COND.search(cond)
   if not cm:continue
   if gate=='벽유교':
    remove=str(sub.get('imp_yes',{}).get('1',{}).get('3',''))
    dm=DELETE.search(remove)
    if dm is None or dm['key'] not in starts:raise ValueError(('unmapped BYJ weight',step,remove))
    flag=dm['key'];w=starts[flag]
   else:
    normal=str(sub.get('imp_no',{}).get('1',{}).get('3',''))
    am=ASSIGN.search(normal)
    if am is None:raise ValueError(('missing fallback weight',gate,step,normal))
    flag=am['key'];w=int(am['weight'])
    removed=str(sub.get('imp_yes',{}).get('1',{}).get('3',''))
    if not re.search(r"RmP\('"+re.escape(flag)+r"'\)",removed):raise AssertionError(('missing cap removal',gate,step))
   result.append({'gate':gate,'step':int(step),'counter':cm['key'],'cap':int(cm['cap']),
                  'weightKey':flag,'originalWeight':w,'initialization':'first_rdward==0' if gate=='벽유교' else 'always recalculated per entry'})
 return {'schema':'original-material-weight-v1','producerCaps':result,
         'sourceRule':'num_ITEM >= cap removes material weight; BYJ initialization is conditional on first_rdward==0',
         'byjInitialWeights':byj_starts}

def simulate(registry,variables,zero_counts=False,fresh_byj=False):
 byj_init=variables.get('first_rdward',0)==0 or fresh_byj
 weights={}
 for row in registry['producerCaps']:
  gate=row['gate'];key=row['weightKey']
  cnt=0 if zero_counts else variables.get(row['counter'],0)
  if gate=='벽유교' and not byj_init:
   # Existing original table has already been initialized and entries may have
   # been removed on earlier clears. Resetting a count does NOT resurrect keys.
   start=variables.get(key,0)
  else:start=row['originalWeight']
  weights[(gate,key)]=0 if cnt>=row['cap'] else start
 return weights

def audit(registry,save):
 var=save['globalVariable']
 current=simulate(registry,var)
 zero=simulate(registry,var,zero_counts=True)
 fresh=simulate(registry,var,zero_counts=True,fresh_byj=True)
 rows=[]
 for row in registry['producerCaps']:
  k=(row['gate'],row['weightKey'])
  rows.append({**row,'actualCount':var.get(row['counter'],0),'actualActiveWeight':current[k],
               'hypotheticalZeroCountSameInitialization':zero[k],
               'hypotheticalNeverObtainedFreshInitialization':fresh[k]})
 return rows

def summary(rows):
 out={}
 for gate in SOURCES:
  g=[r for r in rows if r['gate']==gate]
  out[gate]={'materialWeights':len(g),
    'actualDynamicSum':sum(x['actualActiveWeight'] for x in g),
    'zeroCountSameInitializationSum':sum(x['hypotheticalZeroCountSameInitialization'] for x in g),
    'freshUnclaimedSum':sum(x['hypotheticalNeverObtainedFreshInitialization'] for x in g),
    'changedCountOnly':sum(x['actualActiveWeight']!=x['hypotheticalZeroCountSameInitialization'] for x in g),
    'changedFresh':sum(x['actualActiveWeight']!=x['hypotheticalNeverObtainedFreshInitialization'] for x in g)}
 return out

def main():
 p=argparse.ArgumentParser();p.add_argument('--save',type=Path);p.add_argument('--public-registry',type=Path);p.add_argument('--private-output',type=Path)
 a=p.parse_args();reg=extract()
 if a.public_registry:a.public_registry.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n')
 print('source cap rows',len(reg['producerCaps']))
 if a.save:
  rows=audit(reg,json.loads(a.save.read_text()));print(json.dumps(summary(rows),ensure_ascii=False,indent=2))
  if a.private_output:a.private_output.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()