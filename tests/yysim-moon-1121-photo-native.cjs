'use strict';
// The user's observed 1121 Moon-young wash transcript, replayed strictly
// with the original native yy-sim WASM. Not a production shortcut.
// Only the minimum save-derived numeric character inputs are committed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;globalThis.location={protocol:'file:'};
for(const file of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js','vendor/yysim/data.js','engine/yysim-native-search-guard.js','engine/yysim-purple-anchor-mixed.js'])
 vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file,timeout:30000});
(async()=>{
 assert(await initWasm());assert(wasmInitEngine(TALENT_DATA,ZZ_DATA));
 const initial=wasmGetState();
 const moon={...initial,mode:'seed',seed:660687189,salt:262731,
  role_id:10029,zizhi:153,sex:2,role_level:89,
  str_gift:490,con_gift:480,dex_gift:200,int_gift:200,
  role_stats:{str_val:9,con:9,dex:12,int_val:10},
  talents:[],tal_lucky:0,total_wash:0,total_pills:0,
  total_talent_bars:0,exchange_count:0,
  born_rc:0,has_born_talent:true,rng_variant:'73324',
  luck_seed:0,luck_seed_inited:false,
  quality_counts:{1:0,2:0,3:0,4:0},
  gold_count:0,pity_count:0,last_purple_total_pills:null,
  has_bag_pills:true,bag_pills:20000,global_vars:{}};
 const nativeSource={...moon,zizhi:150,str_gift:190,con_gift:180};
 assert(wasmSetState(nativeSource));
 const originalTwo=YYWashNativeSearchGuard.run({
  getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes
 },{desired_ids:[268,262],max_pad:0,horizon:900,top_n:8});
 console.log('MOON_NATIVE_PURPLE_ACTIONS '+JSON.stringify(
  originalTwo.routes[0]?.actions||[]));
 assert(wasmSetState(moon));
 const snapshot=()=>wasmGetState();
 const pills=()=>Number(snapshot().total_pills||0);
 const step=(title)=>{const state=snapshot();console.log('MOON_NATIVE_PHOTO '+JSON.stringify({
  title,wash:state.total_wash,pills:pills(),
  talents:state.talents.map(t=>({id:t.id,locked:t.locked}))}));};
 const wash=(n,label)=>{
  for(let i=0;i<n;i++){
   const before=Number(snapshot().total_wash);
   const ret=wasmDoWash();
   assert(ret&&!ret.error&&Number(snapshot().total_wash)===before+1,
    'WASM wash failed '+label+' cycle '+(i+1));
  }
  step(label);
 };
 const lock=(id,value)=>{
  const state=snapshot(),idx=state.talents.findIndex(t=>Number(t.id)===id);
  assert(idx>=0,'Missing native talent '+id+' at '+state.total_wash+
   ' present: '+state.talents.map(t=>t.id));
  assert(wasmSetState({...state,talents:state.talents.map((t,i)=>
   i===idx?{...t,locked:value}:t)}));
 };
 const exchange=(from,to)=>{
  const state=snapshot(),idx=state.talents.findIndex(t=>Number(t.id)===from);
  assert(idx>=0,'Missing exchange source '+from);
  const ret=wasmExchangeTalent(idx);
  assert(ret&&!ret.error&&snapshot().talents.some(t=>Number(t.id)===to),
   'Exchange '+from+' -> '+to+' failed at '+state.total_wash+
   ', present: '+snapshot().talents.map(t=>t.id));
 };
 wash(104,'no locks 104');assert.equal(pills(),312);
 lock(274,true);wash(3,'lock life 3');assert.equal(pills(),324);
 lock(276,true);wash(5,'lock undying 5');assert.equal(pills(),354);
 exchange(276,268);
 const state=snapshot();
 assert(wasmSetState({...state,zizhi:154,
  str_gift:Number(state.str_gift)+100,con_gift:Number(state.con_gift)+100}));
 lock(274,false);lock(268,true);
 wash(4,'lock 268 4');assert.equal(pills(),378);
 lock(177,true);wash(7,'lock 177 7');assert.equal(pills(),434);
 lock(271,true);wash(5,'lock 271 5');assert.equal(pills(),484);
 exchange(271,276);exchange(276,262);
 lock(177,false);lock(262,true);
 const manual128=JSON.parse(JSON.stringify(snapshot()));
 wash(19,'lock two purples 19');assert.equal(pills(),636);
 lock(237,true);wash(28,'lock two purples and green 28');assert.equal(pills(),916);
 lock(204,true);step('four final talents');
 assert([268,262,237,204].every(id=>snapshot().talents.some(t=>
  Number(t.id)===id&&t.locked)));
 assert.equal(pills(),916);assert.equal(Number(snapshot().total_wash),175);
 console.log('PASS MOON_1121_ORIGINAL_WASM_916');
 for(const stock of [20000,100000]){
  assert(wasmSetState({...manual128,bag_pills:stock}));
  wash(19,'stock parity 19');
  const at147=snapshot().talents.map(t=>Number(t.id));
  lock(237,true);wash(28,'stock parity 28');
  const at175=snapshot().talents.map(t=>Number(t.id));
  console.log('MOON_STOCK_PARITY '+JSON.stringify({
   stock,at147,at175,pills:pills()
  }));
  assert(at147.includes(237)&&at175.includes(204));
 }
 assert(wasmSetState(nativeSource));
 const variant128=[],tailSnapshots=[];
 const getTrackedState=()=>{
  const state=wasmGetState();
  if(Number(state.total_wash)===128&&Number(state.total_pills)===484&&
   [268,262].every(id=>state.talents.some(t=>Number(t.id)===id)))
   variant128.push(JSON.parse(JSON.stringify(state)));
  if([147,175].includes(Number(state.total_wash))){
   const key=[state.total_wash,state.total_pills,
    state.talents.map(t=>t.id+':'+(t.locked?'L':'U')).join(',')].join('|');
   if(!tailSnapshots.some(x=>x.key===key))tailSnapshots.push({
    key,wash:state.total_wash,pills:state.total_pills,
    talents:state.talents.map(t=>({id:t.id,locked:t.locked}))
   });
  }
  return state;
 };
 const mixed=await YYWashPurpleAnchorMixed.run({
  desiredIds:[268,262,237,204],maxPad:0,horizon:900,topN:8,
  talents:TALENT_DATA,getState:getTrackedState,setState:wasmSetState,
  search:wasmSearchWashRoutes,doWash:wasmDoWash,
  exchangeTalent:wasmExchangeTalent,guard:YYWashNativeSearchGuard
 });
 const observed=variant128.find(x=>x.talents.some(t=>Number(t.id)===262&&t.locked)&&x.talents.some(t=>Number(t.id)===177&&!t.locked));
 if(observed){
  const keys=new Set([...Object.keys(manual128),...Object.keys(observed)]);
  const diffs=[...keys].filter(k=>
   k!=='bag_pills'&&JSON.stringify(manual128[k])!==JSON.stringify(observed[k]));
  console.log('MOON_128_VARIANT_DIFFERENCES '+JSON.stringify({
   count:variant128.length,diffs:diffs.map(k=>({
    key:k,manual:k==='global_vars'?'{private}':manual128[k],
    automatic:k==='global_vars'?'{private}':observed[k]
   }))
  }));
 }else console.log('MOON_128_VARIANT_DIFFERENCES no native 484 snapshot');
 console.log('MOON_TAIL_NATIVE_SNAPSHOTS '+JSON.stringify(tailSnapshots));
 console.log('MOON_NATIVE_OPTIMIZED '+JSON.stringify({
  pills:mixed.routes[0]?.pills??null,
  washes:mixed.routes[0]?.washes??null,
  alternatives:mixed.diagnostics.earlySlotRelayCandidates||0,
  purpleCosts:mixed.diagnostics.purpleBackboneCosts,
  failures:mixed.diagnostics.failures.slice(0,3),
  replayErrors:mixed.diagnostics.purpleReplayErrors||[]
 }));
 assert.equal(mixed.routes[0]?.pills,910,
  'Mixed-grade native search must beat photo-verified 916 with a 910 pill path');
 assert.equal(mixed.routes[0]?.washes,175);
 assert([268,262,237,204].every(id=>mixed.routes[0].final_slots.some(t=>
  Number(t.id)===id&&t.locked)));
 // Every instruction displayed to the user must itself replay on the
 // original native WASM; correct final slots alone are insufficient.
 assert(wasmSetState(nativeSource));
 const names=new Map(Object.entries(TALENT_DATA).map(([id,t])=>[String(t.name),Number(id)]));
 for(const action of mixed.routes[0].actions){
  const at=Number(action.wash_no);
  assert(Number.isInteger(at)&&at>=Number(snapshot().total_wash),
   'Backwards step in guided 910 route: '+JSON.stringify(action));
  while(Number(snapshot().total_wash)<at)wash(1,'guided route');
  if(['lock','unlock','keep'].includes(action.kind)){
   const id=names.get(String(action.talent));
   lock(id,action.kind!=='unlock');
  }else if(action.kind==='exchange'){
   exchange(names.get(String(action.from)),names.get(String(action.to||action.talent)));
  }else if(action.kind==='open_slot'){
   const match=String(action.note||'').match(/15[1-4]/);
   assert(match,'Missing guided native slot requirement');
   const wanted=Number(match[0]);
   while(Number(snapshot().zizhi)<wanted){
    const state=snapshot();
    assert(wasmSetState({...state,zizhi:Number(state.zizhi)+1,
     str_gift:Number(state.str_gift)+100,con_gift:Number(state.con_gift)+100}));
   }
  }else assert(['wash_to','skip'].includes(action.kind),'Unknown guided action');
  if(action.pills_after!=null)assert.equal(pills(),Number(action.pills_after),
   'Displayed step pill count differs from measured native WASM at '+action.kind);
 }
 assert.equal(pills(),910);
 assert.equal(Number(snapshot().total_wash),175);
 assert.deepEqual(snapshot().talents.map(t=>({id:Number(t.id),locked:!!t.locked})),
  mixed.routes[0].final_slots.map(t=>({id:Number(t.id),locked:!!t.locked})));
 assert(wasmSetState(initial));
 console.log('PASS MOON_1121_AUTO_OPTIMIZED_910');
})().catch(e=>{console.error(e);process.exitCode=1});
