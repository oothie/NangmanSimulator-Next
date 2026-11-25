#!/usr/bin/env node
'use strict';
/**
 * Local-only CLI for comparing original before/after saves at 20–80 gates.
 * Never logs raw save values, private equipment object IDs, seed values,
 * account fields, filenames or input paths.
 */
const fs=require('node:fs');
const {audit}=require('./after_save_equipment_evidence.cjs');
function safeReport(before,after){
 const r=audit(before,after);
 return {
  scope:'한국판 출시 하위 관문 6곳, 40급 묵문유적 일반 장비 소비자는 별도 미복원',
  evidence:r.evidenceType,
  gates:r.gateProgress,
  newCandidateEquipment:r.newPossibleGateEquipment,
  otherNewEquipmentCount:r.otherNewEquipmentCount,
  preexistingEquipmentRemovedCount:r.preexistingEquipmentRemovedCount,
  preexistingEquipmentChangedCount:r.preexistingEquipmentChangedCount,
  sourcePoolsAreOnlyCandidates:true,
  directBossAttributionProven:false,
  futureGameDropsVerified:false,
  privacy:r.preservesPrivateOnlyIds,
  caveats:r.caveats
 };
}
if(require.main===module){
 const [beforePath,afterPath]=process.argv.slice(2);
 if(!beforePath||!afterPath){
  console.error('Usage: node run_lower_gate_save_pair.cjs PRIVATE_BEFORE.json PRIVATE_AFTER.json');
  process.exitCode=2;
 }else{
  try{
   const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
   const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
   console.log(JSON.stringify(safeReport(before,after),null,2));
  }catch(_){
   console.error('Invalid private inputs or missing game save fields; file paths and content withheld');
   process.exitCode=1;
  }
 }
}
module.exports={safeReport};
