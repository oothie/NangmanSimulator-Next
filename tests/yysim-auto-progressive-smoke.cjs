// The original yy-sim WASM route search is invoked ONCE at the user bounds.
// No local sequential/locking/beam search, hidden extra passes, or false
// global-optimality/percentage is allowed.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ctx={window:{},setTimeout,clearTimeout,setInterval,clearInterval,Date};
vm.createContext(ctx);
for(const file of ['yysim-auto-search.js','yysim-auto-progressive.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'engine',file),'utf8'),ctx,{filename:file});
const api=ctx.window.YYWashAutoSearch,p=ctx.window.YYWashProgressive;
const expensive={pad:3,pills:15,washes:5,exchanges:0,optimal:false,
 actions:[{kind:'wash_to',wash_no:5}],final_slots:[{id:268,locked:false}]};
const cheaper={pad:0,pills:7,washes:3,exchanges:1,optimal:false,
 actions:[{kind:'exchange',to:'天生神力'}],final_slots:[{id:268,locked:true}]};
(async()=>{
 let calls=0,checks=0;const updates=[];
 const reqs=[];
 async function call(op,config){
  assert.equal(op,'auto-search');calls++;reqs.push({...config});
  await new Promise(resolve=>setTimeout(resolve,12));
  return {nativeFunction:'wasmSearchWashRoutes',nameIds:{'天生神力':268},
   result:{scanned:100,routes:[expensive,cheaper]}};
 }
 const result=await p.run({call,api,desiredIds:[268],maxPad:20,horizon:1500,topN:8,
  ensureSession:()=>checks++,onProgress:item=>updates.push(item)});
 assert.equal(calls,1,'native search called exactly once');
 assert(checks>=3,'session verified around async execution');
 assert.equal(reqs[0].maxPad,20);assert.equal(reqs[0].horizon,1500);
 assert.equal(reqs[0].topN,8);
 assert.deepEqual(Array.from(reqs[0].desiredIds),[268]);
 assert.equal(updates[0].phase,'native');
 assert.equal(updates[0].indeterminate,true,'opaque WASM gives no percentage');
 assert.equal(updates.at(-1).phase,'verified');
 assert.equal(updates.at(-1).bestPills,7);
 assert.equal(result.bestPills,7);
 assert.equal(result.result.routes.length,2);
 assert.equal(result.result.routes[0].pills,7,'prefer cheaper actual final path');
// A native route with all final goals and valid costs must be retained even
// when replay actions are absent; otherwise the UI falsely claims a higher
// minimum cost. A route without actions is NOT executable.
 const noReplayRoute={pad:0,pills:5,washes:2,exchanges:1,optimal:false,
  actions:[],final_slots:[{id:268,locked:true}]};
 const mixed=await p.run({call:async()=>({nativeFunction:'wasmSearchWashRoutes',
  result:{scanned:2,routes:[expensive,noReplayRoute]}}),api,
  desiredIds:[268],maxPad:20,horizon:1500,topN:8});
 assert.equal(mixed.bestPills,5);
 assert.equal(mixed.result.routes.length,2);
 const mixedParsed=api.routeOutcome(mixed.result,[268]);
 assert.equal(mixedParsed.routes[0].executable,false,
  'missing replay actions cannot be applied to native WASM state');
 assert.equal(mixed.history[0].replayReady,1);

 assert.equal(result.globallyOptimal,false,'native optimal false stays false');
 assert.equal(result.history.length,1);
 assert.equal(result.history[0].horizon,1500);
 assert.equal(result.result.scanned,100,'do not sum fictional extra passes');
 assert.equal(result.nativeFunction,'wasmSearchWashRoutes');
 let misses=0;
 const none=await p.run({api,desiredIds:[268],maxPad:30,horizon:3000,topN:8,
  call:async()=>{misses++;return {nativeFunction:'wasmSearchWashRoutes',
   result:{scanned:4,routes:[]}};}});
 assert.equal(misses,1,'missing result must not auto-extend to 4000/5000');
 assert.equal(none.bestPills,null);
 assert.equal(none.result.routes.length,0);
 assert.equal(none.history.length,1);
 const transient={...cheaper,final_slots:[{id:268,locked:false}]};
 const incomplete={...cheaper,final_slots:[{id:271,locked:false}],
  acquired_events:[{id:268,wash_no:2}]};
 const verified=await p.run({api,desiredIds:[268],maxPad:3,horizon:300,
  call:async()=>({nativeFunction:'wasmSearchWashRoutes',
   result:{scanned:2,routes:[incomplete,transient]}})});
 assert.equal(verified.result.routes.length,1,'transient acquisitions never satisfy final goals');
 await assert.rejects(()=>p.run({call:async()=>({}),api,desiredIds:[268],
  maxPad:3,horizon:300,topN:5}),/원본 WASM 자동 탐색/);
 await assert.rejects(()=>p.run({call:async()=>({}),api,desiredIds:[268,268],
  maxPad:3,horizon:300,topN:5}),/서로 다른/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('./engine/yysim-auto-progressive.js?rev=20261122-final-routes'));
 assert(html.includes("op==='washEngineAutoProgressive'"));
 assert(html.includes('p.indeterminate'),'WASM UI must report uncertain duration');
 assert(!html.includes('id="yyAutoProgressive"'),'no second automatic search button');
 console.log('PASS: one native WASM call, no extra bounds, real elapsed status, final goal verification');
})().catch(err=>{console.error(err);process.exitCode=1});
