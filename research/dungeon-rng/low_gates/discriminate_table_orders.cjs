'use strict';
/**
 * Observation-based discrimination of three hypothetical Korean 60014
 * LuaJIT table construction orders. This is NOT a seed or future drop engine.
 * Observations use source-table roll (1..100), not a saved game's seed.
 * Never infer the source roll from a visible item: that is circular evidence.
 */
const {GROUPS}=require('./audit_40_table_synthetic_key.cjs');
const {atRoll}=require('./audit_40_table_equipment_effects.cjs');
const {PATTERNS}=require('./audit_40_table_metadata_positions.cjs');
const MODELS=Object.freeze(['first','last','absent']);
const TABLES=new Map();
for(const group of GROUPS){
 for(const [kind,paths] of Object.entries(group)){
  if(kind==='gate')continue;
  for(const path of paths){
   const id=group.gate+'|'+path;
   if(TABLES.has(id))throw Error('Duplicate source table');
   TABLES.set(id,{gate:group.gate,path,kind});
  }
 }
}
function validateRow(row){
 if(!row||typeof row.gate!=='string'||typeof row.path!=='string')
  throw TypeError('Gate and original table path required');
 const info=TABLES.get(row.gate+'|'+row.path);
 if(!info)throw RangeError('Unknown 60014 gate/table');
 if(info.kind==='dynamic')throw RangeError('Dynamic table is not source-constant; cannot discriminate');
 if(!Number.isSafeInteger(row.roll)||row.roll<1||row.roll>100)
  throw RangeError('Original source table roll must be integer 1..100');
 if(typeof row.effect!=='string'||!['no-drop','equipment','weapon','color:1','color:2','color:3','color:4'].includes(row.effect))
  throw TypeError('Observed original branch effect required');
 const effects=atRoll(row.gate,row.path,row.roll).effects;
 if(!Object.values(effects).includes(row.effect))
  return {info,effects,compatible:[]};
 return {info,effects,compatible:MODELS.filter(m=>effects[m]===row.effect)};
}
function discriminate(observations){
 if(!Array.isArray(observations)||observations.length>1000)
  throw TypeError('Array of at most 1000 typed weighted-stage observations required');
 const per=[],survivors=new Set(MODELS);
 for(const row of observations){
  const r=validateRow(row);
  for(const model of MODELS)if(!r.compatible.includes(model))survivors.delete(model);
  per.push({gate:row.gate,path:row.path,roll:row.roll,observedEffect:row.effect,
   modelEffects:r.effects,compatibleModels:r.compatible});
 }
 const remaining=[...survivors];
 return {schema:'lower-gate-source-order-discrimination-v1',
  observations:per,remainingModels:remaining,
  internallyConsistent:remaining.length>0,
  singleSourceModelRemaining:remaining.length===1,
  nativePairsVerified:false,nativeRngConsumptionVerified:false,
  exactFutureEquipmentPredictionAllowed:false,
  evidenceScope:'Requires independently known original table roll and its observed branch; item/color alone cannot reveal roll',
  accountDataUsed:false};
}
function informativeIntervals(gate,path){
 const info=TABLES.get(gate+'|'+path);
 if(!info)throw RangeError('Unknown 60014 gate/table');
 if(info.kind==='dynamic')return {gate,path,dynamic:true,intervals:[],nativeVerified:false};
 const total=PATTERNS[info.kind].keys.reduce((s,x)=>s+Number(x),0);
 const intervals=[];
 for(let roll=1;roll<=total;roll++){
  const e=atRoll(gate,path,roll).effects;
  const signature=MODELS.map(k=>e[k]).join('|');
  const previous=intervals[intervals.length-1];
  if(previous&&previous.signature===signature){previous.end=roll;}
  else intervals.push({start:roll,end:roll,signature,
   effects:e,discriminating:new Set(Object.values(e)).size>1});
 }
 return {gate,path,dynamic:false,intervals,
  discriminatingRollCount:intervals.reduce((n,v)=>n+(v.discriminating?v.end-v.start+1:0),0),
  nativeVerified:false,seedUsed:false};
}
module.exports={discriminate,informativeIntervals,MODELS};
