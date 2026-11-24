#!/usr/bin/env python3
"""Recover ORIGINAL Roll and JHRandom wrapper from user-owned Korean game APK.

Manifest v fingerprints are independently compared to the game's 60014 manifest.
The proprietary source bytecode itself is never published.
"""
from __future__ import annotations
import hashlib,json,sys,zipfile,struct
from pathlib import Path
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'source_original'
APK=SOURCE/'낭만강호.apk'
MANIFEST_60014=SOURCE/'gameversion.json'
sys.path[0:0]=[str(SOURCE/'decoder/selected'),str(SOURCE/'decoder/source'),'/mnt/data/dungeon_rng_work/v187']
from audit_uploaded_whales import whale_extract,decrypt,inner_decode
from source_parse import parse_all,decode

ITEMS=[('src/app/task/statements/JHTaskStatementsRoll.lua','assets/src_whale64/wapp__task__statements.whale'),
       ('src/app/core/JHExtern.lua','assets/src_whale64/wapp__core.whale')]

def source_proof(apk_path=APK,manifest60014=MANIFEST_60014):
    older={};records=[]
    current=json.loads(Path(manifest60014).read_text())
    with zipfile.ZipFile(apk_path) as z:
        older=json.loads(z.read('assets/gameversion.json'))
        for name,entry in ITEMS:
            assert name in older and name in current
            old,now=older[name],current[name]
            assert old['v']==now['v'] and old['s']==now['s'],f'version mismatch {name}'
            data=z.read(entry);start,count,version=struct.unpack_from('<IHH',data)
            candidates=[]
            for i in range(count):
                _,_,size,_,_=struct.unpack_from('<IIIII',data,start+i*20)
                if size==old['s']:candidates.append(i)
            assert len(candidates)==1,(name,candidates)
            i=candidates[0]
            # whale_extract takes a filename; this is a local copy, never exported.
            tmp=SOURCE/'apk_task'/Path(entry).name
            if not tmp.exists() or tmp.read_bytes()!=data:tmp.write_bytes(data)
            blob,_=whale_extract(tmp,i)
            code,protos,ins=inner_decode(decrypt(blob))
            out=SOURCE/'apk_task'/(Path(name).stem+'_'+str(i)+'.sbc')
            out.write_bytes(code)
            records.append({'module':name,'sourceVersionV':old['v'],'bytesEncrypted':old['s'],
                            'whaleRecord':i,'bytecodeSha256':hashlib.sha256(code).hexdigest(),
                            'prototypes':protos,'instructions':ins,'localProof':out})
    roll,extern=(parse_all(x['localProof']) for x in records)
    # Actual runtime normal statement uses global JHRandom, not getStoryRnd directly.
    assert roll[4]['gc'][decode(roll[4]['instructions'][19])['C']]=='execute'
    assert roll[1]['gc'][decode(roll[1]['instructions'][25])['C']]=='JHRandom'
    assert decode(roll[1]['instructions'][25])['op']==10 # GGET
    assert roll[1]['gc'][decode(roll[1]['instructions'][11])['C']]=='pairs'
    assert roll[1]['gc'][decode(roll[1]['instructions'][29])['C']]=='pairs'
    assert extern[79]['gc'][decode(extern[79]['instructions'][19])['C']]=='JHRandom'
    assert decode(extern[79]['instructions'][19])['op']==11 # GSET
    assert all(k in extern[8]['gc'] for k in ['math','jhrandom','random'])
    proof={'source':'Owned APK original SBv3 + separately retained 60014 manifest v fingerprints',
           'modules':[{k:v for k,v in item.items() if k!='localProof'} for item in records],
           'normalRoll':{'sourceModule':ITEMS[0][0],'executePrototype':1,'JHRandomGlobalReadPC':25,
                         'firstWeightScanPairsPC':11,'secondWeightScanPairsPC':29,
                         'doesNotDirectlyCallStoryRnd':True},
           'JHRandom':{'sourceModule':ITEMS[1][0],'globalAssignmentPrototype':79,
                       'globalAssignmentPC':19,'functionPrototype':8,
                       'references':['math.jhrandom','math.random'],
                       'whichPathExecutedNotYetVerified':True},
           'remaining':'Recover exact JHRandom control-flow and math.jhrandom RNG implementation/seed and verify LuaJIT runtime table order'}
    return proof
if __name__=='__main__':
    print(json.dumps(source_proof(),ensure_ascii=False,indent=2))