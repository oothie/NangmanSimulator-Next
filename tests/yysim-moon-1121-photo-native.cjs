'use strict';
// The user's observed 1121 Moon-young wash transcript, replayed strictly
// with the original native yy-sim WASM. Not a production shortcut.
// Only the minimum save-derived numeric character inputs are committed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
globalThis.window=globalThis;globalThis.location={protocol:'file:'};
for(const file of ['vendor/yysim/wasm_data.js','vendor/yysim/core_glue.js','vendor/yysim/data.js'])
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
 lock(177,false);lock(262,true);wash(19,'lock two purples 19');assert.equal(pills(),636);
 lock(237,true);wash(28,'lock two purples and green 28');assert.equal(pills(),916);
 lock(204,true);step('four final talents');
 assert([268,262,237,204].every(id=>snapshot().talents.some(t=>
  Number(t.id)===id&&t.locked)));
 assert.equal(pills(),916);assert.equal(Number(snapshot().total_wash),175);
 console.log('PASS MOON_1121_ORIGINAL_WASM_916');
})().catch(e=>{console.error(e);process.exitCode=1});
