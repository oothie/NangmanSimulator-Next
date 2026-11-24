#!/usr/bin/env python3
"""Source-restricted BYJZT/Chuhun 60014 entry replay, all named RNG lanes independent.
Typed SBv3 table writes proven; hash order is modeled and native pairs not observed.
"""
from __future__ import annotations
import ast,copy,json,sys,re,hashlib,operator
from pathlib import Path
D=Path(__file__).resolve().parent
MODE_BOSSES={'기본':((50883,50883),(50910,50910),(44122,44122)),
             '추혼':((50941,50941),(50950,50950),(44138,44138))}
def tag(x):return ('n:' if type(x) is int else 's:')+str(x)
def source_tables():return json.loads((D/'BYJZT_12_SOURCE_TYPED_TABLES.json').read_text())
def restore_keys(x):
 if isinstance(x,dict):return {(int(k) if k.isdecimal() else k):restore_keys(v) for k,v in x.items()}
 if isinstance(x,list):return [restore_keys(v) for v in x]
 return x
def draw(seed,limit):
 if not isinstance(seed,int) or not 0<seed<2**53 or not isinstance(limit,int) or limit<=0:raise ValueError('invalid seed/bound')
 state=((seed+limit)*245109059551232+48083817484545)&((1<<64)-1)
 next_seed=(((state>>17)&2147483647)%2047483645)+1
 return next_seed,next_seed%limit+1
OPMAP={ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,
       ast.Eq:operator.eq,ast.NotEq:operator.ne,ast.Lt:operator.lt,ast.LtE:operator.le,
       ast.Gt:operator.gt,ast.GtE:operator.ge}
class Replay:
 def __init__(self,mode,seeds,flags,typed=None):
  if mode not in MODE_BOSSES:raise ValueError('bad mode')
  self.mode=mode;self.seeds=copy.deepcopy(seeds);self.flags=copy.deepcopy(flags)
  self.trace=[];self.path='';self.missing=set()
  self.proof=typed or source_tables()
  self.tree=restore_keys(json.loads((D/'BYJZT_SOURCE_EVENT_TREES.json').read_text())[mode])
 def eval(self,n):
  if isinstance(n,ast.Constant) and type(n.value) in (int,str):return n.value
  if isinstance(n,ast.UnaryOp) and isinstance(n.op,ast.USub):return -self.eval(n.operand)
  if isinstance(n,ast.BinOp) and type(n.op) in OPMAP:return OPMAP[type(n.op)](self.eval(n.left),self.eval(n.right))
  if isinstance(n,ast.Compare) and len(n.ops)==1 and type(n.ops[0]) in OPMAP:return OPMAP[type(n.ops[0])](self.eval(n.left),self.eval(n.comparators[0]))
  if isinstance(n,ast.BoolOp) and isinstance(n.op,ast.And):return all(self.eval(x) for x in n.values)
  if isinstance(n,ast.BoolOp) and isinstance(n.op,ast.Or):return any(self.eval(x) for x in n.values)
  if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and not n.keywords:
   op=n.func.id;args=[self.eval(x) for x in n.args]
   if op=='GetP':
    if args[0] not in self.flags:self.missing.add(args[0])
    return self.flags.get(args[0],0)
   if op=='SeedRandom':
    if len(args)!=3 or args[1]!=1:raise ValueError('Unsupported SeedRandom bounds '+str(args))
    k,_,limit=args
    if k not in self.seeds:raise KeyError('Original RNG key unavailable: '+str(k))
    s,v=draw(self.seeds[k],limit);self.seeds[k]=s
    self.trace.append({'path':self.path,'seedKey':k,'bound':limit,'value':v,'after':s})
    return v
   if op=='SetP':self.flags[args[0]]=args[1];return None
   if op=='AddP':self.flags[args[0]]=self.flags.get(args[0],0)+args[1];return None
   if op=='RmP':self.flags.pop(args[0],None);return None
   if op=='RmManyP':
    for k in args[0].split('|'):self.flags.pop(k,None)
    return None
  raise ValueError('Unsupported source AST: '+ast.dump(n))
 def exec_lua(self,text):
  text=re.sub(r'\)\s+(?=(?:SetP|AddP|RmP|RmManyP)\()',');',text)
  node=ast.parse(text,mode='exec')
  for e in node.body:
   if not isinstance(e,ast.Expr):raise ValueError('unsupported statement')
   self.eval(e.value)
 def run(self,nodes,where='3'):
  for step in sorted(nodes):
   node=nodes[step];self.path=f'{where}/{step}';op=node[2]
   if op=='jhLua':self.exec_lua(node[3]);continue
   if not isinstance(op,dict):raise ValueError('Unknown op type at '+self.path)
   if 'key' in op:
    if op['key']!='seed_byjzt':raise ValueError('Unsupported weighted seed '+op['key'])
    t=self.proof[self.mode]['tables'].get(str(step))
    if not t:raise ValueError('Missing original TDUP/TSET at '+self.path)
    bytag={tag(k):k for k in op if k!='key'}
    if set(bytag)!=set(t['source_typed_writes']):raise ValueError('Typed key mismatch at '+self.path)
    weights=[(k,int(str(k).strip())) for k in (bytag[p] for p in t['model_pairs_order'])]
    v=self.eval(ast.parse(f"SeedRandom('seed_byjzt',1,{sum(w for _,w in weights)})",mode='eval').body)
    for key,weight in weights:
     v-=weight
     if v<=0:self.run(op[key],self.path+'/'+str(key));break
    else:raise ValueError('No weighted result')
   elif 'cond' in op:
    cond=op['cond']['json'].replace('~=','!=')
    yes=bool(self.eval(ast.parse(cond,mode='eval').body))
    self.run(op.get('imp_yes' if yes else 'imp_no',{}),self.path+('/yes' if yes else '/no'))
   elif 'fuhuo' in op or 'map' in op:pass
   else:raise ValueError('Unsupported original op at '+self.path+' '+str(op)[:100])
 def replay(self):
  if self.flags.get('num_fuben',0)<1:raise ValueError('No 100-grade entry tokens')
  self.run(self.tree[3]);return self

def project(mode,seeds,flags,db):
 r=Replay(mode,seeds,flags).replay()
 rows=[]
 for grant,rng in MODE_BOSSES[mode]:
  c=next(x for x in db['consumers'] if x['gate']=='벽유교 본단' and x['mode']==mode and x['grantNpc']==grant)
  slot=r.flags.get(f'drop_{rng}_equip')
  if not slot:rows.append({'boss':grant,'equipment':'미드랍','id':None,'grade':None});continue
  grade=r.flags[f'drop_{rng}_color'];assert 1<=slot<=len(c['equipmentIds']) and 1<=grade<=4
  item=c['equipmentIds'][slot-1]
  rows.append({'boss':grant,'equipment':db['equipmentNames'][str(item)],'id':item,'grade':['','백색','녹색','청색','자색'][grade]})
 return {'mode':mode,'rows':rows,'seedsAfter':r.seeds,'rngCalls':len(r.trace),
         'missingGetPAssumedZero':sorted(r.missing),
         'nativePairsObserved':False,'realFutureVerified':False,'trace':r.trace}

if __name__=='__main__':
 proof=source_tables();out=Path(__file__).with_name('BYJZT_12_SOURCE_TYPED_TABLES.json')
 out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
 print('Extracted', {m:len(v['tables']) for m,v in proof.items()})
 for mode in ('기본','추혼'):
  # Additional source keys must be furnished separately; a synthetic case only.
  seeds={k:123456+i for i,k in enumerate(('seed_byjzt','seed_byj','seed_byjzt_50883','seed_byjzt_44122','seed_byjzt_50941','seed_byjzt_44138'))}
  flags={'num_fuben':1,'win_byjzt':20,'win_byjztex':5,
         'roll_9435_50883':0,'roll_9437_50910':0,'roll_9438_44122':0,'roll_9432_44122':0,
         'roll_9435_50941':0,'roll_9437_50950':0,'roll_9438_44138':0,'roll_9432_44138':0}
  db=json.loads((D/'gate-60-source-registry.json').read_text())
  r=project(mode,seeds,flags,db)
  print(json.dumps({'mode':mode,'syntheticDraws':r['rngCalls'],'rows':r['rows'],'missingGetPAssumedZero':r['missingGetPAssumedZero']},ensure_ascii=False))