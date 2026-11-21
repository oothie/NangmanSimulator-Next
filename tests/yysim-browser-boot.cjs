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
   return {initialized,hasState:!!snapshot,slots:Array.isArray(snapshot?.talents)};
  });
  assert(result.initialized?.ready&&result.hasState&&result.slots,
    'actual browser iframe engine init failed: '+JSON.stringify({result,errs}));
  console.log('PASS: browser same-origin yy-sim WASM iframe init, state and scripts');
 }finally{
  if(browser)await browser.close();
  server.kill();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
