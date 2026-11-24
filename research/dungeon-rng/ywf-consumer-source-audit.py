#!/usr/bin/env python3
"""Extract authentic Yanwangfu slot->equipment ID arrays from original 60014 SBC bytes.
Usage: python ywf-consumer-source-audit.py /path/to/60014_GATE_9MODES_PRIOR_RECOVERY_V177_20261012.zip
No saves, native binaries or proprietary bytecode are copied to output.
"""
import hashlib,io,json,re,sys,zipfile
EXPECTED={
 "ywf_boss1":(33654,[4209,4809,5009,5409,5609]),
 "ywf_boss2":(33653,[4409,4809,5009,5209,5609]),
 "ywf_boss3":(33652,[4009,4809,5009,5409,5609]),
 "ywf_boss4":(33650,[4009,4209,4409,4609,4809,5009,5209,5409,5609])
}
PATTERN=re.compile(rb"local _var = \{([\d, ]+)\}; AddBattleDrop\((\d+), _var\[GetP\('drop_(\d+)_equip'\)\], GetP\('drop_(\d+)_color'\) \)")
def audit(archive):
 with zipfile.ZipFile(archive) as master:
  data=master.read("UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip")
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  output=[]
  for base,(npc,expected) in EXPECTED.items():
   blob=z.read("V174/"+base+".lua.sbc")
   matches=PATTERN.findall(blob)
   if len(matches)!=1:raise ValueError("Non-unique award source: "+base)
   ids,target,a,b=matches[0]
   actual=[int(x) for x in ids.split(b",")]
   if [int(target),int(a),int(b)]!=[npc]*3 or actual!=expected:
    raise AssertionError("Original award source differs: "+base)
   output.append({"npc":npc,"source":base+".lua.sbc","sha256":hashlib.sha256(blob).hexdigest(),"equipment_id_order":actual})
 return output
if __name__=="__main__":
 if len(sys.argv)!=2:raise SystemExit("Provide V177 zip")
 print(json.dumps(audit(sys.argv[1]),ensure_ascii=False,indent=2))
