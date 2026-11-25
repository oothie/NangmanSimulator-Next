#!/usr/bin/env python3
"""Prove all seven Liu manor special producer flags in reconstructed 35271_1.

This uses only decoded game event structure and the public game-mechanic
consumer registry, never player saves, seeds or individual drop outcomes.
The event reconstruction is the 35271_1 producer, not the consumer SBC.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

def commands(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for value in obj.values():
            yield from commands(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from commands(value)

def audit(entry_file: Path, registry_file: Path):
    entry=json.loads(entry_file.read_text(encoding='utf-8'))
    db=json.loads(registry_file.read_text(encoding='utf-8'))
    rules=[r for r in db['awards'] if r['gate']=='유씨별원']
    if len(rules)!=7:
        raise ValueError('Expected exactly seven original Liu consumer rules')
    tree=entry['3']
    producer_words='\n'.join(commands(tree))
    matches={}
    for r in rules:
        flag=r['flag']
        text_hits=[word for word in commands(tree) if flag in word]
        if not text_hits:
            raise ValueError('Original producer flag absent: '+flag)
        matches[flag]={'npc':r['npc'],'item':r['item'],
          'mentions':len(text_hits)}
    # This one source step is a direct command, not a weighted RNG choice.
    s6=tree['6']
    if s6.get('3')!="SetP('drop_35260_rarematerial',1)":
        raise ValueError('Rare-material source step 6 no longer direct SetP')
    if tree['7']['2'].get('key')!='seed_lsby':
        raise ValueError('Original following equipment RNG step changed')
    if 'drop_5020_35260' not in repr(tree['5']):
        raise ValueError('Original preceding unique reward step changed')
    if '8801' in producer_words:
        # The producer sets a flag but does not itself grant item 8801.
        raise ValueError('Direct rare material item grant appeared in producer')
    return {'source':'35271_1.lua.reconstructed.json',
      'producerSpecialFlags':len(matches),
      'rareMaterialFlag':"SetP('drop_35260_rarematerial',1)",
      'rareMaterialConsumesSeed':False,
      'tempGetPConsumerUnproven':True,
      'producerFlags':matches}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--entry',type=Path,required=True)
    parser.add_argument('--registry',type=Path,required=True)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    result=audit(args.entry,args.registry)
    data=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(data,encoding='utf-8')
    else:print(data,end='')

if __name__=='__main__':
    main()
