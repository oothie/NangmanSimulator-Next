#!/usr/bin/env python3
"""Audit native battle-loss rollback vs general_win reward boundaries.

Evidence: bundled ORIGINAL V174 SBC records. This tool reads only original
game source and the source-derived award registry; no player data, saves or RNG.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import zipfile
from pathlib import Path

NESTED = 'UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip'
LOST = b'\tlost'
WIN = b'\x0eeventFile\x10general_win'

def audit(archive:Path,registry:Path)->dict:
    db=json.loads(registry.read_text(encoding='utf8'))
    rows=[r for r in db['awards'] if r['script'].startswith('V174/')]
    if len(rows)!=33:raise ValueError('Expected 33 source V174 consumer rules')
    with zipfile.ZipFile(archive) as outer:
        raw=outer.read(NESTED)
    detail=[]
    with zipfile.ZipFile(io.BytesIO(raw)) as original:
        for rule in rows:
            data=original.read(rule['script'])
            before=data.find(LOST)
            after=data.find(WIN)
            if before<0 or after<=before:
                raise ValueError('No verified lost / general_win boundaries: '+rule['script'])
            loss=data[before:after]
            flag=rule['flag'].encode()
            code=(rb"SetP\(\s*'"+re.escape(flag)+rb"'\s*,\s*1\s*\)")
            matching=list(re.finditer(code,loss))
            expected=1 if rule['rollback'] else 0
            if len(matching)!=expected:
                raise ValueError(
                    f"Lost-branch rollback mismatch {rule['script']} item={rule['item']}: "
                    f"{len(matching)} != {expected}"
                )
            detail.append({'npc':rule['npc'],'item':rule['item'],
                'hasLossRollback':bool(matching),'script':rule['script']})
    assert sum(r['hasLossRollback'] for r in detail)==31
    return {'status':'original-source-verified','consumers':len(detail),
      'lossRollbackRules':sum(r['hasLossRollback'] for r in detail),
      'noLossRollbackRules':sum(not r['hasLossRollback'] for r in detail),
      'details':detail}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source-archive',required=True,type=Path)
    p.add_argument('--consumer-registry',required=True,type=Path)
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    result=audit(args.source_archive,args.consumer_registry)
    msg=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(msg,encoding='utf8')
    else:print(msg,end='')

if __name__=='__main__':main()
