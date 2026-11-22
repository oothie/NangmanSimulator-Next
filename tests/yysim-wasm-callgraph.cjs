'use strict';
// Exact-opcode call graph for the original yy-sim WASM search implementation.
// Read-only: no modifications to the native binary or auto-search UI.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../vendor/yysim/wasm_data.js'),'utf8');
const context={window:{}};vm.createContext(context);
vm.runInContext(source+'\n;this.wasmPayload=EMBEDDED_WASM_B64;',context,{timeout:30000});
const bytes=Buffer.from(context.wasmPayload,'base64');
assert.equal(bytes.toString('hex',0,4),'0061736d');
assert(WebAssembly.validate(bytes),'Original yy-sim WASM binary did not pass runtime validation');
function uleb(cur){
 let value=0,multiplier=1,byte;
 do{
  assert(cur.pos<bytes.length,'LEB128 out of bounds');
  byte=bytes[cur.pos++];
  value+=(byte&127)*multiplier;
  multiplier*=128;
 }while(byte&128);
 return value;
}
const readInt=uleb;
function signedLeb(cur){
 let byte,value=0,shift=0;
 do{
  assert(cur.pos<bytes.length);
  byte=bytes[cur.pos++];
  value+=(byte&127)*2**shift;
  shift+=7;
 }while(byte&128);
 if(shift<32&&(byte&64))value-=2**shift;
 return value;
}
function readName(cur){const n=uleb(cur),end=cur.pos+n;assert(end<=bytes.length);const val=bytes.toString('utf8',cur.pos,end);cur.pos=end;return val}
let position=8,importCount=0,functions=[],wasmExports=[],typeSignatures=[],functionTypeIds=[];
while(position<bytes.length){
 const id=bytes[position++],cur={pos:position},len=uleb(cur),end=cur.pos+len;
 assert(end<=bytes.length);
 if(id===1){
  const n=uleb(cur);
  for(let i=0;i<n;i++){
   assert.equal(bytes[cur.pos++],96,'Expected WASM function type');
   const argCount=uleb(cur),params=[];
   for(let j=0;j<argCount;j++)params.push(bytes[cur.pos++]);
   const resultCount=uleb(cur),returns=[];
   for(let j=0;j<resultCount;j++)returns.push(bytes[cur.pos++]);
   typeSignatures.push({params,returns});
  }
 }else if(id===2){
  const n=uleb(cur);
  for(let i=0;i<n;i++){
   readName(cur);readName(cur);
   const kind=bytes[cur.pos++];
   if(kind===0){uleb(cur);importCount++}
   else if(kind===1){cur.pos++;const flags=uleb(cur);uleb(cur);if(flags&1)uleb(cur)}
   else if(kind===2){const flags=uleb(cur);uleb(cur);if(flags&1)uleb(cur)}
   else if(kind===3){cur.pos+=2}
   else throw Error('Unknown import kind '+kind);
  }
 }else if(id===3){
  const n=uleb(cur);
  for(let i=0;i<n;i++)functionTypeIds.push(uleb(cur));
 }else if(id===7){
  const n=uleb(cur);
  for(let i=0;i<n;i++)wasmExports.push({name:readName(cur),kind:bytes[cur.pos++],index:uleb(cur)});
 }else if(id===10){
  const n=uleb(cur);
  for(let i=0;i<n;i++){
   const size=uleb(cur);
   assert(cur.pos+size<=end);
   functions.push({start:cur.pos,size});
   cur.pos+=size;
  }
 }
 position=end;
}
const named=new Map(wasmExports.filter(x=>x.kind===0).map(x=>[x.index,x.name]));
const wasmFunctionSignature=(index)=>{
 const type=typeSignatures[functionTypeIds[index-importCount]];
 assert(type,'WASM function type not found for '+index);
 return {index,params:type.params,returns:type.returns};
};
const nativeFunctionSignatures=[4,13,16,30,75,78,117,227,960]
 .map(wasmFunctionSignature);
assert.deepEqual(wasmFunctionSignature(13).params,[127,127,127,127],
 'Original next_purple function13 parameters changed');
assert.deepEqual(wasmFunctionSignature(16).returns,[127],
 'Original exchange function16 return type changed');

const instructionCache=new Map();
function inspect(index){
 if(instructionCache.has(index))return instructionCache.get(index);
 const functionBody=functions[index-importCount];
 assert(functionBody,'Invalid function index '+index);
 const {start,size}=functionBody,cur={pos:start},end=start+size;
 const groups=uleb(cur);
 for(let i=0;i<groups;i++){uleb(cur);cur.pos++}
 const calls=[],constants=[],instructions=[];
 while(cur.pos<end){
  const at=cur.pos-start,opcode=bytes[cur.pos++];
  const instr={offset:at,opcode};instructions.push(instr);
  if(opcode===2||opcode===3||opcode===4)signedLeb(cur);
  else if([12,13,16,18,32,33,34,35,36,37,38,210].includes(opcode)){
   const value=uleb(cur);
   // Keep immediate local/branch/table operands as actual bytecode values,
   // rather than deriving WASM arguments from unparsed neighboring bytes.
   instr.immediate=value;
   if(opcode===16)calls.push({offset:at,index:value,bodyBytes: functions[value-importCount]?.size??null,name:named.get(value)||null});
  }
  else if(opcode===14){const n=uleb(cur);for(let i=0;i<=n;i++)uleb(cur)}
  else if(opcode===17||opcode===19){uleb(cur);uleb(cur)}
  else if(opcode===28){const n=uleb(cur);cur.pos+=n}
  else if(opcode>=40&&opcode<=62){uleb(cur);instr.memOffset=uleb(cur)}
  else if(opcode===63||opcode===64)cur.pos++;
  else if(opcode===65||opcode===66){
   const value=signedLeb(cur);
   if(opcode===65){instr.value=value;constants.push({offset:at,value})}
  }
  else if(opcode===67)cur.pos+=4;
  else if(opcode===68)cur.pos+=8;
  else if(opcode===208)cur.pos++;
  else if(opcode===252){
   const sub=uleb(cur);
   if([8,10,12,14].includes(sub)){uleb(cur);uleb(cur)}
   else if([9,11,13,15,16,17].includes(sub))uleb(cur);
  }
  else if(opcode===253||opcode===254)throw Error('Unsupported SIMD/atomic instruction '+opcode+' in function '+index);
  else if(opcode>=69&&opcode<=196){}
  else if([0,1,5,11,15,26,27,209,211].includes(opcode)){}
  else throw Error('Unknown instruction '+opcode+' in function '+index+' at '+at);
  assert(cur.pos<=end,'Decoded past end of function '+index);
 }
 assert.equal(cur.pos,end);
 const decoded={index,bodyBytes:size,callCount:calls.length,calls,constants,instructions};
 instructionCache.set(index,decoded);
 return decoded;
}
const search=wasmExports.find(x=>x.name==='search_wash_routes'&&x.kind===0);
assert(search,'Original WASM search export absent');
const wrapper=inspect(search.index);
assert(wrapper.calls.some(x=>x.index===78),'Native search wrapper must reach function 78');
const solver=inspect(78);
// Function 78 is a search-request adapter: the actual heavy calculation
// occurs through its single call to function 4. Function 30 is called on
// both sides of that call and is likely a representation/serialization
// helper, but that semantic inference is not yet independently verified.
const highLevelCalls=solver.calls.filter(x=>[4,30].includes(x.index))
 .map(x=>({offset:x.offset,index:x.index,bodyBytes:x.bodyBytes}));
assert.deepEqual(highLevelCalls.map(x=>x.index),[30,4,30],
 'Original WASM adapter / search core call order changed');
const coreSearch=inspect(4);
const tally=new Map();
for(const c of solver.calls){
 const entry=tally.get(c.index)||{index:c.index,bodyBytes:c.bodyBytes,calls:0};
 entry.calls++;tally.set(c.index,entry);
}
const constantCounts=new Map();
for(const value of solver.constants.map(x=>x.value))
 constantCounts.set(value,(constantCounts.get(value)||0)+1);
// Literal four is also used for slot counts and data offsets. Mark only
// nearby integer comparisons as REVIEW CANDIDATES, not proven grade checks.
const compareOpcodes=new Set([70,71,72,73,74,75,76,77,78,79]);
function gradeReviewSitesFor(decoded){
 const candidates=[];
 for(let i=0;i<decoded.instructions.length;i++){
  const inst=decoded.instructions[i];
  if(inst.opcode!==65||inst.value!==4)continue;
  const match=decoded.instructions.slice(i+1,i+5).find(next=>compareOpcodes.has(next.opcode));
  if(match)candidates.push({literalOffset:inst.offset,
   compareOffset:match.offset,compareOpcode:match.opcode});
 }
 return candidates;
}
// Distinguish generic four-slot/count operations from credible talent-grade
// checks. These are diagnostics ONLY; absence of a match is not proof.
function classifyFourUses(decoded){
 const output=[];
 const inst=decoded.instructions;
 for(let i=0;i<inst.length;i++){
  if(inst[i].opcode!==65||inst[i].value!==4)continue;
  const after=inst.slice(i+1,i+7).map(x=>x.opcode);
  const before=inst.slice(Math.max(0,i-4),i).map(x=>x.opcode);
  let category='unclassified';
  if(after[0]===54||after[0]===55)category='memory-store';
  else if(after[0]===106||after[0]===107)category='pointer-stride-or-arithmetic';
  else if(after.includes(27)&&after.some(x=>[73,75,77,79].includes(x)))
   category='min-max-clamp';
  else if(after[0]>=70&&after[0]<=79&&after.includes(13))
   category='bound-or-branch';
  else if(after.includes(116))category='bit-mask-or-slot-count';
  output.push({offset:inst[i].offset,category,
   nearOpcodes:[...before,...after].map(x=>x.toString(16))});
 }
 return output;
}
const fourUseCandidates=classifyFourUses(solver);
// Search the actual native selection function for gates written as <=3,
// >=4, ==3, etc. A restriction to purple can be an inverted comparison
// against 3, so only searching for literal 4 would miss it.
function comparisonWindows(decoded){
 const inst=decoded.instructions,rows=[];
 for(let i=0;i<inst.length;i++){
  const item=inst[i];
  if(item.opcode!==65||![2,3,4].includes(item.value))continue;
  const next=inst.slice(i+1,i+6);
  const comparison=next.find(x=>x.opcode>=70&&x.opcode<=79);
  if(comparison)rows.push({
   literal:item.value,offset:item.offset,
   comparisonOffset:comparison.offset,
   comparisonOpcode:comparison.opcode,
   nearbyOpcodes:inst.slice(Math.max(0,i-3),Math.min(inst.length,i+7))
    .map(x=>x.opcode)
  });
 }
 return rows;
}
const searchQualityBoundaryCandidates=comparisonWindows(solver);
// Preserve memory offsets around quality-range candidates for human review.
const structuralBoundarySites=[];
for(const index of [78,30]){
 const decoded=index===78?solver:inspect(index);
 const candidates=comparisonWindows(decoded);
 for(const site of candidates){
  const position=decoded.instructions.findIndex(x=>x.offset===site.offset);
  const preceding=decoded.instructions.slice(Math.max(0,position-4),position);
  const following=decoded.instructions.slice(position+1,position+6);
  structuralBoundarySites.push({functionIndex:index,...site,
   preceding:preceding.map(x=>({opcode:x.opcode,offset:x.offset,
    value:x.value??null,memOffset:x.memOffset??null})),
   following:following.map(x=>({opcode:x.opcode,offset:x.offset,
    value:x.value??null}))});
 }
}
const gradeReviewSites=gradeReviewSitesFor(solver);
const dependencies=[...tally.values()].sort((a,b)=>b.calls-a.calls||a.index-b.index);
const byBody=[...tally.values()].sort((a,b)=>b.bodyBytes-a.bodyBytes).slice(0,12);
const candidateCallees=[];
// Native quality checks may compare a loaded TalentData grade against
// literals 2, 3 or 4; unlike an arbitrary literal-four search, retain the
// immediately preceding load opcode and its field offset. These are merely
// dataflow clues, not a permission to modify the original WASM.
const qualityDataflowCandidates=[];
const exploredFromCore=new Set();
const coreQueue=[{index:4,depth:0}];
while(coreQueue.length){
 const {index,depth}=coreQueue.shift();
 if(exploredFromCore.has(index)||depth>2)continue;
 exploredFromCore.add(index);
 let decoded;
 try{decoded=index===4?coreSearch:inspect(index)}
 catch(_){continue}
 const ins=decoded.instructions;
 for(let i=0;i<ins.length;i++){
  if(ins[i].opcode!==65||![2,3,4].includes(ins[i].value))continue;
  const next=ins.slice(i+1,i+4);
  const compare=next.find(x=>x.opcode>=70&&x.opcode<=79);
  if(!compare)continue;
  const prior=ins.slice(Math.max(0,i-5),i);
  const load=[...prior].reverse().find(x=>x.opcode>=40&&x.opcode<=53);
  if(!load)continue;
  qualityDataflowCandidates.push({functionIndex:index,depth,
   literal:ins[i].value,literalOffset:ins[i].offset,
   comparisonOpcode:compare.opcode,loadOpcode:load.opcode,
   memoryOffset:load.memOffset??null,
   instructionGap:i-ins.indexOf(load)});
 }
 if(depth<2)for(const child of decoded.calls){
  if(child.bodyBytes!==null&&child.bodyBytes<=50000&&
     !exploredFromCore.has(child.index))
   coreQueue.push({index:child.index,depth:depth+1});
 }
}
// Capture the original core's native event-generator call operands and
// neighbors without renaming any unknown field as a quality-grade filter.
const nativeEventCalls=[];
for(let i=0;i<coreSearch.instructions.length;i++){
 const instruction=coreSearch.instructions[i];
 if(instruction.opcode!==16)continue;
 const destination=coreSearch.calls.find(x=>x.offset===instruction.offset);
 if(!destination||![13,75,117,16,227].includes(destination.index))continue;
 nativeEventCalls.push({offset:instruction.offset,destination:destination.index,
  preceding:coreSearch.instructions.slice(Math.max(0,i-12),i)
   .map(x=>({opcode:x.opcode,offset:x.offset,value:x.value??null,
    memoryOffset:x.memOffset??null}))});
}
assert(nativeEventCalls.some(x=>x.destination===13),
 'Expected direct original purple candidate generation call');
assert(nativeEventCalls.some(x=>x.destination===13&&x.offset===14886),
 'Original native next_purple event call site moved; audit call argument bound');
// Collect the actual local/constant operands immediately preceding the
// original native next_purple call for future grade-gate reconstruction.
// This is an instruction window, NOT a proven four-argument semantic map.
const purpleCallSite=coreSearch.instructions.findIndex(x=>
 x.offset===14886&&x.opcode===16);
assert(purpleCallSite>0,'Original purple generator call no longer decoded');
const purpleCallOperands=coreSearch.instructions.slice(purpleCallSite-28,purpleCallSite)
 .map(x=>({offset:x.offset,opcode:x.opcode,
  immediate:x.immediate??null,value:x.value??null,memOffset:x.memOffset??null}));
assert(purpleCallOperands.some(x=>x.opcode===32),
 'Expected real local.get bytecode near native purple generator');

// Decode the exact four operand expressions feeding call 13. This is the
// original bytecode contract, not an assumption that any operand is a grade.
//  1) base(local 3) + 2648
//  2) base(local 3) + 1560
//  3) local 33
//  4) select(-1, derived bound, unsigned comparison)
const purpleOperandInstructions=coreSearch.instructions.slice(purpleCallSite-18,purpleCallSite);
const purpleOperandContract=[
 [32,3],[65,2648],[106,null],[32,3],[65,1560],[106,null],
 [32,33],[65,-1],[32,3],[40,1716],[34,6],[32,26],
 [106,null],[34,5],[32,5],[32,6],[73,null],[27,null]
];
assert.deepEqual(purpleOperandInstructions.map(x=>[
 x.opcode,x.opcode===65?x.value:x.opcode===40?x.memOffset:
  [32,34].includes(x.opcode)?x.immediate:null
]),purpleOperandContract,'Native next_purple four-input bytecode changed');
// Resolve the immediately visible *writers* of each local feeding function
// 13. Values can cross branches and loops, so these remain a bounded
// def-use inventory, not a full SSA proof or a talent grade identification.
const nextPurpleLocalOrigins=[3,5,6,26,33].map(localIndex=>{
 const instructions=coreSearch.instructions;
 const definitions=instructions.filter(x=>x.offset<14886&&
  (x.opcode===33||x.opcode===34)&&x.immediate===localIndex);
 return {localIndex,definitionCount:definitions.length,
  previousDefinitions:definitions.slice(-12).map(def=>{
   const at=instructions.findIndex(x=>x.offset===def.offset);
   return {offset:def.offset,assignmentOpcode:def.opcode,
    preceding:instructions.slice(Math.max(0,at-8),at)
     .map(x=>({offset:x.offset,opcode:x.opcode,value:x.value??null,
      local:x.immediate??null,memOffset:x.memOffset??null}))};
  })};
});
assert(nextPurpleLocalOrigins.some(x=>x.localIndex===33&&x.definitionCount>0),
 'Original core local 33 is no longer assigned within search function');
const purpleFourInputs=[
 {kind:'pointer-base-plus-offset',localIndex:3,addend:2648},
 {kind:'pointer-base-plus-offset',localIndex:3,addend:1560},
 {kind:'local-value',localIndex:33},
 {kind:'unsigned-select',left:-1,rightLocalIndex:5,
  condition:{leftLocalIndex:5,rightLocalIndex:6,opcode:73},
  source:{baseLocalIndex:3,memOffset:1716,addLocalIndex:26}}
];
// This argument-local inventory allows follow-on def/use analysis of the
// exact source slots without claiming that 2648 or 1560 is TalentData.pinzhi.

const nativePurpleGenerator=inspect(13);
const purpleGeneratorCompareWindows=comparisonWindows(nativePurpleGenerator);
// The three functions identified through original next_purple.rs source-location
// metadata are inspected separately. Constant 2/3/4 in these bodies may mean
// a grade, slot count, vector stride, or state-machine arm: preserve their
// neighboring memory operands rather than relabeling all of them as grades.
const nativePurpleFunctions=[13,75,117].map(index=>{
 const decoded=index===13?nativePurpleGenerator:inspect(index);
 const windows=comparisonWindows(decoded);
 const candidates=windows.map(site=>{
  const pos=decoded.instructions.findIndex(x=>x.offset===site.offset);
  const nearby=decoded.instructions.slice(Math.max(0,pos-9),Math.min(decoded.instructions.length,pos+9));
  const loads=nearby.filter(x=>x.opcode>=40&&x.opcode<=53);
  const memory=nearby.filter(x=>x.opcode>=40&&x.opcode<=62)
   .map(x=>({offset:x.offset,opcode:x.opcode,memOffset:x.memOffset}));
  return {...site,nearby:nearby.map(x=>({offset:x.offset,opcode:x.opcode,
    value:x.value??null,localIndex:x.immediate??null,memOffset:x.memOffset??null})),
   memory,loadOffsets:loads.map(x=>x.memOffset)};
 });
 return {index,bodyBytes:decoded.bodyBytes,comparisonSites:candidates.length,
  sites:candidates,opcodeCount:decoded.instructions.length};
});
assert(nativePurpleFunctions.every(x=>x.opcodeCount>0),
 'Original native next_purple source functions failed disassembly');
assert(nativePurpleFunctions.find(x=>x.index===13)?.comparisonSites>0,
 'Original native purple event source no longer has grade-adjacent comparisons');

// Generate a reproducible review table: group 2/3/4 comparison windows by
// function and their adjacent *actual* memory offsets. This is not proof
// that any memory field is a talent quality. It prevents re-investigating
// generic literal "4" sites as if they were validated quality gates.
const nativeQualityReview=nativePurpleFunctions.map(group=>{
 const buckets=new Map();
 for(const site of group.sites){
  const keys=site.loadOffsets.length?
   [...new Set(site.loadOffsets)].map(String):['no-adjacent-load'];
  for(const key of keys){
   const entry=buckets.get(key)||{fieldOffset:key,counts:{2:0,3:0,4:0},
    sourceOffsets:[],comparisonOpcodes:[]};
   entry.counts[site.literal]++;
   entry.sourceOffsets.push(site.offset);
   if(!entry.comparisonOpcodes.includes(site.comparisonOpcode))
    entry.comparisonOpcodes.push(site.comparisonOpcode);
   buckets.set(key,entry);
  }
 }
 const groups=[...buckets.values()].sort((a,b)=>
  b.sourceOffsets.length-a.sourceOffsets.length||
  a.fieldOffset.localeCompare(b.fieldOffset));
 return {index:group.index,comparedWindows:group.comparisonSites,
  memoryLoadGroups:groups};
});
assert(nativeQualityReview.length===3,
 'All original Rust next_purple function sites must be surveyed');



const coreComparisons=comparisonWindows(coreSearch);
const coreGradeReview=gradeReviewSitesFor(coreSearch);
for(const item of tally.values()){
 if(item.bodyBytes===null||item.bodyBytes>22000)continue;
 try{
  const decoded=inspect(item.index);
  const sites=gradeReviewSitesFor(decoded);
  if(sites.length)candidateCallees.push({index:item.index,bodyBytes:item.bodyBytes,
   sites:sites.slice(0,12)});
 }catch(error){
  // Internal code uses some instruction extensions not needed to follow the
  // original exported route. Do not turn a diagnostic into a failing patch.
  candidateCallees.push({index:item.index,unparsed:String(error?.message||error)});
 }
}
// Bounded transitive view of the ORIGINAL algorithm's helper functions.
// Never infer a talent-quality predicate from a literal 4 alone.
const queue=[{index:78,depth:0}],visited=new Set(),reachable=[],nestedGradeSites=[];
while(queue.length){
 const next=queue.shift();
 if(visited.has(next.index)||next.depth>3)continue;
 visited.add(next.index);
 try{
  const decoded=next.index===78?solver:inspect(next.index);
  reachable.push({index:next.index,depth:next.depth,bodyBytes:decoded.bodyBytes});
  const sites=gradeReviewSitesFor(decoded);
  if(sites.length)nestedGradeSites.push({index:next.index,depth:next.depth,
   sites:sites.slice(0,6),total:sites.length});
  if(next.depth<3)for(const item of decoded.calls){
   if(item.bodyBytes!==null&&item.bodyBytes<=50000&&!visited.has(item.index))
    queue.push({index:item.index,depth:next.depth+1});
  }
 }catch(error){
  reachable.push({index:next.index,depth:next.depth,
   skipped:String(error?.message||error).slice(0,100)});
 }
}
// Link original Rust source-location metadata back to native function
// indices. Source names are preserved by Rust panic/location descriptors.
// This is stronger evidence than guessing from numeric quality constants.
const sourceLocations=[];
const sourceNames=['next_purple','exchange','memo','pity','slots','replay','start',
 'vehicle_wait','ticket','luck_walk','pad'];
let dataPosition=8;
while(dataPosition<bytes.length){
 const sectionId=bytes[dataPosition++],cursor={pos:dataPosition};
 const sectionLength=readInt(cursor),sectionEnd=cursor.pos+sectionLength;
 if(sectionId===11){
  const segmentCount=readInt(cursor);
  for(let segment=0;segment<segmentCount;segment++){
   const flags=readInt(cursor);
   if(flags===2)readInt(cursor); // memory index
   let memoryOffset=null;
   if(flags===0||flags===2){
    assert.equal(bytes[cursor.pos++],65,'Expected i32.const data offset');
    memoryOffset=readInt(cursor);
    assert.equal(bytes[cursor.pos++],11,'Expected data offset end');
   }
   const length=readInt(cursor),start=cursor.pos;
   if(memoryOffset!==null){
    const data=bytes.subarray(start,start+length);
    for(const name of sourceNames){
     const needle=Buffer.from('src\\wash_search\\'+name+'.rs');
     let at=-1;
     while((at=data.indexOf(needle,at+1))>=0){
      const address=memoryOffset+at,pointer=Buffer.alloc(4);
      pointer.writeUInt32LE(address,0);
      let location=-1;
      while((location=data.indexOf(pointer,location+1))>=0){
       // Rust Location metadata stores file string pointer, filename length,
       // line and column. A match here is a source-location candidate.
       if(location+16>data.length)continue;
       const filenameLength=data.readUInt32LE(location+4);
       if(filenameLength!==needle.length)continue;
       const line=data.readUInt32LE(location+8);
       const column=data.readUInt32LE(location+12);
       if(line>100000||column>10000)continue;
       sourceLocations.push({name,address:memoryOffset+location,line,column});
      }
     }
    }
   }
   cursor.pos+=length;
  }
 }
 dataPosition=sectionEnd;
}
const bySourceAddress=new Map();
for(const item of sourceLocations){
 const list=bySourceAddress.get(item.address)||[];
 list.push(item);
 bySourceAddress.set(item.address,list);
}
const moduleFunctionMap=new Map();
for(let index=importCount;index<importCount+functions.length;index++){
 let decoded;
 try{decoded=inspect(index)}catch(_){continue}
 for(const literal of decoded.constants){
  const owners=bySourceAddress.get(literal.value);
  if(!owners)continue;
  for(const owner of owners){
   const key=owner.name,items=moduleFunctionMap.get(key)||[];
   items.push({functionIndex:index,sourceLine:owner.line,
    sourceColumn:owner.column,wasmOffset:literal.offset});
   moduleFunctionMap.set(key,items);
  }
 }
}
const originalRustModules=[...moduleFunctionMap.entries()].map(([name,refs])=>({
 name,functions:[...new Set(refs.map(x=>x.functionIndex))].sort((a,b)=>a-b),
 sourceLocationReferences:refs.length,examples:refs.slice(0,6)
})).sort((a,b)=>a.name.localeCompare(b.name));
// Recover bounded concrete call paths from the core route engine to each
// original Rust source module, avoiding name-based guesses about behavior.
const corePredecessors=new Map([[4,null]]);
const pendingCore=[4];
while(pendingCore.length){
 const current=pendingCore.shift();
 let decoded;
 try{decoded=current===4?coreSearch:inspect(current)}catch(_){continue}
 for(const call of decoded.calls){
  if(call.index<importCount||corePredecessors.has(call.index)||
     call.bodyBytes===null)continue;
  corePredecessors.set(call.index,current);
  pendingCore.push(call.index);
 }
}
function nativePathTo(index){
 if(!corePredecessors.has(index))return null;
 const chain=[];
 let current=index;
 while(current!==null){chain.push(current);current=corePredecessors.get(current)}
 return chain.reverse();
}
const moduleReachability=originalRustModules.map(module=>({
 name:module.name,
 paths:module.functions.map(fn=>({functionIndex:fn,path:nativePathTo(fn)}))
  .filter(item=>item.path!==null).sort((a,b)=>a.path.length-b.path.length)
  .slice(0,5)
}));
assert(moduleReachability.find(x=>x.name==='next_purple')
 ?.paths.some(x=>x.path.length===2&&x.path[0]===4&&x.path[1]===13),
 'Core search no longer directly calls a next_purple.rs function');
assert(moduleReachability.find(x=>x.name==='exchange')?.paths.some(x=>
 x.path.length>=2),'No native exchange module reachable from core search');

assert(originalRustModules.some(x=>x.name==='next_purple'&&
 x.functions.includes(75)),'Original next_purple native code location changed');
assert(originalRustModules.some(x=>x.name==='exchange'&&
 x.functions.includes(16)),'Original exchange native code location changed');

assert.equal(solver.bodyBytes,4055,'Native solver changed; re-characterize original yy-sim binary');
assert.equal(coreSearch.bodyBytes,20164,'Original yy-sim core search function changed');
assert.equal(coreGradeReview.length,13,'Core search immediate-four comparison sites changed');
assert.equal(solver.instructions.length,1824,'Unexpected native instruction count');
assert.equal(solver.callCount,83,'Unexpected native search call instruction count');
assert.equal(tally.size,29,'Unexpected native search dependency count');
assert.equal(gradeReviewSites.length,0,'Unexpected new direct comparison candidate');
assert(candidateCallees.some(x=>x.index===4&&x.sites?.length===13),
 'Native downstream comparison candidates changed; inspect source before edits');

assert(solver.calls.some(x=>x.index===30)&&solver.calls.some(x=>x.index===4),
 'Missing important downstream WASM calls');
console.log('YY_SIM_NATIVE_SEARCH_CALL_GRAPH',JSON.stringify({
 wrapper:{index:wrapper.index,bodyBytes:wrapper.bodyBytes,calls:wrapper.calls.map(x=>x.index)},
 adapterCoreCalls:highLevelCalls,
 coreSearch:{index:4,bodyBytes:coreSearch.bodyBytes,opcodeCount:coreSearch.instructions.length,
  comparisonsNear2or3or4:coreComparisons.length,gradeFourReviewSites:coreGradeReview.length},
 exploredCoreFunctions:exploredFromCore.size,
 nativeEventCalls,
 purpleCallOperands,
 purpleFourInputs,
 nextPurpleLocalOrigins,
 purpleGenerator:{index:13,signature:wasmFunctionSignature(13),
  instructionCount:nativePurpleGenerator.instructions.length,
  comparisonsNearGrades:purpleGeneratorCompareWindows.slice(0,30)},
 nativePurpleFunctions,
 nativeQualityReview,
 qualityDataflowCandidates:qualityDataflowCandidates.slice(0,70),
 solver:{index:solver.index,bodyBytes:solver.bodyBytes,callInstructions:solver.callCount,uniqueDependencies:tally.size},
 mostFrequent:dependencies.slice(0,15),largestDependencies:byBody,
 solverConstants:[...constantCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20),
 gradeFourCandidates:solver.constants.filter(x=>x.value===4).map(x=>x.offset),
 fourUseCandidates,
 gradeComparisonReviewSites:gradeReviewSites,
 searchQualityBoundaryCandidates,
 structuralBoundarySites,
 candidateCallees:candidateCallees.slice(0,25),
 reachableFunctions:reachable.length,
 nestedReviewSites:nestedGradeSites.sort((a,b)=>a.depth-b.depth||b.total-a.total).slice(0,35),
 originalRustModules,
 moduleReachability,
 nativeFunctionSignatures
}));
