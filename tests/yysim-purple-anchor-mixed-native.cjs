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
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,272,202],TALENT_DATA),
  'Three-purple plus blue must enter purple-anchored extension');
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
 assert(out.routes.length>0,'3 purple plus green must find an actual native final route');
 assert(out.routes[0].pills>0&&out.routes[0].pills<=7357,
  'Purple/green regression exceeded validated native route cost');
 assert(out.routes.every(r=>[271,268,272,184].every(id=>
  r.final_slots.some(t=>Number(t.id)===id))),'Unverified goal in results');
 assert(out.routes.every(r=>r.optimal===false),'Do not claim global optimality');
 // Also exercise the other requested 3-purple/1-blue shape with the
 // ORIGINAL native talent quality (blue 202), never promoted to purple.
 const blue=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,202],maxPad:0,horizon:180,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base,
  'Original native blue goal search must restore user WASM state');
 assert(blue.routes.every(r=>[271,268,272,202].every(id=>
  r.final_slots.some(t=>Number(t.id)===id&&t.locked))),
  'A returned 3-purple/blue route lacks a locked final target');
 assert(blue.routes.every(r=>r.optimal===false),
  'Bounded blue goal must not claim exact optimality');
 console.log('YY_PURPLE_ANCHOR_THREE_PURPLE_BLUE_NATIVE '+JSON.stringify({
  goals:[271,268,272,202],
  routes:blue.routes.map(r=>({pills:r.pills,finalIds:r.final_slots.map(t=>t.id)})),
  diagnostics:blue.diagnostics,preserved:true
 }));
 // The second requested shape uses two purple anchors and TWO green/blue
 // final targets. It may be absent from a short bounded window, but never
 // accept merely having seen either target in an intermediate wash.
 const two=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,184,202],maxPad:0,horizon:200,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base,
  'Two-purple anchor search must restore exact original state');
 assert(two.routes.length>0,'Two purple plus two colors must yield a final native route');
 assert(two.routes[0].pills>0&&two.routes[0].pills<=5032,
  'Two-color route exceeds validated native cost');
 assert(two.diagnostics.replanAttempts>0&&two.diagnostics.replanNativeRoutes>0,
  'Remaining-purple original WASM native replanning was not exercised');
 assert(two.diagnostics.betweenCandidates>4&&
  two.diagnostics.betweenExamined>4,
  'Native interval must examine candidates from BOTH ends beyond first four');
 assert(two.diagnostics.betweenExamined<=8,
  'Original WASM native interval must obey the bounded eight-candidate cap');
 assert((two.diagnostics.replannedCosts||[]).length>=2,
  'Additional inter-purple native final routes should be verified');
 assert(two.diagnostics.replannedCosts.every(item=>
  [271,268,184,202].every(id=>item.finalIds.includes(id))),
  'Inter-purple diagnostic route missing one of four final retained targets');
 assert(two.routes[0].pills<=
  Math.min(...two.diagnostics.replannedCosts.map(item=>item.pills)),
  'Expensive inter-purple branches must not displace a cheaper complete route');
 assert(two.routes.every(r=>[271,268,184,202].every(id=>
  r.final_slots.some(t=>Number(t.id)===id))),'Two-color result has missing final slot');
 assert(two.routes.every(r=>r.optimal===false),'A bounded search is not globally optimal');
 console.log('YY_PURPLE_ANCHOR_TWO_TWO_REAL_WASM '+JSON.stringify({
  shape:[271,268,184,202],
  routes:two.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),diagnostics:two.diagnostics,preserved:true
 }));
 // The user can have zero pills in their save: a hypothetical native
 // route still must predict exact cost without modifying source inventory.
 const empty={...source,bag_pills:0,has_bag_pills:true};
 assert(wasmSetState(empty));
 const lowBefore=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
 const low=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:0,horizon:40,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),lowBefore,
  'Hypothetical pill funding must not change zero-stock save state');
 assert.equal(low.routes[0]?.pills,out.routes[0]?.pills,
  'Zero-stock character predicted cost differs from funded reference');
 assert(wasmSetState(source));
 console.log('YY_PURPLE_ANCHOR_MIXED_REAL_WASM '+JSON.stringify({
  shape:[271,268,272,184],
  routes:out.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),
  diagnostics:out.diagnostics,preserved:true
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
