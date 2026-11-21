// yy-sim native route replay: preflight, verified goals, rollback.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-route-replay.js'),'utf8'),ctx);
const api=ctx.window.YYWashRouteReplay;
const route=(actions,washes=0,exchanges=0)=>({complete:true,executable:true,
 goalIds:[271],estimatedWashes:washes,exchanges,actions});
assert.throws(()=>api.plan(route([{kind:'open_slot'}])),/자질 조건/);
assert.equal(api.plan(route([{kind:'open_slot',note:'开槽至 154（4 格）'}]))[0].requiredSlots,4);
assert.throws(()=>api.plan(route([{kind:'exchange',from:'旧',to:'新'}],0,1),{}),/매핑/);
assert.throws(()=>api.plan(route([{kind:'wash_to',wash_no:2}],3)),/총 세수/);
assert.throws(()=>api.plan(route([{kind:'wash_to',wash_no:1}],1,1)),/총 치환/);
const raw={seed:3,role_id:10044,talents:[{id:271,locked:false}]};
let current=JSON.parse(JSON.stringify(raw)),fail=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const call=async(op,p)=>{
 if(op==='state')return clone(current);
 if(op==='wash'){
  if(fail)throw Error('모의 실행 중 오류');
  current.seed+=p.count;return {performed:p.count,state:clone(current)};
 }
 if(op==='set-state'){current=clone(p);return clone(current)}
 if(op==='toggle-lock'){
  current.talents[p.index].locked=!current.talents[p.index].locked;
  return {state:clone(current)};
 }
 throw Error('unsupported '+op);
};
(async()=>{
 const result=await api.run({route:route([{kind:'lock',talent:'转世金仙'},{kind:'wash_to',wash_no:2}],2),
  nameIds:{'转世金仙':271},call});
 assert.equal(result.verified,true);assert.equal(result.steps,2);
 assert.equal(current.seed,5);assert.equal(current.talents[0].locked,true);
 current=clone(raw);fail=true;
 await assert.rejects(()=>api.run({route:route([{kind:'lock',talent:'转世金仙'},{kind:'wash_to',wash_no:2}],2),
  nameIds:{'转世金仙':271},call}),/모의 실행 중 오류/);
 assert.deepEqual(current,raw,'failed midway restores every WASM state field');
 const empty=route([],0,0);
 const present=await api.run({route:empty,call});assert(present.verified);
 const alreadyOpen=await api.run({route:route([{kind:'open_slot',note:'开槽至 151'}]),call});
 assert(alreadyOpen.verified,'an already-open slot is an audited no-op');
 const beforeClosed=clone(current);
 await assert.rejects(()=>api.run({route:route([{kind:'open_slot',note:'开槽至 154'}]),call}),/자질 개방/);
 assert.deepEqual(current,beforeClosed,'unsupported slot opening never consumes materials');
 await assert.rejects(()=>api.run({route:{...empty,finalSlots:[{id:999,locked:false}]},call}),/최종 슬롯/);
 assert.deepEqual(current,beforeClosed,'mismatched native final state must be restored');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert(html.includes('data-yy-replay-route'));
 assert(html.includes('washEngineReplayRoute'));
 assert(html.includes('./engine/yysim-route-replay.js'));
 console.log('PASS: strict native replay preflight, goal verification, undo snapshot, atomic error rollback');
})().catch(error=>{console.error(error);process.exitCode=1});
