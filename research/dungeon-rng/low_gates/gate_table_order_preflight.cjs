'use strict';
/**
 * Gate equipment forward-model risk preflight, NOT a native-game predictor.
 * Supply a FULL trace of ORIGINAL weighted table paths and values for a
 * particular low gate. If a table is missing or dynamically evaluated it
 * cannot be certified. The model-only parity of individual weighted effects
 * does not prove seed progression parity across different branch paths.
 *
 * No raw RNG seed, save, role data or equipment OnlyID is handled or emitted.
 */
const {GROUPS}=require('./audit_40_table_synthetic_key.cjs');
const {atRoll}=require('./audit_40_table_equipment_effects.cjs');
const PATHS=new Map(GROUPS.map(x=>[x.gate,
 Object.entries(x).filter(([k])=>k!=='gate').flatMap(([kind,paths])=>
 paths.map(path=>({path,kind})))]));
function preflight(gate,stageRolls){
 if(!PATHS.has(gate))throw RangeError('Unsupported Korean original released low-gate source');
 if(!Array.isArray(stageRolls)||stageRolls.length>40)
  throw TypeError('A complete original source weighted-event trace array is required');
 const required=PATHS.get(gate),look=new Map(),duplicates=[];
 for(const item of stageRolls){
  if(!item||typeof item.path!=='string'||!Number.isSafeInteger(item.roll))
   throw TypeError('Original weighted event path and integer roll are required');
  if(look.has(item.path))duplicates.push(item.path);
  else look.set(item.path,item.roll);
 }
 if(duplicates.length)throw RangeError('Duplicate source weighted table paths');
 const missing=required.filter(r=>!look.has(r.path)).map(r=>r.path);
 const unknown=[...look.keys()].filter(p=>!required.some(r=>r.path===p));
 if(unknown.length)throw RangeError('Unrecognized original gate weighted table path');
 const stages=required.filter(r=>look.has(r.path)).map(r=>{
  if(r.kind==='dynamic')return {path:r.path,effect:'dynamic-conditional',
   unanimousSourceModels:false,blockedByDynamicBranch:true};
  const outcome=atRoll(gate,r.path,look.get(r.path));
  return {path:r.path,sourceEffects:outcome.effects,
   unanimousSourceModels:outcome.allModelEffectAgreement,
   blockedByDynamicBranch:false};
 });
 const modelDisagreement=stages.filter(r=>!r.unanimousSourceModels).map(r=>r.path);
 const dynamic=stages.filter(r=>r.blockedByDynamicBranch).map(r=>r.path);
 return {
  gate,sourceWeightedStageCount:required.length,providedWeightedStageCount:look.size,
  missingWeightedStages:missing,
  ambiguousEffectPaths:modelDisagreement,
  dynamicWeightedStages:dynamic,
  allThreeModelEffectsAgreeForGivenStageRolls:missing.length===0&&modelDisagreement.length===0,
  hasIndependentNativePairsProof:false,
  hasIndependentNativeSeedProgressionProof:false,
  sameStageRollAcrossBranchHistoriesProven:false,
  exactGameGearForecastAllowed:false,
  accountDataUsed:false,
  sourceOnly:true,
  note:'Key position first/last/absent are hypothetical LuaJIT models. Even unanimous weighted effects do not prove native RNG progress when earlier branch consumes other calls.'
 };
}
module.exports={preflight,PATHS};
