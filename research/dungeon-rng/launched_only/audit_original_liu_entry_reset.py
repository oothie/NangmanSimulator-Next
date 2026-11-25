#!/usr/bin/env python3
"""Audit the first two original 35271_1 Liu manor entry steps.

Accepts only the locally extracted 60014 event reconstruction. It does not
read or output any user save, seed, account identifier, or observation.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

RESET = {
 "fuben_lsby": 1, "search_lsby": 0, "open_mishilsby": 0,
 "lsby_2001": 0, "lsby_2002": 0, "lsby_2003": 0,
}
REMOVE = {
 "lsby_boss1", "lsby_boss2", "lsby_boss3",
 "round_lsby", "quick_fuben", "ambush_lsby",
}
SET = re.compile(r"SetP\('([a-z0-9_]+)',\s*(-?\d+)\)")
ADD = re.compile(r"AddP\('([a-z0-9_]+)',\s*(-?\d+)\)")

def audit(path:Path):
 obj=json.loads(path.read_text(encoding="utf-8"))
 steps=obj["3"]
 first=steps["1"]["3"]
 second=steps["2"]["3"]
 sets={key:int(value) for key,value in SET.findall(first)}
 adds={key:int(value) for key,value in ADD.findall(first)}
 if sets!=RESET:raise ValueError("Original entry SetP commands changed: "+str(sets))
 if adds!={"num_fuben":-1}:
  raise ValueError("Original entry spend AddP command changed")
 expected="RmManyP('"+("|".join([
  "lsby_boss1","lsby_boss2","lsby_boss3","round_lsby",
  "quick_fuben","ambush_lsby"]))+"')"
 if second!=expected:raise ValueError("Original entry RmManyP keys changed")
 if "SeedRandom" in first or "SeedRandom" in second:
  raise ValueError("Original entry reset unexpectedly consumes game RNG")
 third=steps["6"]["3"]
 if third!="SetP('drop_35260_rarematerial',1)":
  raise ValueError("Original 8801 producer direct SetP has changed")
 return {"source":"35271_1.lua.reconstructed.json",
  "originalEntrySetP":sets,"originalEntryAddP":adds,
  "originalEntryRmManyP":sorted(REMOVE),
  "sourceStep6RareMaterialFlag":third,
  "entryResetConsumesSeed":False,
  "sourceGameStateOnly":True}

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--entry",required=True,type=Path)
 args=parser.parse_args()
 print(json.dumps(audit(args.entry),ensure_ascii=False,indent=2))

if __name__=="__main__":main()
