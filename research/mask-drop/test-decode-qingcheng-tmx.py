#!/usr/bin/env python3
"""Synthetic native-TMX decoder test; private saves never used or printed."""
import base64
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("qc_decoder",ROOT/"decode-qingcheng-tmx.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
plain=b'<?xml version="1.0"?><map><npc/></map>'
cipher=base64.b64decode("REFERFnKGzH8rPxszSQ/zlnD+s/KJoMFV7jTZa7BGrZvy93zYrEGG6A5TOdTEqiaRw==")
assert module.decrypt(cipher)==plain
meta=json.loads((ROOT/"60014-qingcheng-map-spawns.json").read_text(encoding="utf-8"))
assert meta["sourceBanditNpc"]==32950
assert meta["encryptedSha256"]==module.EXPECTED
assert len(meta["fixedBanditObjects"])==6
assert sorted(x["objectId"] for x in meta["fixedBanditObjects"])==[1331,1332,1333,1334,1335,1422]
assert meta["npcObjectCount"]==9
assert meta["predictedFutureBanditCounts"] is None
assert meta["nativeBattleLineupSourceRecovered"] is False
assert meta["privateUserDataIncluded"] is False
try:
    module.decrypt(b"INVALID")
except ValueError:
    pass
else:
    raise AssertionError("Decoder accepted nonnative map")
print("PASS Korean 60014 native TMX decrypt synthetic vector and source-verified six fixed NPC objects")
