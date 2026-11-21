// Browser-equivalent actual WASM boot test (not mocked).
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../vendor/yysim');
const ctx={console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),
 location:{protocol:'https:'},window:{},Date,Math,JSON,Promise};
vm.createContext(ctx);
for(const file of ['wasm_data.js','core_glue.js','data.js']){
 const source=fs.readFileSync(path.join(base,file),'utf8');
 assert(source.length>1000,'missing native engine resource '+file);
 vm.runInContext(source,ctx,{filename:file,timeout:60000});
}
(async()=>{
 const ok=await vm.runInContext('initWasm()',ctx);
 assert.equal(ok,true,'native wasm instantiation');
 const init=vm.runInContext('wasmInitEngine(TALENT_DATA,ZZ_DATA)',ctx);
 assert.equal(init,true,'native WASM talent initialization');
 const state=vm.runInContext('wasmGetState()',ctx);
 assert(state&&Array.isArray(state.talents),'native state after initialization');
 console.log('PASS: actual embedded yy-sim WASM boot and talent initialization');
})().catch(e=>{console.error(e);process.exitCode=1});
