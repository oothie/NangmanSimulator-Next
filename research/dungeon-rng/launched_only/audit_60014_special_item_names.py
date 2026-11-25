#!/usr/bin/env python3
"""Validate source-game special reward Korean item names using the 60014 HTML.

This only checks item naming, NOT 54506->60014 reward-script equivalence.
No private save or account state is used; the large client-derived HTML is read
locally and must never be copied into the public repository.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

REGISTRY=re.compile(
    r"export const SPECIAL_KOREAN_NAMES = Object\.freeze\((\{[^\n]+\})\);"
)

def validate(item_html: Path, engine: Path):
    source=engine.read_text(encoding="utf8")
    match=REGISTRY.search(source)
    if not match:
        raise ValueError("Source engine Korean names JSON registry is missing")
    labels=json.loads(match[1])
    raw=item_html.read_bytes()
    results=[]
    for id_text,label in labels.items():
        token=('"'+id_text+'":{').encode("ascii")
        position=0
        candidates=[]
        while True:
            position=raw.find(token,position)
            if position<0:break
            region=raw[position:position+1600]
            end=region.find(b'},"')
            if end>=0:region=region[:end]
            name=re.search(rb'"name":"([^"]+)"',region)
            valid_id=re.search(rb'"id":'+id_text.encode("ascii")+rb'(?!\d)',region)
            # Item data appears before other unrelated tables that reuse ID
            # keys (characters, status definitions, and change logs).
            if name and valid_id and b'"table":"char_data"' not in region:
                candidates.append(name[1].decode("utf8").strip())
            position+=len(token)
        if not candidates:
            raise ValueError("No item name for "+id_text)
        observed=candidates[0]
        expected=label.strip()
        if observed!=expected:
            raise ValueError("Korean name mismatch for "+id_text+": "+
                             repr(expected)+" vs "+repr(observed))
        results.append({"id":int(id_text),"name":observed})
    if len(results)!=35:raise ValueError("Unexpected launched special item count")
    return {"source":"60014 Korean V6.20 item table",
            "crossVersionRewardLogicVerified":False,
            "namesMatched":len(results),"items":results}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--korean-html",type=Path,required=True)
    parser.add_argument("--research-engine",type=Path,required=True)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    report=validate(args.korean_html,args.research_engine)
    data=json.dumps(report,ensure_ascii=False,indent=2)+"\n"
    if args.output:args.output.write_text(data,encoding="utf8")
    else:print(data,end="")

if __name__=="__main__":
    main()
