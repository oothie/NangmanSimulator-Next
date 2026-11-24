#!/usr/bin/env python3
"""Load audited WSD source-key construction; retain native-pairs-model caveat."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dungeon_v108'))
from entry_v108 import Entry

def orders_from_manifest(mode,proof):
 if mode not in ('wsd','wsdex'):raise ValueError('Invalid WSD mode')
 rows=proof['modes'][mode]['weighted_tables']
 def lookup(path,keys):
  path=path+'/2'; major='/'.join(path.split('/')[:2])+'/'
  candidates=[k for k in rows if k.startswith(major) and sorted(x[2:] for x in rows[k]['source_write_keys'])==sorted(str(x) for x in keys)]
  if len(candidates)!=1:raise KeyError('Source exact table not proven or ambiguous: '+mode+' '+path)
  row=rows[candidates[0]]
  m={}
  for k in keys:
   candidates2=[tag for tag in row['source_write_keys'] if tag[2:]==str(k)]
   if len(candidates2)!=1:raise ValueError('Source native key type ambiguous')
   m[candidates2[0]]=k
  if len(m)!=len(keys) or set(m)!=set(row['source_write_keys']):raise ValueError('Original source key mismatch')
  return [m[tag] for tag in row['model_pairs_keys']]
 return lookup

def load_manifest(path=ROOT/'WSD_29_SOURCE_TYPED_TABLES.json'):
 j=json.loads(Path(path).read_text())
 if {k:len(j['modes'][k]['weighted_tables']) for k in ('wsd','wsdex')}!={'wsd':9,'wsdex':20}:
  raise ValueError('Not the WSD 29-table audited manifest')
 return j