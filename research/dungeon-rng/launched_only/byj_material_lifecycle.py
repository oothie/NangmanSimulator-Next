#!/usr/bin/env python3
"""Fail-closed BYJ 3-stage reward lifecycle based on decrypted original script.

Entry: original steps 10..23 material weights/caps (no seed_byj draw).
Rescue: original event 36274/36275 dynamic-weighted branches, selected outcomes
        must be externally observed or provided (random chooser unresolved).
Exit: original 'byj_out' event conditional empty-group fallback (JHRandom 3..5);
      cannot pretend upstream exit branch is known.
"""
from __future__ import annotations
import copy
from byj_original_material_prestage import apply as prestage
from byj_original_material_consumer import possible_rewards,apply_known_selected_outcomes
from byj_original_exit_fallback import conditionally_plan_exit


def trace_lifecycle(save:dict,rescue_registry:dict,selected:dict|None=None,
                    rescue_executed:bool=False,exit_completed:bool|None=None,apply_entry:bool=True)->dict:
    source,stage=prestage(save) if apply_entry else (copy.deepcopy(save),{'prestageSkipped':True})
    gv=source['globalVariable']
    candidates=possible_rewards(gv,rescue_registry,rescue_executed)
    output={'materialPrestage':stage,'rescue':candidates,'selectionRequired':False,
            'exit':{'status':'unresolved','grants':[]},'seedByjDrawsModeled':stage.get('rngDrawsConsumed',0),
            'rngUnknown':'Event weighted chooser and JHRandom quantities are not externally verified'}
    if rescue_executed and candidates['status']=='conditional-weighted-candidates':
        output['selectionRequired']=any(g['candidates'] for g in candidates['groups'])
        if selected is not None:
            # Only explicitly selected outcomes are applied; never infer random winners.
            v,effects=apply_known_selected_outcomes(gv,rescue_registry,selected,True)
            output['rescueEffects']=effects
            output['selectionRequired']=False
            gv=v
        else:
            output['exit']={'status':'blocked-pending-unknown-rescue-selection','grants':[]}
            return output
    output['exit']=conditionally_plan_exit(gv,exit_completed)
    return output