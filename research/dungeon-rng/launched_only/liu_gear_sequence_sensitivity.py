#!/usr/bin/env python3
"""Separate Liu material/counter vs numeric 8915 multi-clear sensitivity for equipment predictions.
No real RNG seed values or private save content are emitted in public outputs.
"""
import argparse,copy,json,sys
from pathlib import Path
from released_four_gate_integrated_counterfactual import make_scenarios
from launched_gate_forward import BOSSES

def simulate_liu(start:dict,source_root:Path,clears:int=3):
    root=source_root.resolve()
    for folder in (root,root/'models/liu'):
        if str(folder) not in sys.path:sys.path.insert(0,str(folder))
    from experimental_four_gate_engine import report_liu
    current=copy.deepcopy(start);result=[]
    for i in range(1,clears+1):
        current,r=report_liu(current,i)
        result.append({'draws':r['call_count'],'seed':r['seed_after'],
          'equipment':[(b,r['bosses'][b]['slot'],r['bosses'][b]['grade']) for b,_ in BOSSES['유씨별원']]})
    return result

def compare(save,awards,materials,root,clears=3):
    scenarios=make_scenarios(save,awards,materials)
    normal=simulate_liu(scenarios['completed'],root,clears)
    cases={}
    for name,altered in scenarios.items():
        replay=simulate_liu(altered,root,clears)
        cases[name]=[{'clear':i+1,'equipmentChanged':replay[i]['equipment']!=normal[i]['equipment'],
           'drawCountChanged':replay[i]['draws']!=normal[i]['draws'],
           'seedChanged':replay[i]['seed']!=normal[i]['seed']}
               for i in range(clears)]
    return {'gate':'유씨별원','clears':clears,'source':'original-sourced v30 simulator; private hypothetical states',
       'notVerifiedNeverClaimed':True,'results':cases}

def main():
    p=argparse.ArgumentParser();p.add_argument('--save',type=Path,required=True)
    p.add_argument('--source-root',type=Path,required=True);p.add_argument('--awards',type=Path,required=True)
    p.add_argument('--materials',type=Path,required=True);p.add_argument('--clears',type=int,default=3)
    p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    if not 1<=a.clears<=10:raise ValueError('clears 1..10')
    data=compare(json.loads(a.save.read_text()),json.loads(a.awards.read_text()),
       json.loads(a.materials.read_text()),a.source_root,a.clears)
    a.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(data,ensure_ascii=False,indent=2))
if __name__=='__main__':main()