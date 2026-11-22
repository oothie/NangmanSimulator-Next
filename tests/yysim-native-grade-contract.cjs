'use strict';
// Read-only characterization of the original yy-sim WASM route export.
// A green/blue return must NEVER be treated as success without final slots.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const path=require('node:path');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],
  {cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  // Node's HTTP server starts asynchronously. Retry connection refused
  // rather than treating a startup race as a failed WASM regression.
  for(let attempt=0;attempt<30;attempt++){
   try{
    await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
    break;
   }catch(error){
    if(attempt===29)throw error;
    await new Promise(resolve=>setTimeout(resolve,200));
   }
  }
  const audit=await page.evaluate(async()=>{
   const {washSearchEngine}=await import('./engine/local-engine-bridge.js');
   await washSearchEngine.call('init');
   const baseline=await washSearchEngine.call('state');
   const current={...baseline,zizhi:154,seed:447882174,role_id:10044,
    talents:[{id:171,locked:false},{id:172,locked:false},
     {id:173,locked:false},{id:174,locked:false}],
    total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
   await washSearchEngine.call('set-state',current);
   const frame=washSearchEngine.frame;
   const target=Array.from(document.querySelectorAll('iframe')).find(x=>x===frame);
   if(!target)throw Error('native iframe unavailable');
   const engine=target.contentWindow;
   // Same-origin WASM function is intentionally unavailable through the
   // user-facing command; use it only from this regression characterization.
   const outcome=engine.eval(`(function(){
    const original=wasmGetState();
    const candidates=[
     {grade:4,id:271},{grade:2,id:184},{grade:3,id:191}
    ];
    const rows=[];
    for(const item of candidates){
     let response=null,error=null;
     try{response=wasmSearchWashRoutes({
      desired_ids:[item.id],max_pad:0,horizon:30,top_n:1
     })}catch(err){error=String(err.message||err)}
     const valid=(response?.routes||[]).filter(route=>
      route?.final_slots?.some(t=>Number(t.id)===item.id));
     rows.push({grade:item.grade,returned:response?.routes?.length??null,
      valid:valid.length,error:error||response?.error||null});
     if(JSON.stringify(wasmGetState())!==JSON.stringify(original))
      throw Error('read-only grade probe modified native state');
    }
    // Explicitly test combinations against FINAL native slots, not transient
    // acquisitions or the presence of a JSON "routes" array. This isolates
    // whether original behavior rejects IDs at the request boundary or
    // produces paths that drop some goals before reaching the final state.
    const sets=[
     {name:'purple-only',ids:[271]},
     {name:'green-only',ids:[184]},
     {name:'blue-only',ids:[191]},
     {name:'green-purple',ids:[184,271]},
     {name:'blue-purple',ids:[202,271]},
     {name:'green-blue-purple',ids:[184,202,271]}
    ];
    // Native type IDs identify overlapping upgrade families. In particular
    // blue 191 and purple 271 are BOTH type 177 and are unsuitable as
    // simultaneous final-goal benchmarks. Keep every mixed test family
    // distinct to avoid falsely blaming a native grade restriction.
    for(const target of sets){
     if(target.ids.length<2)continue;
     const types=target.ids.map(id=>TALENT_DATA[String(id)]?.type);
     if(types.some(v=>v==null)||new Set(types).size!==types.length)
      throw Error('원본 혼합 재능 검사 목표의 type 계열 중복: '+target.name);
    }
    const mixedGoalResults=[];
    for(const target of sets){
     let response=null,error=null;
     const started=performance.now();
     try{response=wasmSearchWashRoutes({
      desired_ids:target.ids,max_pad:0,horizon:30,top_n:2
     })}catch(err){error=String(err?.message||err)}
     const elapsedMs=Math.round((performance.now()-started)*100)/100;
     const paths=Array.isArray(response?.routes)?response.routes:[];
     const complete=paths.filter(route=>{
      const last=new Set((route.final_slots||[]).map(t=>Number(t.id)));
      return target.ids.every(id=>last.has(id));
     });
     mixedGoalResults.push({name:target.name,ids:target.ids,
      routes:paths.length,complete:complete.length,elapsedMs,
      cheapestComplete:complete.reduce((best,r)=>
       Number.isSafeInteger(Number(r.pills))&&Number(r.pills)>=0?
        Math.min(best,Number(r.pills)):best,Infinity),
      error:error||response?.error||null});
     if(JSON.stringify(wasmGetState())!==JSON.stringify(original))
      throw Error('mixed-grade native route probe modified original WASM state');
    }
    // Purple-only reference: same state + same request should produce the
    // same native result in two calls. This is an algorithm baseline, not a
    // fabricated target-minimum or a speed guarantee on other machines.
    const baselineRequest={desired_ids:[271],max_pad:0,horizon:30,top_n:2};
    const baselineTrials=[];
    for(let i=0;i<2;i++){
     const started=performance.now();
     const result=wasmSearchWashRoutes(baselineRequest);
     baselineTrials.push({elapsedMs:Math.round((performance.now()-started)*100)/100,
      result:JSON.stringify(result)});
     if(JSON.stringify(wasmGetState())!==JSON.stringify(original))
      throw Error('native purple repeat search mutated the WASM state');
    }
    if(baselineTrials[0].result!==baselineTrials[1].result)
     throw Error('원본 자맥 검색이 같은 상태·같은 목표에 서로 다른 결과를 반환');
    const nativePurpleBaseline={timesMs:baselineTrials.map(x=>x.elapsedMs),
     deterministic:true,resultLength:baselineTrials[0].result.length};
    mixedGoalResults.forEach(x=>{
     if(x.cheapestComplete===Infinity)x.cheapestComplete=null;
    });
    // Characterize optional fields described by original Rust serde metadata.
    // This is diagnostic only: do not enable flags in user-facing auto-search.
    const optionalRequests=[
     {name:'defaults',req:{desired_ids:[271],max_pad:0,horizon:30,top_n:1}},
     {name:'explicit-slot-policy',req:{desired_ids:[271],max_pad:0,horizon:30,top_n:1,
      allow_open_slot:false,max_slots:4,allow_pity:false,max_preview:30,pill_budget:100}},
     {name:'allow-open-slot',req:{desired_ids:[271],max_pad:0,horizon:30,top_n:1,
      allow_open_slot:true,max_slots:4,allow_pity:true,max_preview:30,pill_budget:100}}
    ];
    const requestVariants=[];
    for(const item of optionalRequests){
     let response=null,error=null;
     try{response=wasmSearchWashRoutes(item.req)}catch(e){error=String(e?.message||e)}
     requestVariants.push({name:item.name,
      returned:response?.routes?.length??null,
      error:error||response?.error||null,
      firstPills:response?.routes?.[0]?.pills??null});
     if(JSON.stringify(wasmGetState())!==JSON.stringify(original))
      throw Error('original native request field probe mutated state');
    }
    return {rows,mixedGoalResults,nativePurpleBaseline,requestVariants,unchanged:JSON.stringify(wasmGetState())===JSON.stringify(original)};
   })()`);
   const state=await washSearchEngine.call('state');
   return {outcome,preserved:JSON.stringify(state)===JSON.stringify(await washSearchEngine.call('state'))};
  });
  assert(audit.outcome.unchanged&&audit.preserved,'native grade audit mutated live state');
  assert.equal(audit.outcome.rows.length,3);
  assert.equal(audit.outcome.mixedGoalResults.length,6);
  assert(audit.outcome.nativePurpleBaseline.deterministic);
  assert.equal(audit.outcome.nativePurpleBaseline.timesMs.length,2);
  assert(audit.outcome.mixedGoalResults.every(r=>Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0));
  assert(audit.outcome.mixedGoalResults.every(row=>
   row.complete<=row.routes),'never accept transient mixed goals as final routes');
  console.log('ORIGINAL_YY_SIM_GRADE_CONTRACT',JSON.stringify(audit.outcome));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(err=>{console.error(err);process.exitCode=1});
