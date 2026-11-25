#!/usr/bin/env python3
"""Source-verified post-grant flags for V174 native dungeon consumer scripts.

Reads local 60014 original archive + recovered public metadata registry;
outputs only source and gameplay rule values, never user saves or RNG seeds.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import zipfile
from pathlib import Path

INNER='UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip'
POST=re.compile(rb"SetP\(\s*'(?P<flag>drop_[0-9]+_[0-9]+)'\s*,\s*(?P<value>[0-9]+)\s*\)")

def extract(original:Path, registry:Path):
    meta=json.loads(registry.read_text(encoding='utf-8'))
    with zipfile.ZipFile(original) as parent:
        data=parent.read(INNER)
    with zipfile.ZipFile(io.BytesIO(data)) as raw:
        results=[]
        for rule in meta['awards']:
            script=rule['script']
            if not script.startswith('V174/'):
                continue
            b=raw.read(script)
            pattern=(rb"AddBattleDrop\(\s*"+str(rule['npc']).encode()+
                rb"\s*,\s*"+str(rule['item']).encode()+rb"\s*,\s*"+
                str(rule['quantity']).encode()+rb"\s*\)")
            hits=list(re.finditer(pattern,b))
            if len(hits)!=1:
                raise ValueError('Source payout is ambiguous: '+script)
            suffix=b[hits[0].end():hits[0].end()+180]
            flags=list(POST.finditer(suffix))
            matching=[m for m in flags if m['flag'].decode()==rule['flag']]
            if len(matching)!=1:
                raise ValueError('Source post-grant flag is ambiguous: '+script)
            results.append({'script':script,'npc':rule['npc'],'item':rule['item'],
                'flag':rule['flag'],'value':int(matching[0]['value'])})
    if len(results)!=33:raise ValueError('Expected 33 original V174 rewards')
    if [(row['npc'],row['item'],row['value']) for row in results if row['value']!=2]!=[(40372,3523,0)]:
        raise ValueError('Unexpected nonstandard original post-grant value')
    return results

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source-archive',type=Path,required=True)
    p.add_argument('--registry',type=Path,required=True)
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    rows=extract(args.source_archive,args.registry)
    data=json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(data,encoding='utf-8')
    else:print(data,end='')

if __name__=='__main__':main()
