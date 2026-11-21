// yy-sim native route replay: preflight, verified goals, rollback.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-route-replay.js'),'utf8'),ctx);
const api=ctx.window.YYWashRouteReplay;
const route=(actions,washes=0,exchanges=0)=>({complete:true,executable:true,
 goalIds:[271],estimatedWashes:washes,estimatedPills:0,pad:0,exchanges,actions});
assert.throws(()=>api.plan(route([{kind:'open_slot'}])),/자질 조건/);
assert.equal(api.plan(route([{kind:'open_slot',note:'开槽至 154（4 格）'}]))[0].requiredSlots,4);
assert.throws(()=>api.plan(route([{kind:'exchange',from:'旧',to:'新'}],0,1),{}),/매핑/);
assert.equal(api.plan(route([{kind:'lock',talent:'251'}]))[0].id,251,'numeric native talent ID is resolved before replay');
ctx.window.NANGMAN_TALENT_NAMES_KO={'251':'일심겸용'};
assert.equal(api.plan(route([{kind:'lock',talent:'일심겸용'}]))[0].id,251,'user-confirmed Korean name resolves to native 251');
assert.throws(()=>api.plan(route([{kind:'wash_to',wash_no:2}],3)),/총 세수/);
assert.throws(()=>api.plan(route([{kind:'wash_to',wash_no:1}],1,1)),/총 치환/);
assert.throws(()=>api.plan({...route([],0,0),estimatedPills:1}),/실행 단계/);
const raw={seed:3,role_id:10044,zizhi:151,str_gift:30,con_gift:50,talents:[{id:271,locked:false}]};
let current=JSON.parse(JSON.stringify(raw)),fail=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const call=async(op,p)=>{
 if(op==='state')return clone(current);
 if(op==='wash'){
  if(fail)throw Error('모의 실행 중 오류');
  current.seed+=p.count;return {performed:p.count,state:clone(current)};
 }
 if(op==='set-state'){current=clone(p);return clone(current)}
 if(op==='upgrade-zizhi'){
  current.zizhi++;current.str_gift+=100;current.con_gift+=100;
  return {state:clone(current),source:'original-upgradeZiZhi',inventoryDeducted:false};
 }
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
 const beforeUpgrade=clone(current);
 const upgraded=await api.run({route:route([{kind:'open_slot',note:'开槽至 154'}]),call});
 assert(upgraded.verified);
 assert.equal(current.zizhi,154,'three sequential aptitude upgrades from 151 to 154');
 assert.equal(current.str_gift,beforeUpgrade.str_gift+300);
 assert.equal(current.con_gift,beforeUpgrade.con_gift+300);
 current=clone(beforeUpgrade);
 await assert.rejects(()=>api.run({route:{...empty,finalSlots:[{id:999,locked:false}]},call}),/최종 슬롯/);
 assert.deepEqual(current,beforeUpgrade,'mismatched native final state must be restored');
 await assert.rejects(()=>api.run({route:{...empty,finalSlots:[{id:271,locked:false},{id:268,locked:false}]},call}),/최종 슬롯/);
 assert.deepEqual(current,beforeUpgrade,'wrong native final slot count must be restored');
 const earlier=clone(current);
 current={...current,has_bag_pills:true,bag_pills:100,luck_seed_inited:false};
 const beforePaid=clone(current);
 // Synthetic WASM response with real consumption counters; no seed guesses.
 const paidCall=async(op,p)=>{
  if(op==='state')return clone(current);
  if(op==='set-state'){current=clone(p);return clone(current)}
  if(op==='wash'){
   current.seed+=p.count;current.bag_pills-=p.count*2;
   return {state:clone(current),performed:p.count};
  }
  throw Error('unsupported '+op);
 };
 const paidRoute={...route([{kind:'wash_to',wash_no:2}],2),estimatedPills:4};
 const paid=await api.run({route:paidRoute,call:paidCall});
 assert.equal(paid.pillsConsumed,4);
 assert.equal(paid.audit.length,1);
 assert.equal(paid.luckInitializedDuringReplay,false);
 current=clone(beforePaid);
 await assert.rejects(()=>api.run({route:{...paidRoute,estimatedPills:3},call:paidCall}),/세수단 예상 소비/);
 assert.deepEqual(current,beforePaid,'pill-cost mismatch restores all WASM state');
 current=earlier;
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert(html.includes('data-yy-replay-route'));
 assert(html.includes('washEngineReplayRoute'));
 assert(html.includes('./engine/yysim-route-replay.js'));
 console.log('PASS: original yy-sim aptitude slot upgrades, target outcome, undo snapshot, atomic rollback');
})().catch(error=>{console.error(error);process.exitCode=1});
