'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{},setTimeout};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-auto-progressive.js'),'utf8'),ctx);
const {run}=ctx.window.YYWashProgressive;
let count=0;const calls=[],progress=[];
const api={
 options:x=>({...x}),
 routeOutcome:r=>({
  stats:{scanned:9,total:r.routes.length},
  routes:r.routes.map(x=>({...x,source:x}))
 })
};
(async()=>{
 const result=await run({
  call:async(op,opts)=>{
   count++;calls.push({op,opts});
   return {nativeFunction:'wasmSearchWashRoutes',nameIds:{},
    result:{routes:[
     {complete:false,executable:false,estimatedPills:1},
     {complete:true,executable:true,estimatedPills:21,actions:[{kind:'wash_to',wash_no:7}]}
    ],scanned:9}};
  },
  api,desiredIds:[271,272],maxPad:30,horizon:1500,topN:12,
  onProgress:p=>progress.push(p)
 });
 assert.equal(count,1,'exactly one native WASM call should run');
 assert.deepEqual(calls[0].opts,{desiredIds:[271,272],maxPad:30,horizon:1500,topN:12});
 assert.equal(result.result.routes.length,1,'incomplete native routes must not be returned');
 assert.equal(result.bestPills,21);
 assert.equal(progress.length,2);
 assert.equal(progress[1].phase,1);
 console.log('PASS: original native yy-sim automatic search has one call, honors bounds and rejects incomplete routes');
})().catch(e=>{console.error(e);process.exitCode=1});
