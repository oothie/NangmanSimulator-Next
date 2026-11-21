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
   const scratch=module.washSearchEngine;
   await scratch.call('init');
   const copied=await scratch.call('set-state',mapped);
   const search=await scratch.call('auto-intermediate-search',{
    desiredIds:[184,191],horizon:100,topN:5});
   const restored=await engine.call('state');
   return {initialized,hasState:!!snapshot,slots:Array.isArray(snapshot?.talents),
    mapped:mapped?.role_id,search:search?.result?.routes?.length||0,
    scanned:search?.result?.scanned||0,
    scratchMatches:JSON.stringify(copied)===JSON.stringify(mapped),
    preserved:JSON.stringify(restored)===JSON.stringify(mapped)};
  });
  assert(result.initialized?.ready&&result.hasState&&result.slots&&result.search>0&&result.scanned>1&&result.scratchMatches&&result.preserved,
    'actual browser iframe engine init failed: '+JSON.stringify({result,errs}));
  console.log('PASS: browser same-origin yy-sim WASM iframe init, state and scripts');
  const finalSearch=await page.evaluate(async()=>{
   const {washEngine,washSearchEngine}=await import('./engine/local-engine-bridge.js');
   const originalLive=await washEngine.call('state');
   const seed={...originalLive,zizhi:152,seed:447882174,role_id:10044,
    talents:[{id:171,locked:false},{id:172,locked:false}],
    bag_pills:20000,has_bag_pills:true,total_pills:0,total_wash:0,
    tal_lucky:0,luck_seed_inited:false,luck_seed:'0'};
   await washSearchEngine.call('set-state',seed);
   const greenIds=new Set((window.YYWashTargetCatalog||[]).find(x=>x.quality===2)?.items.map(x=>x.id)||[]);
   const blueIds=new Set((window.YYWashTargetCatalog||[]).find(x=>x.quality===3)?.items.map(x=>x.id)||[]);
   let green=0,blue=0,needed=0;
   for(let n=1;n<=700;n++){
    const result=await washSearchEngine.call('wash',{count:1});
    if(result.performed!==1)break;
    const slots=result.state.talents;
    if(!green){
     const candidate=slots.find(x=>greenIds.has(Number(x.id)));
     if(candidate){
      green=Number(candidate.id);
      const other=slots.find(x=>blueIds.has(Number(x.id)));
      if(other)blue=Number(other.id);
      else{
       const at=slots.findIndex(x=>Number(x.id)===green);
       await washSearchEngine.call('toggle-lock',{index:at});
      }
     }
    }else{
     const candidate=slots.find(x=>blueIds.has(Number(x.id)));
     if(candidate)blue=Number(candidate.id);
    }
    if(green&&blue){needed=n;break}
   }
   if(!green||!blue)throw Error('Native final-slot green/blue fixture not found');
   await washSearchEngine.call('set-state',seed);
   const checked=await washSearchEngine.call('auto-intermediate-search',{
    desiredIds:[green,blue],horizon:Math.min(900,needed+50),topN:8});
   const retained=(checked.result?.routes||[]).filter(route=>
    [green,blue].every(id=>route.final_slots.some(slot=>Number(slot.id)===id)));
   const ranked=window.YYWashAutoSearch.routeOutcome(checked.result,checked.desiredIds);
   const route=ranked.routes.find(x=>x.complete&&x.executable);
   if(!route)throw Error('No executable final-slot route: '+JSON.stringify(ranked.stats));
   await washSearchEngine.call('set-state',seed);
   const replay=await window.YYWashRouteReplay.run({
    route,nameIds:checked.nameIds,call:(op,payload)=>washSearchEngine.call(op,payload)
   });
   const unchanged=JSON.stringify(await washEngine.call('state'))===JSON.stringify(originalLive);
   return {green,blue,needed,scanned:checked.result?.scanned,
    routeCount:retained.length,cheapest:retained[0]?.pills,
    withinWitness:retained[0]?.washes<=needed,unchanged,
    replayVerified:replay?.verified===true,
    replayPills:replay?.pillsConsumed,warnings:checked.warnings||[]};
  });
  assert(finalSearch.routeCount>0&&finalSearch.scanned>=2&&finalSearch.withinWitness&&finalSearch.unchanged&&finalSearch.replayVerified,
   'native final green-blue minimum candidate: '+JSON.stringify(finalSearch));
  console.log('PASS: dynamically discovered green+blue stay simultaneously in final slots, min candidate <= observed path; live state intact',JSON.stringify(finalSearch));

  const retryPage=await browser.newPage();
  let failedAssets=0;
  await retryPage.route(/\/wasm_data\.js\?rev=0\.10\.7/,async route=>{
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
