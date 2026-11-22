'use strict';
// DIAGNOSTIC ONLY: native yy-sim grade-input perturbation characterization.
// The production talent dictionary and original WASM binary remain untouched.
// A promoted grade is NOT a valid simulated green/blue wash result.
const cp=require('node:child_process');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const variants=['original','green-as-purple','blue-as-purple','both-as-purple'];
const goals=[
 {name:'purple-control',ids:[271]},
 {name:'green-single',ids:[184]},
 {name:'blue-single',ids:[202]},
 {name:'green-purple',ids:[184,271]},
 {name:'blue-purple',ids:[202,271]},
 {name:'3purple-green',ids:[271,268,272,184]},
 {name:'2purple-blue-green',ids:[271,268,202,184]}
];
const snapshot=x=>JSON.stringify(x,Object.keys(x||{}).sort());
if(!process.argv.includes('--child')){
 const out=[];
 for(const variant of variants){
  const run=cp.spawnSync(process.execPath,[__filename,'--child',variant],{
   cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024
  });
  assert.equal(run.status,0,variant+': '+run.stderr+'\n'+run.stdout);
  const line=run.stdout.split('\n').find(x=>x.startsWith('WASH_GRADE_PROBE '));
  assert(line,'missing isolated WASM result for '+variant);
  out.push(JSON.parse(line.slice('WASH_GRADE_PROBE '.length)));
 }
 assert.deepEqual(out.map(x=>x.variant),variants);
 assert(out.every(x=>x.preserved),'native request modified initial game state');
 console.log('ORIGINAL_WASM_GRADE_INPUT_CHARACTERIZATION '+JSON.stringify(out));
}else{
 (async()=>{
  const variant=process.argv.at(-1);
  assert(variants.includes(variant));
  globalThis.window=globalThis;globalThis.location={protocol:'file:'};
  for(const file of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
    'vendor/yysim/data.js','engine/yysim-native-search-guard.js']){
   vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),
    {filename:file,timeout:30000});
  }
  assert(await initWasm(),'native WASM init');
  const table=JSON.parse(JSON.stringify(TALENT_DATA));
  if(variant==='green-as-purple'||variant==='both-as-purple')
   table['184'].pinzhi=4;
  if(variant==='blue-as-purple'||variant==='both-as-purple')
   table['202'].pinzhi=4;
  assert(wasmInitEngine(table,ZZ_DATA),'native init_engine rejected talent dictionary');
  const initial=wasmGetState();
  const state={...initial,zizhi:154,seed:447882174,role_id:10044,
   talents:[{id:171,locked:false},{id:172,locked:false},
    {id:173,locked:false},{id:174,locked:false}],
   total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
  assert(wasmSetState(state),'native test state rejected');
  const before=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
  const rows=[];
  for(const goal of goals){
   let response=null,error=null;
   try{response=YYWashNativeSearchGuard.run({
    getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
   },{desired_ids:goal.ids,max_pad:0,horizon:30,top_n:2})}
   catch(e){error=String(e?.message||e)}
   const routes=Array.isArray(response?.routes)?response.routes:[];
   const complete=routes.filter(route=>{
    const last=new Set((route.final_slots||[]).map(t=>Number(t.id)));
    return goal.ids.every(id=>last.has(id));
   });
   assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),before,
    'Native WASM state changed for '+goal.name);
   rows.push({name:goal.name,error:error||response?.error||null,
    routes:routes.length,complete:complete.length,
    // Original result semantics: distinguish returned search order, final
    // held talents, and transient acquisition events. These observations
    // are NOT proofs of a green/blue route or of minimum pill cost.
    nativeOrderIds:routes[0]?.order_ids||null,
    finalIds:routes[0]?.final_slots?.map(t=>Number(t.id))||null,
    reachedIds:routes[0]?.reached_ids||null,
    actions:routes[0]?.actions?.map(a=>a.kind)||null,
    bestPills:complete.reduce((n,r)=>Math.min(n,Number(r.pills)||Infinity),Infinity)});
  }
  for(const x of rows)if(!Number.isFinite(x.bestPills))x.bestPills=null;
  console.log('WASH_GRADE_PROBE '+JSON.stringify({
   variant,grades:{184:table['184'].pinzhi,202:table['202'].pinzhi},
   preserved:true,rows
  }));
 })().catch(e=>{console.error(e);process.exitCode=1});
}
