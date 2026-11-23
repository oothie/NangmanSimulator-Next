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
 assert.equal(emptyNativeAttempts,12,'Unreachable purple goals should stop after six orders and two native padding modes');
 assert.equal(unavailable.routes.length,0);
 assert.equal(unavailable.diagnostics.purpleNoRoute,true);
 assert.equal(unavailable.diagnostics.scannedWashes,0);
 assert.match(unavailable.error,/자맥.*0개/);
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base);
 // Korean in-game regression: 3 purple (환생금선/귀연정천/현양신맥)
 // plus green (친구의리) belongs to four distinct native talent families.
 const requested=[271,272,249,234];
 const shape=YYWashPurpleAnchorMixed.requestShape(requested,TALENT_DATA);
 assert.deepEqual(Array.from(shape.purple),[271,272,249]);
 assert.deepEqual(Array.from(shape.colors),[234]);
 assert.equal(new Set(requested.map(id=>TALENT_DATA[String(id)].type)).size,4);
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
    }else if(action.kind==='open_slot'){
     const match=String(action.note||'').match(/15[1-4]/);
     assert(match,'Native open_slot replay needs aptitude requirement');
     const target=Number(match[0]);
     while(Number(wasmGetState().zizhi)<target){
      const beforeUpgrade=wasmGetState();
      const applied={...beforeUpgrade,zizhi:Number(beforeUpgrade.zizhi)+1,
       str_gift:Number(beforeUpgrade.str_gift||0)+100,
       con_gift:Number(beforeUpgrade.con_gift||0)+100};
      assert(wasmSetState(applied),'Original WASM aptitude upgrade rejected');
      const afterUpgrade=wasmGetState();
      assert.equal(Number(afterUpgrade.zizhi),applied.zizhi);
      assert.equal(Number(afterUpgrade.str_gift),applied.str_gift);
      assert.equal(Number(afterUpgrade.con_gift),applied.con_gift);
     }
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
 // Compare real WASM replay when the character has only two starting
 // talents or one pre-existing locked talent (common game-save states).
 for(const fixture of [
  {label:'two-slots',talents:source.talents.slice(0,2)},
  {label:'one-locked',talents:source.talents.map((t,i)=>({...t,locked:i===0}))}
 ]){
  assert(wasmSetState({...source,talents:fixture.talents}));
  const fingerprint=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
  const check=await YYWashPurpleAnchorMixed.run({
   desiredIds:[271,268,272,184],maxPad:20,horizon:900,topN:2,
   talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
   search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
   guard:YYWashNativeSearchGuard
  });
  assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),fingerprint);
  console.log('YY_PRODUCTION_SAVE_SHAPE '+JSON.stringify({
   shape:fixture.label,routes:check.routes.length,
   nativeReturned:check.diagnostics.purpleNativeReturned||0,
   replayRejected:check.diagnostics.purpleReplayRejected||0,
   errors:check.diagnostics.purpleReplayErrors||[],
   attempts:check.diagnostics.purpleAttempts||0
  }));
  assert(wasmSetState(source));
 }
 console.log('YY_PRODUCTION_20PAD_900_NATIVE '+JSON.stringify({
  routes:prodDefaults.routes.length,
  bestPills:prodDefaults.routes[0]?.pills??null,
  attempts:prodDefaults.diagnostics.purpleAttempts||0,
  nativeReturned:prodDefaults.diagnostics.purpleNativeReturned||0,
  replayRejected:prodDefaults.diagnostics.purpleReplayRejected||0,
  replayErrors:prodDefaults.diagnostics.purpleReplayErrors||[],
  scanned:prodDefaults.diagnostics.scannedWashes
 }));
 // Simulate inaccurate native pill metadata only: the actual four-slot
 // route must be costed from the real replayed WASM state, not rejected.
 const costMetadataGuard={...YYWashNativeSearchGuard,
  run:function(ops,req){
   const native=YYWashNativeSearchGuard.run(ops,req);
   return {...native,routes:native.routes.map(route=>({
    ...route,pills:Number(route.pills)+1
   }))};
  }};
 const measured=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,268,272,184],maxPad:0,horizon:40,topN:1,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:costMetadataGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),base);
 assert.equal(measured.routes[0]?.pills,out.routes[0]?.pills,
  'Measured native WASM cost must override inaccurate route metadata');
 assert(measured.diagnostics.purpleCostAdjusted>0,
  'Native replay cost adjustment should be reported');
 // Minimal fields from the user's 1121 save: Yi Il-jin, aptitude 153,
 // native purple goals 272/249/266 plus lower-grade friendship 234.
 // No private inventory or quest data is copied into this fixture.
 const role1121={...source,seed:90431629,role_id:10030,zizhi:153,
  talents:[],tal_lucky:0,total_wash:0,total_pills:0,
  str_gift:1695,con_gift:5000,dex_gift:5000,int_gift:5000,
  role_level:100,bag_pills:20000,has_bag_pills:true,global_vars:{}};
 assert(wasmSetState(role1121),'1121 Yi Il-jin minimal native fixture rejected');
 // Compare a minimal reconstruction against the exact public-safe
 // scalar mapping used by index.html for this character's save.
 // Do not commit the user's raw save or its private globalVariable map.
 console.log('YY_1121_STATE_SHAPE '+JSON.stringify({
  minimal:{salt:role1121.salt,roleStats:role1121.role_stats,
   rngVariant:role1121.rng_variant,hasBornTalent:role1121.has_born_talent},
  mapped:{salt:262731,roleStats:{str_val:11,con:200,dex:210,int_val:13},
   rngVariant:'73324',hasBornTalent:true},
  originalGlobalKeys:Object.keys(role1121.global_vars||{}).length
 }));
 const roleBefore=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
 const roleMixed=await YYWashPurpleAnchorMixed.run({
  desiredIds:[272,249,266,234],maxPad:20,horizon:900,topN:8,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),roleBefore,
  '1121 Yi Il-jin fixture must restore original WASM state');
 assert(roleMixed.routes.length>0,
  '1121 Yi Il-jin / 272+249+266+234 must find a native final four-goal route');
 assert.equal(roleMixed.diagnostics.purpleReplayRejected||0,0,
  'Original 1121-shaped purple route must no longer reject open_slot');
 assert.equal(roleMixed.diagnostics.purpleAttempts,1,
  'Successful first original-WASM purple order must not trigger six redundant calls');
 if(roleMixed.routes.length){
  const native=roleMixed.routes[0];
  assert([272,249,266,234].every(id=>native.final_slots.some(t=>
   Number(t.id)===id&&t.locked)),
   '1121 four selected talents must survive together in final WASM slots');
  const replayReport=replayReturnedRoute(native,wasmGetState());
  assert.equal(replayReport.pills,native.pills);
  assert(native.actions.some(step=>step.kind==='open_slot'),
   'Aptitude 153 user route must include an original open_slot action');
 }
 console.log('YY_1121_INCOMPLETE_FIXTURE_ROUTE '+JSON.stringify({pills:roleMixed.routes[0]?.pills??null,washes:roleMixed.routes[0]?.washes??null}));
 // Separate source-state parity from the originally published minimal
 // 4285 fixture. These are scalar fields from the same Yi Il-jin save,
 // with the 7,592-key private globalVariable map intentionally omitted.
 const mapped1121={...role1121,
  salt:262731,role_stats:{str_val:11,con:200,dex:210,int_val:13},
  luck_seed:0,luck_seed_inited:false,born_rc:0,
  has_born_talent:true,rng_variant:'73324',sex:1,
  gold_count:0,pity_count:0,exchange_count:0,total_talent_bars:0,
  quality_counts:{1:0,2:0,3:0,4:0},last_purple_total_pills:null
 };
 assert(wasmSetState(mapped1121));
 const mappedBefore=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
 const mappedResult=await YYWashPurpleAnchorMixed.run({
  desiredIds:[272,249,266,234],maxPad:20,horizon:900,topN:8,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 // Verified original-WASM purple-only results depend on max_pad.
 // Keep only the two regression-critical probes; wide pad sweeps are costly.
 const nativePadVariants=[];
 for(const max_pad of [0,20]){
  assert(wasmSetState(mapped1121));
  const native=YYWashNativeSearchGuard.run({
   getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
  },{desired_ids:[272,249,266],max_pad,horizon:900,top_n:8});
  nativePadVariants.push({max_pad,costs:native.routes.map(route=>({
   pills:route.pills,washes:route.actions?.at(-1)?.wash_no??null,
   actions:route.actions?.length||0
  }))});
 }
 assert.equal(nativePadVariants[0].costs[0]?.pills,4019);
 assert.equal(nativePadVariants[0].costs[0]?.washes,826);
 assert.equal(nativePadVariants[1].costs[0]?.pills,4039);
 assert.equal(nativePadVariants[1].costs[0]?.washes,830);
 console.log('YY_1121_PURPLE_NATIVE_PADDING '+JSON.stringify(nativePadVariants));
 assert(wasmSetState(mapped1121));
 const noPadMixed=await YYWashPurpleAnchorMixed.run({
  desiredIds:[272,249,266,234],maxPad:0,horizon:900,topN:8,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 assert.equal(noPadMixed.routes[0]?.pills,4279);
 assert.equal(noPadMixed.routes[0]?.washes,852);
 console.log('YY_1121_NO_PAD_MIXED '+JSON.stringify({
  routes:noPadMixed.routes.length,
  pills:noPadMixed.routes[0]?.pills??null,
  washes:noPadMixed.routes[0]?.washes??null,
  steps:noPadMixed.routes[0]?.actions?.length??null,
  errors:noPadMixed.diagnostics.failures
 }));
 assert(wasmSetState(mapped1121));


 assert(wasmSetState(mapped1121));
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),mappedBefore);
 assert.equal(mappedResult.routes[0]?.pills,4279,
  '1121 Yi Il-jin solver must retain user-verified 4019+260=4279 route');
 assert.equal(mappedResult.routes[0]?.washes,852,
  '1121 Yi Il-jin verified route ends after 826+26=852 washes');
 assert.deepEqual(mappedResult.diagnostics.purpleBackboneCosts.map(x=>x.pills),[4019,4039]);
 assert.equal(mappedResult.diagnostics.purpleNativeCalls,2);
 // Isolate the previously missing save fields so a later mismatch has a
 // precise cause; no user's private full save is persisted in the repo.
 for(const variant of [
  {label:'salt-only',change:{salt:262731}},
  {label:'stats-only',change:{role_stats:{str_val:11,con:200,dex:210,int_val:13}}}
 ]){
  const probe={...role1121,...variant.change};
  assert(wasmSetState(probe));
  const probeResult=await YYWashPurpleAnchorMixed.run({
   desiredIds:[272,249,266,234],maxPad:20,horizon:900,topN:2,
   talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
   search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
   guard:YYWashNativeSearchGuard
  });
  console.log('YY_1121_VARIANT '+JSON.stringify({
   variant:variant.label,pills:probeResult.routes[0]?.pills??null,
   washes:probeResult.routes[0]?.washes??null,
   replayRejected:probeResult.diagnostics.purpleReplayRejected||0
  }));
  assert.equal(probeResult.routes[0]?.pills,
   variant.label==='salt-only'?4279:probeResult.routes[0]?.pills,
   'Salt-only state must retain user-verified best route');
  assert.equal(probeResult.routes[0]?.washes,
   variant.label==='salt-only'?852:probeResult.routes[0]?.washes,
   'Salt-only fixture must complete user-verified path at 852 washes');
  assert(wasmSetState(mapped1121));
 }
 console.log('YY_1121_SCALARS_ONLY '+JSON.stringify({
  routes:mappedResult.routes.length,pills:mappedResult.routes[0]?.pills??null,
  washes:mappedResult.routes[0]?.washes??null,
  attempts:mappedResult.diagnostics.purpleAttempts,
  replayRejected:mappedResult.diagnostics.purpleReplayRejected||0
 }));
 assert(wasmSetState(source));
 console.log('YY_1121_INCOMPLETE_FIXTURE '+JSON.stringify({
  goals:[272,249,266,234],zizhi:153,
  routes:roleMixed.routes.length,
  bestPills:roleMixed.routes[0]?.pills??null,
  nativeReturned:roleMixed.diagnostics.purpleNativeReturned||0,
  replayRejected:roleMixed.diagnostics.purpleReplayRejected||0,
  replayErrors:roleMixed.diagnostics.purpleReplayErrors||[],
  scanned:roleMixed.diagnostics.scannedWashes,
  failure:roleMixed.error
 }));
 assert(!(roleMixed.diagnostics.purpleReplayErrors||[]).some(x=>
  /미지원 원본 자맥 실행 단계: open_slot/.test(x.reason)),
  'Original native open_slot must not reject the actual 1121 talent goals');
 assert(wasmSetState(source));
 // 1121 Moon-young (ID 10029), save-derived scalar state. No raw
 // save or private globalVariable table is placed in public GitHub.
 const moonState={...source,mode:'seed',seed:660687189,role_id:10029,
  salt:262731,zizhi:150,sex:2,role_level:89,
  str_gift:190,con_gift:180,dex_gift:200,int_gift:200,
  role_stats:{str_val:9,con:9,dex:12,int_val:10},
  talents:[],tal_lucky:0,total_wash:0,total_pills:0,
  total_talent_bars:0,exchange_count:0,
  born_rc:0,has_born_talent:true,rng_variant:'73324',
  luck_seed:0,luck_seed_inited:false,
  quality_counts:{1:0,2:0,3:0,4:0},
  gold_count:0,pity_count:0,last_purple_total_pills:null,
  has_bag_pills:true,bag_pills:20000,global_vars:{}};
 const moonNative=[];
 for(const order of [[268,262],[262,268]]){
  for(const pad of [0,5,10,15,20,30]){
   assert(wasmSetState(moonState));
   const result=YYWashNativeSearchGuard.run({
    getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
   },{desired_ids:order,max_pad:pad,horizon:900,top_n:8});
   moonNative.push({order,pad,costs:(result.routes||[]).map(x=>({
    pills:x.pills,steps:x.actions?.length||0,washes:x.actions?.at(-1)?.wash_no??null
   }))});
  }
 }
 console.log('YY_MOON_1121_PURPLE_BACKBONES '+JSON.stringify(moonNative));
 assert(wasmSetState(moonState));
 const moonMixed=await YYWashPurpleAnchorMixed.run({
  desiredIds:[268,262,237,204],maxPad:0,horizon:900,topN:8,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
  guard:YYWashNativeSearchGuard
 });
 // Reproduce the user-supplied screenshot as native actions, NOT a
 // hard-coded search answer: every wash and exchange runs original WASM.
 assert(wasmSetState({...moonState,zizhi:153,
  str_gift:moonState.str_gift+300,con_gift:moonState.con_gift+300}));
 const moonSnapshot=()=>wasmGetState();
 const moonCost=()=>Number(moonSnapshot().total_pills||0);
 const moonWash=(count,label)=>{
  for(let i=0;i<count;i++){
   const before=Number(moonSnapshot().total_wash);
   const result=wasmDoWash();
   if(!result||result.error||Number(moonSnapshot().total_wash)!==before+1)
    throw Error('Moon screenshot wash mismatch at '+label+' '+(i+1));
  }
 };
 const moonLock=(id,locked)=>{
  const x=moonSnapshot(),index=x.talents.findIndex(t=>Number(t.id)===id);
  if(index<0)throw Error('Moon screenshot missing talent '+id+
   ' at '+x.total_wash+' pills '+moonCost()+
   ' present '+x.talents.map(t=>t.id));
  assert(wasmSetState({...x,talents:x.talents.map((t,j)=>
   j===index?{...t,locked}:t)}));
 };
 const moonExchange=(from,to)=>{
  const x=moonSnapshot(),index=x.talents.findIndex(t=>Number(t.id)===from);
  if(index<0)throw Error('Moon screenshot missing exchange source '+from);
  const result=wasmExchangeTalent(index);
  if(!result||result.error||
    !moonSnapshot().talents.some(t=>Number(t.id)===to))
   throw Error('Moon screenshot exchange '+from+'->'+to+
    ' failed at wash '+x.total_wash+' state '+moonSnapshot().talents.map(t=>t.id));
 };
 const photoLogs=[];
 const photoStep=(label)=>photoLogs.push({label,
  wash:moonSnapshot().total_wash,pills:moonCost(),
  slots:moonSnapshot().talents.map(t=>({id:t.id,locked:t.locked}))});
 try{
  moonWash(104,'104 free');photoStep('104');
  moonLock(274,true);moonWash(3,'274 locked');photoStep('107');
  moonLock(276,true);moonWash(5,'276 locked');photoStep('112');
  moonExchange(276,268);
  const old=moonSnapshot();
  assert(wasmSetState({...old,zizhi:154,
   str_gift:Number(old.str_gift)+100,con_gift:Number(old.con_gift)+100}));
  moonLock(274,false);moonLock(268,true);
  moonWash(4,'268 locked');photoStep('116');
  moonLock(177,true);moonWash(7,'177 locked');photoStep('123');
  moonLock(271,true);moonWash(5,'271 locked');photoStep('128');
  moonExchange(271,276);moonExchange(276,262);
  moonLock(177,false);moonLock(262,true);moonWash(19,'two purple locked');photoStep('147');
  moonLock(237,true);moonWash(28,'plus green locked');photoStep('175');
  moonLock(204,true);photoStep('final');
  assert([268,262,237,204].every(id=>moonSnapshot().talents.some(t=>
   Number(t.id)===id&&t.locked)));
  assert.equal(moonCost(),916);
 }catch(error){
  console.log('YY_MOON_PHOTO_REPLAY_DIAGNOSTICS '+JSON.stringify(photoLogs));
  throw error;
 }
 console.log('YY_MOON_PHOTO_REPLAY '+JSON.stringify(photoLogs));
 assert(wasmSetState(moonState));
 assert.equal(moonMixed.routes[0]?.pills,910,
  'Moon 1121 original-WASM mixed search must find 910 pills');
 assert.equal(moonMixed.routes[0]?.washes,175);
 assert([268,262,237,204].every(id=>moonMixed.routes[0].final_slots.some(t=>
  Number(t.id)===id&&t.locked)));
 const moonGuidedReplay=replayReturnedRoute(moonMixed.routes[0],wasmGetState());
 assert.equal(moonGuidedReplay.pills,910,
  'The displayed Moon route must replay its steps through actual WASM to the exact final state');
 console.log('YY_MOON_1121_MIXED '+JSON.stringify({
  cost:moonMixed.routes[0]?.pills??null,
  washes:moonMixed.routes[0]?.washes??null,
  attempts:moonMixed.diagnostics.purpleNativeCalls,
  purpleCosts:moonMixed.diagnostics.purpleBackboneCosts,
  betweenCandidates:moonMixed.diagnostics.betweenCandidates,
  betweenExamined:moonMixed.diagnostics.betweenExamined,
  failures:moonMixed.diagnostics.failures.slice(0,5),
  actions:moonMixed.routes[0]?.actions?.length??null
 }));
 assert(wasmSetState(source));
 console.log('YY_PURPLE_ANCHOR_MIXED_REAL_WASM '+JSON.stringify({
  shape:[271,268,272,184],
  routes:out.routes.map(r=>({pills:r.pills,washes:r.washes,final:r.final_slots,
   actionCount:r.actions.length})),
  diagnostics:out.diagnostics,preserved:true
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
