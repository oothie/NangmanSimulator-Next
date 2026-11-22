'use strict';
// Real browser integration for the 2/3 purple-anchored nearest green/blue
// algorithm: production iframe, ORIGINAL native WASM wash/replay, final slots.
const assert=require('node:assert/strict'),{chromium}=require('playwright'),
 cp=require('node:child_process'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=cp.spawn('python3',['-m','http.server','8777','--bind','127.0.0.1'],
  {cwd:root,stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(let tries=0;tries<30;tries++){
   try{await page.goto('http://127.0.0.1:8777/',{waitUntil:'domcontentloaded'});break}
   catch(e){if(tries===29)throw e;await new Promise(r=>setTimeout(r,200))}
  }
  const report=await page.evaluate(async()=>{
   const {washSearchEngine}=await import('./engine/local-engine-bridge.js');
   const ready=await washSearchEngine.call('init');
   const base=await washSearchEngine.call('state');
   const target={...base,mode:'seed',zizhi:154,seed:447882174,
    role_id:10044,has_bag_pills:true,bag_pills:20000,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    total_wash:0,total_pills:0};
   await washSearchEngine.call('set-state',target);
   const before=await washSearchEngine.call('state');
   const results=[];
   for(const goals of [[271,268,272,184],[271,268,184,202]]){
    const response=await washSearchEngine.call('auto-search',{
     desiredIds:goals,maxPad:0,horizon:goals[1]===268&&goals[2]===272?40:200,topN:1});
    const routes=response.result?.routes||[];
    const complete=routes.filter(route=>{
     const final=new Set((route.final_slots||[]).map(t=>Number(t.id)));
     return goals.every(id=>final.has(id));
    });
    const after=await washSearchEngine.call('state');
    results.push({goals,complete:complete.length,
     routes:routes.length,pills:complete[0]?.pills??null,
     allLocked:complete[0]?.final_slots.every(t=>t.locked===true)??false,
     nativeFunction:response.nativeFunction,
     method:response.nativeDiagnostics?.method,
     statePreserved:JSON.stringify(before)===JSON.stringify(after)});
   }
   return {ready:ready.ready,results};
  });
  assert(report.ready,'production WASM iframe initialization failed');
  for(const row of report.results){
   assert.equal(row.nativeFunction,'wasmSearchWashRoutes');
   assert.equal(row.method,'purple-anchor-original-wasm');
   assert(row.statePreserved,'mixed-grade branch changed original save state');
   assert.equal(row.complete,1,'native final four-goal route missing');
   assert(row.allLocked,'all four final talents must remain locked');
  }
  assert(report.results[0].pills>0&&report.results[0].pills<=7357,'3 purple + green is no worse than verified last-anchor route');
  assert(report.results[1].pills>0&&report.results[1].pills<=5032,'2 purple + green + blue is no worse than verified last-anchor route');
  assert.deepEqual(errors,[],'unexpected browser errors');
  console.log('YY_ANCHOR_PRODUCTION_BROWSER '+JSON.stringify(report));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
