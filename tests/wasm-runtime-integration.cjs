// Real embedded yy-sim WASM smoke: verify native result shapes and no mutation on previews.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..','vendor','yysim');
const context={
 console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),
 location:{protocol:'https:'},window:{},Date,Math,JSON,
};
vm.createContext(context);
for(const file of ['wasm_data.js','core_glue.js','data.js']){
 vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file,timeout:60000});
}
const shape=v=>Array.isArray(v)?'array['+v.length+']':
 v==null?String(v):typeof v==='object'?'object{'+Object.keys(v).join(',')+'}':typeof v;
(async()=>{
 assert.equal(await vm.runInContext('initWasm()',context),true,'embedded wasm initializes');
 assert.equal(vm.runInContext('wasmInitEngine(TALENT_DATA,ZZ_DATA)',context),true,'real talent table engine');
 const initial=vm.runInContext('wasmGetState()',context);
 assert(initial&&typeof initial==='object','WASM exposes state');
 console.log('NATIVE_STATE',shape(initial),JSON.stringify(initial).slice(0,1200));
 const state={...initial,mode:'seed',seed:447882174,role_id:10044,salt:262731,
  rng_variant:'73324',zizhi:153,sex:1,vip:1,has_born_talent:true,
  talents:[{id:248,locked:false},{id:249,locked:false},{id:250,locked:false},{id:271,locked:false}],
  tal_lucky:37,total_wash:0,total_talent_bars:0,total_pills:0,bag_pills:1200,
  has_bag_pills:true,role_stats:{str_val:193,dex:27,con:141,int_val:167},
  global_vars:{}};
 context.state=state;
 assert.equal(vm.runInContext('wasmSetState(state)',context),true);
 const read=vm.runInContext('wasmGetState()',context);
 assert.equal(Number(read.seed),447882174);
 const before=JSON.stringify(read);
 const preview=vm.runInContext('wasmPreviewSequence(80)',context);
 const constraints=vm.runInContext('wasmGetConflicts()',context);
 const available=vm.runInContext('wasmGetAvailableTalents()',context);
 const targets=[{purple_name:'九阴鬼脉',conflict_name:'玄阳神脉'}];
 context.targets=targets;
 const pads=vm.runInContext('wasmPreviewExchangePads(targets,80)',context);
 context.targetsNew=[{purple_name:'拳脚无双',conflict_name:'剑术无双'}];
 const actualRoutes=vm.runInContext('wasmPreviewExchangePads(targetsNew,80)',context);
 console.log('NATIVE_TARGET_ROUTE_SAMPLE',JSON.stringify(actualRoutes.filter(x=>x.error||x.nodes?.some(n=>n.chain?.length)).slice(0,4)).slice(0,5000));
 assert(Array.isArray(preview.purples),'real native preview has purple list');
 assert(Array.isArray(preview.luck_pool),'real native preview has luck-pool list');
 assert(Array.isArray(constraints),'real native conflicts are slot records');
 assert(Array.isArray(available),'real native available talents are IDs');
 assert(Array.isArray(pads)&&pads.length===81,'real native exchange pads include pad 0 through 80');
 assert(pads.every(row=>row&&Number.isInteger(row.pad)&&Array.isArray(row.nodes)&&
   'pills' in row&&'washes' in row&&'exchanges' in row),'actual pad cost and steps');
 assert(preview.purples.every(row=>Number.isInteger(row.wash_no)&&
   Number.isInteger(row.wash_times)&&Number.isInteger(row.talent_id)),
  'purple preview exposes original event, cycle and talent ID');
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine','wash-path-model.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine','wash-preview-model.js'),'utf8'),context);
 context.nativePads=pads;context.nativePreview=preview;
 const pathCandidates=vm.runInContext('window.NangmanWashPath.inspect(nativePads,1)',context);
 const purples=vm.runInContext('window.NangmanWashPreview.normalize(nativePreview)',context);
 assert.equal(pathCandidates.length,81,'native path candidates parsed by UI model');
 assert.equal(purples.length,preview.purples.length,'native preview parsed by UI model');
 assert.equal(JSON.stringify(vm.runInContext('wasmGetState()',context)),before,
  'read-only previews must not modify live WASM state');
 for(const [name,value] of [['preview',preview],['conflicts',constraints],['available',available],['pads',pads]]){
  assert(value&&typeof value==='object','native '+name+' returns object/array');
  console.log('NATIVE_'+name.toUpperCase(),shape(value),JSON.stringify(value).slice(0,1200));
 }
 console.log('PASS: live embedded WASM initialized, preview/constraints/pads inspected without side-effects');
})().catch(err=>{console.error(err);process.exitCode=1});
