#!/usr/bin/env node
'use strict';
/**
 * Local-only, two-save Qingcheng -> Manhogang research workflow.
 *
 * BEFORE: original game save taken immediately before the Qingcheng hunts.
 * AFTER: original game save after the hunts. The caller supplies the number
 * of field hunts for context, NOT an assumed number of bandits.
 *
 * Compare aidrop70 state transitions under the original *hypothetical*
 * 100-bound draw, then compute candidate 1%-hit indices from the ACTUAL AFTER
 * save state. Never derive a future state by subtracting an estimated bandit
 * population. No real save, seed, account ID, or input path is emitted.
 */
const {draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
const {getSeed,firstHits}=require('./qingcheng-mask-planner.cjs');

function validateCount(value,min,max,name){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(name+' must be '+min+'..'+max);
 return value;
}
function compare(before,after,{fieldBattles,maxDraws=1000,horizon=2000,hitSlot=1}={}){
 validateCount(fieldBattles,1,100000,'fieldBattles');
 validateCount(maxDraws,1,100000,'maxDraws');
 validateCount(horizon,1,100000,'horizon');
 validateCount(hitSlot,1,100,'hitSlot');
 // Require BOTH explicit seeds; refuse to infer missing data.
 const a=getSeed(before),b=getSeed(after);
 const matches=[];
 let state=a;
 if(state===b)matches.push(0);
 for(let calls=1;calls<=maxDraws;calls++){
  state=draw(state,100).seed;
  if(state===b)matches.push(calls);
 }
 const isUnique=matches.length===1;
 // Important: after-save predictions are directly based on after's state,
 // regardless of how many previous hunts happened or match ambiguity.
 const candidates=firstHits(b,{maxDraws:horizon,hitSlot});
 const next=candidates[0]??null;
 return {
  workflow:'청성산 사냥 전후 세이브 aidrop70 비교',
  item:'수라가면',
  reportedFieldBattles:fieldBattles,
  candidateModel:'첫 단계 100칸 중 1칸; 수라가면 실제 지급 분기 미검증',
  hypothesizedDrawBound:100,
  progressionMatches:matches.slice(0,20),
  progressionMatchCount:matches.length,
  uniqueProgression:isUnique?matches[0]:null,
  progressionClassification:isUnique?'unique-candidate':matches.length?'ambiguous':'no-match-in-range',
  fieldBattleCountNotAssumedEqualToDrawCount:true,
  nextCandidateAidrop70Draw:next,
  candidateDrawsFromAfterSave:candidates.slice(0,5),
  precedingLevel70DrawsBeforeMask:next===null?null:next-1,
  afterSaveUsedDirectly:true,
  // No future Qingcheng enemy spawn sequence is needed or emitted.
  exactFieldEnemyAppearanceForecast:null,
  firstStageOnePercentVerified:false,
  actualMaskAwardVerified:false,
  dropPredictionConfirmed:false,
  otherLevel70ActivityMustBeExcluded:true,
  rawSaveOrSeedReported:false,
  note:'전후 두 파일의 차이가 청성산 사냥만으로 발생했는지는 독립 검증이 필요합니다. 1% 당첨 후보는 실제 수라가면 드랍 확정이 아닙니다.'
 };
}
module.exports={compare};
