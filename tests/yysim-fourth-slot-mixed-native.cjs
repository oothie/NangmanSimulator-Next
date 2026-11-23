'use strict';
// Regression for the user's 3-purple + 1-green request. Do not store any
// private save seeds: this uses the repository's existing synthetic 10044
// WASM fixture. Purple-only optimum can stop at 153 (three slots).
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;
globalThis.location={protocol:'file:'};
for(const item of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
 'vendor/yysim/data.js','engine/yysim-native-search-guard.js',
 'engine/yysim-purple-anchor-mixed.js'])
 vm.runInThisContext(fs.readFileSync(path.join(root,item),'utf8'),{
  filename:item,timeout:30000
 });
(async()=>{
 assert(await initWasm());
 assert(wasmInitEngine(TALENT_DATA,ZZ_DATA));
 const original=wasmGetState();
 const synthetic={...original,mode:'seed',seed:447882174,role_id:10044,
  salt:262731,zizhi:153,sex:1,vip:1,
  str_gift:300,con_gift:300,
  talents:[{id:271,locked:true},{id:272,locked:true},{id:249,locked:true}],
  total_wash:0,total_pills:0,total_talent_bars:0,
  bag_pills:20000,has_bag_pills:true,global_vars:{}};
 assert(wasmSetState(synthetic),'Synthetic original WASM must accept three locked purples');
 const before=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
 const output=await YYWashPurpleAnchorMixed.run({
  desiredIds:[271,272,249,234],horizon:2000,maxPad:0,topN:3,
  talents:TALENT_DATA,getState:wasmGetState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,
  exchangeTalent:wasmExchangeTalent,guard:YYWashNativeSearchGuard
 });
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),before,
  'Research search must restore the initial three-slot WASM state exactly');
 assert(output.diagnostics.fourthSlotOpened>=1,
  'Green search must actually open the fourth slot after three locked purples');
 assert(output.routes.length>=1,
  'Three-purple + green should find a genuine fourth-slot WASM path');
 const best=output.routes[0];
 assert.equal(best.final_slots.length,4,'The final game state must have 4 slots');
 assert([271,272,249,234].every(id=>best.final_slots.some(
  t=>Number(t.id)===id&&t.locked)),'All four targets must be locked in real WASM');
 assert(best.actions.some(a=>a.kind==='open_slot'&&/154/.test(a.note||'')),
  'User-visible route must explicitly include aptitude-154 fourth slot opening');
 assert.equal(best.washes,
  Number(best.actions.at(-1).wash_no)-Number(synthetic.total_wash));
 console.log('PASS native 3+1 fourth-slot route '+JSON.stringify({
  pills:best.pills,washes:best.washes,opened:output.diagnostics.fourthSlotOpened,
  finalIds:best.final_slots.map(t=>t.id),actions:best.actions.length
 }));
})().catch(e=>{console.error(e);process.exitCode=1});
