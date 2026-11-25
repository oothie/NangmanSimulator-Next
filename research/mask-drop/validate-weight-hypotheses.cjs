#!/usr/bin/env node
'use strict';
/**
 * Research only: test competing, explicitly hypothetical weighted-drop models
 * against a set of controlled original-game encounter snapshots.
 * No save, seed, path, account ID, raw roll or deterministic RNG state appears
 * in returned results. Equality of a transition is not native-callsite proof.
 */
const fs=require('node:fs');
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const ALLOWED=new Set([NPC.mask,NPC.bandit]);
const OUTCOMES=new Set(['mask','other','none','unknown']);
function lane(s){
 const v=s?.Rnds?.Sds?.aidrop70;
 return Number.isSafeInteger(v)&&v>0?v:null;
}
function load(path){
 const raw=JSON.parse(fs.readFileSync(path,'utf8'));
 return Array.isArray(raw)?raw[0]:raw;
}
function modelKey(m){return [m.bound,m.calls,m.hitFrom,m.hitTo,m.rewardDraw].join(':')}
function selectNpcModel(candidate,npc){
 // Model candidates can supply two independent NPC-specific weight scenarios.
 // The old single-model form remains a 30681-only shorthand and is REJECTED
 // for mixed-NPC schedules, to prevent assuming identical weight pools.
 if(candidate.mask&&candidate.bandit)return npc===NPC.mask?candidate.mask:candidate.bandit;
 return npc===NPC.mask?candidate:null;
}
function checkModel(m){
 if(!m||!Number.isSafeInteger(m.bound)||m.bound<1||m.bound>1000000||
  !Number.isInteger(m.calls)||m.calls<0||m.calls>2||
  !Number.isInteger(m.hitFrom)||m.hitFrom<1||
  !Number.isInteger(m.hitTo)||m.hitTo<m.hitFrom||m.hitTo>m.bound||
  !Number.isInteger(m.rewardDraw)||m.rewardDraw<1||m.rewardDraw>Math.max(1,m.calls))
  throw RangeError('Explicit valid bound/calls/hit window/reward draw required');
}
function checkEvent(e){
 if(!e||!ALLOWED.has(e.npc)||!OUTCOMES.has(e.outcome)||!e.before||!e.after)
  throw RangeError('Supported NPC, observed outcome and before/after saves required');
 if(e.npc!==NPC.mask&&e.outcome==='mask')
  throw RangeError('A mask award from the bandit cannot be attributed to this NPC model');
}
function evaluate(events,models){
 if(!Array.isArray(events)||!events.length||events.length>5000||
  !Array.isArray(models)||!models.length||models.length>5000)
  throw RangeError('1..5000 events and explicit candidate models required');
 events.forEach(checkEvent);
 const mixedNpc=events.some(e=>e.npc===NPC.bandit);
 models.forEach(m=>{
  if(m?.mask||m?.bandit){
   if(!m.mask||!m.bandit)throw RangeError('Both NPC-specific models required');
   checkModel(m.mask);checkModel(m.bandit);
  }else{
   checkModel(m);
   if(mixedNpc)throw RangeError('Mixed-NPC schedule requires independent mask and bandit weight models');
  }
 });
 const observations=events.map(e=>({npc:e.npc,outcome:e.outcome,
  before:lane(e.before),after:lane(e.after)}));
 const candidates=[];
 for(const model of models){
  let transitions=0,awardChecks=0,compatible=true;
  for(const e of observations){
   if(e.before===null||e.after===null){compatible=false;break}
   const active=selectNpcModel(model,e.npc);
   let state=e.before,roll=null;
   for(let i=1;i<=active.calls;i++){
    const d=draw(state,active.bound);
    state=d.seed;
    if(i===active.rewardDraw)roll=d.value;
   }
   if(state!==e.after){compatible=false;break}
   transitions++;
   // Only a mask drop from NPC30681 is a positive label.
   // A non-mask reward is not a validated negative: story drops, reward
   // switches or another source may have intervened despite lane matching.
   if(e.npc===NPC.mask&&e.outcome==='mask'){
    awardChecks++;
    if(roll===null||roll<active.hitFrom||roll>active.hitTo){
     compatible=false;break;
    }
   }
  }
  if(compatible)candidates.push({model:model.mask?('mask='+modelKey(model.mask)+';bandit='+modelKey(model.bandit)):modelKey(model),
   testedTransitions:transitions,positiveMaskChecks:awardChecks});
 }
 return {item:'수라가면',sourceNpc:NPC.mask,
  candidateLane:'aidrop70',sourceWeight:[7209,1],
  events:events.length,modelsTested:models.length,compatibleCandidates:candidates,
  sourceBranchVerified:false,sourcePoolVerified:false,
  exactDropPredictionAllowed:false,privateInputsReported:false,
  limitations:[
   '본 추첨의 전체 가중치와 실제 호출 횟수가 아직 원본 실행으로 검증되지 않음',
   '만호강과 산적은 동일한 난수 경로 후보라도 서로 다른 NPC별 가중치 배열을 쓸 수 있음',
   '수라가면 미획득은 음성 판정에 사용하지 않음: 후처리·보상 조건 미확정',
   '동일한 난수 전이는 원본 weightRand 함수 호출을 증명하지 않음',
   '실제 획득 첫 회차를 확정하는 계산기가 아님'
  ]};
}
function readManifest(file){
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const events=manifest.events.map(e=>({...e,before:load(e.before),after:load(e.after)}));
 return evaluate(events,manifest.models);
}
if(require.main===module){
 if(!process.argv[2]){console.error('Usage: node validate-weight-hypotheses.cjs LOCAL_manifest.json');process.exitCode=2}
 else console.log(JSON.stringify(readManifest(process.argv[2]),null,2));
}
module.exports={evaluate,readManifest};
