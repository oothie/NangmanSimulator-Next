'use strict';
// Diagnostic only: distinguish a native talent-grade gate from talent-ID gate.
// Executes exclusively in a disposable browser tab + search iframe.
// Never patches the deployed WASM, gameplay data or user-facing auto-search.
const assert=require('node:assert/strict');
const {chromium}=require('playwright'),cp=require('node:child_process'),path=require('node:path');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],
  {cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8767/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const {washSearchEngine}=await import('./engine/local-engine-bridge.js');
   await washSearchEngine.call('init');
   const baseline=await washSearchEngine.call('state');
   const copied={...baseline,role_id:10044,zizhi:154,seed:447882174,
    talents:[{id:184,locked:false},{id:171,locked:false},
     {id:172,locked:false},{id:173,locked:false}],
    total_pills:0,total_wash:0,bag_pills:10000,has_bag_pills:true};
   await washSearchEngine.call('set-state',copied);
   const frame=washSearchEngine.frame.contentWindow;
   // All native calls are made in the scratch iframe; the live washEngine
   // and original TALENT_DATA are not modified.
   return frame.eval(`(function(){
    const initial=wasmGetState(),id=184;
    const oldGrade=TALENT_DATA[String(id)]?.pinzhi;
    if(oldGrade!==2)throw Error('Expected native green talent 184');
    const query=()=>{
     let response=null,exception=null;
     try{response=wasmSearchWashRoutes({
      desired_ids:[id],max_pad:0,horizon:35,top_n:2
     })}catch(e){exception=String(e?.message||e)}
     return {error:exception||response?.error||null,
      keys:response&&typeof response==='object'?Object.keys(response).slice(0,12):[],
      total:response?.routes?.length??null,
      complete:(response?.routes||[]).filter(route=>
       route?.final_slots?.some(slot=>Number(slot.id)===id)).length};
    };
    let before=null,spoofed=null,probeError=null;
    try{
     before=query();
     TALENT_DATA[String(id)].pinzhi=4;
     if(!wasmInitEngine(TALENT_DATA,ZZ_DATA))throw Error('Probe WASM data init rejected');
     if(!wasmSetState(initial))throw Error('Probe state restore failed');
     spoofed=query();
    }catch(error){probeError=String(error?.message||error)}
    finally{
     TALENT_DATA[String(id)].pinzhi=oldGrade;
     if(!wasmInitEngine(TALENT_DATA,ZZ_DATA)||!wasmSetState(initial))
      throw Error('Unable to restore original WASM grade and state');
    }
    const replay=query();
    return {id,originalGrade:oldGrade,baseline:before,spoofed,probeError,
     searchOutputRestored:JSON.stringify(replay)===JSON.stringify(before),
     restoredGrade:TALENT_DATA[String(id)].pinzhi,
     originalSnapshotRestored:JSON.stringify(initial)===JSON.stringify(wasmGetState()),
     warning:'Spoofing a grade changes the game pool, so no result is a valid gameplay route'};
   })()`);
  });
  assert.equal(result.originalGrade,2);
  assert.equal(result.restoredGrade,2);
  assert(result.originalSnapshotRestored,'isolated WASM probe did not restore snapshot');
  assert(result.searchOutputRestored,'reinitialized original WASM route response changed after diagnostic');
  console.log('NATIVE_GRADE_GATE_PROBE',JSON.stringify(result));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(error=>{console.error(error);process.exitCode=1});
