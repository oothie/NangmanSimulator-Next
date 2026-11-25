#!/usr/bin/env node
'use strict';
/**
 * Lower-gate equipment ID/color precommitment and post-game verification.
 * A SHA256 hash detects changes, but its timestamp/prospective nature must be
 * externally established: never infer prospective proof from this module.
 * Private record / save bytes MUST stay on local disk, never in GitHub.
 */
const crypto=require('node:crypto');
const {audit,possibleAttribution}=require('./after_save_equipment_evidence.cjs');
const source=require('./60014_equipment_candidate_pools.json');
function sha(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function isPair(r){
 return r&&Number.isSafeInteger(r.itemId)&&r.itemId>0&&Number.isSafeInteger(r.color)&&r.color>=1&&r.color<=4;
}
function sortedPairs(xs){return xs.map(({itemId,color})=>({itemId,color})).sort((a,b)=>a.itemId-b.itemId||a.color-b.color);}
function seal(before,gate,forecast){
 if(!source.gates[gate])throw RangeError('Only six source-confirmed 20–80-tier gates are supported');
 if(!Array.isArray(forecast)||forecast.length>20)throw TypeError('Forecast must be a complete boss reward list');
 const required=Object.keys(source.gates[gate].bosses).map(Number);
 const actual=forecast.map(r=>r.npc);
 if(actual.length!==required.length||new Set(actual).size!==required.length||
  required.some(n=>!actual.includes(n)))throw RangeError('All original gate bosses exactly once, including no-drop');
 const cleaned=forecast.map(r=>{
  if(!r||!Number.isSafeInteger(r.npc))throw TypeError('Each boss must be identified');
  if(r.itemId==null){
   if(r.color!==null&&r.color!==undefined)throw TypeError('No-drop cannot have a color');
   return {npc:r.npc,itemId:null,color:null};
  }
  if(!isPair(r))throw TypeError('Drop must have original item ID and color code 1..4');
  if(!source.gates[gate].bosses[r.npc].includes(r.itemId))
   throw RangeError('Equipment not in original boss source array');
  return {npc:r.npc,itemId:r.itemId,color:r.color};
 });
 if(!before?.Rnds?.Sds||!before?.globalVariable||!Array.isArray(before?.Equips))
  throw TypeError('Source save must contain original gate seed/win/inventory');
 const oldIds=before.Equips.map(e=>e?.OnlyID);
 if(oldIds.some(x=>!Number.isSafeInteger(x))||new Set(oldIds).size!==oldIds.length)
  throw TypeError('Pre-existing equipment needs unique original OnlyID');
 const model={schema:'low-gate-gear-precommit-v1',gate,bossForecast:cleaned,
   beforeSaveHash:sha(before),kind:'source-model-forecast-not-game-certified'};
 return {privateRecord:model,
   publicCommitment:{schema:model.schema,forecastSha256:sha(model)},
   disclosures:{containsPrivateSave:false,containsOriginalRngSeed:false,
     containsPrivateForecast:true,requiresExternalPreClearTimestamp:true}};
}
function verify(before,after,privateRecord,publicCommitment){
 if(!privateRecord||!publicCommitment||sha(privateRecord)!==publicCommitment.forecastSha256)
  return {status:'FAIL_TAMPERED_SEAL',actualGamePredictionCertified:false};
 if(sha(before)!==privateRecord.beforeSaveHash)
  return {status:'FAIL_BEFORE_SAVE_MISMATCH',actualGamePredictionCertified:false};
 const gate=privateRecord.gate,expected=privateRecord.bossForecast.filter(x=>x.itemId!=null);
 const aud=audit(before,after);
 const changed=aud.gateProgress.filter(g=>g.winDelta!==0||g.changedSeedKeyNames.length);
 const observed=aud.newPossibleGateEquipment;
 const actualPairs=sortedPairs(observed.map(e=>({itemId:e.itemId,
  color:({'백색':1,'녹색':2,'청색':3,'자색':4})[e.color]??0})));
 const expectedPairs=sortedPairs(expected);
 const equipmentMatches=JSON.stringify(actualPairs)===JSON.stringify(expectedPairs);
 const safeSingleGate=changed.length===1&&changed[0].gate===gate&&changed[0].winDelta===1
  &&changed[0].consistency==='win-and-seed-moved';
 const noInventorySideEffects=aud.completeInventoryContinuity&&aud.otherNewEquipmentCount===0;
 const allPossible=observed.every(e=>e.progressedGateCandidates.some(g=>g.gate===gate));
 const consistent=equipmentMatches&&safeSingleGate&&noInventorySideEffects&&allPossible;
 return {
  status:consistent?'MATCHED_SOURCE_MODEL_NOT_NATIVE_PROOF':'INCONCLUSIVE_OR_MISMATCH',
  gate,sourcePredictedDrops:expected.length,observedPossibleGateDrops:observed.length,
  equipmentIdAndColorMultisetMatches:equipmentMatches,
  singleGateWinAndSeedEvidence:safeSingleGate,
  inventoryContinuity:noInventorySideEffects,
  originalBossSourcePoolAgreement:allPossible,
  externallyTimestampedPrecommitmentVerified:false,
  actualGamePredictionCertified:false,
  noPrivateSaveOrEquipmentOnlyIdsPrinted:true,
  note:'Matching retrospective save state and a private record is not proof the forecast was sealed before battle; external commitment time and no other intervening activity must be independently documented.'
 };
}
module.exports={seal,verify};
