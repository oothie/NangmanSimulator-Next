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
  // Node's HTTP server starts asynchronously. Retry connection refused
  // rather than treating a startup race as a failed WASM regression.
  for(let attempt=0;attempt<30;attempt++){
   try{
    await page.goto('http://127.0.0.1:8767/',{waitUntil:'domcontentloaded'});
    break;
   }catch(error){
    if(attempt===29)throw error;
    await new Promise(resolve=>setTimeout(resolve,200));
   }
  }
  const result=await page.evaluate(async()=>{
   const {washSearchEngine}=await import('./engine/local-engine-bridge.js');
   await washSearchEngine.call('init');
   const baseline=await washSearchEngine.call('state');
   const copied={...baseline,role_id:10044,zizhi:154,seed:447882174,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    total_pills:0,total_wash:0,bag_pills:10000,has_bag_pills:true};
   await washSearchEngine.call('set-state',copied);
   const frame=washSearchEngine.frame.contentWindow;
   // All native calls are made in the scratch iframe; the live washEngine
   // and original TALENT_DATA are not modified.
   return frame.eval(`(function(){
    const initial=wasmGetState();
    const scenarios=[{id:184,gradeBefore:2,gradeProbe:3},
                     {id:184,gradeBefore:2,gradeProbe:4},
                     {id:271,gradeBefore:4,gradeProbe:3},
                     {id:271,gradeBefore:4,gradeProbe:2}];
    if(scenarios.some(s=>initial.talents.some(slot=>Number(slot.id)===s.id)))
     throw Error('Probe fixture already contains a target; grade gate would be masked');
    const probes=[];
    const query=(id)=>{
     let response=null,exception=null;
     try{response=wasmSearchWashRoutes({
      desired_ids:[id],max_pad:0,horizon:120,top_n:3
     })}catch(e){exception=String(e?.message||e)}
     return {error:exception||response?.error||null,
      keys:response&&typeof response==='object'?Object.keys(response).sort():[],
      total:response?.routes?.length??null,
      complete:(response?.routes||[]).filter(route=>
       route?.final_slots?.some(slot=>Number(slot.id)===id)).length,
      firstPills:response?.routes?.[0]?.pills??null};
    };
    for(const scenario of scenarios){
     const id=scenario.id,originalGrade=TALENT_DATA[String(id)]?.pinzhi;
     if(originalGrade!==scenario.gradeBefore)
      throw Error('Native fixture grade mismatch for '+id);
     let before=null,spoofed=null,probeError=null;
     try{
      before=query(id);
      TALENT_DATA[String(id)].pinzhi=scenario.gradeProbe;
      if(!wasmInitEngine(TALENT_DATA,ZZ_DATA))throw Error('Probe init rejected');
      if(!wasmSetState(initial))throw Error('Probe state injection failed');
      spoofed=query(id);
     }catch(e){probeError=String(e?.message||e)}
     finally{
      TALENT_DATA[String(id)].pinzhi=originalGrade;
      if(!wasmInitEngine(TALENT_DATA,ZZ_DATA)||!wasmSetState(initial))
       throw Error('Unable to restore original data after '+id);
     }
     const replay=query(id);
     probes.push({id,originalGrade,probeGrade:scenario.gradeProbe,
      before,spoofed,probeError,
      restored:JSON.stringify(replay)===JSON.stringify(before),
      gradeRestored:TALENT_DATA[String(id)]?.pinzhi===originalGrade});
    }
    return {probes,allRestored:probes.every(p=>p.restored&&p.gradeRestored),
     stateRestored:JSON.stringify(initial)===JSON.stringify(wasmGetState()),
     note:'Diagnostic grade mutations are never gameplay-valid predictions'};
   })()`);
  });
  assert.equal(result.probes.length,4);
  assert(result.allRestored,'native route outputs changed after isolated grade tests');
  assert(result.stateRestored,'original WASM state not restored');
  assert.deepEqual(result.probes.map(x=>[x.id,x.probeGrade]),
   [[184,3],[184,4],[271,3],[271,2]]);
  console.log('NATIVE_GRADE_GATE_PROBE',JSON.stringify(result));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(error=>{console.error(error);process.exitCode=1});
