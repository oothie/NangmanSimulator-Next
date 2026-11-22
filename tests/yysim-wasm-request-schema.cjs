'use strict';
// Read-only introspection of Rust/serde metadata embedded in original yy-sim
// wasm data. This does NOT mean that each field is implemented or safe to pass.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../vendor/yysim/wasm_data.js'),'utf8');
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(source+'\n;this.__encoded=EMBEDDED_WASM_B64;',sandbox,{timeout:30000});
const wasm=Buffer.from(sandbox.__encoded,'base64');
assert.equal(wasm.toString('hex',0,4),'0061736d','WASM magic header');
const metadata=wasm.toString('latin1');
const name='struct WashSearchReq';
const found=metadata.indexOf(name);
assert(found>0,'Original WashSearchReq Rust metadata missing');
const marker=metadata.slice(found,found+260);
const expected=[
 'desired_ids','max_pad','horizon','top_n','allow_open_slot',
 'max_slots','allow_pity','max_preview','pill_budget'
];
let previous=marker.indexOf(name)+name.length;
for(const field of expected){
 const idx=marker.indexOf(field,previous);
 assert(idx>=previous,'Missing or reordered original native field '+field);
 previous=idx+field.length;
}
console.log('ORIGINAL_YY_SIM_WASH_REQUEST_SCHEMA',JSON.stringify({
 type:'WashSearchReq',fields:expected,serializedKeys:expected.length,
 existingHostKeys:['desired_ids','max_pad','horizon','top_n'],
 notYetCharacterized:expected.slice(4),
 note:'Metadata proves serde field names, not color support or optimization semantics'
}));
