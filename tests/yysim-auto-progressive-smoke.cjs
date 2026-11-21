// Progressive multi-pass search must retain true native results and only claim
// lowest pill cost *within enumerated candidates*, not global optimality.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const file of ['yysim-auto-search.js','yysim-auto-progressive.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'engine',file),'utf8'),ctx,{filename:file});
const api=ctx.window.YYWashAutoSearch,p=ctx.window.YYWashProgressive;
const levels=Array.from(p.levels({maxPad:20,horizon:1500,topN:8}));
assert.deepEqual(Array.from(levels,x=>[x.maxPad,x.horizon]),[[3,300],[8,900],[20,1500]]);
assert.equal(p.levels({maxPad:0,horizon:100,topN:2}).length,1,'identical stages deduplicated');
const existing={pad:0,pills:10,washes:3,exchanges:0,optimal:false,actions:[],
 final_slots:[{id:268,locked:false}]};
const cheaper={pad:3,pills:7,washes:2,exchanges:1,optimal:false,
 actions:[{kind:'exchange',to:'天生神力'}],final_slots:[{id:268,locked:true}]};
let calls=0,checks=0;const updates=[];
async function call(op,config){
 assert.equal(op,'auto-search');assert.deepEqual(Array.from(config.desiredIds),[268]);
 calls++;return {nativeFunction:'wasmSearchWashRoutes',
  nameIds:{'天生神力':268},result:{scanned:100*calls,
   routes:calls===1?[existing]:calls===2?[existing,cheaper]:[cheaper]}};
}
(async()=>{
 const res=await p.run({call,api,desiredIds:[268],maxPad:20,horizon:1500,topN:8,
  ensureSession:()=>checks++,onProgress:r=>updates.push(r)});
 assert.equal(calls,3);assert(checks>=6);
 assert.equal(updates.length,3);
 assert.equal(updates.at(-1).bestPills,7);
 assert.equal(res.bestPills,7);
 assert.equal(res.result.routes.length,2,'same native candidate across stages deduplicated');
 assert.equal(res.result.scanned,600,'sum is documented as overlapping scan work');
 let extendedCalls=0;
 const fallback=await p.run({api,desiredIds:[268],maxPad:30,horizon:3000,topN:8,
  call:async()=>{extendedCalls++;return {nativeFunction:'wasmSearchWashRoutes',
   result:{scanned:4,routes:[]}};}});
 assert.equal(extendedCalls,5,'missing goals automatically extend search in two bounded stages');
 assert.deepEqual(Array.from(fallback.history,x=>[x.maxPad,x.horizon]),
  [[3,300],[8,900],[30,3000],[100,4000],[200,5000]]);
 assert.equal(fallback.bestPills,null,'no candidates still cannot be marked complete');
 assert.equal(res.globallyOptimal,false,'native optimal:false cannot mean guaranteed best globally');
 assert(res.progressive===true&&res.history.length===3);
 assert.equal(api.routeOutcome(res.result,[268]).routes[0].estimatedPills,7);
 const alternative={...cheaper,steps:[{kind:'luck-reset',roll_idx:31}],luck_init:{roll_idx:31,by:'exchange'}};
 const repeated={...cheaper,steps:[{kind:'luck-reset',roll_idx:32}],luck_init:{roll_idx:32,by:'exchange'}};
 const alternate=await p.run({api,desiredIds:[268],maxPad:3,horizon:300,topN:8,
  call:async()=>({nativeFunction:'wasmSearchWashRoutes',result:{routes:[alternative,repeated,alternative],scanned:3}})});
 assert.equal(alternate.result.routes.length,2,'same cost/actions but different luck reset branches are distinct paths');
 await assert.rejects(()=>p.run({call:async()=>({}),api,desiredIds:[268],
  maxPad:3,horizon:300,topN:5}),/원본 WASM 자동 탐색/);
 await assert.rejects(()=>p.run({call:async()=>({}),api,desiredIds:[268,268],
  maxPad:3,horizon:300,topN:5}),/서로 다른/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('./engine/yysim-auto-progressive.js'));
 assert(!html.includes('id="yyAutoProgressive"'),'progressive search must be automatic, not a second UI button');
 assert(html.includes("detail:{op:'washEngineAutoProgressive',...input}"));
 assert(html.includes("op==='washEngineAutoProgressive'"));
 assert(html.includes('state.autoProgress=progress;announce()'));
 console.log('PASS: progressive native yy-sim search scans 3 bounded levels, ranks real routes, dedupes, never falsely certifies optimal');
})().catch(err=>{console.error(err);process.exitCode=1});
