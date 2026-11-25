#!/usr/bin/env node
'use strict';
/**
 * Local-only Qingcheng bandit -> Manhogang mask candidate CLI.
 * Usage: node qingcheng-mask-cli.cjs CURRENT_PRIVATE_SAVE.json [FUTURE_OBSERVATIONS.json]
 * Observations are fights AFTER the supplied save, e.g.
 * [ {"bandits":0,"otherEnemies":3}, {"bandits":1,"otherEnemies":2} ].
 * Do not pass observations that already happened before the save snapshot.
 * Never prints source paths, original seeds, account identifiers or saves.
 */
const fs=require('node:fs');
const {plan}=require('./qingcheng-mask-planner.cjs');
function parseLocal(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function safeResult(save,observations=[]){
 const x=plan(save,{observed:observations,maxDraws:2000});
 return {
  experiment:'청성산 산적 난수 → 만호강 수라가면',
  observedFieldFights:x.observedFights,
  observedBanditCounts:x.observedBanditCounts,
  observedLevel70Bandits:x.observedLevel70Bandits,
  nextCandidateDraw:x.nextCandidateAidrop70Index,
  requiredLevel70CallsBeforeTarget:x.level70DrawsBeforeNextCandidate,
  candidatePlan:x.maskPlanWhenNoOtherConsumption,
  nextFiveConditionalCandidates:x.firstFiveCandidateDraws,
  exactFutureBanditAppearances:null,
  reason:'일반 전투에서 산적 인원을 뽑는 원본 함수가 복원되지 않아 자동 출현 예측 금지',
  actualMaskDropVerified:false,rawSavePrinted:false
 };
}
if(require.main===module){
 const [savePath,observationsPath]=process.argv.slice(2);
 if(!savePath){
  console.error('Usage: node qingcheng-mask-cli.cjs LOCAL_SAVE.json [LATER_OBSERVATIONS.json]');
  process.exitCode=2;
 }else{
  try{
   const result=safeResult(parseLocal(savePath),observationsPath?parseLocal(observationsPath):[]);
   console.log(JSON.stringify(result,null,2));
  }catch(err){
   console.error('Invalid private save or observation data (details and paths withheld)');
   process.exitCode=1;
  }
 }
}
module.exports={safeResult};
