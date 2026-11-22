'use strict';
// Investigate original yy-sim WASM code structure WITHOUT modifying the binary.
// Only export/function metadata are printed; never dump the encoded payload.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const filename=path.join(__dirname,'../vendor/yysim/wasm_data.js');
const code=fs.readFileSync(filename,'utf8');
const sandbox={window:{},self:{}};
vm.createContext(sandbox);
vm.runInContext(code+'\n;this.__wasm_blob=typeof EMBEDDED_WASM_B64!=="undefined" ? EMBEDDED_WASM_B64 : window.EMBEDDED_WASM_B64;',sandbox,{timeout:30000});
const base64=String(sandbox.__wasm_blob||'');
if(!/^[A-Za-z0-9+/\s=]+$/.test(base64))throw Error('Native WASM embedded data is not base64');
const bytes=Buffer.from(base64.replace(/\s/g,''),'base64');
if(bytes.toString('hex',0,4)!=='0061736d')throw Error('WASM binary header mismatch');
const wasmModule=new WebAssembly.Module(bytes);
const imports=WebAssembly.Module.imports(wasmModule).filter(x=>x.kind==='function').length;
const exported=WebAssembly.Module.exports(wasmModule);
let at=8,wasmExports=[],bodySizes=[];
function readInt(cursor){
 let n=0,shift=0,byte;
 do{
  if(cursor.pos>=bytes.length||shift>35)throw Error('Invalid LEB128 data');
  byte=bytes[cursor.pos++];n|=(byte&127)<<shift;shift+=7;
 }while(byte&128);
 return n>>>0;
}
function readString(cursor){
 const size=readInt(cursor),end=cursor.pos+size;
 if(end>bytes.length)throw Error('WASM string out of bounds');
 const value=bytes.toString('utf8',cursor.pos,end);
 cursor.pos=end;return value;
}
while(at<bytes.length){
 const id=bytes[at++],cursor={pos:at};
 const length=readInt(cursor),end=cursor.pos+length;
 if(end>bytes.length)throw Error('WASM section outside binary');
 if(id===7){
  const n=readInt(cursor);
  for(let i=0;i<n;i++){
   const name=readString(cursor),kind=bytes[cursor.pos++],index=readInt(cursor);
   wasmExports.push({name,kind,index});
  }
 }else if(id===10){
  const n=readInt(cursor);
  for(let i=0;i<n;i++){
   const size=readInt(cursor);bodySizes.push(size);cursor.pos+=size;
  }
 }
 at=end;
}
const funcs=wasmExports.filter(x=>x.kind===0&&/wash|search|talent|exchange|state/i.test(x.name));
const routes=funcs.find(x=>x.name==='search_wash_routes');
if(!routes)throw Error('WASM route export search_wash_routes not found; inspect glue contract');
const bodyIndex=routes.index-imports;
if(bodyIndex<0||bodyIndex>=bodySizes.length)throw Error('WASM native route export index points outside code bodies');
// The export is wasm-bindgen JSON glue, not the actual route solver.
// Its first large callee is the 78 request adapter, not the full search core.
// The adapter then reaches the much larger internal function 4.
// The wrapper is simple enough that raw 0x10 scanning is diagnostic only;
// do not modify native instructions using this heuristic.
const directCalls=[];
const routeBodyOffset=(()=>{
 let cursor=8;
 while(cursor<bytes.length){
  const id=bytes[cursor++],p={pos:cursor},length=readInt(p),end=p.pos+length;
  if(id===10){
   const n=readInt(p);
   for(let i=0;i<n;i++){
    const size=readInt(p),start=p.pos;
    if(i===bodyIndex)return {start,size};
    p.pos+=size;
   }
  }
  cursor=end;
 }
 throw Error('WASM function body not found');
})();
for(let i=0;i<routeBodyOffset.size;i++){
 if(bytes[routeBodyOffset.start+i]!==0x10)continue;
 const cursor={pos:routeBodyOffset.start+i+1};
 const target=readInt(cursor);
 const candidateSize=target>=imports&&target-imports<bodySizes.length?
  bodySizes[target-imports]:null;
 if(candidateSize!==null)directCalls.push({functionIndex:target,bodyBytes:candidateSize});
}
const adapterCallees=directCalls.filter(x=>x.functionIndex!==routes.index&&x.bodyBytes>1000)
 .sort((a,b)=>b.bodyBytes-a.bodyBytes);
if(!adapterCallees.length)throw Error('WASM search adapter target could not be located');
if(adapterCallees[0].functionIndex!==78||adapterCallees[0].bodyBytes!==4055)
 throw Error('Original yy-sim WASM search implementation changed; re-audit before extending');

const record={moduleBytes:bytes.length,importedFunctions:imports,definedFunctions:bodySizes.length,
 nativeRouteFunctionIndex:routes.index,nativeRouteBodyBytes:bodySizes[bodyIndex],
 searchWrapperCalls:directCalls,requestAdapterCandidate:adapterCallees[0],
 relatedExports:funcs.map(x=>({name:x.name,index:x.index})),
 searchExportPresent:exported.some(x=>x.name==='search_wash_routes'&&x.kind==='function')};
console.log('YY_SIM_ORIGINAL_WASM_STRUCTURE',JSON.stringify(record));
