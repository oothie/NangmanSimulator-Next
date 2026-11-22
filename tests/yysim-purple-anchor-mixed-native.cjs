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
 // A real character may have no original purple backbone in the selected
 // horizon. This must NOT be reported as a green/blue scan with 0 candidates.
 // Verify all purple orders are tried without mutating the save.
 let emptyNativeAttempts=0;
 const emptyAnchorGuard={...YYWashNativeSearchGuard,
  run:()=>{emptyNativeAttempts++;return {routes:[],scanned:0,error:'no native anchor'};}};
 const unavailable=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:20,horizon:900,topN:2,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:emptyAnchorGuard
 });
 assert.equal(emptyNativeAttempts,6,'Three purple targets must retry all native target orders');
 assert.equal(unavailable.routes.length,0);
 assert.equal(unavailable.diagnostics.purpleNoRoute,true);
 assert.equal(unavailable.diagnostics.scannedWashes,0);
 assert.match(unavailable.error,/자맥.*0개/);
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base);
 const talentIds=new Map(Object.entries(TALENT_DATA).map(([id,t])=>
  [String(t.name),Number(id)]));
 function replayReturnedRoute(route,origin=source){
  const expectedSource=YYWashNativeSearchGuard.canonicalJson(origin);
  assert(wasmSetState(origin),'Native replay could not restore fixture');
  try{
   let last=Number(origin.total_wash);
   for(const action of route.actions||[]){
    const wash=Number(action.wash_no);
    assert(Number.isInteger(wash)&&wash>=last,
     'Returned route contains backward wash step '+JSON.stringify(action));
    while(Number(wasmGetState().total_wash)<wash){
     const n=Number(wasmGetState().total_wash);
     const result=wasmDoWash();
     assert(result&&!result.error&&Number(wasmGetState().total_wash)===n+1,
      'Returned route native doWash failed at '+n);
    }
    last=wash;
    const state=wasmGetState();
    if(['lock','unlock','keep'].includes(action.kind)){
     const id=talentIds.get(String(action.talent));
     const i=state.talents.findIndex(t=>Number(t.id)===id);
     assert(i>=0,'Returned route lock/unlock target absent '+JSON.stringify(action));
     assert(wasmSetState({...state,talents:state.talents.map((t,j)=>
      i===j?{...t,locked:action.kind!=='unlock'}:t)}),
      'Returned route lock/unlock rejected');
    }else if(action.kind==='exchange'){
     const id=talentIds.get(String(action.from));
     const index=state.talents.findIndex(t=>Number(t.id)===id);
     assert(index>=0,'Returned route exchange source absent');
     const x=wasmExchangeTalent(index);
     assert(x&&!x.error&&x.success!==false,
      'Returned route native exchange invalid '+JSON.stringify(action));
    }else assert(['wash_to','skip'].includes(action.kind),
      'Returned route has unknown step '+action.kind);
   }
   const final=wasmGetState();
   const got=final.talents.map(t=>({id:Number(t.id),locked:!!t.locked}));
   const expected=route.final_slots.map(t=>({id:Number(t.id),locked:!!t.locked}));
   assert.deepEqual(got,expected,'Returned route actions do not replay to final four slots');
   assert.equal(Number(final.total_pills)-Number(origin.total_pills),
    Number(route.pills),'Returned route native pill cost does not replay');
   return {pills:Number(route.pills),steps:route.actions.length,finalIds:got.map(t=>t.id)};
  }finally{
   assert(wasmSetState(origin));
   assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),expectedSource);
  }
 }

 // Bounded interval sampling must not ignore the whole middle when
 // there are many valid green/blue native events between purple anchors.
 const sampleEvents=Array.from({length:21},(_,i)=>({time:i+100}));
 const sampled=YYWashPurpleAnchorMixed.sampleIntervalCandidates(sampleEvents);
 assert.equal(sampled.length,8);
 assert.deepEqual(sampled.slice(0,2).map(x=>x.time),[100,101]);
 assert.deepEqual(sampled.slice(-2).map(x=>x.time),[119,120]);
 assert(sampled.some(x=>x.time>=108&&x.time<=112),
  'Native mixed-grade sampling skipped middle of purple interval');
 assert.deepEqual(YYWashPurpleAnchorMixed.sampleIntervalCandidates(sampleEvents.slice(0,5)),
  sampleEvents.slice(0,5),'Short interval candidates must not be discarded');
 // Candidate cap must retain native events for BOTH possible first
 // green/blue appearances, not just whichever goal has frequent hits.
 const colorEvents=Array.from({length:24},(_,i)=>({
  time:100+i,appearing:i===10||i===17?[202]:[184],
  state:{total_pills:100+i*7}
 }));
 const mixedSample=YYWashPurpleAnchorMixed.sampleMixedColorCandidates(
  colorEvents,[184,202],8);
 assert.equal(mixedSample.length,8);
 assert(mixedSample.some(x=>x.appearing.includes(184)),
  'Missing green-first native candidate');
 assert(mixedSample.some(x=>x.appearing.includes(202)),
  'Missing blue-first native candidate');
 assert(mixedSample.some(x=>x.time===110)&&mixedSample.some(x=>x.time===117),
  'Both blue native intervals should remain eligible');
 assert(mixedSample.every((x,i,a)=>i===0||
  Number(a[i-1].state.total_pills)<=Number(x.state.total_pills)),
  'Native candidate exploration should prioritize lower observed pill cost');
 const reversedSample=YYWashPurpleAnchorMixed.sampleMixedColorCandidates(
  colorEvents,[202,184],8);
 assert(reversedSample.some(x=>x.appearing.includes(202))&&
  reversedSample.some(x=>x.appearing.includes(184)),
  'Reversing user selection must not hide one grade objective');
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,272,184],TALENT_DATA));
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,272,202],TALENT_DATA),
  'Three-purple plus blue must enter purple-anchored extension');
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,184,202],TALENT_DATA));
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,184,186],TALENT_DATA),
  'Two purple plus two distinct green families must be eligible');
 assert(YYWashPurpleAnchorMixed.requestShape([271,268,202,204],TALENT_DATA),
  'Two purple plus two distinct blue families must be eligible');
 assert.equal(YYWashPurpleAnchorMixed.requestShape([271,268,184,185],TALENT_DATA),null,
  'Purple and lower-grade talent with the same native family must collide');
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
 for(const route of out.routes)
  console.log('YY_ANCHOR_ACTION_REPLAY_GREEN '+JSON.stringify(replayReturnedRoute(route)));
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
 // Strict native-pill pruning may correctly stop expensive continuations
 // before their former fully-computed outputs are produced.
 assert((two.diagnostics.replannedCosts||[]).length>=1||
  (two.diagnostics.prunedByCost||0)+(two.diagnostics.candidatePruned||0)+
  (two.diagnostics.betweenScanPruned||0)>0,
  'Inter-purple routes must be verified or rejected by a measured cost bound');
 assert((two.diagnostics.replannedCosts||[]).every(item=>
  [271,268,184,202].every(id=>item.finalIds.includes(id))),
  'Inter-purple diagnostic route missing one of four final retained targets');
 assert(two.routes[0].pills<=
  Math.min(Infinity,...(two.diagnostics.replannedCosts||[]).map(item=>item.pills)),
  'Expensive inter-purple branches must not displace a cheaper complete route');
 assert(two.routes.every(r=>[271,268,184,202].every(id=>
  r.final_slots.some(t=>Number(t.id)===id))),'Two-color result has missing final slot');
 assert(two.routes.every(r=>r.optimal===false),'A bounded search is not globally optimal');
 for(const route of two.routes)
  console.log('YY_ANCHOR_ACTION_REPLAY_TWO_TWO '+JSON.stringify(replayReturnedRoute(route)));
 console.log('YY_PURPLE_ANCHOR_TWO_TWO_REAL_WASM '+JSON.stringify({
  shape:[271,268,184,202],
  routes:two.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),diagnostics:two.diagnostics,preserved:true
 }));
 // Also exercise the other requested 3-purple/1-blue shape with the
 // ORIGINAL native talent quality (blue 202), never promoted to purple.
 const blue=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,202],maxPad:0,horizon:900,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base,
  'Original native blue goal search must restore user WASM state');
 assert(blue.routes.every(r=>[271,268,272,202].every(id=>
  r.final_slots.some(t=>Number(t.id)===id&&t.locked))),
  'A returned 3-purple/blue route lacks a locked final target');
 assert(blue.routes.length>0,
  'Original WASM full 900-wash three-purple/blue target must yield a final route');
 assert(blue.routes[0].pills>0&&blue.routes[0].pills<=4148,
  'Blue goal now exceeds a previously replayed verified 4148-pill native route');
 assert(blue.routes.every(r=>r.optimal===false),
  'Bounded blue goal must not claim exact optimality');
 for(const route of blue.routes)
  console.log('YY_ANCHOR_ACTION_REPLAY_THREE_BLUE '+
   JSON.stringify(replayReturnedRoute(route)));
 console.log('YY_PURPLE_ANCHOR_THREE_PURPLE_BLUE_NATIVE '+JSON.stringify({
  goals:[271,268,272,202],
  routes:blue.routes.map(r=>({pills:r.pills,finalIds:r.final_slots.map(t=>t.id)})),
  diagnostics:blue.diagnostics,preserved:true
 }));
 // Real loaded saves may ALREADY contain all purple anchors.
 // Preserve existing selected colors as well; all four held should need
 // ZERO additional washes, and the route must replay from the save.
 const completeSave={...source,bag_pills:0,has_bag_pills:true,
  talents:[{id:271,locked:true},{id:268,locked:true},
   {id:272,locked:true},{id:184,locked:false}]};
 assert(wasmSetState(completeSave));
 const completeStart=wasmGetState();
 const completeFingerprint=YYWashNativeSearchGuard.canonicalJson(completeStart);
 const alreadyComplete=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:0,horizon:900,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),
  completeFingerprint,'Original WASM complete save modified after searching');
 assert.equal(alreadyComplete.diagnostics.preexistingPurple,true);
 assert.equal(alreadyComplete.routes.length,1,
  'An already complete save must yield its exact zero-pill final route');
 assert.equal(alreadyComplete.routes[0].pills,0);
 assert.equal(alreadyComplete.routes[0].optimal,true,
  'Zero additional pills is a proven mathematical global minimum');
 assert(alreadyComplete.routes[0].final_slots.every(t=>t.locked),
  'Already held green talent must be locked in resulting path');
 console.log('YY_ALREADY_COMPLETE_WASM '+JSON.stringify(
  replayReturnedRoute(alreadyComplete.routes[0],completeStart)));
 assert(wasmSetState(source));
 // Purple goals are already held but the green goal is not. The original
 // WASM should search only the missing color, not force another purple route.
 const heldPurples={...source,bag_pills:0,has_bag_pills:true,
  talents:[{id:271,locked:true},{id:268,locked:true},
   {id:272,locked:true},{id:171,locked:false}]};
 assert(wasmSetState(heldPurples));
 const heldStart=wasmGetState();
 const heldFingerprint=YYWashNativeSearchGuard.canonicalJson(heldStart);
 const missingGreen=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:0,horizon:900,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(missingGreen.diagnostics.preexistingPurple,true);
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),
  heldFingerprint,'Already held purple save mutated');
 assert(missingGreen.routes.every(r=>[271,268,272,184].every(id=>
  r.final_slots.some(t=>Number(t.id)===id&&t.locked))),
  'Missing-green branch falsely completed final four talents');
 for(const route of missingGreen.routes)
  console.log('YY_HELD_PURPLES_MISSING_GREEN_REPLAY '+
   JSON.stringify(replayReturnedRoute(route,heldStart)));
 console.log('YY_HELD_PURPLES_NATIVE '+JSON.stringify({
  searchedOnlyColors:missingGreen.diagnostics.preexistingPurple,
  routes:missingGreen.routes.length,
  bestPills:missingGreen.routes[0]?.pills??null,
  preserved:true
 }));
 assert(wasmSetState(source));
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
 // Reproduce the production default maxPad=20 on the original saved
 // character state rather than only the earlier maxPad=0 fixture.
 const prodDefaults=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:20,horizon:900,topN:2,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base,
  'Production bound replay must not mutate character state');
 console.log('YY_PRODUCTION_20PAD_900_NATIVE '+JSON.stringify({
  routes:prodDefaults.routes.length,
  bestPills:prodDefaults.routes[0]?.pills??null,
  attempts:prodDefaults.diagnostics.purpleAttempts||0,
  nativeReturned:prodDefaults.diagnostics.purpleNativeReturned||0,
  replayRejected:prodDefaults.diagnostics.purpleReplayRejected||0,
  replayErrors:prodDefaults.diagnostics.purpleReplayErrors||[],
  scanned:prodDefaults.diagnostics.scannedWashes
 }));
 console.log('YY_PURPLE_ANCHOR_MIXED_REAL_WASM '+JSON.stringify({
  shape:[271,268,272,184],
  routes:out.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),
  diagnostics:out.diagnostics,preserved:true
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
