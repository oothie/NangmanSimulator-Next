#!/usr/bin/env node
'use strict';
/**
 * Local-only CLI: node qingcheng-save-refresh.cjs BEFORE.json AFTER.json FIGHTS
 *
 * Never prints files, account details, raw RNG seeds, or stack traces.
 * BEFORE and AFTER must bracket only the recorded Qingcheng hunting period.
 * The computed 1% slot is hypothetical, not a verified 7209 award.
 */
const fs=require('node:fs');
const {compare}=require('./compare-qingcheng-saves-mask.cjs');
function localReport(before,after,fieldBattles){
 const r=compare(before,after,{fieldBattles});
 return {
  item:r.item,
  verification:'미검증 1% 가설 · 실제 획득 확정 아님',
  fieldBattles:r.reportedFieldBattles,
  inferredAidrop70Progress:r.uniqueProgression,
  progressionStatus:r.progressionClassification,
  nextFirstStageCandidate:r.nextCandidateAidrop70Draw,
  level70CallsToConsumeBeforeManhogang:r.precedingLevel70DrawsBeforeMask,
  nextFiveFirstStageCandidates:r.candidateDrawsFromAfterSave,
  afterSaveIsBaseline:r.afterSaveUsedDirectly,
  actualMaskDropVerified:r.actualMaskAwardVerified,
  note:r.note
 };
}
if(require.main===module){
 const [beforeFile,afterFile,battlesText]=process.argv.slice(2);
 if(!beforeFile||!afterFile||!battlesText){
  console.error('Usage: node qingcheng-save-refresh.cjs BEFORE.json AFTER.json NUMBER_OF_QINGCHENG_FIGHTS');
  process.exitCode=2;
 }else{
  try{
   const before=JSON.parse(fs.readFileSync(beforeFile,'utf8'));
   const after=JSON.parse(fs.readFileSync(afterFile,'utf8'));
   // Reject partial numeric strings like 2garbage and prevent accidental floats.
   const fights=/^[1-9]\d*$/.test(battlesText)?Number(battlesText):NaN;
   console.log(JSON.stringify(localReport(before,after,fights),null,2));
  }catch(_){
   console.error('Cannot compare: invalid save, battle count, or unreadable local files (private details withheld)');
   process.exitCode=1;
  }
 }
}
module.exports={localReport};
