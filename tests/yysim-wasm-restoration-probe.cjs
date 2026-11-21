'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../vendor/yysim');
const ctx={console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),location:{protocol:'https:'},window:{},Date,Math,JSON,Promise};
vm.createContext(ctx);
for(const file of ['wasm_data.js','core_glue.js','data.js'])
 vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file,timeout:60000});
(async()=>{
 assert.equal(await vm.runInContext('initWasm()',ctx),true);
 assert.equal(vm.runInContext('wasmInitEngine(TALENT_DATA,ZZ_DATA)',ctx),true);
 const defaultState=vm.runInContext('wasmGetState()',ctx);
 const input={...defaultState,mode:'seed',seed:447882174,role_id:10044,salt:262731,zizhi:153,sex:1,vip:1,
  talents:[{id:171,locked:false},{id:172,locked:false}],bag_pills:1200,has_bag_pills:true};
 ctx.input=input;assert.equal(vm.runInContext('wasmSetState(input)',ctx),true);
 const original=vm.runInContext('wasmGetState()',ctx);
 console.log('BASELINE_SCHEMA',JSON.stringify(original).slice(0,6000));
 const attempt=(label,apply)=>{
  apply();const before=vm.runInContext('wasmGetState()',ctx);
  const valid=vm.runInContext('wasmSetState(inputOriginal)',ctx);
  const actual=vm.runInContext('wasmGetState()',ctx);
  const keys=[...new Set([...Object.keys(original),...Object.keys(actual)])];
  const different=keys.filter(k=>JSON.stringify(original[k])!==JSON.stringify(actual[k]))
   .map(k=>({key:k,wanted:original[k],actual:actual[k]}));
  console.log('RESTORE_PROBE',label,JSON.stringify({valid,changedBefore:JSON.stringify(before)!==JSON.stringify(original),different}).slice(0,4500));
  return {valid,different};
 };
 ctx.inputOriginal=original;
 const zero=attempt('untouched',()=>{});
 const lock=attempt('lock-state',()=>{ctx.lockInput={...original,talents:original.talents.map((t,i)=>({...t,locked:i===0}))};
  vm.runInContext('wasmSetState(lockInput)',ctx)});
 const wash=attempt('one-wash',()=>{vm.runInContext('wasmDoWash()',ctx)});
 const twice=attempt('two-washes',()=>{vm.runInContext('wasmDoWash();wasmDoWash()',ctx)});
 console.log('SUMMARY',JSON.stringify({zero:zero.different.length,lock:lock.different.length,wash:wash.different.length,twice:twice.different.length}));
 const scenarios=[
  {label:'present-3slots-1lock',talents:[{id:401,locked:true},{id:260,locked:false},{id:278,locked:false}],zizhi:153},
  {label:'present-4slots-2lock',talents:[{id:401,locked:true},{id:260,locked:true},{id:278,locked:false},{id:184,locked:false}],zizhi:154},
  {label:'present-4slots-3lock',talents:[{id:401,locked:true},{id:260,locked:true},{id:278,locked:true},{id:184,locked:false}],zizhi:154},
  {label:'zero-bag',talents:[{id:171,locked:false},{id:172,locked:false}],zizhi:152,bag_pills:0},
  {label:'large-seed',talents:[{id:171,locked:false},{id:172,locked:false}],zizhi:152,seed:4294967295},
  {label:'record-rich',talents:[{id:401,locked:true},{id:260,locked:false},{id:278,locked:false}],zizhi:153,
   born_talent_rc:123456,international_wash:true,luck_seed:291430,luck_seed_inited:true,tal_lucky:37,
   total_pills:324,total_wash:1100,exchange_count:14,gold_count:5,pity_count:2,bag_pills:900},
 ];
 for(const scenario of scenarios){
  const next={...original,...scenario};delete next.label;
  ctx.scenario=next;
  const applied=vm.runInContext('wasmSetState(scenario)',ctx);
  if(!applied){console.log('SCENARIO_REJECT',scenario.label);continue}
  const first=vm.runInContext('wasmGetState()',ctx);
  ctx.scenarioBaseline=first;
  const setAgain=vm.runInContext('wasmSetState(scenarioBaseline)',ctx);
  const readAgain=vm.runInContext('wasmGetState()',ctx);
  const diffs=Object.keys(first).filter(k=>JSON.stringify(first[k])!==JSON.stringify(readAgain[k]));
  let bad=null;let washesDone=0;
  for(let step=1;step<=250;step++){
   const got=vm.runInContext('wasmDoWash()',ctx);
   if(!got)break;
   washesDone++;
   if(step%25===0){
    const valid=vm.runInContext('wasmSetState(scenarioBaseline)',ctx);
    const actual=vm.runInContext('wasmGetState()',ctx);
    const different=Object.keys(first).filter(k=>JSON.stringify(first[k])!==JSON.stringify(actual[k]));
    if(!valid||different.length){bad={at:step,valid,different:different.map(k=>({key:k,expected:first[k],actual:actual[k]}))};break;}
   }
  }
  console.log('SCENARIO',scenario.label,JSON.stringify({setAgain,diffs,washesDone,bad}).slice(0,2500));
 }
 vm.runInContext('wasmSetState(inputOriginal)',ctx);

})().catch(e=>{console.error(e);process.exitCode=1});