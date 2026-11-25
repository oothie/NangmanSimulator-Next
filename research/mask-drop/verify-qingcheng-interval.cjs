#!/usr/bin/env node
'use strict';
/**
 * Verify (rather than assume) 159 Qingcheng level-70 direct-drop draws by
 * comparing controlled original-game pre/post saves.
 *
 * One call per NPC32950, 100-total weight are candidate hypotheses.
 * Does NOT claim this is the native battle execution, nor disclose seeds,
 * account data, file paths or other raw saved state.
 */
const fs=require('node:fs');
const {draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
const LANES=Object.freeze(['aidrop70','aidrop71','aidrop72','aidrop73','aidrop75','rollenemy_qc','seed_32954']);
function unwrap(x){return Array.isArray(x)?x[0]:x}
function lane(x,key){
 const s=unwrap(x)?.Rnds?.Sds;
 const n=s?.[key];
 return Number.isSafeInteger(n)&&n>0?n:null;
}
function check(before,after,{expectedFieldFights=159,maxCalls=1000,bound=100}={}){
 if(!Number.isSafeInteger(expectedFieldFights)||expectedFieldFights<1||expectedFieldFights>100000||
 !Number.isSafeInteger(maxCalls)||maxCalls<expectedFieldFights||maxCalls>100000||
 !Number.isSafeInteger(bound)||bound<1||bound>1000000)
  throw RangeError('Invalid research scan parameters');
 const a=lane(before,'aidrop70'),b=lane(after,'aidrop70');
 if(a===null||b===null)return {
   usable:false,requestedFights:expectedFieldFights,sharedLaneConfirmed:false,
   privateInputReported:false,reason:'전후 세이브에 aidrop70이 모두 있어야 함'
 };
 let state=a,matchCounts=[];
 if(state===b)matchCounts.push(0);
 for(let calls=1;calls<=maxCalls;calls++){
  state=draw(state,bound).seed;
  if(state===b)matchCounts.push(calls);
 }
 const changedLanes=LANES.filter(k=>{
  const x=lane(before,k),y=lane(after,k);
  return x!==null&&y!==null&&x!==y;
 });
 return {
  usable:true,requestedFights:expectedFieldFights,
  assumedBound:bound,
  candidateCallCounts:matchCounts.slice(0,20),
  supportsExactlyOneAidrop70DrawPerFight:matchCounts.includes(expectedFieldFights),
  observedLevel70LaneChanged:a!==b,
  otherLaneChangedLabels:changedLanes.filter(k=>k!=='aidrop70'),
  sourceRuleVerified:false,sharedLaneConfirmed:false,
  nativeBattlePerNpcCallProven:false,privateInputReported:false,
  note:'A match supports numerical consistency only; no intervening activity and actual battle NPC IDs must be independently checked.'
 };
}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
if(require.main===module){
 const [a,b]=process.argv.slice(2);
 if(!a||!b){console.error('Usage: node verify-qingcheng-interval.cjs LOCAL_PRE.json LOCAL_AFTER_159.json');process.exitCode=2}
 else{
  try{console.log(JSON.stringify(check(read(a),read(b)),null,2))}
  catch(e){console.error('Analysis failed: invalid private input or scan bounds');process.exitCode=1}
 }
}
module.exports={check};
