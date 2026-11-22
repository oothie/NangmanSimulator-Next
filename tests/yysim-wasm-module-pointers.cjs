'use strict';
// Recover the memory addresses of original yy-sim Rust wash_search source paths
// and their panic/location descriptors from the ACTIVE WASM data segment.
// Read-only, no gameplay edits and no guesses about executable semantics.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../vendor/yysim/wasm_data.js'),'utf8');
const context={window:{}};vm.createContext(context);
vm.runInContext(source+'\n;this.payload=EMBEDDED_WASM_B64;',context,{timeout:30000});
const bytes=Buffer.from(context.payload,'base64');
assert.equal(bytes.toString('hex',0,4),'0061736d');
function leb(cursor){
 let result=0,multiplier=1,byte;
 do{
  assert(cursor.at<bytes.length);
  byte=bytes[cursor.at++];result+=(byte&127)*multiplier;multiplier*=128;
 }while(byte&128);
 return result;
}
let at=8,segments=[];
while(at<bytes.length){
 const id=bytes[at++],cursor={at},len=leb(cursor),end=cursor.at+len;
 assert(end<=bytes.length);
 if(id===11){
  const n=leb(cursor);
  for(let i=0;i<n;i++){
   const flag=leb(cursor);
   let memoryIndex=0,offset=null;
   if(flag===2)memoryIndex=leb(cursor);
   if(flag===0||flag===2){
    assert.equal(bytes[cursor.at++],65,'expected i32.const data offset');
    offset=leb(cursor);
    assert.equal(bytes[cursor.at++],11,'expected end offset expression');
   }
   const size=leb(cursor),start=cursor.at;
   assert(start+size<=end);
   segments.push({flag,memoryIndex,offset,start,size});
   cursor.at+=size;
  }
 }
 at=end;
}
const modules=['next_purple','exchange','slots','pity','memo','replay',
 'start','vehicle_wait','ticket','luck_walk','pad'];
const report=[];
for(const name of modules){
 const fragment=Buffer.from('src\\wash_search\\'+name+'.rs','utf8');
 const matches=[];
 for(const segment of segments.filter(x=>x.offset!==null)){
  const data=bytes.subarray(segment.start,segment.start+segment.size);
  let off=-1;
  while((off=data.indexOf(fragment,off+1))>=0){
   const address=segment.offset+off,needle=Buffer.alloc(4);
   needle.writeUInt32LE(address,0);
   let references=0,atRef=-1;
   while((atRef=data.indexOf(needle,atRef+1))>=0)references++;
   matches.push({address,locationDescriptors:references});
  }
 }
 assert(matches.length,'Original WASM source path missing for '+name);
 report.push({module:name,matches});
}
const main=report.find(x=>x.module==='next_purple');
assert(main.matches.some(x=>x.locationDescriptors>0),
 'Native purple event source location must have compiled metadata references');
console.log('YY_SIM_NATIVE_RUST_MODULE_MEMORY_MAP',JSON.stringify({
 originalDataSegments:segments.map(x=>({flag:x.flag,offset:x.offset,size:x.size})),
 modules:report,
 caution:'Source paths and location descriptors identify the original architecture, not a proven quality predicate'
}));
