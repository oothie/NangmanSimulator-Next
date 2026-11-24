#!/usr/bin/env python3
"""Original 60014 BYJ rescue roll provenance and conditional source-order model.

This does not guess the unknown StoryRnd state, seed, or native intRand bounds.
"""
from __future__ import annotations
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'source_original'
ARCHIVE=Path('/mnt/data/dungeon_rng_work/v187/JHTaskStatementsSeedKeyRoll.sb3')
sys.path.insert(0,str(SOURCE/'decoder/source'))
sys.path.insert(0,str(Path('/mnt/data/dungeon_rng_work/v187')))
sys.path.insert(0,str(Path('/mnt/data/dungeon_native/v140/v30/models/liu')))
from parse_sb3_tables import parse,emulate
from source_parse import parse_all,decode
from v16_luajit_source_table import SourceTable
KEY_RX=re.compile(r"^GetP\('drop_byj_(\d+)'\)$")

def extract_source(i):
    file=ROOT/f'private_byj_{i}.sbc'
    if not file.exists():
        sys.path.insert(0,str(SOURCE/'decoder/selected'))
        from audit_uploaded_whales import whale_extract,decrypt,inner_decode
        blob,_=whale_extract(SOURCE/'wapp__story__fun.whale',i)
        plain,_,_=inner_decode(decrypt(blob));file.write_bytes(plain)
    data=file.read_bytes();p=parse(data);tree,_=emulate(p)
    results=[]
    for step,group in [(8,range(1,7)),(9,range(7,14))]:
        seen=[]
        for pc,w in enumerate(p['instructions']):
            op=w&255;C=(w>>16)&255
            if op!=17:continue
            if C>=len(p['gc']):continue
            k=p['gc'][C];m=KEY_RX.fullmatch(k) if isinstance(k,str) else None
            if m and int(m.group(1)) in group:seen.append({'pc':pc,'key':k,'index':int(m.group(1))})
        assert [x['index'] for x in seen]==list(group),(i,step,seen)
        tbl=SourceTable(0)
        for row in seen:tbl.put(row['key'])
        order=[int(KEY_RX.fullmatch(k).group(1)) for k in tbl.order()]
        assert len(order)==len(group) and set(order)==set(group)
        results.append({'step':step,'opcode':'roll','tdUpPc':32 if step==8 else 60,
                        'typedInsertion':seen,'modelOrder':order,'sourceModel':'LuaJIT-2.1-beta3-content-hash',
                        'runtimeOrderVerified':False})
    return {'funWhaleRecord':i,'sourceSha256':hashlib.sha256(data).hexdigest(),'rolls':results}

def inspect_dispatch():
    f=ARCHIVE;protos=parse_all(f)
    seed,story=protos[1],protos[3]
    assert all(k in seed['gc'] for k in ['getRands','getRandBetween','key','pairs'])
    assert all(k in story['gc'] for k in ['getStoryRnd','intRand','pairs'])
    assert 'getRands' not in story['gc'] and 'getStoryRnd' not in seed['gc']
    def source_at(proto,k):
        return [pc for pc,w in enumerate(proto['instructions']) if decode(w)['op']==13 and decode(w)['C']<len(proto['gc']) and proto['gc'][decode(w)['C']]==k]
    assert source_at(story,'getStoryRnd')==[19]
    assert source_at(story,'intRand')==[22]
    assert source_at(seed,'getRands')==[29]
    assert source_at(seed,'getRandBetween')==[32]
    top=protos[4]
    assert top['gc'][decode(top['instructions'][23])['C']]=='executeCheckMode'
    assert top['gc'][decode(top['instructions'][19])['C']]=='execute'
    dispatcher=Path('/mnt/data/dungeon_rng_work/v187/V174/original_60014/JHTaskStatements_60014.sb3')
    dp=parse_all(dispatcher)[862]
    assert all(name in dp['gc'] for name in ['roll','app/task/statements/JHTaskStatementsRoll','seedkeyroll','app/task/statements/JHTaskStatementsSeedKeyRoll'])
    assert dp['gc'][decode(dp['instructions'][1176])['C']]=='app/task/statements/JHTaskStatementsRoll'
    assert dp['gc'][decode(dp['instructions'][1204])['C']]=='app/task/statements/JHTaskStatementsSeedKeyRoll'
    return {'originalModule':'JHTaskStatementsSeedKeyRoll.sb3',
            'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),
            'seedkeyroll':{'prototype':1,'getRandsPc':29,'getRandBetweenPc':32},
            'seedKeyRollCheckMode':{'prototype':3,'method':'executeCheckMode','getStoryRndPc':19,'intRandPc':22},
            'normalRoll':{'module':'JHTaskStatementsRoll.lua','dispatcherPrototype':862,'requirePc':1176,
                          'originalBodyRecovered':False,'rngSourceConfirmed':False},
            'normalSeedKeyRoll':{'dispatcherRequirePc':1204,'method':'execute','prototype':1},
            'storyRndSExistsInSavedGame':True,
            'storyRndUsedByNormalRollProven':False}

def build():
    rows=[extract_source(i) for i in [1777,2150]]
    assert rows[0]['rolls'][0]['modelOrder']==rows[1]['rolls'][0]['modelOrder']
    assert rows[0]['rolls'][1]['modelOrder']==rows[1]['rolls'][1]['modelOrder']
    return {'source':'60014 Whale source original source bytecode; no original game files published',
            'statementDispatch':inspect_dispatch(),
            'equivalentRescueScripts':rows,
            'candidateOrders':{str(g['step']):g['modelOrder'] for g in rows[0]['rolls']},
            'limitation':'Normal rescue roll dispatches to separate JHTaskStatementsRoll; its original implementation remains unrecovered. StoryRnd call belongs to SeedKeyRoll.executeCheckMode, NOT proof of rescue roll RNG. Never synthesize a game result.'}

if __name__=='__main__':
    result=build()
    print(json.dumps(result,ensure_ascii=False,indent=2))