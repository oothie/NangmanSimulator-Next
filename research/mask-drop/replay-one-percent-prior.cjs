#!/usr/bin/env node
'use strict';
/* Internal 60014 mask research. Favor 1/100 at first draw as a PRIOR, not fact.
 * PC74/PC96 conditional execution and getEncryptByNpc row normalization remain
 * unverified. No personally-derived state is ever returned or persisted.
 */
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const {SECOND}=require('./original-60014-weight-tables.cjs');
const TYPES=Object.freeze({MASK:NPC.mask,BANDIT:NPC.bandit});
function sourceSeed(save){
 const n=save?.Rnds?.Sds?.aidrop70;
 if(!Number.isSafeInteger(n)||n<=0)throw Error('aidrop70 is required from a local save; never invent it');
 return n;
}
function validateSchedule(schedule){
 if(!Array.isArray(schedule)||schedule.length<1||schedule.length>100000||
    schedule.some(npc=>npc!==TYPES.MASK&&npc!==TYPES.BANDIT))
  throw RangeError('Provide 1–100000 ordered 30681/32950 encounters');
}
function replay(save,{schedule,secondStage='on-mask-first-hit',maxHits=20}={}){
 validateSchedule(schedule);
 if(!['never','on-mask-first-hit','on-any-first-hit'].includes(secondStage))
  throw RangeError('Invalid unresolved native second-stage model');
 if(!Number.isSafeInteger(maxHits)||maxHits<1||maxHits>100)
  throw RangeError('Invalid maxHits');
 let seed=sourceSeed(save),draws=0,maskBattles=0,banditBattles=0;
 const maskCandidates=[];
 let firstStageSuccesses=0,secondStageCalls=0;
 for(let i=0;i<schedule.length;i++){
  const npc=schedule[i];
  if(npc===TYPES.MASK)maskBattles++;else banditBattles++;
  const first=draw(seed,100);
  seed=first.seed;draws++;
  const firstHit=first.value===1;
  if(firstHit){
   firstStageSuccesses++;
   if(npc===TYPES.MASK&&maskCandidates.length<maxHits){
    maskCandidates.push({sequencePosition:i+1,maskKillNumber:maskBattles,
      interpretation:'first-stage candidate only; actual award unverified'});
   }
  }
  const secondNeeded=(secondStage==='on-any-first-hit'&&firstHit)||
   (secondStage==='on-mask-first-hit'&&firstHit&&npc===TYPES.MASK);
  if(secondNeeded){
   const second=draw(seed,SECOND.totalWeight);seed=second.seed;
   draws++;secondStageCalls++;
  }
 }
 return {
  item:'수라가면',npc:TYPES.MASK,firstStageHypothesis:'1 favorable slot / 100',
  secondStageHypothesis:secondStage,secondStageOriginalTotalWeight:SECOND.totalWeight,
  evaluatedEncounters:schedule.length,maskBattles,banditBattles,
  firstStageSuccesses,secondStageCalls,totalCandidateLaneDraws:draws,
  firstStageMaskCandidates:maskCandidates,
  nativeBranchVerified:false,firstStageChanceVerified:false,
  confirmedMaskAwards:0,exactDropPredictionAllowed:false,
  privateInputsReported:false,
  note:'Candidate hit is NOT a confirmed item drop. Future outcome changes if other aidrop70 consumers exist.'
 };
}
function compareScenarios(save,schedule){
 return ['never','on-mask-first-hit','on-any-first-hit'].map(secondStage=>
  replay(save,{schedule,secondStage}));
}
module.exports={TYPES,replay,compareScenarios};
