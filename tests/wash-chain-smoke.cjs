// Multi-step native WASM conflict and auto-exchange orchestration.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base,'engine/wash-chain-core.js'),'utf8'),ctx);
const run=ctx.window.NangmanWashChain.run;
function mock({failStep=-1,stopStep=-1,sessionChangeStep=-1,loseGoalStep=-1}={}){
 const initial={role_id:10044,seed:500,talents:[{id:248,locked:false}]};
 let live=JSON.parse(JSON.stringify(initial)), calls=0,restores=0,session=0;
 const call=async(name,payload)=>{
  if(name==='state')return structuredClone(live);
  if(name==='set-state'){restores++;live=structuredClone(payload);return structuredClone(live)}
  if(name!=='until-exchange-and-replace')throw Error('unexpected host operation: '+name);
  calls++;
  live.seed+=10;
  if(calls===loseGoalStep)live.talents[0].id=249;
  if(calls===sessionChangeStep)session++;
  if(calls===failStep)throw Error('source exchange rejected');
  const found=calls!==stopStep;
  return {state:structuredClone(live),results:[{wash_no:calls}],performed:1,
   found,autoExchanged:found,exchange:found?{success:true}:null,
   conflict:found?{index:0,can_exchange:true}:null,stopReason:found?'conflict':'limit',
   targetId:payload?.talentId??null};
 };
 return {call,ensureSession:()=>{if(session)throw Error('세이브 변경')},
  get:()=>structuredClone(live),counts:()=>({calls,restores})};
}
(async()=>{
 const a=mock();
 const output=await run({...a,steps:4,maxWashes:100});
 assert.equal(output.exchanges,4);
 assert.equal(output.totalWashes,4);
 assert.equal(output.stopReason,'completed');
 assert.equal(a.get().seed,540);
 assert.equal(a.counts().restores,0);
 const guided=mock();
 const targetResult=await run({...guided,steps:4,maxWashes:50,targets:[248,250,271]});
 assert.equal(targetResult.exchanges,3);
 assert.equal(targetResult.targeted,true);
 assert.equal(targetResult.stopReason,'targets-completed');
 assert.deepEqual(Array.from(targetResult.actions,x=>x.targetId),[248,250,271]);
 assert.deepEqual(Array.from(targetResult.requestedTargets),[248,250,271]);
 assert.deepEqual(Array.from(targetResult.presentTargets),[248]);
 assert.deepEqual(Array.from(targetResult.missingTargets),[250,271]);
 assert.equal(targetResult.goalsComplete,false,'successful collisions do not imply acquired four talents');
 const regressed=mock({loseGoalStep:2});
 await assert.rejects(()=>run({...regressed,steps:2,maxWashes:100,targets:[248,250]}),/확보한 목표 자맥/);
 assert.equal(regressed.get().seed,500,'goal regression restores entire chain');
 assert.equal(regressed.get().talents[0].id,248,'lost goal talent restored');
 await assert.rejects(()=>run({...mock(),steps:3,maxWashes:10,targets:[248,248]}),/중복 없는/);
 const b=mock({stopStep:2});
 const partial=await run({...b,steps:4,maxWashes:100});
 assert.equal(partial.exchanges,1);
 assert.equal(partial.stopReason,'limit');
 assert.equal(b.counts().calls,2);
 const c=mock({failStep:2});
 await assert.rejects(()=>run({...c,steps:4,maxWashes:100}),/source exchange rejected/);
 assert.equal(c.get().seed,500,'all prior successful exchanges and washes rolled back');
 assert.equal(c.counts().restores,1);
 const d=mock({sessionChangeStep:2});
 await assert.rejects(()=>run({...d,steps:4,maxWashes:100}),/세이브 변경/);
 assert.equal(d.counts().restores,0,'never restore old role onto changed session');
 for(const options of [{steps:0,maxWashes:10},{steps:5,maxWashes:10},{steps:2,maxWashes:1001}]){
  await assert.rejects(()=>run({call:async()=>{},...options}),/최대 4단계|1~1000/);
 }
 const main=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert(main.includes('id="washChainAuto"'));
 assert(main.includes('id="washChainSteps"'));
 assert(main.includes('id="washChainLimit"'));
 assert(main.includes("op==='washEngineAutoChain'"));
 assert(main.includes('NangmanWashChain.run'));
 assert(main.includes('id="washPathChain"'));
 assert(main.includes('targets:targetIds'));
 assert(main.includes('입력한 목표 자맥 순서대로 연속 충돌·치환'));
 assert(main.includes('state.undoStates.push(output.initial)'),'one undo per chain');
 assert(!main.includes('washVerifyRun'),'user-rejected before-and-after wash tool absent');
 console.log('PASS: native multi-step 4-exchange simulation, stop, error rollback, session guards, UI');
})().catch(e=>{console.error(e);process.exitCode=1});
