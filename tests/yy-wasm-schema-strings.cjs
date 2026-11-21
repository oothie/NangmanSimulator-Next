// Inspect game-only yy-sim WASM static strings around auto search validation.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={};vm.createContext(ctx);
const source=fs.readFileSync(path.join(__dirname,'..','vendor/yysim/wasm_data.js'),'utf8');
vm.runInContext(source,ctx);
const b64=vm.runInContext('EMBEDDED_WASM_B64',ctx),data=Buffer.from(b64,'base64');
const error='路径搜索只能预选紫脉';
const bytes=Buffer.from(error,'utf8'),at=data.indexOf(bytes);
console.log('WASM_SCHEMA_BYTES',data.length,'ERROR_OFFSET',at);
function strings(start,end){
 const text=data.subarray(Math.max(0,start),Math.min(data.length,end)).toString('utf8');
 const ascii=[...text.matchAll(/[a-zA-Z_][a-zA-Z0-9_]{3,80}/g)].map(x=>({key:x[0],pos:x.index})).filter((v,i,a)=>a.findIndex(x=>x.key===v.key)===i);
 const han=[...text.matchAll(/[\u3400-\u9fff]{3,40}/g)].map(x=>x[0]);
 return {ascii:ascii.slice(0,120),han:han.slice(0,45)};
}
console.log('ERROR_NEARBY',JSON.stringify(strings(at-2200,at+2400)));
const whole=data.toString('utf8');
const relevant=[...whole.matchAll(/(?:target|purple|search|talent|selected|desired|route)[a-zA-Z_]{0,40}/gi)].map(x=>x[0]);
console.log('SEARCH_SCHEMA_KEYS',JSON.stringify([...new Set(relevant)].slice(0,160)));
console.log('PASS: static WASM auto search validation strings inspected');
