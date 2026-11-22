'use strict';
// Read-only architecture map from embedded Rust panic/source locations in the
// original yy-sim WebAssembly binary. This is NOT recovered Rust source.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../vendor/yysim/wasm_data.js'),'utf8');
const scope={window:{}};vm.createContext(scope);
vm.runInContext(source+'\n;this.payload=EMBEDDED_WASM_B64;',scope,{timeout:30000});
const bytes=Buffer.from(scope.payload,'base64');
assert.equal(bytes.toString('hex',0,4),'0061736d');
const haystack=bytes.toString('latin1');
const sourcePaths=[...haystack.matchAll(/src[\\/]wash_search[\\/][A-Za-z_]+\.rs/g)]
 .map(m=>m[0].replaceAll('\\','/'));
const modules=[...new Set(sourcePaths)].sort();
const expected=['next_purple','exchange','slots','pity','memo','replay',
 'start','vehicle_wait','ticket','luck_walk','pad'];
for(const module of expected){
 assert(modules.includes('src/wash_search/'+module+'.rs'),
  'Native Rust search module unavailable: '+module);
}
console.log('YY_SIM_RUST_WASH_SEARCH_MODULE_MAP',JSON.stringify({
 moduleCount:modules.length,modules,mentions:sourcePaths.length,
 nextPurpleModuleFound:modules.includes('src/wash_search/next_purple.rs'),
 evidence:'Embedded native Rust source path strings; implementation remains compiled WASM',
 conclusion:'Investigate purple-event acquisition and its memo/replay dependencies; never patch quality constants without confirmation'
}));
