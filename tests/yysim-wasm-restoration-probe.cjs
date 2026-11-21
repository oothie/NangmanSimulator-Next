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
})().catch(e=>{console.error(e);process.exitCode=1});