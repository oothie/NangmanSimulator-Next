// Real end-to-end: same-origin host commands through embedded yy-sim WASM.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','vendor','yysim'),sent=[],events={};
const parent={postMessage(payload){sent.push(payload)}};
const sandbox={console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),Math,Date,setTimeout,location:{origin:'https://nangman.test',protocol:'https:'},parent,
 window:{addEventListener(name,handler){events[name]=handler}}};
vm.createContext(sandbox);
for(const file of ['wasm_data.js','core_glue.js','data.js']){
 vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
}
const host=fs.readFileSync(path.join(dir,'engine-host.html'),'utf8');
const body=host.match(/<script>([\s\S]*?)<\/script>/);assert(body);
vm.runInContext(body[1],sandbox,{filename:'engine-host:inline'});
let id=0;
async function call(op,payload){
 await events.message({origin:'https://nangman.test',source:parent,data:{
  kind:'nangman-engine-command',requestId:++id,op,payload
 }});
 const answer=sent.at(-1);
 assert.equal(answer.requestId,id);
 return answer;
}
(async()=>{
 assert((await call('init')).ok,'real embedded WASM engine init');
 const base=(await call('state')).data;
 const initial={...base,mode:'seed',seed:447882174,role_id:10044,zizhi:153,salt:262731,
  talents:[{id:248,locked:false},{id:249,locked:false},{id:250,locked:false},{id:271,locked:false}],
  tal_lucky:37,bag_pills:400,has_bag_pills:true};
 const applied=await call('set-state',initial);
 assert(applied.ok&&Number(applied.data.seed)===447882174);
 const nativeSearch=await call('auto-search',{desiredIds:[271,250],maxPad:1,horizon:30,topN:3});
 assert(nativeSearch.ok,'real native search_wash_routes should accept desired_ids');
 assert.equal(nativeSearch.data.nativeFunction,'wasmSearchWashRoutes');
 assert(Array.isArray(nativeSearch.data.result.routes),'real WASM returns automatic routes');
 assert(nativeSearch.data.result.routes.some(route=>route.pills===0&&route.washes===0),
  'already equipped goals yield zero-wash native automatic path');
 assert.equal(Number((await call('state')).data.seed),447882174,
  'automatic path search is read-only');
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine','yysim-auto-search.js'),'utf8'),sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine','yysim-auto-progressive.js'),'utf8'),sandbox);
 const progressive=await sandbox.window.YYWashProgressive.run({
  call:async(name,payload)=>{const reply=await call(name,payload);if(!reply.ok)
   throw Error(String(reply.data?.error||'native host rejected'));return reply.data;},
  api:sandbox.window.YYWashAutoSearch,desiredIds:[271,250],
  maxPad:0,horizon:30,topN:3
 });
 assert(progressive.progressive===true&&progressive.bestPills===0,
  'native progressive route retains a zero-cost preexisting two-purple candidate');
 assert.equal(Number((await call('state')).data.seed),447882174,
  'progressive native search remains read-only');
 const nativeColored=await call('auto-color-search',{desiredIds:[184],horizon:100});
 assert(nativeColored.ok,'real native WASM green-talent sequential search accepted');
 assert.equal(nativeColored.data.nativeFunction,'wasmColorSequentialSearch');
 assert(Array.isArray(nativeColored.data.result?.routes));
 assert.equal(Number((await call('state')).data.seed),447882174,
  'real WASM green-target automatic search must preserve original seed');
 const sourceNew=await call('auto-search',{desiredIds:[268],maxPad:4,horizon:300,topN:3});
 assert(sourceNew.ok&&Array.isArray(sourceNew.data.result.routes));
 console.log('REAL_AUTOROUTE_SAMPLE',JSON.stringify(sourceNew.data.result).slice(0,3800));
 const beforeUpgrade=(await call('state')).data;
 const aptitudeUpgrade=await call('upgrade-zizhi');
 assert(aptitudeUpgrade.ok,'native source aptitude upgrade succeeds on zizhi 153');
 assert.equal(Number(aptitudeUpgrade.data.state.zizhi),154);
 assert.equal(Number(aptitudeUpgrade.data.state.str_gift),Number(beforeUpgrade.str_gift)+100);
 assert.equal(Number(aptitudeUpgrade.data.state.con_gift),Number(beforeUpgrade.con_gift)+100);
 assert(aptitudeUpgrade.data.inventoryDeducted===false);
 assert((await call('upgrade-zizhi')).ok===false,'max aptitude 154 cannot upgrade further');
 assert((await call('set-state',beforeUpgrade)).ok,'restore original aptitude and WASM RNG');
 const preview=await call('preview',{count:80});
 assert(preview.ok&&Array.isArray(preview.data.preview.purples));
 assert.equal(preview.data.nameIds['九阴鬼脉'],'248');
 const conflicts=await call('talent-constraints');
 assert(conflicts.ok&&Array.isArray(conflicts.data.available)&&Array.isArray(conflicts.data.conflicts));
 const goalLock=await call('lock-present-goals',{targetIds:[248,249,250,271]});
 assert(goalLock.ok&&goalLock.data.locked===3,'native WASM locks maximum three owned targets');
 assert(goalLock.data.applied.length===3&&goalLock.data.maxed.length===1);
 assert((await call('set-state',initial)).ok,'native goal locks can be undone');
 const realEligible=conflicts.data.conflicts.find(x=>x?.can_exchange===true&&
    Number.isInteger(x?.index));
 const strictBad=await call('exchange-matched',{index:99});
 assert(strictBad.ok===false,'out-of-range native exchange rejected');
 if(realEligible){
  const matched=await call('exchange-matched',{index:realEligible.index});
  assert(matched.ok&&matched.data.result.success===true,
    'matched native exchange uses real currently eligible conflict');
  assert((await call('set-state',initial)).ok,'restore after strict matched exchange');
 }
 const candidate=await call('exchange-pads',{targets:[{purpleId:248,conflictId:249}],maxPad:30});
 assert(candidate.ok&&Array.isArray(candidate.data.results));
 assert.equal(candidate.data.results.length,31);
 assert(candidate.data.results[0].nodes[0].purple_name,'九阴鬼脉');
 assert.equal(Number((await call('state')).data.seed),447882174,
  'read-only preview/conflict/path API did not advance native seed');
 const lock=await call('toggle-lock',{index:0});
 assert(lock.ok&&lock.data.state.talents[0].locked===true);
 const undo=await call('set-state',initial);
 assert(undo.ok&&undo.data.talents[0].locked===false);
 const exchange=await call('exchange-talent',{index:0});
 assert(exchange.ok&&exchange.data.result.success===true&&Array.isArray(exchange.data.state.talents));
 assert((await call('set-state',initial)).ok);
 const washed=await call('wash',{count:5});
 assert(washed.ok&&washed.data.performed===5&&washed.data.partial===false,'native 5 wash result count');
 assert.equal(washed.data.requested,5);
 assert((await call('set-state',initial)).ok);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine','wash-chain-core.js'),'utf8'),sandbox);
 const chain=await sandbox.window.NangmanWashChain.run({
  call:async(name,payload)=>{const reply=await call(name,payload);if(!reply.ok)
   throw Error(String(reply.data?.error||'native host rejected'));return reply.data;},
  steps:2,maxWashes:20
 });
 assert(chain&&chain.actions.length>=1&&chain.actions.length<=2);
 assert(chain.totalWashes<=40);
 assert((await call('set-state',initial)).ok,'real multistage WASM simulation rolls back');
 let strictGoals=null,blockedGoal=null;
 try{
  strictGoals=await sandbox.window.NangmanWashChain.run({
   call:async(name,payload)=>{const reply=await call(name,payload);if(!reply.ok)
    throw Error(String(reply.data?.error||'native host rejected'));return reply.data;},
   steps:2,maxWashes:20,targets:[248,249]
  });
 }catch(err){blockedGoal=err}
 if(blockedGoal){
  assert.match(String(blockedGoal.message),/확보한 목표 자맥/);
  const unchanged=(await call('state')).data;
  assert.equal(String(unchanged.seed),String(initial.seed),'native target loss restored full start seed');
  assert.deepEqual(JSON.stringify(unchanged.talents),JSON.stringify(initial.talents),
   'native target loss restored all four talent slots');
 }else{
  assert(strictGoals.targeted===true);
  assert(strictGoals.actions.every((step,i)=>step.targetId===[248,249][i]));
  assert(strictGoals.actions.every(step=>step.autoExchanged===false||
   step.conflict?.can_exchange===true),'real WASM only exchanges matching goal collisions');
 }
 assert((await call('set-state',initial)).ok,'native targeted chain can be undone');
 const atomic=await call('until-exchange-and-replace',{count:30});
 assert(atomic.ok,'real yy-sim WASM atomic conflict/exchange API returns valid result');
 assert.equal(typeof atomic.data.autoExchanged,'boolean');
 if(atomic.data.autoExchanged)assert(atomic.data.exchange?.success===true);
 assert(atomic.data.performed<=30);
 assert((await call('set-state',initial)).ok,'real atomic simulation snapshot restores');
 const collision=await call('until-exchange',{count:30});
 console.log('ACTUAL_COLLISION_RESPONSE',JSON.stringify(collision).slice(0,2000));
 assert(collision.ok,'real WASM native until-exchange command succeeds: '+JSON.stringify(collision.data));
 assert(collision.data.performed>=0&&collision.data.performed<=30,
  'native search must stop within configured wash bound');
 if(collision.data.found)assert(collision.data.conflict?.can_exchange===true,
   'reported collision uses original can_exchange flag');
 assert((await call('set-state',initial)).ok,'native collision simulation can be undone');
 const target=await call('until-talent',{talentId:248,count:10});
 assert(target.ok&&Array.isArray(target.data.results));
 assert.equal(Number((await call('state')).data.seed),447882174,'existing goal no untracked mutation');
 console.log('PASS: same-origin host + real WASM: save state, preview, conflicts, route, lock, exchange, 5 washes, next conflict, rollback');
})().catch(error=>{console.error(error);process.exitCode=1});
