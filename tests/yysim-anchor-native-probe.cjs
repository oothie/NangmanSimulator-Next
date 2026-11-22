'use strict';
// Characterize original WASM wash/lock/exchange semantics before using
// purple anchor windows for mixed green/blue final-route optimization.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;globalThis.location={protocol:'file:'};
for(const p of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js',
 'vendor/yysim/data.js','engine/yysim-native-search-guard.js'])
 vm.runInThisContext(fs.readFileSync(path.join(root,p),'utf8'),{filename:p,timeout:30000});
function summary(state){
 return {seed:state?.seed,washtimes:state?.total_wash,pills:state?.total_pills,
  bag:state?.bag_pills,talents:state?.talents,quality:state?.quality_counts,
  pity:state?.pity_count};
}
(async()=>{
 assert(await initWasm());assert(wasmInitEngine(TALENT_DATA,ZZ_DATA));
 const before=wasmGetState();
 const saved={...before,mode:'seed',zizhi:154,seed:447882174,role_id:10044,
  talents:[{id:171,locked:false},{id:172,locked:false},
   {id:173,locked:false},{id:174,locked:false}],
  total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
 assert(wasmSetState(saved));
 const start=wasmGetState(),key=YYWashNativeSearchGuard.canonicalJson(start);
 const native=YYWashNativeSearchGuard.run({getState:wasmGetState,
  setState:wasmSetState,search:wasmSearchWashRoutes},
  {desired_ids:[271,268,272],max_pad:0,horizon:40,top_n:2});
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),key);
 const path0=native.routes?.[0]||null;
 const preview=wasmPreviewSequence(30);
 assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),key,
  'Original preview_sequence modified state');
 const states=[summary(start)],washes=[];
 for(let i=0;i<12;i++){
  const row=wasmDoWash();
  washes.push({returnValue:row});
  states.push(summary(wasmGetState()));
 }
 assert(wasmSetState(start));
 const beforeLock=wasmGetState();
 const lockVariant={...beforeLock,talents:beforeLock.talents.map((t,i)=>({...t,locked:i===0}))};
 const lockOk=wasmSetState(lockVariant);
 const afterLock=wasmGetState();
 const lockedWash=lockOk?wasmDoWash():null;
 const afterLockedWash=wasmGetState();
 assert(wasmSetState(start));
 const out={native:{
  scanned:native.scanned,error:native.error,
  orderIds:path0?.order_ids,finalSlots:path0?.final_slots,
  actions:path0?.actions,steps:path0?.steps?.slice(0,5),
  pills:path0?.pills},
  previewShape:Array.isArray(preview)?{type:'array',items:preview.slice(0,3)}:{
   type:typeof preview,keys:Object.keys(preview||{}),
   purples:preview?.purples?.slice(0,5)},
  washes:washes.slice(0,6),stateSamples:states.slice(0,6),
  lockBranch:{ok:lockOk,locked:summary(afterLock),
   firstWash:lockedWash,afterWash:summary(afterLockedWash)},
  preserved:YYWashNativeSearchGuard.canonicalJson(wasmGetState())===key};
 assert(out.preserved);
 console.log('YY_NATIVE_ANCHOR_WASH_CONTRACT '+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exitCode=1});
