#!/usr/bin/env python3
"""Verify original 54506 boss event consumer guard expressions, independently.

Uses local original gate V177 archive and source-extracted registry JSON.
The archive is a 54506 datamine; 60014 parity is NOT established. Reads no
personal saves, character records or user RNG state.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import zipfile
from pathlib import Path

ARCHIVE = "UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip"
STATIC = re.compile(rb"AddBattleDrop\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)")
NUMERIC = re.compile(rb"GetP\(\s*(\d+)\s*\)")

def audit(archive: Path, registry: Path):
    db = json.loads(registry.read_text(encoding="utf8"))
    entries = [r for r in db["awards"] if r["script"].startswith("V174/")]
    assert len(entries) == 33, "Expected 33 preserved V174 consumer rules"
    with zipfile.ZipFile(archive) as outer:
        inner_bytes = outer.read(ARCHIVE)
    result = []
    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as original:
        for entry in entries:
            blob = original.read(entry["script"])
            payout = [m for m in STATIC.finditer(blob)
                      if (int(m[1]), int(m[2]), int(m[3])) ==
                      (entry["npc"], entry["item"], entry["quantity"])]
            if len(payout) != 1:
                raise ValueError("Ambiguous original payout in " + entry["script"])
            boundary = blob.find(b"\x0eeventFile\x10general_win")
            if boundary < 0 or payout[0].start() < boundary:
                raise ValueError("Reward outside original victory event")
            guard = entry["consumerCondition"].encode("utf8")
            after = blob[payout[0].end():payout[0].end()+420]
            if guard not in after:
                raise ValueError("Missing source guard " + entry["script"] +
                                 " " + str(entry["item"]))
            guards = [int(n) for n in NUMERIC.findall(after[:240])]
            expected = [3970] if (entry["npc"], entry["item"]) == (35221, 3970) else []
            if guards != expected:
                raise ValueError("Unexpected original numeric GetP conditions " +
                                 str((entry["npc"], entry["item"], guards)))
            if entry["countKey"]:
                token = ("GetP('" + entry["countKey"] + "')").encode()
                if token not in guard:
                    raise ValueError("Count guard missing source GetP expression")
            result.append({"npc": entry["npc"], "item": entry["item"],
                           "source": entry["script"], "numericGetP": guards,
                           "guardVerified": True})
    return {"scriptVersion": "1.124.54506", "current60014Parity": "UNVERIFIED",
            "originalConsumerGuards": len(result), "extraNumericGetP": 1,
            "checks": result}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-archive", type=Path, required=True)
    parser.add_argument("--consumer-registry", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = audit(args.source_archive, args.consumer_registry)
    data = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(data, encoding="utf8")
    else:
        print(data, end="")

if __name__ == "__main__":
    main()
