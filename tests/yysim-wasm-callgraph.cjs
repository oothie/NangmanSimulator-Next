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
let position=8,importCount=0,functions=[],exports=[];
while(position<bytes.length){
 const id=bytes[position++],cur={pos:position},len=uleb(cur),end=cur.pos+len;
 assert(end<=bytes.length);
 if(id===2){
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
 }else if(id===7){
  const n=uleb(cur);
  for(let i=0;i<n;i++)exports.push({name:readName(cur),kind:bytes[cur.pos++],index:uleb(cur)});
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
const named=new Map(exports.filter(x=>x.kind===0).map(x=>[x.index,x.name]));
function inspect(index){
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
   if(opcode===16)calls.push({offset:at,index:value,bodyBytes: functions[value-importCount]?.size??null,name:named.get(value)||null});
  }
  else if(opcode===14){const n=uleb(cur);for(let i=0;i<=n;i++)uleb(cur)}
  else if(opcode===17||opcode===19){uleb(cur);uleb(cur)}
  else if(opcode===28){const n=uleb(cur);cur.pos+=n}
  else if(opcode>=40&&opcode<=62){uleb(cur);uleb(cur)}
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
 return {index,bodyBytes:size,callCount:calls.length,calls,constants,instructions};
}
const search=exports.find(x=>x.name==='search_wash_routes'&&x.kind===0);
assert(search,'Original WASM search export absent');
const wrapper=inspect(search.index);
assert(wrapper.calls.some(x=>x.index===78),'Native search wrapper must reach function 78');
const solver=inspect(78);
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
const gradeReviewSites=gradeReviewSitesFor(solver);
const dependencies=[...tally.values()].sort((a,b)=>b.calls-a.calls||a.index-b.index);
const byBody=[...tally.values()].sort((a,b)=>b.bodyBytes-a.bodyBytes).slice(0,12);
const candidateCallees=[];
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
assert.equal(solver.bodyBytes,4055,'Native solver changed; re-characterize original yy-sim binary');
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
 solver:{index:solver.index,bodyBytes:solver.bodyBytes,callInstructions:solver.callCount,uniqueDependencies:tally.size},
 mostFrequent:dependencies.slice(0,15),largestDependencies:byBody,
 solverConstants:[...constantCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20),
 gradeFourCandidates:solver.constants.filter(x=>x.value===4).map(x=>x.offset),
 fourUseCandidates,
 gradeComparisonReviewSites:gradeReviewSites,
 candidateCallees:candidateCallees.slice(0,25),
 reachableFunctions:reachable.length,
 nestedReviewSites:nestedGradeSites.sort((a,b)=>a.depth-b.depth||b.total-a.total).slice(0,35)
}));
