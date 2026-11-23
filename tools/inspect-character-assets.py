#!/usr/bin/env python3
"""Inspect saved simulator and game archives without bulk extraction.
Usage: python tools/inspect-character-assets.py reference.zip hero.zip images.zip split_asset001.apk --output character-assets-report.json
Only the ZIP central directory is enumerated. No images or APK files are unpacked.
"""
import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path

SCRIPT = re.compile(r"(?:^|/)(?:character|avatar|role|hero|sprite|skin|appearance|head|hair|body|full|clothes|fashion)[^/]*\.(?:js|json|html|css)$", re.I)
IMAGE = re.compile(r"(?:^|/)(?:heads?|hairs?|full|heroes?|characters?|roles?|skins?|fashion|spine|body|avatars?)/", re.I)
IMAGE_EXT = {".png", ".webp", ".jpg", ".jpeg", ".atlas", ".skel", ".json", ".bytes"}
RELEVANT = re.compile(r"(?:head|hair|full|hero|role|character|player|body|fashion|skin|avatar|spine|dress|cloth|hat|costume|weapon)", re.I)

def scan(path, samples=50):
    p=Path(path)
    report={"file":p.name, "bytes":p.stat().st_size, "entries":0, "matched":0, "extensions":{}, "scripts":[], "image_examples":[], "other_examples":[], "errors":[]}
    try:
        with zipfile.ZipFile(p) as z:
            types=Counter()
            for info in z.infolist():
                report["entries"] += 1
                if info.is_dir(): continue
                name=info.filename.replace("\\", "/")
                ext=Path(name).suffix.lower()
                types[ext]+=1
                if SCRIPT.search(name):
                    report["matched"]+=1
                    if len(report["scripts"])<samples: report["scripts"].append({"path":name, "bytes":info.file_size})
                elif (IMAGE.search(name) or RELEVANT.search(name)) and ext in IMAGE_EXT:
                    report["matched"]+=1
                    if len(report["image_examples"])<samples: report["image_examples"].append({"path":name, "bytes":info.file_size})
                elif RELEVANT.search(name):
                    report["matched"]+=1
                    if len(report["other_examples"])<samples: report["other_examples"].append({"path":name, "bytes":info.file_size})
            report["extensions"]=dict(types.most_common(25))
    except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
        report["errors"].append(str(exc))
    return report

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("archives", nargs="+")
    ap.add_argument("--output", default="character-assets-report.json")
    ap.add_argument("--samples", type=int, default=80)
    ns=ap.parse_args()
    results=[scan(p, ns.samples) for p in ns.archives]
    Path(ns.output).write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    for item in results:
        print(f"{item['file']}: {item['entries']} entries; {item['matched']} candidates; {len(item['scripts'])} script references; {len(item['image_examples'])} sampled assets")
        if item["errors"]:print("  ERROR:", "; ".join(item["errors"]))
    print("Metadata report:",ns.output)

if __name__=="__main__":
    main()
