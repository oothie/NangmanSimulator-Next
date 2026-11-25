#!/usr/bin/env python3
"""Verify all counter writes of the 33 V174 original reward consumers.

This checks the original encoded Lua code under each AddBattleDrop call. No
account data, saved RNG state or actual player drops are used.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import zipfile
from pathlib import Path

NESTED='UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip'
PAYOUT=re.compile(rb'AddBattleDrop\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)')
COUNTER=re.compile(rb"(AddP|SetP)\(\s*'(get_\d+(?:_\d+)?)'\s*,\s*(-?\d+)\)")

def audit(archive:Path,registry:Path)->dict:
    meta=json.loads(registry.read_text(encoding='utf-8'))
    rows=[r for r in meta['awards'] if r['script'].startswith('V174/')]
    if len(rows)!=33:raise ValueError('Expected 33 V174 source consumers')
    with zipfile.ZipFile(archive) as master:
        nested=master.read(NESTED)
    evidence=[]
    with zipfile.ZipFile(io.BytesIO(nested)) as original:
        for row in rows:
            raw=original.read(row['script'])
            matches=[m for m in PAYOUT.finditer(raw) if (
                int(m[1])==row['npc'] and int(m[2])==row['item'] and
                int(m[3])==row['quantity'])]
            if len(matches)!=1:
                raise ValueError(f"Ambiguous original payout: {row['script']} {row['item']}")
            after=raw[matches[0].end():matches[0].end()+130]
            found=COUNTER.search(after)
            action=None if not found else {'op':found[1].decode(),
                'key':found[2].decode(),'value':int(found[3])}
            evidence.append({'npc':row['npc'],'item':row['item'],
                'originalCounterAction':action,'script':row['script']})
        bykind={'SetP':[],'AddP':[],'none':[]}
        for row in evidence:
            kind=row['originalCounterAction']['op'] if row['originalCounterAction'] else 'none'
            bykind[kind].append(str(row['npc'])+':'+str(row['item']))
        if [len(bykind[t]) for t in ('SetP','AddP','none')]!=[10,21,2]:
            raise ValueError('Original payout action distribution changed')
        if set(bykind['none'])!={'40372:3523','33652:3505'}:
            raise ValueError('Unexpected original counter-free payout')
        source=original.read('V174/byj_boss3.lua.sbc')
        if b'GetP(3970) == 0' not in source:
            raise ValueError('Original numeric key possession guard is absent')
    return {'status':'original-source-verified','total':len(evidence),
       'countByOp':{k:len(v) for k,v in bykind.items()},
       'byOp':bykind,'independentNumericGuard':'GetP(3970) == 0',
       'rows':evidence}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-archive',type=Path,required=True)
    parser.add_argument('--consumer-registry',type=Path,required=True)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    report=audit(args.source_archive,args.consumer_registry)
    data=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(data,encoding='utf-8')
    else:print(data,end='')

if __name__=='__main__':main()
