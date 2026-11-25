#!/usr/bin/env node
'use strict';
/**
 * PRIVATE research-only level-70 RNG calibration.
 * Never exports save contents, RNG states, account IDs or paths.
 * A matching seed transition is numerical evidence, not proof of the native
 * getDropByID call or its weight array.
 */
const fs=require('node:fs');
const {NPC,draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
const SUPPORTED=new Set([NPC.mask,NPC.bandit]);
function seedFrom(save){
 const s=save?.Rnds?.Sds?.aidrop70;
 return Number.isSafeInteger(s)&&s>0?s:null;
}
function load(path){
 const json=JSON.parse(fs.readFileSync(path,'utf8'));
 return Array.isArray(json)?json[0]:json;
}
function validateEvent(e){
 if(!e||!SUPPORTED.has(e.npc)||!e.before||!e.after)
  throw new RangeError('Each event needs source-confirmed NPC and before/after local saves');
 if(e.outcome!==undefined&&!['mask','other','none','unknown'].includes(e.outcome))
  throw new RangeError('Unknown reward observation');
}
function inferEvent(e,{bounds=[100],maxCalls=3}={}){
 validateEvent(e);
 const a=seedFrom(e.before),b=seedFrom(e.after);
 if(a===null||b===null)return {npc:e.npc,usable:false,matchingModels:[],reason:'전후 기록의 70레벨 난수 상태 누락'};
 const matches=[];
 if(a===b)matches.push({bound:null,calls:0});
 for(const bound of bounds){
  let state=a;
  for(let n=1;n<=maxCalls;n++){
   state=draw(state,bound).seed;
   if(state===b)matches.push({bound,calls:n});
  }
 }
 const laneKeys=new Set([...Object.keys(e.before.Rnds?.Sds||{}),...Object.keys(e.after.Rnds?.Sds||{})]);
 const otherChanged=[...laneKeys].filter(k=>k!=='aidrop70'&&e.before.Rnds?.Sds?.[k]!==e.after.Rnds?.Sds?.[k]).length;
 return {npc:e.npc,usable:true,changed:a!==b,otherChanged,
  observedReward:e.outcome||'unknown',
  matchingModels:matches,unexplained:matches.length===0};
}
function calibrate(events,{bounds=[100],maxCalls=3}={}){
 if(!Array.isArray(events)||events.length===0||events.length>5000)
  throw RangeError('1–5000 controlled encounter observations required');
 if(!Array.isArray(bounds)||bounds.length<1||bounds.length>500||
  bounds.some(x=>!Number.isSafeInteger(x)||x<1||x>1000000)||
  !Number.isInteger(maxCalls)||maxCalls<1||maxCalls>10)
  throw RangeError('Invalid numeric calibration window');
 const cleanBounds=[...new Set(bounds)];
 const observations=events.map(e=>inferEvent(e,{bounds:cleanBounds,maxCalls}));
 // A continuous controlled schedule requires the post-battle state to be the
 // next event's pre-battle state. Equality compares internally only.
 let contiguousPairs=0,brokenPairs=0,unusablePairs=0;
 for(let i=1;i<events.length;i++){
  const previous=seedFrom(events[i-1].after);
  const current=seedFrom(events[i].before);
  if(previous===null||current===null)unusablePairs++;
  else if(previous===current)contiguousPairs++;
  else brokenPairs++;
 }
 const perNPC=[NPC.mask,NPC.bandit].map(npc=>{
  const relevant=observations.filter(x=>x.npc===npc);
  const usable=relevant.filter(x=>x.usable);
  const advanced=usable.filter(x=>x.changed);
  const unchanged=usable.filter(x=>!x.changed);
  const oneOrMore=advanced.filter(x=>x.matchingModels.some(m=>m.calls>0));
  const unresolved=advanced.filter(x=>x.unexplained);
  const zeroOthers=unchanged.filter(x=>x.matchingModels.some(m=>m.calls===0));
  const allModelKeys=usable.map(x=>new Set(x.matchingModels
   .map(m=>m.calls===0?'0':m.bound+':'+m.calls)));
  const intersection=allModelKeys.reduce((set,x)=>set===null?x:new Set([...set].filter(k=>x.has(k))),null);
  return {npc,encounters:relevant.length,usable:usable.length,
   laneChanged:advanced.length,laneUnchanged:unchanged.length,
   compatiblePositiveTransitions:oneOrMore.length,
   unmatchedPositiveTransitions:unresolved.length,
   zeroDrawCompatible:zeroOthers.length,
   commonConstantModel:[...(intersection||[])].sort(),
   caveat:'공통 모델이 없어도 전투별 조건부 호출 가능; 일치해도 원본 테이블 미확정'};
 });
 const mask=perNPC[0],bandit=perNPC[1];
 return {
  item:'수라가면',sourceNPC:NPC.mask,candidateLane:'aidrop70',
  events:events.length,perNPC,sequenceContinuity:{contiguousPairs,brokenPairs,unusablePairs},
  sharedLaneEvidence:mask.laneChanged>0&&bandit.laneChanged>0?
   '두 NPC 모두 70레벨 후보 난수 상태가 변함 — 공유 가능성 지지, 직접 원본 호출 증명은 아님':
   '두 NPC의 후보 난수 소비가 모두 관측되지 않아 공유 미확정',
  exactFirstDropPredictionAllowed:false,
  continuousScheduleProven:events.length>1&&brokenPairs===0&&unusablePairs===0,
  nativeWeightTableVerified:false,
  privateInputsReported:false,
  note:'단일 NPC 전투 직전/직후 세이브만 사용. 전투 사이 다른 행동이 있으면 해석 불가'
 };
}
function runManifest(manifestPath){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(!Array.isArray(manifest.events))throw RangeError('Manifest requires events[]');
 const events=manifest.events.map(e=>({...e,before:load(e.before),after:load(e.after)}));
 return calibrate(events,{bounds:manifest.bounds||[100],maxCalls:manifest.maxCalls||3});
}
if(require.main===module){
 if(!process.argv[2]){console.error('Usage: node calibrate-level70.cjs LOCAL_manifest.json');process.exitCode=2;}
 else console.log(JSON.stringify(runManifest(process.argv[2]),null,2));
}
module.exports={inferEvent,calibrate,runManifest};
