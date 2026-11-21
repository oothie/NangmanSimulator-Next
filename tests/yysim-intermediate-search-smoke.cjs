// Intermediate-color search: actual per-wash observations, earliest completion,
 // legal starting locks, exact costs, and WASM state rollback.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-intermediate-search.js'),'utf8'),ctx);
const source=ctx.window.YYWashIntermediateSearch;
const clone=x=>JSON.parse(JSON.stringify(x));
const INITIAL={talents:[{id:171,locked:false},{id:172,locked:false}],
 seed:0,zizhi:152,has_bag_pills:true,bag_pills:100,total_pills:0};
let current=clone(INITIAL);
const sequence=[184,185,191,186,187,188];
const getState=()=>clone(current),setState=s=>(current=clone(s),true);
const doWash=()=>{
 const slot=current.talents.findIndex(t=>!t.locked);
 if(slot<0)return {error:'no slot'};
 current.talents[slot]={id:sequence[current.seed%sequence.length],locked:false};
 current.seed++;current.total_pills+=3;current.bag_pills-=3;
 return {talents:clone(current.talents)};
};
(async()=>{
 const result=await source.run({ids:[184,191],horizon:30,topN:12,
  getState,setState,doWash});
 assert.equal(result.scanned,4);
 assert.equal(result.routes[0].washes,3);
 assert.equal(result.routes[0].pills,9);
 assert.equal(result.routes[0].intermediate_goals,true);
 assert.deepEqual(Array.from(result.routes[0].acquired_events,x=>[x.id,x.wash_no]),
  [[184,1],[191,3]]);
 assert.equal(result.routes[0].final_slots.some(x=>x.id===184),false,
  'intermediate goals need not survive the last wash');
 assert.deepEqual(current,INITIAL,'all lock branches restore the source state');
 const impossible=await source.run({ids:[999],horizon:3,topN:2,
  getState,setState,doWash});
 assert.equal(impossible.routes.length,0);
 assert.deepEqual(current,INITIAL,'failed search also restores the source state');
 const autoSource=fs.readFileSync(path.join(__dirname,'../engine/yysim-auto-search.js'),'utf8');
 const c2={window:{}};vm.createContext(c2);vm.runInContext(autoSource,c2);
 const report=c2.window.YYWashAutoSearch.routeOutcome(result,[184,191]);
 assert.equal(report.routes[0].complete,true);
 assert.equal(report.routes[0].intermediateGoals,true);
 assert.equal(report.routes[0].executable,true);
 assert.equal(report.routes[0].globallyOptimal,false);
 console.log('PASS: intermediate green-blue events, minimal traced cost, no final-slot false negative, rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
