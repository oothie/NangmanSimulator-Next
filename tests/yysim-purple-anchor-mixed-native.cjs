'use strict';
// Real original WASM purple-anchor extension characterization, NOT fake RNG.
// A route is only valid when target purple AND green/blue coexist in native slots.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;globalThis.location={protocol:'file:'};
for(const p of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
 'vendor/yysim/data.js','engine/yysim-native-search-guard.js',
 'engine/yysim-purple-anchor-mixed.js'])
 vm.runInThisContext(fs.readFileSync(path.join(root,p),'utf8'),{filename:p,timeout:30000});
(async()=>{
 assert(await initWasm());assert(wasmInitEngine(TALENT_DATA,ZZ_DATA));
 const initial=wasmGetState();
 assert(wasmSetState({...initial,mode:'seed',zizhi:154,
  seed:447882174,role_id:10044,
  talents:[{id:171,locked:false},{id:172,locked:false},
   {id:173,locked:false},{id:174,locked:false}],
  total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true}));
 const source=wasmGetState();
 const base=YYWashNativeSearchGuard.canonicalJson(source);
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,272,184],TALENT_DATA));
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,184,202],TALENT_DATA));
 assert.equal(YYWashPurpleAnchorMixed.requestShape([271,184],TALENT_DATA),null);
 const out=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:0,horizon:40,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base,
  'Purple anchor scan must restore exact user WASM state');
 assert(out.routes.every(r=>[271,268,272,184].every(id=>
  r.final_slots.some(t=>Number(t.id)===id))),'Unverified goal in results');
 assert(out.routes.every(r=>r.optimal===false),'Do not claim global optimality');
 console.log('YY_PURPLE_ANCHOR_MIXED_REAL_WASM '+JSON.stringify({
  shape:[271,268,272,184],
  routes:out.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),
  diagnostics:out.diagnostics,preserved:true
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
