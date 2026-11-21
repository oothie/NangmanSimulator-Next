// Discover actual embedded yy-sim WASM 'search_wash_routes' input contract.
// This is a bounded native API inspection; it must never mutate imported save state.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..','vendor','yysim'),context={
 console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),
 location:{protocol:'https:'},window:{},Date,Math,JSON
};
vm.createContext(context);
for(const file of ['wasm_data.js','core_glue.js','data.js']){
 vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file,timeout:60000});
}
(async()=>{
 assert.equal(await vm.runInContext('initWasm()',context),true);
 assert.equal(vm.runInContext('wasmInitEngine(TALENT_DATA,ZZ_DATA)',context),true);
 const original=vm.runInContext('wasmGetState()',context);
 context.testState={...original,mode:'seed',seed:447882174,role_id:10044,salt:262731,
   zizhi:153,sex:1,vip:1,talents:[{id:248,locked:false},{id:249,locked:false},
   {id:250,locked:false},{id:271,locked:false}],bag_pills:1200,has_bag_pills:true};
 assert.equal(vm.runInContext('wasmSetState(testState)',context),true);
 const before=JSON.stringify(vm.runInContext('wasmGetState()',context));
 const queries=[
  {},
  {targetIds:[]},
  {target_ids:[271],max_total_pills:30,max_nodes:10,search_depth:1},
  {targetIds:[271],options:{maxTotalPills:30,maxNodes:10,searchDepth:1}},
  {targets:[271],limit:20},
  {targets:[{id:271}],limit:20},
  {targets:[{talent_id:271}],limit:20},
  {purpleIds:[271],limit:20},
  {purple_ids:[271],limit:20},
  {targetPurples:[271],limit:20},
  {target_purples:[271],limit:20},
  {selectedPurples:[271],limit:20},
  {selected_purples:[271],limit:20},
  {selectedTalentIds:[271],limit:20},
  {selected_talents:[271],limit:20},
  {desiredTalents:[271],limit:20},
  {targetTalentIds:[271],limit:20},
  {purple_names:['转世金仙'],limit:20},
  {target_names:['转世金仙'],limit:20},
  {targets:['转世金仙'],limit:20},
  {wanted:[271],limit:20},
  {desired_ids:[271],max_pad:0,horizon:20,top_n:3,allow_open_slot:false},
  {desired_ids:[271,250],max_pad:0,horizon:30,top_n:3,allow_open_slot:false},
  {desired_ids:[271,250,268],max_pad:1,horizon:25,top_n:3,allow_open_slot:false},
  {desired_ids:[999],max_pad:0,horizon:20,top_n:3},

 ];
 for(const [i,query] of queries.entries()){
  context.query=query;
  const started=Date.now();
  const result=vm.runInContext('wasmSearchWashRoutes(query)',context);
  console.log('PROBE',i,'took',Date.now()-started,
   'ms','result',JSON.stringify(result).slice(0,3000));
  assert.equal(JSON.stringify(vm.runInContext('wasmGetState()',context)),before,
   'native route probe cannot change save state');
 }
 console.log('PASS: inspected real yy-sim wasmSearchWashRoutes API; no state mutation');
})().catch(err=>{console.error(err);process.exitCode=1});
