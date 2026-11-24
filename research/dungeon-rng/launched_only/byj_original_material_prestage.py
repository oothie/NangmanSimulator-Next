#!/usr/bin/env python3
"""Verified 35227_1.lua steps 10-23 ONLY: BYJ material initialization/cap pruning.

No RNG is consumed by these 14 script steps. Step 24 and the subsequent
material grant consumer must be separately replayed before claiming all loot.
"""
from __future__ import annotations
import copy,json,re
from pathlib import Path

SOURCE=Path(__file__).resolve().parent.parent/'v140/v30/models/byj/35227_1.lua.reconstructed.json'
SET=re.compile(r"SetP\('(?P<key>drop_byj_\d+)'\s*,\s*(?P<value>\d+)\s*\)")
COND=re.compile(r"GetP\('(?P<counter>num_\d+_byj)'\)\s*>=\s*(?P<cap>\d+)")
REMOVE=re.compile(r"RmP\('(?P<key>drop_byj_\d+)'\)")

def decode(source=SOURCE):
    tree=json.loads(Path(source).read_text(encoding='utf-8'))['3']
    start=tree['10']['2']
    if start['cond']['json'].replace(' ','')!="GetP('first_rdward')==0":
        raise AssertionError('Unrecognized original BYJ initialization guard')
    rows={}
    for action in start['imp_yes'].values():
        for hit in SET.finditer(action['3']):
            key=hit['key']
            if key in rows:raise AssertionError('Duplicate original key')
            rows[key]=int(hit['value'])
    if len(rows)!=13:raise AssertionError('Expected original 13 material keys')
    caps=[]
    for step in range(11,24):
        event=tree[str(step)]['2'];m=COND.fullmatch(event['cond']['json'])
        remove=event['imp_yes']['1']['3'];d=REMOVE.search(remove)
        if not m or not d:raise AssertionError('Not source-supported BYJ material cap: '+str(step))
        if d['key'] not in rows:raise AssertionError('Unknown original material key')
        caps.append((step,m['counter'],int(m['cap']),d['key']))
    if len(caps)!=13:raise AssertionError('Expected 13 cap nodes')
    return rows,caps

def apply(save:dict,source=SOURCE):
    start,caps=decode(source)
    nxt=copy.deepcopy(save);v=nxt['globalVariable'];before=v.copy()
    initialized=not bool(v.get('first_rdward',0))
    if initialized:
        v.update(start);v['first_rdward']=1
    removed=[]
    for step,counter,cap,key in caps:
        if v.get(counter,0)>=cap:
            if key in v:removed.append(key)
            v.pop(key,None)
    changed={key:(before.get(key),v.get(key)) for key in sorted(start) if before.get(key)!=v.get(key)}
    return nxt,{'initialized':initialized,'removedByCap':removed,'changedKeys':changed,
                'entriesActive':sum(v.get(key,0)!=0 for key in start),
                'materialWeightTotal':sum(v.get(key,0) for key in start),
                'rngDrawsConsumed':0,'proof':'35227_1.lua steps 10..23; steps 24+ not covered'}