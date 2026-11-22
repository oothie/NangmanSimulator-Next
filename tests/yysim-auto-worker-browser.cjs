'use strict';
// Regression: native search must execute in a Worker, preserve the input state,
// emit factual stage counters and leave the page event loop responsive.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const path=require('node:path');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8781','--bind','127.0.0.1'],
  {cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(let i=0;i<30;i++){
   try{await page.goto('http://127.0.0.1:8781/',{waitUntil:'domcontentloaded'});break}
   catch(error){if(i===29)throw error;await new Promise(r=>setTimeout(r,200))}
  }
  // The normal wash UI is embedded: theme changes must reach the iframe
  // immediately, without requiring tab navigation, reload, or a save.
  await page.locator('#washV350Frame').waitFor({state:'attached'});
  await page.locator('#ink').click();
  await page.waitForFunction(()=>{
   const frame=document.querySelector('#washV350Frame');
   return frame?.contentWindow?.document.documentElement.dataset.theme==='ink';
  },{timeout:15000});
  const inkTheme=await page.evaluate(()=>{
   const frame=document.querySelector('#washV350Frame');
   const doc=frame.contentWindow.document;
   return {frameTheme:doc.documentElement.dataset.theme,
    bodyBg:getComputedStyle(doc.body).backgroundColor,
    rawPaneBg:getComputedStyle(doc.querySelector('#rawPane')).backgroundColor,
    primary:getComputedStyle(doc.querySelector('#washModule')).color};
  });
  assert.equal(inkTheme.frameTheme,'ink','normal wash must switch to dark immediately');
  assert.equal(inkTheme.rawPaneBg,'rgb(32, 36, 44)',
   'raw purple sequence pane must use neutral dark background, not brown active-state highlight');
  await page.locator('#paper').click();
  await page.waitForFunction(()=>{
   const frame=document.querySelector('#washV350Frame');
   return frame?.contentWindow?.document.documentElement.dataset.theme==='paper';
  },{timeout:15000});
  const paperTheme=await page.evaluate(()=>{
   const frame=document.querySelector('#washV350Frame');
   return getComputedStyle(frame.contentWindow.document.body).backgroundColor;
  });
  assert.notEqual(paperTheme,inkTheme.bodyBg,'normal wash background actually changes');
  const actual=await page.evaluate(async()=>{
   const {washEngine}=await import('./engine/local-engine-bridge.js');
   await washEngine.call('init');
   const original=await washEngine.call('state');
   const sample={...original,seed:447882174,role_id:10044,zizhi:154,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
   await washEngine.call('set-state',sample);
   const before=await washEngine.call('state');
   const progress=[];
   let heartbeats=0;
   const id=setInterval(()=>heartbeats++,10);
   let output;
   try{output=await washEngine.call('auto-search',{
    desiredIds:[271],maxPad:0,horizon:40,topN:1
   },item=>progress.push({...item}))}
   finally{clearInterval(id)}
   const after=await washEngine.call('state');
   const canonical=washEngine.frame.contentWindow.YYWashNativeSearchGuard.statesEqual;
   return {output,progress,heartbeats,unchanged:canonical(before,after)};
  });
  assert.equal(actual.output.nativeFunction,'wasmSearchWashRoutes');
  assert(Array.isArray(actual.output.result.routes),'native search response routes');
  assert(actual.unchanged,'Worker must never alter live original save state');
  const phases=actual.progress.map(row=>row.phase);
  for(const phase of ['worker-init','worker-ready','worker-state','worker-result'])
   assert(phases.includes(phase),'missing actually reached Worker stage: '+phase);
  assert.deepEqual(actual.progress.filter(x=>Number.isInteger(x.completed))
   .map(x=>x.completed),[0,1,2,3],'only measured stage completions');
  assert(actual.heartbeats>=1,'browser main event loop must remain responsive during native Worker search');
  assert.deepEqual(errors,[],'unexpected browser errors');
  console.log('PASS: original native WASM Worker isolation, truthful progress stages, responsive browser');
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(error=>{console.error(error);process.exitCode=1});
