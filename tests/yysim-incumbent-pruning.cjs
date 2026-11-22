'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-intermediate-search.js'),'utf8'),ctx);
const search=ctx.window.YYWashIntermediateSearch;
const clone=x=>JSON.parse(JSON.stringify(x));
const initial={seed:1,zizhi:153,total_wash:0,total_pills:0,bag_pills:1000,
 talents:[{id:101,locked:false},{id:102,locked:false},{id:103,locked:false}]};
let state=clone(initial),runs=0;
const getState=()=>clone(state),setState=s=>(state=clone(s),true);
const doWash=()=>{
 const next=[201,202,203][state.total_wash%3];
 const slot=state.talents.findLastIndex(t=>!t.locked);
 if(slot<0)return {error:'no slot'};
 state.talents[slot]={id:next,locked:false};
 state.total_wash++;state.total_pills+=3;state.bag_pills-=3;state.seed++;
 runs++;return {};
};
(async()=>{
 const progress=[];
 const result=await search.run({ids:[201,202,203],horizon:100,topN:6,
  getState,setState,doWash,qualityFor:()=>2,isolated:true,
  freshBranch:async snapshot=>{state=clone(snapshot);return getState()},
  onProgress:value=>progress.push(value)});
 assert(result.routes.length>0,'one valid complete final-slot route must exist');
 assert.equal(result.routes[0].pills,9);
 assert.equal(result.routes[0].washes,3);
 assert(result.prunedByIncumbent>0,'expensive permutations must stop after discovering cheaper native route');
 assert(runs<100,'do not blindly run all 100 washes of every acquisition order');
 assert(result.routes.every(r=>[201,202,203].every(id=>r.final_slots.some(t=>t.id===id))));
 assert(result.routes.every(r=>r.optimal===false),'never claim global optimality');
 console.log('PASS: incumbent pill pruning of mixed talent orders with verified final slots',JSON.stringify({runs,pruned:result.prunedByIncumbent,best:result.routes[0].pills}));
})().catch(err=>{console.error(err);process.exitCode=1});
