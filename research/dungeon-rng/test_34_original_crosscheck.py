#!/usr/bin/env python3
"""Crosscheck 100-grade 5-mode typed sources against the 60-original-table registry.
Compares source PC, typed writes, model order; not live native pairs or real future gameplay.
"""
from pathlib import Path
import argparse,json

def verify(registry,wsd,byjzt,wxj):
 counts={'무신전':0,'벽유교 본단':0,'문향교':0}
 for c in registry['consumers']:
  gate=c['gate'];mode=c['mode']
  for t in c['tables']:
   path=t['sourcePath']
   if gate=='무신전':
    k={'숙명':'wsd','절세':'wsdex'}[mode];row=wsd['modes'][k]['weighted_tables'][path.lstrip('/')]
    original=[x['key'] for x in t['typedWrites']]
    assert original==row['source_write_keys'],(gate,path,'typed writes')
    assert t['sourceTdupPc']==row['source_tdup_pc'],(gate,path,'TDUP PC')
    assert t['modelPairsOrder']==row['model_pairs_keys'],(gate,path,'pairs MODEL')
   elif gate=='벽유교 본단':
    step=path.strip('/').split('/')[0];row=byjzt[mode]['tables'][step]
    assert [x['key'] for x in t['typedWrites']]==row['source_typed_writes'],(gate,path,'typed writes')
    assert t['sourceTdupPc']==row['td_up_pc'],(gate,path,'TDUP PC')
    assert t['modelPairsOrder']==row['model_pairs_order'],(gate,path,'pairs MODEL')
   elif gate=='문향교':
    step=path.lstrip('/').split('/')[1]
    row=wxj['originalTables'][step+('/color' if t['kind']=='color' else '')]
    assert [x['key'] for x in t['typedWrites']]==[tag for tag,_ in row['typedWrites']],(gate,path,'typed writes')
    assert t['sourceTdupPc']==row['sourceTdupPc'],(gate,path,'TDUP PC')
    assert t['modelPairsOrder']==row['modelPairs'],(gate,path,'pairs MODEL')
   else:continue
   counts[gate]+=1
 assert counts=={'무신전':16,'벽유교 본단':12,'문향교':6}
 return {'originalSourceTablesCrosschecked':sum(counts.values()),'byGate':counts,
         'verified':['typed numeric/string keys','TDUP bytecode PC','source hash-order model consistency'],
         'nativePairsObserved':False,'futureGameDropValidated':False}

def main():
 p=argparse.ArgumentParser()
 for n in ('registry','wsd','byjzt','wxj'):p.add_argument(n,type=Path)
 a=p.parse_args();data={n:json.loads(getattr(a,n).read_text()) for n in ('registry','wsd','byjzt','wxj')}
 print(json.dumps(verify(**data),ensure_ascii=False,indent=2))
if __name__=='__main__':main()