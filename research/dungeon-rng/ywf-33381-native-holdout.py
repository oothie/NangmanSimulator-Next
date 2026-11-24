"""Offline 33381 Yanwangfu holdout. Saves stay on local machine; output only booleans."""
import argparse,importlib,json,sys
from pathlib import Path
BOSSES=("33654","33653","33652","33650")
def verify(before,after,replay):
    result=replay(before); gv=after["globalVariable"]; seed=after["Rnds"]["Sds"]
    checks={}
    for npc in BOSSES:
        checks["seed_"+npc]=result["seeds"]["seed_"+npc]==seed["seed_"+npc]
        record=result["bosses"][npc]
        checks["slot_"+npc]=record["index"]==gv.get("drop_"+npc+"_equip")
        if record["index"] is not None:
            checks["color_"+npc]=record["quality"]==gv.get("drop_"+npc+"_color")
    for k in ("roll_2921_33653","roll_2918_33652","roll_2920_33650"):
        checks[k]=result["global_state"].get(k)==gv.get(k)
    checks["one_clear"]=gv.get("win_ywf",0)-before["globalVariable"].get("win_ywf",0)==1
    return {"original_source":"33381_1.lua","rng_draws":result["counts"],
            "checks":checks,"passed":all(checks.values()),"assertions":len(checks),
            "known_limitation":"No-drop preserves previous color; consumer award ID pool not independently verified"}
def main():
    p=argparse.ArgumentParser();p.add_argument("before");p.add_argument("after");p.add_argument("local_source_dir");a=p.parse_args()
    root=Path(a.local_source_dir)
    sys.path[:0]=[str(root),str(root/"models"/"ywf"),str(root/"models"/"liu")]
    replay=importlib.import_module("ywf_33381_replay_v29").replay
    output=verify(json.loads(Path(a.before).read_text()),json.loads(Path(a.after).read_text()),replay)
    print(json.dumps(output,ensure_ascii=False,indent=2))
    return 0 if output["passed"] else 1
if __name__=="__main__":raise SystemExit(main())
