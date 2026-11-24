#!/usr/bin/env python3
"""Read original 60014 reward consumer bytes, audit earned-count guards and compare
already-claimed vs zero-claim hypothetical without mutating input saves or inventing RNG.
Original SBC and user saves remain local; generated registry stores only rule metadata.
"""
from __future__ import annotations
import argparse,hashlib,io,json,re,zipfile
from pathlib import Path

BASE=Path(__file__).resolve().parent
V177_NAME='UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip'
# Only user-confirmed launched gates.
AWARD=re.compile(rb"AddBattleDrop\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*(?:SetP\(\s*'(?P<flag>drop_\d+_\d+)'\s*,\s*2\s*\))?",re.I)
CONDITION=re.compile(rb"GetP\(\s*'(?P<flag>drop_\d+_\d+|drop_35260_rarematerial)'\s*\)\s*(?P<fop>==|~=)\s*(?P<fvalue>\d+)(?:\s+and\s+GetP\(\s*'(?P<count>get_\d+(?:_\d+)?)'\s*(?:,\s*'(?P<scope>temp)'\s*)?\)\s*(?P<cmp><=|<|==)\s*(?P<cap>\d+))?")
COUNT_WRITE=re.compile(rb"(?:AddP|SetP)\(\s*'(?P<key>get_\d+(?:_\d+)?)'\s*,\s*(?P<value>-?\d+)\s*\)")
OTHER_SPECIAL=re.compile(rb"GetP\(\s*'(?P<key>get_\d+(?:_\d+)?)'\s*\)\s*(?P<op>==|<=|<)\s*(?P<value>\d+)")
ROLLBACK_COUNT=re.compile(rb"(?P<op>AddP|SetP)\(\s*'(?P<key>get_\d+(?:_\d+)?)'\s*,\s*(?P<amount>-?\d+)\s*\)")

def source_blobs(v177:Path, liu_dir:Path):
    with zipfile.ZipFile(v177) as archive:
        nested=archive.read(V177_NAME)
    with zipfile.ZipFile(io.BytesIO(nested)) as z:
        for name in sorted(z.namelist()):
            if re.search(r'/(?:ywf|dcy|byj)_boss\d+\.lua\.sbc$',name):
                yield name,z.read(name),'V174 original SBC in V177 archive'
    for boss in (2,3,4):
        p=liu_dir/f'lsby_boss{boss}.recovered.sbc'
        if not p.is_file():raise FileNotFoundError(f'Original decoded Liu consumer not present: {p}')
        yield p.name,p.read_bytes(),'Whale event unique-sized record, outer+inner decrypted'

def find_rollback(blob:bytes,flag:str):
    # Original event serialization places the prior-award recovery action just
    # before its `GetP(drop_...) == 2` condition. Only certify a unique match.
    target=("GetP('"+flag+"') == 2").encode()
    positions=[m.start() for m in re.finditer(re.escape(target),blob)]
    if not positions:return None
    if len(positions)!=1:raise AssertionError(('ambiguous original rollback condition',flag))
    prefix=blob[max(0,positions[0]-180):positions[0]]
    setflag=re.compile(rb"SetP\(\s*'"+re.escape(flag.encode())+rb"'\s*,\s*1\s*\)")
    matches=list(setflag.finditer(prefix))
    if len(matches)!=1:raise AssertionError(('ambiguous original rollback flag reset',flag))
    tail=prefix[matches[-1].end():]
    count=list(ROLLBACK_COUNT.finditer(tail))
    if len(count)>1:raise AssertionError(('multiple rollback count updates',flag))
    update=None
    if count:
        c=count[0]
        update={'operation':c.group('op').decode(),'key':c.group('key').decode(),'value':int(c.group('amount'))}
    return {'ifFlagEquals':2,'resetFlagTo':1,'counterUpdate':update}

def apply_original_rollbacks(awards:list[dict],variables:dict):
    # The original consumer's pre-reward `flag==2` recovery is applied before
    # evaluating grant eligibility. Never mutate caller save or fake RNG draws.
    state=variables.copy()
    applied=[]
    for row in awards:
        rule=row.get('rollback')
        if rule is None or state.get(row['flag'],0)!=rule['ifFlagEquals']:continue
        state[row['flag']]=rule['resetFlagTo']
        update=rule['counterUpdate']
        if update:
            key=update['key'];value=update['value']
            if update['operation']=='AddP':state[key]=state.get(key,0)+value
            elif update['operation']=='SetP':state[key]=value
            else:raise ValueError('Unknown original rollback operation')
        applied.append(row['flag'])
    return state,applied

def extract(v177:Path,liu_dir:Path):
    output=[];sources=[];skipped=[]
    for name,blob,provenance in source_blobs(v177,liu_dir):
        sources.append({'name':name,'sha256':hashlib.sha256(blob).hexdigest(),'provenance':provenance})
        for match in AWARD.finditer(blob):
            npc,item,quantity=map(int,match.group(1,2,3)); flag=(match.group('flag') or b'').decode() or None
            tail=blob[match.end():match.end()+290]
            cond=CONDITION.search(tail)
            if not cond:
                # Ordinary award (equipment or money), excluded from special registry.
                if flag:skipped.append({'script':name,'item':item,'reason':'No exact flag award guard in bytecode'})
                continue
            conditionflag=cond.group('flag').decode()
            if flag and flag!=conditionflag:
                raise AssertionError(f'Mismatched consumer flag: {name} {flag} {conditionflag}')
            count=(cond.group('count') or b'').decode() or None
            row={'gate':('연왕부' if 'ywf_' in name else '창옥' if 'dcy_' in name else '벽유교' if 'byj_' in name else '유씨별원'),
                 'script':name,'npc':npc,'item':item,'quantity':quantity,'flag':conditionflag,
                 'flagCondition':cond.group('fop').decode()+' '+cond.group('fvalue').decode(),
                 'countKey':count,'countScope':(cond.group('scope') or b'').decode() or None,
                 'operator':(cond.group('cmp') or b'').decode() or None,
                 'cap':int(cond.group('cap')) if cond.group('cap') is not None else None,
                 'consumerCondition':cond.group(0).decode()}
            row['rollback']=find_rollback(blob,conditionflag)
            if row['countKey'] is None and item not in (3505,3970,8915):
                # Guard may not be bound or data is incomplete. Do not invent quantity limits.
                row['requiresIndependentReview']=True
            output.append(row)
    if len({(r['npc'],r['item'],r['flag']) for r in output})!=len(output):
        raise AssertionError('Duplicate consumer award detected')
    return {'schema':'special-consumer-v1','semantics':'Post-RNG reward eligibility only; not unconditional ownership and not producer probability',
            'sources':sources,'awards':output,'skipped':skipped}

def eligible(row,variables:dict,assume_flag:bool=False,override_count:int|None=None):
    if not assume_flag:
        raw=variables.get(row['flag'],0)
        if row['flagCondition'].startswith('~='): allowed=(raw!=int(row['flagCondition'].split()[1]))
        else:allowed=(raw==int(row['flagCondition'].split()[1]))
        if not allowed:return False
    if row['countKey'] is None:return True
    if row['countScope']=='temp':
        return None # save globalVariable does not establish temporary property.
    val=variables.get(row['countKey'],0) if override_count is None else override_count
    if row['operator']=='==':return val==row['cap']
    if row['operator']=='<':return val<row['cap']
    if row['operator']=='<=':return val<=row['cap']
    raise ValueError('Unsupported source comparison')

def whatif(registry:dict, save:dict):
    global_vars=save['globalVariable'];rows=[]
    prepared,rolled_back=apply_original_rollbacks(registry['awards'],global_vars)
    for row in registry['awards']:
        current=eligible(row,prepared,assume_flag=True)
        zero=eligible(row,prepared,assume_flag=True,override_count=0)
        rows.append({'gate':row['gate'],'npc':row['npc'],'item':row['item'],'cap':row['cap'],
                     'claimedCount':global_vars.get(row['countKey'],None) if row['countKey'] else None,
                     'claimedCountAfterRollback':prepared.get(row['countKey'],None) if row['countKey'] else None,
                     'claimCountCurrentEligible':current,'claimCountZeroEligible':zero,
                     'doesChangingClaimCountAffectConsumer':current!=zero,
                     'sourceFlagAlreadyRaised':global_vars.get(row['flag'])==1,
                     'originalRollbackApplied':row['flag'] in rolled_back})
    return rows

def main():
    p=argparse.ArgumentParser();p.add_argument('--original-v177',type=Path,required=True);p.add_argument('--liu-decrypted-dir',type=Path,required=True)
    p.add_argument('--save',type=Path);p.add_argument('--registry-output',type=Path);p.add_argument('--local-output',type=Path)
    a=p.parse_args();registry=extract(a.original_v177,a.liu_decrypted_dir)
    if a.registry_output:a.registry_output.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
    summary={'sourceScripts':len(registry['sources']),'specialAwardRules':len(registry['awards']),
      'byGate':{gate:sum(x['gate']==gate for x in registry['awards']) for gate in ['연왕부','창옥','벽유교','유씨별원']},
      'counted':sum(x['countKey'] is not None for x in registry['awards']),
      'noCountLimit':sum(x['countKey'] is None for x in registry['awards']),
      'originalRollbackBranches':sum(x['rollback'] is not None for x in registry['awards'])}
    if a.save:
        save=json.loads(a.save.read_text());rows=whatif(registry,save)
        summary['alreadyClaimedCounterfactual']={'currentCountDisallowed':sum(x['claimCountCurrentEligible'] is False for x in rows),
           'resetCountEligible':sum(x['claimCountZeroEligible'] is True for x in rows),
           'affected':sum(x['doesChangingClaimCountAffectConsumer'] for x in rows),
           'unknownTempScope':sum(x['claimCountCurrentEligible'] is None for x in rows)}
        if a.local_output:a.local_output.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()