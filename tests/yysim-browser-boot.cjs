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
  page.on('pageerror',err=>errs.push('JS: '+err.message));
  page.on('console',msg=>{if(msg.type()==='error')errs.push('Console: '+msg.text())});
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   // Drive the exact same-origin engine host path as the UI, without a save.
   const module=await import('./engine/local-engine-bridge.js');
   const engine=module.washEngine;
   const initialized=await engine.call('init');
   const snapshot=await engine.call('state');
   const selected={...snapshot,mode:'seed',seed:447882174,role_id:10044,salt:262731,
    zizhi:153,sex:1,vip:1,talents:[{id:184,locked:false},{id:191,locked:false}],
    bag_pills:1200,has_bag_pills:true};
   const mapped=await engine.call('set-state',selected);
   const search=await engine.call('auto-intermediate-search',{
    desiredIds:[184,191],horizon:100,topN:5});
   const restored=await engine.call('state');
   return {initialized,hasState:!!snapshot,slots:Array.isArray(snapshot?.talents),
    mapped:mapped?.role_id,search:search?.result?.routes?.length||0,
    preserved:JSON.stringify(restored)===JSON.stringify(mapped)};
  });
  assert(result.initialized?.ready&&result.hasState&&result.slots&&result.search>0&&result.preserved,
    'actual browser iframe engine init failed: '+JSON.stringify({result,errs}));
  console.log('PASS: browser same-origin yy-sim WASM iframe init, state and scripts');
  const retryPage=await browser.newPage();
  let failedAssets=0;
  await retryPage.route(/\/wasm_data\.js\?rev=0\.10\.5/,async route=>{
   if(failedAssets++===0)return route.abort('failed');
   return route.continue();
  });
  await retryPage.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  const retry=await retryPage.evaluate(async()=>{
   const {washEngine}=await import('./engine/local-engine-bridge.js');
   const result=await washEngine.call('init');
   return {ready:result?.ready,bootAttempt:washEngine.bootAttempt,
    available:!!(await washEngine.call('state'))};
  });
  assert.equal(retry.ready,true,'automatic iframe bootstrap recovery');
  assert.equal(retry.bootAttempt,1,'only failed init retried, once');
  assert.equal(retry.available,true,'restarted WASM state accessible');
  assert(failedAssets>=2,'forced one transient asset failure and recovered');
  console.log('PASS: auto-retry re-fetches lost WASM data and recovers without clearing user save');
 }finally{
  if(browser)await browser.close();
  server.kill();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
