'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=cp.spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  const checks=await page.evaluate(async()=>{
   const {washEngine}=await import('./engine/local-engine-bridge.js');
   const init=await washEngine.call('init');
   const before=await washEngine.call('state');
   const chosen={...before,seed:447882174,role_id:10044,zizhi:154,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    bag_pills:20000,has_bag_pills:true,total_pills:0,total_wash:0};
   await washEngine.call('set-state',chosen);
   const original=await washEngine.call('state');
   const native=await washEngine.call('auto-search',{
    desiredIds:[271,272,250],maxPad:20,horizon:1200,topN:3
   });
   const after=await washEngine.call('state');
   const forbidden=[];
   for(const op of ['auto-intermediate-search','auto-color-search']){
    try{await washEngine.call(op,{desiredIds:[184,271],horizon:100})}
    catch(err){forbidden.push(op)}
   }
   const final=await washEngine.call('state');
   const controls=(window.YYWashTargetCatalog||[]).flatMap(group=>
    (group.items||[]).map(item=>({id:Number(item.id),quality:group.quality})));
   const green=controls.find(x=>x.quality===2),blue=controls.find(x=>x.quality===3);
   const blocked=[];
   for(const target of [green,blue].filter(Boolean)){
    try{await washEngine.call('auto-search',{desiredIds:[271,target.id],horizon:100,maxPad:5,topN:3})}
    catch(e){blocked.push(target.quality)}
   }
   return {ready:init.ready,native:native.nativeFunction,
    routes:native.result?.routes?.length||0,
    immutable:JSON.stringify(original)===JSON.stringify(after)&&JSON.stringify(after)===JSON.stringify(final),
    forbidden,blocked,green:!!green,blue:!!blue,
    hostScripts:[...document.scripts].filter(x=>/intermediate-search|exchange-beam-search/.test(x.src)).length};
  });
  assert(checks.ready,'native yy-sim init failed');
  assert.equal(checks.native,'wasmSearchWashRoutes');
  assert(checks.immutable,'native search must preserve current WASM state');
  assert.deepEqual(checks.forbidden,['auto-intermediate-search','auto-color-search']);
  assert.deepEqual(checks.blocked,[2,3]);
  assert.equal(checks.hostScripts,0);
  assert(checks.green&&checks.blue,'mixed target catalog must remain available for native extension');
  assert.deepEqual(errs,[],'unexpected page JS errors');
  console.log('PASS: original native yy-sim auto-search only; obsolete custom operations gone; green/blue fail closed',checks);
 }finally{
  await browser?.close();
  server.kill('SIGTERM');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
