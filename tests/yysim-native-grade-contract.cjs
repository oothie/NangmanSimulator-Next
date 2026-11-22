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
  await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
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
    return {rows,requestVariants,unchanged:JSON.stringify(wasmGetState())===JSON.stringify(original)};
   })()`);
   const state=await washSearchEngine.call('state');
   return {outcome,preserved:JSON.stringify(state)===JSON.stringify(await washSearchEngine.call('state'))};
  });
  assert(audit.outcome.unchanged&&audit.preserved,'native grade audit mutated live state');
  assert.equal(audit.outcome.rows.length,3);
  console.log('ORIGINAL_YY_SIM_GRADE_CONTRACT',JSON.stringify(audit.outcome));
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(err=>{console.error(err);process.exitCode=1});
