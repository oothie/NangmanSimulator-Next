'use strict';
// Research-only sandbox. Never deploy any patched WASM to the user site.
// Perturb single-byte native function13 grade-comparison operands while
// keeping the ORIGINAL talent table and RNG configuration unchanged.
const cp=require('node:child_process'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const variants={
 original:[],
 gradeGate2665:[2665],
 gradeGate3332:[3332],
 gradeGate6303:[6303],
 gradeGatesPair:[2665,3332],
 gradeGatesTriple:[2665,3332,6303],
 bypassRequestGuard:[-5532]
};
function readUleb(bytes,c){
 let n=0,s=0,v;
 do{v=bytes[c.pos++];n+=(v&127)*2**s;s+=7;if(s>42)throw Error('LEB too long')}while(v&128);
 return n;
}
function functionBodyStart(bytes,index){
 let pos=8,imports=0,bodies=[];
 while(pos<bytes.length){
  const id=bytes[pos++],c={pos},length=readUleb(bytes,c),end=c.pos+length;
  if(id===2){
   const count=readUleb(bytes,c);
   for(let i=0;i<count;i++){
    for(let n=0;n<2;n++){const len=readUleb(bytes,c);c.pos+=len}
    const kind=bytes[c.pos++];
    if(kind===0){readUleb(bytes,c);imports++}
    else if(kind===1||kind===2){
     if(kind===1)c.pos++;
     const flags=readUleb(bytes,c);readUleb(bytes,c);
     if(flags&1)readUleb(bytes,c);
    }else if(kind===3)c.pos+=2;
    else throw Error('Unknown import kind '+kind);
   }
  }
  if(id===10){
   const count=readUleb(bytes,c);
   for(let i=0;i<count;i++){
    const size=readUleb(bytes,c);
    bodies.push({start:c.pos,size});
    c.pos+=size;
   }
  }
  pos=end;
 }
 assert(bodies.length>0,'original function code not found');
 const body=bodies[index-imports];
 assert(body,'native function '+index+' was not found');
 return body;
}
if(!process.argv.includes('--child')){
 const results=[];
 for(const name of Object.keys(variants)){
  const job=cp.spawnSync(process.execPath,[__filename,'--child',name],{
   cwd:root,encoding:'utf8',timeout:90000,maxBuffer:1024*1024
  });
  assert.equal(job.status,0,name+' failure: '+job.stderr+' '+job.stdout);
  const record=job.stdout.split('\n').find(x=>x.startsWith('YY_OPCODE_PROBE '));
  assert(record,'missing probe output for '+name);
  results.push(JSON.parse(record.slice('YY_OPCODE_PROBE '.length)));
 }
 const original=results.find(x=>x.name==='original');
 assert(original.preserved&&original.valid,'native baseline must remain valid');
 assert(original.purpleComplete>0,'unmodified purple baseline missing');
 assert(results.every(x=>x.valid&&x.preserved),'mutated WASM or state guard invalid');
 console.log('YY_NATIVE_GRADE_GATE_EXPERIMENT '+JSON.stringify(results));
}else{
 (async()=>{
  const name=process.argv.at(-1),offsets=variants[name];
  assert(offsets,'unknown case '+name);
  globalThis.window=globalThis;globalThis.location={protocol:'file:'};
  const asset=fs.readFileSync(path.join(root,'vendor/yysim/wasm_data.js'),'utf8');
  vm.runInThisContext(asset,{filename:'vendor/yysim/wasm_data.js',timeout:30000});
  const bytes=Buffer.from(EMBEDDED_WASM_B64,'base64');
  assert(WebAssembly.validate(bytes),'native WASM invalid before mutation');
  const body=functionBodyStart(bytes,13);
  assert(body.size>10000&&body.size<20000,'native next_purple body contract changed');
  for(const offset of offsets){
   if(offset===-5532){
    // Research-only: native core4 builds the purple-only error after
    // i32.load8_u from a request-validation flag at state+300.
    // Replace only that four-byte LOAD with drop + const(0) + nop;
    // leave all original game talent metadata and wash RNG unchanged.
    const core=functionBodyStart(bytes,4),at=core.start+5532;
    assert.deepEqual([...bytes.subarray(at,at+4)],[45,0,172,2],
     'native purple request rejection flag bytecode moved');
    bytes.set([26,65,0,1],at);
    continue;
   }
   const at=body.start+offset;
   assert.equal(bytes[at],65,'expected i32.const in native function13 at '+offset);
   assert.equal(bytes[at+1],4,'expected native threshold four at '+offset);
   assert.equal(bytes[at+2],73,'expected i32.lt_u native grade candidate at '+offset);
   bytes[at+1]=2;
  }
  const valid=WebAssembly.validate(bytes);
  assert(valid,'opcode probe produced invalid WASM');
  globalThis.__yyProbeBytes=bytes;
  let glue=fs.readFileSync(path.join(root,'vendor/yysim/core_glue.js'),'utf8');
  const old='bytes = base64ToUint8Array(EMBEDDED_WASM_B64);';
  assert(glue.includes(old),'native glue loader contract changed');
  glue=glue.replace(old,'bytes = globalThis.__yyProbeBytes;');
  vm.runInThisContext(glue,{filename:'vendor/yysim/core_glue.js',timeout:30000});
  for(const file of ['vendor/yysim/data.js','engine/yysim-native-search-guard.js']){
   vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{
    filename:file,timeout:30000});
  }
  assert(await initWasm(),'patched native WASM failed to initialize');
  assert(wasmInitEngine(TALENT_DATA,ZZ_DATA),'original talent table initialization failed');
  const original=wasmGetState();
  const state={...original,zizhi:154,seed:447882174,role_id:10044,
   talents:[{id:171,locked:false},{id:172,locked:false},
    {id:173,locked:false},{id:174,locked:false}],
   total_wash:0,total_pills:0,bag_pills:20000,has_bag_pills:true};
  assert(wasmSetState(state));
  const identity=YYWashNativeSearchGuard.canonicalJson(wasmGetState());
  const sets=[
   {label:'purple',ids:[271]},
   {label:'green-purple',ids:[184,271]},
   {label:'blue-purple',ids:[202,271]},
   {label:'3purple-green',ids:[271,268,272,184]},
   {label:'2purple-blue-green',ids:[271,268,202,184]}
  ];
  const rows=[];
  for(const x of sets){
   let raw=null,error=null;
   try{raw=YYWashNativeSearchGuard.run({
    getState:wasmGetState,setState:wasmSetState,
    search:wasmSearchWashRoutes
   },{desired_ids:x.ids,max_pad:0,horizon:30,top_n:2})}
   catch(e){error=String(e?.message||e)}
   const routes=raw?.routes||[];
   const complete=routes.filter(r=>{
    const ids=new Set((r.final_slots||[]).map(t=>Number(t.id)));
    return x.ids.every(id=>ids.has(id));
   });
   assert.equal(YYWashNativeSearchGuard.canonicalJson(wasmGetState()),identity,
    'WASM state changed in '+name+'/'+x.label);
   rows.push({label:x.label,routes:routes.length,complete:complete.length,
    cheapest:complete.length?Math.min(...complete.map(r=>Number(r.pills))):null,
    error:error||raw?.error||null});
  }
  console.log('YY_OPCODE_PROBE '+JSON.stringify({
   name,offsets,valid,preserved:true,
   purpleComplete:rows[0].complete,
   rows
  }));
 })().catch(e=>{console.error(e);process.exitCode=1});
}
