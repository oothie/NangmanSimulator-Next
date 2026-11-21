// yy-sim final-slot goal search: simultaneous retention, minimum cost among
// acquisition orders, exact chronology, native state rollback.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-intermediate-search.js'),'utf8'),ctx);
const source=ctx.window.YYWashIntermediateSearch,clone=x=>JSON.parse(JSON.stringify(x));
const INITIAL={talents:[{id:171,locked:false},{id:172,locked:false}],
 seed:0,zizhi:152,has_bag_pills:true,bag_pills:200,total_pills:0,str_gift:0,con_gift:0};
let current=clone(INITIAL);
const sequence=[184,185,191,186,184,187];
const getState=()=>clone(current),setState=s=>(current=clone(s),true);
const doWash=()=>{
 const at=current.talents.findIndex(t=>!t.locked);
 if(at<0)return {error:'no slot'};
 while(current.talents.length<current.zizhi-150)
  current.talents.push({id:173,locked:false});
 current.talents[at]={id:sequence[current.seed%sequence.length],locked:false};
 current.seed++;current.total_pills+=3;current.bag_pills-=3;
 return {talents:clone(current.talents)};
};
(async()=>{
 const result=await source.run({ids:[184,191],horizon:12,topN:12,getState,setState,doWash});
 assert.equal(result.scanned,2,'two acquisition orders');
 assert(result.routes.length>=1);
 const best=result.routes[0];
 assert.equal(best.washes,3,'lock first green and keep blue in final wash');
 assert.equal(best.pills,9,'minimum WASM wash pill cost');
 assert.equal(best.intermediate_goals,false,'final-slot goal, never transient');
 assert(best.final_slots.some(x=>x.id===184),'first goal is retained');
 assert(best.final_slots.some(x=>x.id===191),'last goal is retained');
 assert.deepEqual(Array.from(best.actions,a=>[a.kind,a.wash_no]),
  [['wash_to',1],['lock',1],['wash_to',3]]);
 assert.deepEqual(current,INITIAL,'standalone test resets native state');
 for(const goals of [[184,185,191],[184,185,191,186]]){
  const solved=await source.run({ids:goals,horizon:12,topN:20,getState,setState,doWash});
  assert(solved.routes.length>0,'native lock order can preserve '+goals.length+' goals');
  const best=solved.routes[0];
  assert.equal(best.washes,goals.length,'goal order reaches final simultaneous set');
  assert.equal(best.pills,goals.length*3,'lowest cost of explored orders');
  for(const id of goals)assert(best.final_slots.some(t=>t.id===id),'goal '+id+' retained in final slots');
  assert.equal(best.intermediate_goals,false);
  assert.deepEqual(current,INITIAL,'3/4-target search restores native state');
 }
 const impossible=await source.run({ids:[999],horizon:3,topN:2,getState,setState,doWash});
 assert.equal(impossible.routes.length,0);
 assert.deepEqual(current,INITIAL);
 const autoSource=fs.readFileSync(path.join(__dirname,'../engine/yysim-auto-search.js'),'utf8');
 const c2={window:{}};vm.createContext(c2);vm.runInContext(autoSource,c2);
 const report=c2.window.YYWashAutoSearch.routeOutcome(result,[184,191]);
 assert.equal(report.routes[0].complete,true);
 assert.equal(report.routes[0].intermediateGoals,false);
 assert.equal(report.routes[0].executable,true);
 assert.equal(report.routes[0].globallyOptimal,false);
 const transient={routes:[{pills:3,washes:1,pad:0,exchanges:0,
  final_slots:[{id:191,locked:false}],reached_ids:[184,191],
  acquired_events:[{id:184,wash_no:1},{id:191,wash_no:1}],intermediate_goals:true,
  actions:[{kind:'wash_to',wash_no:1}]}],scanned:1};
 const noFalse=c2.window.YYWashAutoSearch.routeOutcome(transient,[184,191]);
 assert.equal(noFalse.routes[0].complete,false,'past appearances cannot count as final result');
 console.log('PASS: final green-blue simultaneous goals, minimum candidate cost, chronological locks, rollback, transient rejection');
})().catch(error=>{console.error(error);process.exitCode=1});
