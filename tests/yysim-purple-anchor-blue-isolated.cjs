'use strict';
// Separate PROCESS baseline: verifies that the three-purple/blue result
// does not depend on earlier wash searches in the same WASM instance.
const assert=require('node:assert/strict'),fs=require('node:fs');
const vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;globalThis.location={protocol:'file:'};
for(const file of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
 'vendor/yysim/data.js','engine/yysim-native-search-guard.js',
 'engine/yysim-purple-anchor-mixed.js']){
 vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{
  filename:file,timeout:30000
 });
}
(async()=>{
 assert(await initWasm(),'original WASM unavailable');
 assert(wasmInitEngine(TALENT_DATA,ZZ_DATA),'native talent table rejected');
 const original=wasmGetState();
 assert(wasmSetState({...original,mode:'seed',zizhi:154,
  seed:447882174,role_id:10044,has_bag_pills:true,bag_pills:20000,
  talents:[{id:171,locked:false},{id:172,locked:false},
   {id:173,locked:false},{id:174,locked:false}],
  total_wash:0,total_pills:0}));
 const fixture=wasmGetState();
 const fingerprint=YYWashNativeSearchGuard.canonicalJson(fixture);
 const goals=[271,268,272,202];
 const out=await YYWashPurpleAnchorMixed.run({
  desiredIds:goals,maxPad:0,horizon:900,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,
  exchangeTalent:wasmExchangeTalent,guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),fingerprint,
  'Independent blue fixture mutated original native save state');
 assert(out.routes.every(r=>goals.every(id=>
  r.final_slots.some(t=>Number(t.id)===id&&t.locked))),
  'Isolated blue route lacks all four final locked talents');
 assert(out.routes.length>0,
  'Fresh original WASM did not reproduce three-purple/blue final four-slot route');
 assert(out.routes[0].pills>0&&out.routes[0].pills<=4148,
  'Fresh WASM native blue-route cost exceeds previously verified 4148 pills');
 assert(out.routes.every(r=>r.optimal===false),
  'Native bounded wash candidates must not assert exact global minimum');
 console.log('YY_ISOLATED_THREE_PURPLE_BLUE_WASM '+JSON.stringify({
  goals,completeRoutes:out.routes.length,
  bestPills:out.routes[0]?.pills??null,
  finalIds:out.routes[0]?.final_slots.map(t=>Number(t.id))||null,
  diagnostics:out.diagnostics,sourcePreserved:true
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
