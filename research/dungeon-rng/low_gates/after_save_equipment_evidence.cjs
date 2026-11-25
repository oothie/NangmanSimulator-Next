#!/usr/bin/env node
'use strict';
/**
 * Korean 60014 lower-tier gate equipment before/after evidence audit.
 * No fabricated drop. Never exports account identity, OnlyID or original RNG
 * seeds. A new item matching multiple gates stays ambiguous.
 */
const source=require('./60014_equipment_candidate_pools.json');
const COLOR=Object.freeze({1:'백색',2:'녹색',3:'청색',4:'자색'});
const gates=source.gates;
function requireSave(s){
 if(!s||typeof s!=='object'||!s.Rnds?.Sds||!s.globalVariable||!Array.isArray(s.Equips))
  throw new TypeError('Both saves must include Rnds.Sds, globalVariable and Equips');
 return s;
}
function equipByUniqueId(items){
 const map=new Map();
 for(const e of items){
  if(!e||!Number.isSafeInteger(e.OnlyID)||!Number.isSafeInteger(e.ID)||
   !Number.isSafeInteger(e.Color)||e.Color<1||e.Color>6)
   throw new TypeError('OnlyID, ID and Color are required for full inventory comparison');
  if(map.has(e.OnlyID))throw new Error('Duplicate OnlyID prevents reliable inventory diff');
  map.set(e.OnlyID,e);
 }
 return map;
}
function safeWin(v,name){
 const n=v??0;
 if(!Number.isSafeInteger(n)||n<0)throw new TypeError('Missing/invalid win counter '+name);
 return n;
}
function possibleAttribution(id){
 const matches=[];
 for(const [gate,p] of Object.entries(gates)){
  const bosses=Object.entries(p.bosses).filter(([,ids])=>ids.includes(id)).map(([npc])=>Number(npc));
  if(bosses.length)matches.push({gate,bossCandidates:bosses});
 }
 return matches;
}
function audit(before,after){
 requireSave(before);requireSave(after);
 const old=equipByUniqueId(before.Equips),newItems=equipByUniqueId(after.Equips);
 const removed=[...old.keys()].filter(k=>!newItems.has(k));
 const added=[...newItems.entries()].filter(([key])=>!old.has(key)).map(([,e])=>e);
 const changedExisting=[...old].filter(([key,e])=>newItems.has(key)&&(
  newItems.get(key).ID!==e.ID||newItems.get(key).Color!==e.Color)).length;
 const progress=[];
 for(const [gate,p] of Object.entries(gates)){
  const from=safeWin(before.globalVariable[p.win],p.win),to=safeWin(after.globalVariable[p.win],p.win);
  const changed=p.seeds.filter(key=>!Object.is(before.Rnds.Sds[key],after.Rnds.Sds[key]));
  const missing=p.seeds.filter(key=>!Number.isSafeInteger(before.Rnds.Sds[key])||
                                          !Number.isSafeInteger(after.Rnds.Sds[key]));
  progress.push({gate,winDelta:to-from,changedSeedKeyNames:changed.filter(k=>!missing.includes(k)),
    missingSeedKeyNames:missing,
    consistency:to<from?'counter-reset-or-other-account':
     missing.length?'missing-seed':
     to>from&&changed.length?'win-and-seed-moved':
     to>from?'win-moved-seed-unchanged':
     changed.length?'seed-moved-no-win':'unchanged'});
 }
 const progressed=progress.filter(x=>x.winDelta>0&&!x.missingSeedKeyNames.length);
 const evidence=added.map(e=>{
  const candidates=possibleAttribution(e.ID);
  const active=candidates.filter(c=>progressed.some(p=>p.gate===c.gate));
  return {
   itemId:e.ID,color:COLOR[e.Color]||'기타 등급',
   originalGateCandidates:candidates,
   progressedGateCandidates:active,
   identification:active.length===0?'not-linked-to-observed-win':
     active.length===1?'one-compatible-gate-not-confirmed':'ambiguous-among-progressed-gates'
  };
 }).filter(e=>e.originalGateCandidates.length);
 const unknownAdded=added.length-evidence.length;
 const allStable=removed.length===0&&changedExisting===0;
 return {
  schema:'60014-lower-gate-equipment-save-pair-evidence-v1',
  evidenceType:'historical inventory and seed/win consistency only',
  sourceGates:Object.keys(gates),sourceBosses:source.gates&&Object.values(gates).reduce((n,p)=>n+Object.keys(p.bosses).length,0),
  gateProgress:progress,
  newPossibleGateEquipment:evidence,
  otherNewEquipmentCount:unknownAdded,
  preexistingEquipmentRemovedCount:removed.length,
  preexistingEquipmentChangedCount:changedExisting,
  completeInventoryContinuity:allStable,
  strictNativeForwardValidation:false,
  independentDropAttributionConfirmed:false,
  exactNewGamePredictionVerified:false,
  preservesPrivateOnlyIds:true,
  caveats:[
   'Equipment item ID overlap makes Tianyi/Guge or bosses within a gate ambiguous',
   'An unrelated field drop of the same equipment ID is also possible',
   'A winning gate, a seed change and an equipment inventory addition do not prove boss attribution',
   'No 60014 native LuaJIT pairs/hash equivalence or prospective holdout yet'
  ]
 };
}
module.exports={audit,possibleAttribution};
