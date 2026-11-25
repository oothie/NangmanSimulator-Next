#!/usr/bin/env node
'use strict';
/**
 * Field encounter audit: consecutive one-battle save snapshots only.
 *
 * Infer number of 100-bound aidrop70 transitions between consecutive saves.
 * It is an observed candidate CALL count, not a guarantee of NPC ID.
 * A single 70-level mob is 32950 (bandit) in Korean 60014 Qingcheng config.
 * Exact future lineup is not inferred from the current save alone.
 *
 * Raw IDs, seed values, account details, and save paths are never returned.
 */
const fs=require('node:fs');
const {draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
const LEVELS=Object.freeze([70,71,72,73,75]);
function lane(snapshot,level){
 const root=Array.isArray(snapshot)?snapshot[0]:snapshot;
 const val=root?.Rnds?.Sds?.['aidrop'+level];
 return Number.isSafeInteger(val)&&val>0?val:null;
}
function progress(a,b,{bound=100,maxDraws=15}={}){
 if(!Number.isSafeInteger(bound)||bound<1||bound>1000000 ||
    !Number.isSafeInteger(maxDraws)||maxDraws<1||maxDraws>100)
   throw RangeError('Invalid research audit limits');
 if(a===null||b===null)return {usable:false,matches:[]};
 let state=a;const matches=[];
 if(a===b)matches.push(0);
 for(let n=1;n<=maxDraws;n++){
  state=draw(state,bound).seed;
  if(state===b)matches.push(n);
 }
 return {usable:true,matches};
}
function audit(snapshots,{maxPerBattle=12}={}){
 if(!Array.isArray(snapshots)||snapshots.length<2||snapshots.length>10001)
  throw RangeError('Provide consecutive save snapshots, one per field battle');
 if(!Number.isSafeInteger(maxPerBattle)||maxPerBattle<1||maxPerBattle>20)
  throw RangeError('Invalid per-battle model bound');
 const rows=[];let inferredBandits=0;let complete=true;
 for(let i=1;i<snapshots.length;i++){
  const steps={};
  for(const level of LEVELS){
   steps[level]=progress(lane(snapshots[i-1],level),
                         lane(snapshots[i],level),{maxDraws:maxPerBattle});
  }
  const candidates=steps[70].matches;
  const accepted=steps[70].usable&&candidates.length===1;
  if(!accepted)complete=false;
  const count=accepted?candidates[0]:null;
  if(count!==null)inferredBandits+=count;
  rows.push({
    battle:i,
    level70DrawCount:count,
    level70CandidateCallCounts:accepted?undefined:candidates,
    level71CandidateCallCounts:steps[71].matches,
    level72CandidateCallCounts:steps[72].matches,
    level73CandidateCallCounts:steps[73].matches,
    level75CandidateCallCounts:steps[75].matches,
    exactBattleNpcCompositionProven:false,
    independentCombatActivitiesExcluded:false
  });
 }
 return {
  task:'청성산 70레벨 출현 추적',
  battleIntervals:rows.length,
  rows,
  inferredLevel70Calls:complete?inferredBandits:null,
  60014NpcForThisLevel:'산적',
  originalGameFormationRoutineRecovered:false,
  futureAppearanceSchedule:null,
  privateInputsReported:false,
  limitations:[
    '각 스냅샷은 실제 사냥 1회 간격이어야 하며 다른 70레벨 활동 없어야 함',
    '난수 전이는 출현한 산적의 드랍 호출 수와 일치하는지 추가 확인 필요',
    '전투를 모아 저장하면 합계만 나오며 개별 회차에 산적이 나온 시점은 복원 불가'
  ]
 };
}
function fromFiles(files,options){
 if(!Array.isArray(files)||files.length<2)throw RangeError('Need multiple save files');
 return audit(files.map(path=>JSON.parse(fs.readFileSync(path,'utf8'))),options);
}
if(require.main===module){
 const files=process.argv.slice(2);
 if(files.length<2){
  console.error('Usage: node qingcheng-appearance-from-saves.cjs BEFORE.json AFTER1.json AFTER2.json ...');
  process.exitCode=2;
 }else{
  try{console.log(JSON.stringify(fromFiles(files),null,2))}
  catch(_){console.error('Invalid input or inaccessible private save; no path or seed disclosed');process.exitCode=1}
 }
}
module.exports={LEVELS,lane,progress,audit,fromFiles};
