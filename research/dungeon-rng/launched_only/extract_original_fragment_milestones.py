#!/usr/bin/env python3
"""Reconstruct 8 fragment-completion follow-up effects from original 60014 SBC.

Input is the LOCAL archival V177 zip; original compressed SBC bytes stay local.
Output includes only game IDs, condition, event side effect, and source hash.
No user save or seed is accessed or written.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

SOURCE = 'UPSTREAM/60014_FIELD_GATE_FUNCTION_CACHE_V174_20261012.zip'
SHOP = re.compile(rb"AddP\(\s*'(?P<shop>buyshop_\d+)'\s*,\s*(?P<delta>\d+)\s*\)")
GUARD = re.compile(rb"GetP\(\s*'(?P<count>get_\d+)'\s*\)\s*==\s*(?P<value>\d+)")
DROP = re.compile(rb"AddBattleDrop\(\s*(?P<npc>\d+)\s*,\s*(?P<item>\d+)\s*,\s*\d+\s*\)")


def extract(outer: Path) -> list[dict]:
    with zipfile.ZipFile(outer) as archive:
        nested = archive.read(SOURCE)
    entries = []
    with zipfile.ZipFile(io.BytesIO(nested)) as archive:
        for name in sorted(archive.namelist()):
            if not re.search(r'/(?:dcy|byj|ywf)_boss\d+\.lua\.sbc$', name):
                continue
            blob = archive.read(name)
            for effect in SHOP.finditer(blob):
                following = blob[effect.end():effect.end() + 120]
                before = blob[max(0, effect.start() - 160):effect.start()]
                guard = GUARD.search(following)
                drop = list(DROP.finditer(before))
                if not guard or len(drop) != 1:
                    raise ValueError(f'Cannot uniquely prove milestone: {name}')
                source = drop[0]
                entries.append({
                    'npc': int(source['npc']),
                    'item': int(source['item']),
                    'count': guard['count'].decode(),
                    'before': int(guard['value']),
                    'shop': effect['shop'].decode(),
                    'delta': int(effect['delta']),
                    'source': name,
                    'sha256': hashlib.sha256(blob).hexdigest(),
                    'guard': following[guard.start():guard.end()].decode()
                })
    if len(entries) != 8:
        raise ValueError('Original milestone count changed: ' + str(len(entries)))
    keys = [(e['npc'], e['item']) for e in entries]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate fragment completion source')
    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, help='Optional game-only rule JSON')
    args = parser.parse_args()
    rows = extract(args.source_archive)
    text = json.dumps(rows, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text, encoding='utf-8')
    else:
        print(text, end='')


if __name__ == '__main__':
    main()
