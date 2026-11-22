'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(inline.length,1);
const sent=[],state={seed:1234,global_vars:{b:2,a:1},talents:[]},listeners={};
const fakeParent={postMessage:x=>sent.push(x)};
const fakeWindow={
 YYWashTargetCatalog:[{quality:2,items:[{id:184}]},{quality:3,items:[{id:202}]},
  {quality:4,items:[{id:271},{id:268},{id:272}]}],
 addEventListener:(name,fn)=>listeners[name]=fn
};
const TALENT_DATA={'184':{id:184,pinzhi:2,type:177,name:'气息浑厚'},
 '202':{id:202,pinzhi:3,type:202,name:'四两拨千斤'},
 '271':{id:271,pinzhi:4,type:271,name:'转世金仙'},
 '268':{id:268,pinzhi:4,type:268,name:'天生神力'},
 '272':{id:272,pinzhi:4,type:272,name:'岿然顶天'}};
let requestCount=0,returnCompleteMixed=false;
// Node VM has no browser Worker. Mock only the transport boundary; the
// separate Chromium regression executes the real Worker + original WASM.
class FakeWorker {
 constructor(){this.onmessage=null;this.onerror=null;this.onmessageerror=null;this.stopped=false}
 postMessage(packet){
  Promise.resolve().then(()=>{
   if(this.stopped)return;
   const raw=ctx.wasmSearchWashRoutes(packet.request);
   const ids=packet.request.desired_ids;
   const isMixed=ids.some(id=>TALENT_DATA[String(id)].pinzhi!==4);
   const complete=raw.routes.filter(route=>{
    const present=new Set(route.final_slots.map(item=>Number(item.id)));
    return ids.every(id=>present.has(id));
   }).length;
   const diagnostics={isMixed,returned:raw.routes.length,complete,
    incomplete:raw.routes.length-complete,
    unsupportedNotProven:isMixed&&complete===0};
   this.onmessage?.({data:{kind:'nangman-native-auto-result',
    requestId:packet.requestId,ok:true,data:{
     result:raw,nativeDiagnostics:diagnostics,nativeFunction:'wasmSearchWashRoutes'
    }}});
  });
 }
 terminate(){this.stopped=true}
}

const ctx={window:fakeWindow,parent:fakeParent,location:{origin:'https://local.test'},
 TALENT_DATA,ZZ_DATA:{},EMBEDDED_WASM_B64:'fixture',setTimeout,clearTimeout,Worker:FakeWorker,
 initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState:()=>JSON.parse(JSON.stringify(state)),
 wasmSetState:newState=>{Object.assign(state,JSON.parse(JSON.stringify(newState)));return true},
 wasmSearchWashRoutes:req=>{
  requestCount++;
  const routes=req.desired_ids.includes(184)&&!returnCompleteMixed?[
   {pills:7,washes:1,pad:0,exchanges:0,
    final_slots:[{id:271},{id:202}]}]:
   [{pills:6,washes:1,pad:0,exchanges:0,
    final_slots:req.desired_ids.map(id=>({id}))}];
  return {routes};
 }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/yysim-native-search-guard.js'),'utf8'),ctx);
vm.runInContext(inline[0],ctx,{filename:'engine-host-inline.js'});
async function message(op,payload){
 const requestId=sent.length+1;
 await listeners.message({origin:ctx.location.origin,source:fakeParent,
  data:{kind:'nangman-engine-command',requestId,op,payload}});
 const response=sent.at(-1);
 assert.equal(response.requestId,requestId);
 assert.equal(response.ok,true,JSON.stringify(response.data));
 return response.data;
}
(async()=>{
 await message('init');
 const mixed=await message('auto-search',{desiredIds:[271,202,184],maxPad:0,horizon:90,topN:3});
 assert.equal(mixed.nativeFunction,'wasmSearchWashRoutes');
 assert.equal(mixed.nativeDiagnostics.isMixed,true);
 assert.equal(mixed.nativeDiagnostics.returned,1);
 assert.equal(mixed.nativeDiagnostics.complete,0,'Transient native route is not a final success');
 assert.equal(mixed.nativeDiagnostics.incomplete,1);
 assert.equal(mixed.nativeDiagnostics.unsupportedNotProven,true);
 assert.equal(mixed.result.routes[0].pills,7,'Preserve original route for diagnostics');
 const purple=await message('auto-search',{desiredIds:[271,268,272],maxPad:0,horizon:90,topN:3});
 assert.equal(purple.nativeDiagnostics.isMixed,false);
 assert.equal(purple.nativeDiagnostics.complete,1);
 returnCompleteMixed=true;
 const completed=await message('auto-search',{desiredIds:[271,202,184],maxPad:0,horizon:90,topN:3});
 assert.equal(completed.nativeDiagnostics.isMixed,true);
 assert.equal(completed.nativeDiagnostics.complete,1);
 assert.equal(completed.nativeDiagnostics.incomplete,0);
 assert.equal(completed.result.routes[0].pills,6,'Native mixed complete route cost preserved');
 assert.equal(requestCount,3,'Only the original WASM was invoked, once per request');
 assert.equal(state.seed,1234);
 assert.equal(state.global_vars.a,1);
 // Native type overlap is impossible regardless of selected color.
 const counter=requestCount;
 TALENT_DATA['271'].type=177;
 await listeners.message({origin:ctx.location.origin,source:fakeParent,
  data:{kind:'nangman-engine-command',requestId:98,op:'auto-search',
   payload:{desiredIds:[184,271],maxPad:0,horizon:90,topN:3}}});
 assert.equal(sent.at(-1).ok,false,'Same-family green/purple request must be rejected');
 assert.equal(requestCount,counter,'Impossible goal must not invoke expensive WASM search');
 TALENT_DATA['271'].type=271;
 const bad=await listeners.message({origin:ctx.location.origin,source:fakeParent,
  data:{kind:'nangman-engine-command',requestId:99,op:'auto-search',
   payload:{desiredIds:[184,999],maxPad:0,horizon:90,topN:3}}});
 assert.equal(sent.at(-1).ok,false,'Unknown/dummy talent must be rejected');
 console.log('PASS: original WASM accepts green blue purple requests, but partial final slots are not successes');
})().catch(error=>{console.error(error);process.exitCode=1});
