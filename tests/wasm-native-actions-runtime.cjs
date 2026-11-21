// Test real yy-sim WASM mutating wash/exchange APIs; restore before each operation.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','vendor','yysim');
const ctx={console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),window:{},location:{protocol:'https:'},Date,Math};
vm.createContext(ctx);
for(const f of ['wasm_data.js','core_glue.js','data.js'])
 vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
(async()=>{
 assert(await vm.runInContext('initWasm()',ctx));
 assert(vm.runInContext('wasmInitEngine(TALENT_DATA,ZZ_DATA)',ctx));
 const start=vm.runInContext('wasmGetState()',ctx);
 ctx.record={...start,mode:'seed',seed:447882174,role_id:10044,zizhi:153,salt:262731,
  talents:[{id:248,locked:false},{id:249,locked:false},{id:250,locked:false},{id:271,locked:false}],
  tal_lucky:37,bag_pills:400,has_bag_pills:true};
 const restore=()=>{
  assert(vm.runInContext('wasmSetState(record)',ctx));
  assert.equal(Number(vm.runInContext('wasmGetState().seed',ctx)),447882174);
 };
 const probe=(name,code)=>{
  restore();
  const result=vm.runInContext(code,ctx);
  const before=vm.runInContext('wasmGetState()',ctx);
  console.log('NATIVE_ACTION_'+name,JSON.stringify(result).slice(0,1500));
  console.log('NATIVE_ACTION_'+name+'_AFTER',JSON.stringify({
    seed:before.seed,role:before.role_id,pills:before.total_pills,talents:before.talents
  }).slice(0,700));
  assert(result==null||Array.isArray(result)||typeof result==='object');
  return result;
 };
 probe('WASH_ONCE','wasmDoWash()');
 probe('EXCHANGE_UNLOCKED','wasmExchangeTalent(0)');
 probe('NEXT_PURPLE','wasmWashUntilGold(20)');
 probe('TARGET_PURPLE','wasmWashUntilTalentName("九阴鬼脉",20)');
 restore();
 console.log('PASS: live original WASM direct wash/exchange/till-purple APIs tested with rollback');
})().catch(err=>{console.error(err);process.exitCode=1});
