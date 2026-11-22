'use strict';
// Execute the REAL unmodified yy-sim wasm binary via its existing core_glue.js.
// This is a diagnostic/CI probe, NOT an alternative wash solver.
// No browser or Playwright required; never changes user save data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');

globalThis.window=globalThis;
globalThis.location={protocol:'file:'};
for(const file of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
 'vendor/yysim/data.js','engine/yysim-native-search-guard.js']){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 vm.runInThisContext(source,{filename:file,timeout:30000});
}

const serialize=value=>JSON.stringify(value);
function goalResult(raw,ids){
 if(!raw||!Array.isArray(raw.routes))return {classification:'invalid-native-response',
  error:String(raw?.error||'Invalid WASM route response'),complete:0,candidates:0};
 const finished=raw.routes.filter(route=>{
  const all=new Set((route?.final_slots||[]).map(slot=>Number(slot?.id)));
  return ids.every(id=>all.has(id));
 });
 const costs=finished.map(x=>Number(x.pills)).filter(x=>Number.isSafeInteger(x)&&x>=0);
 return {
  classification:raw.error?'native-reported-error':finished.length?
   'final-goals-confirmed':raw.routes.length?'incomplete-final-slots':'not-found-in-window',
  candidates:raw.routes.length,complete:finished.length,
  cheapest:costs.length?Math.min(...costs):null,
  nativeError:raw.error||null
 };
}
async function main(){
 assert.equal(typeof initWasm,'function');
 assert.equal(await initWasm(),true,'Original yy-sim WASM initialization failed');
 assert.equal(wasmInitEngine(TALENT_DATA,ZZ_DATA),true,'Original talent/ZZ data init failed');
 const original=wasmGetState();
 assert(original&&typeof original==='object','Native start state absent');
 const seedState={...original,zizhi:154,seed:447882174,role_id:10044,
  talents:[{id:171,locked:false},{id:172,locked:false},
   {id:173,locked:false},{id:174,locked:false}],
  total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
 assert(wasmSetState(seedState),'Native test state rejected');
 const baseline=serialize(wasmGetState());
 const grades=[
  {name:'purple',ids:[271]},
  {name:'green',ids:[184]},
  {name:'blue',ids:[202]},
  {name:'green-purple',ids:[184,271]},
  {name:'blue-purple',ids:[202,271]},
  {name:'green-blue-purple',ids:[184,202,271]},
  // The exact user-reported regression shape: 3 purple native targets,
  // then the SAME 3 purples plus one green target of a distinct type.
  {name:'three-purple',ids:[271,268,272]},
  {name:'three-purple-plus-green',ids:[271,268,272,184]}
 ];
 const outcomes=[];
 for(const item of grades){
  const types=item.ids.map(id=>Number(TALENT_DATA[id]?.type));
  assert.equal(new Set(types).size,types.length,'Duplicate talent family: '+item.name);
  const request={desired_ids:item.ids,max_pad:0,horizon:30,top_n:2};
  const begin=performance.now();
  let raw=null,error=null;
  try{
   raw=YYWashNativeSearchGuard.run({
    getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
   },request);
  }catch(e){error=String(e?.message||e)}
  const elapsedMs=+(performance.now()-begin).toFixed(2);
  assert.equal(serialize(wasmGetState()),baseline,
   'WASM changed source state on '+item.name);
  const summary=error?{classification:'native-exception',error,complete:0,
   candidates:0}:goalResult(raw,item.ids);
  outcomes.push({name:item.name,elapsedMs,...summary});
 }
 // The existing original purple-only function must remain deterministic.
 const request={desired_ids:[271],max_pad:0,horizon:30,top_n:2};
 const attempts=[];
 for(let i=0;i<2;i++){
  const started=performance.now();
  let raw=null,error=null;
  try{raw=YYWashNativeSearchGuard.run({
   getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
  },request)}catch(e){error=String(e?.message||e)}
  assert.equal(serialize(wasmGetState()),baseline,
   'Repeat purple call mutated original state');
  attempts.push({json:serialize(raw),error,ms:+(performance.now()-started).toFixed(2)});
 }
 assert.deepEqual({json:attempts[0].json,error:attempts[0].error},
  {json:attempts[1].json,error:attempts[1].error},
  'Original purple WASM search is not deterministic for the same state');
 const purpleThree=outcomes.find(x=>x.name==='three-purple');
 const mixedFour=outcomes.find(x=>x.name==='three-purple-plus-green');
 assert(purpleThree&&mixedFour,'3 purple + 1 green regression pair missing');
 const comparison={
  sameNativeState:true,sameMaxPad:0,sameHorizon:30,sameTopN:2,
  purpleOnly:{classification:purpleThree.classification,
   elapsedMs:purpleThree.elapsedMs,complete:purpleThree.complete,
   cheapest:purpleThree.cheapest??null},
  threePurplePlusGreen:{classification:mixedFour.classification,
   elapsedMs:mixedFour.elapsedMs,complete:mixedFour.complete,
   cheapest:mixedFour.cheapest??null}
 };
 const report={wasmEngine:'original-yy-sim',readOnly:true,
  nativeCall:'search_wash_routes',purpleDeterministic:true,
  purpleMs:attempts.map(x=>x.ms),threePurpleGreenComparison:comparison,
  gradeResults:outcomes};
 console.log('YY_SIM_NATIVE_NODE_GRADE_RESULT',JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1});
