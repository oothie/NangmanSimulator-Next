#!/usr/bin/env python3
"""Read-only Korean 60014 Qingcheng TiledMap audit; no user save handling.
Native JHTMXMapInfoC2Ev builds the map-specific XXTEA key JiangHuTmx and
prefix DADDY; parseXMLFile calls xxtea_decrypt on the bytes after prefix.
"""
import hashlib
import json
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

EXPECTED = "3ac7a5978c6bd6ac346c76359aa54ce43686323a11525d9e268d977f593eb726"
KEY = b"JiangHuTmx"

def decrypt(blob):
    if not blob.startswith(b"DADDY"):
        raise ValueError("Not an encrypted Korean 60014 map")
    data = blob[5:]
    if len(data) % 4 or len(data) < 8:
        raise ValueError("Bad ciphertext size")
    n = len(data) // 4
    v = list(struct.unpack("<%dI" % n, data))
    k = struct.unpack("<4I", KEY.ljust(16, b"\0"))
    delta = 0x9E3779B9
    total = ((6 + 52 // n) * delta) & 0xffffffff
    def mx(z, y, p, e):
        return (((z >> 5 ^ y << 2) + (y >> 3 ^ z << 4))
                ^ ((total ^ y) + (k[(p & 3) ^ e] ^ z))) & 0xffffffff
    y = v[0]
    while total:
        e = (total >> 2) & 3
        for p in range(n - 1, 0, -1):
            z = v[p - 1]
            y = (v[p] - mx(z, y, p, e)) & 0xffffffff
            v[p] = y
        z = v[-1]
        y = (v[0] - mx(z, y, 0, e)) & 0xffffffff
        v[0] = y
        total = (total - delta) & 0xffffffff
    plain = struct.pack("<%dI" % n, *v)
    length = v[-1]
    if length < 32 or length > len(plain) - 4:
        raise ValueError("Invalid native decrypted map")
    return plain[:length]

def summarize(blob):
    if hashlib.sha256(blob).hexdigest() != EXPECTED:
        raise ValueError("Unverified input map SHA256")
    root = ET.fromstring(decrypt(blob))
    if root.tag != "map" or root.attrib.get("orientation") != "isometric":
        raise ValueError("Unexpected original map")
    npc = root.find("objectgroup[@name='npc']")
    if npc is None:
        raise ValueError("Missing npc group")
    entries = []
    for element in npc.findall("object"):
        attrs = element.attrib
        entries.append(dict(
            objectId=int(attrs["id"]), npcId=int(attrs["name"]),
            x=float(attrs["x"]), y=float(attrs["y"]),
            type=attrs.get("type", "")))
    return dict(
        source="Original Korean 60014 map_qc.tmx",
        sourceSha256=EXPECTED, width=int(root.attrib["width"]),
        height=int(root.attrib["height"]), npcObjects=len(entries),
        banditSpawns=[e for e in entries if e["npcId"] == 32950],
        otherNpcIds=sorted({e["npcId"] for e in entries if e["npcId"] != 32950}),
        futureBattleLineupVerified=False, privateSaveUsed=False)

def read(path):
    path = Path(path)
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            return archive.read("map_qc.tmx")
    return path.read_bytes()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python decode-qingcheng-tmx.py LOCAL_ORIGINAL_MAP_ZIP_OR_TMX",
              file=sys.stderr)
        sys.exit(2)
    try:
        print(json.dumps(summarize(read(sys.argv[1])), ensure_ascii=False, indent=2))
    except Exception:
        print("Original map decryption failed; input path withheld", file=sys.stderr)
        sys.exit(1)
