'use strict';
// Browser-only, read-only comparison of native WASM in an isolated Worker
// against the currently deployed iframe engine. This is NOT user-facing.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],
  {cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  for(let i=0;i<30;i++){
   try{await page.goto('http://127.0.0.1:8767/',{waitUntil:'domcontentloaded'});break}
   catch(error){if(i===29)throw error;await new Promise(r=>setTimeout(r,200))}
  }
  const evidence=await page.evaluate(async()=>{
   const {washSearchEngine}=await import('./engine/local-engine-bridge.js');
   await washSearchEngine.call('init');
   const baseline=await washSearchEngine.call('state');
   const sample={...baseline,zizhi:154,seed:447882174,role_id:10044,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
   await washSearchEngine.call('set-state',sample);
   const state=await washSearchEngine.call('state');
   const frame=washSearchEngine.frame.contentWindow;
   const reqs=[
    {name:'purple',desired_ids:[271],max_pad:0,horizon:30,top_n:2},
    {name:'mixed-diagnostic-only',desired_ids:[184,202,271],max_pad:0,horizon:30,top_n:2}
   ];
   const worker=new Worker('./vendor/yysim/native-search-worker.js');
   const responses=[];
   const before=JSON.stringify(state);
   try{
    for(let i=0;i<reqs.length;i++){
     const req=reqs[i];
     let expected=null,directError=null;
     const started=performance.now();
     try{expected=frame.eval('wasmSearchWashRoutes('+JSON.stringify(req)+')')}
     catch(err){directError=String(err?.message||err)}
     const directMs=Math.round((performance.now()-started)*100)/100;
     if(JSON.stringify(await washSearchEngine.call('state'))!==before)
      throw Error('Native iframe comparison mutated original WASM state');
     const job=new Promise((resolve,reject)=>{
      const id=i+1;
      const timeout=setTimeout(()=>{worker.removeEventListener('message',onMessage);
       reject(Error('Worker diagnostic request timed out'))},30000);
      function onMessage(event){
       const data=event.data||{};
       if(data.requestId!==id||data.kind!=='yy-native-search-probe-result')return;
       clearTimeout(timeout);worker.removeEventListener('message',onMessage);
       resolve(data);
      }
      worker.addEventListener('message',onMessage);
      worker.postMessage({kind:'yy-native-search-probe',requestId:id,state,request:req});
     });
     const startedWorker=performance.now();
     const workerResult=await job;
     const workerMs=Math.round((performance.now()-startedWorker)*100)/100;
     if(JSON.stringify(await washSearchEngine.call('state'))!==before)
      throw Error('Worker diagnostic modified the main WASM instance');
     // Error text may be wrapped by the state guard. Preserve raw native
     // diagnostics, but do not mistake an expected mixed-grade rejection for
     // proof of success or worker failure. Only a matching successful purple
     // result qualifies the worker for a future production migration.
     const nativeParity=!directError&&workerResult.ok&&
      workerResult.stateUnchanged===true&&
      JSON.stringify(expected)===JSON.stringify(workerResult.result);
     responses.push({name:req.name,iframeError:directError,
      workerError:workerResult.error||null,iframeMs:directMs,workerMs,
      iframeReturnedRoutes:Array.isArray(expected?.routes)?expected.routes.length:null,
      workerReturnedRoutes:Array.isArray(workerResult.result?.routes)?
       workerResult.result.routes.length:null,
      workerPreserved:workerResult.stateUnchanged===true,
      matching:nativeParity,comparisonValid:!directError&&workerResult.ok});
    }
   }finally{worker.terminate()}
   return {responses,mainStatePreserved:JSON.stringify(await washSearchEngine.call('state'))===before};
  });
  assert(evidence.mainStatePreserved,'live native state changed');
  const purple=evidence.responses.find(r=>r.name==='purple');
  assert(purple?.matching,'Native purple worker result is NOT proven identical to iframe');
  // The mixed-grade query is an investigation: original WASM may reject it.
  // A mixed failure must not block the unrelated, verified purple parity
  // comparison; nor may it be described as implemented mixed search.
  console.log('ORIGINAL_YY_SIM_NATIVE_WORKER_PARITY',JSON.stringify(evidence));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(err=>{console.error(err);process.exitCode=1});
