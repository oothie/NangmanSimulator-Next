// Green/blue/purple multi-goal native sequential search with actual host bridge.
// All simulated washes call the same real WASM wrapper signatures, not a guessed RNG.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const sourceData=fs.readFileSync(path.join(root,'vendor/yysim/data.js'),'utf8');
const sourceHost=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const sourceCatalog=fs.readFileSync(path.join(root,'engine/yysim-target-catalog.js'),'utf8');
const sourceAuto=fs.readFileSync(path.join(root,'engine/yysim-auto-search.js'),'utf8');
const sourceReplay=fs.readFileSync(path.join(root,'engine/yysim-route-replay.js'),'utf8');
const messages=[],handlers={},parent={postMessage(msg){messages.push(msg)}};
const clone=x=>JSON.parse(JSON.stringify(x));
const INITIAL={role_id:10044,seed:123,zizhi:152,str_gift:10,con_gift:20,
 has_bag_pills:true,bag_pills:1000,total_pills:0,total_wash:0,
 talents:[{id:171,locked:false},{id:173,locked:false}],luck_seed_inited:false};
let current=clone(INITIAL),failWash=false,washCalls=0;
const ctx={console,window:{addEventListener(kind,cb){handlers[kind]=cb}},
 parent,location:{origin:'https://nangman.test'},setTimeout,
 initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){return clone(current)},
 wasmSetState(state){current=clone(state);return true},
 wasmWashUntilTalentName(name,limit){
  washCalls++;
  if(failWash)return [];
  const item=Object.values(ctx.TALENT_DATA).find(row=>row.name===name);
  if(!item||limit<1)return [];
  const cap=ctx.ZZ_DATA[String(current.zizhi)].num_talent;
  if(current.talents.length<cap)current.talents.push({id:item.id,locked:false});
  else{
   const slot=current.talents.findIndex(row=>!row.locked);
   if(slot<0)return [];
   current.talents[slot]={id:item.id,locked:false};
  }
  current.seed++;current.total_wash++;current.total_pills+=3;current.bag_pills-=3;
  return [{talents:clone(current.talents)}];
 }};
vm.createContext(ctx);
vm.runInContext(sourceData,ctx);
vm.runInContext(sourceHost.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
vm.runInContext(sourceCatalog,ctx);
vm.runInContext(sourceAuto,ctx);
vm.runInContext(sourceReplay,ctx);
async function rawCall(op,payload){
 await handlers.message({origin:'https://nangman.test',source:parent,data:{
  kind:'nangman-engine-command',requestId:messages.length+1,op,payload
 }});
 return messages.at(-1);
}
async function call(op,payload){
 const msg=await rawCall(op,payload);
 if(!msg.ok)throw Error(msg.data?.error||'WASM host error');
 return msg.data;
}
(async()=>{
 await call('init');
 const groups=ctx.window.YYWashTargetCatalog;
 assert.deepEqual(Array.from(groups,x=>[x.quality,x.items.length]),[[2,22],[3,35],[4,17]]);
 for(const group of groups)for(const t of group.items){
  assert.equal(ctx.TALENT_DATA[String(t.id)].pinzhi,group.quality);
  assert.equal(ctx.TALENT_DATA[String(t.id)].name,t.name);
 }
 assert.equal((await rawCall('auto-color-search',{desiredIds:[184,184]})).ok,false);
 assert.equal((await rawCall('auto-color-search',{desiredIds:[414]})).ok,false);
 const initial=clone(current);
 const searched=await call('auto-color-search',{desiredIds:[184,185,191,248],horizon:900});
 assert.equal(searched.nativeFunction,'wasmColorSequentialSearch');
 assert.equal(searched.result.scanned,24,'4-target search explores 24 native permutations');
 assert(searched.result.routes.length>0);
 const first=searched.result.routes[0];
 assert.deepEqual(Array.from(first.order_ids).sort((a,b)=>a-b),[184,185,191,248]);
 assert.equal(first.washes,4);assert.equal(first.pills,12);assert.equal(first.exchanges,0);
 assert(first.actions.some(a=>a.kind==='open_slot'));
 assert.equal(first.final_slots.length,4);
 assert.deepEqual(current,initial,'all search permutations must restore the native WASM snapshot');
 const outcome=ctx.window.YYWashAutoSearch.routeOutcome(searched.result,searched.desiredIds);
 assert(outcome.routes.every(route=>route.complete));
 const replay=await ctx.window.YYWashRouteReplay.run({
  route:outcome.routes[0],nameIds:searched.nameIds,call
 });
 assert.equal(replay.verified,true);
 assert.equal(replay.pillsConsumed,12);
 assert.equal(current.zizhi,154);
 assert.equal(current.str_gift,initial.str_gift+200);
 assert.equal(current.con_gift,initial.con_gift+200);
 assert.deepEqual(Array.from(current.talents,x=>x.id),Array.from(first.final_slots,x=>x.id));
 await call('set-state',initial);
 assert.deepEqual(current,initial,'native replay can be undone to original save copy');
 failWash=true;
 const missing=await call('auto-color-search',{desiredIds:[184,185],horizon:100});
 assert.equal(missing.result.routes.length,0);
 assert.deepEqual(current,initial,'failure to find goals never mutates a WASM session');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('engine/yysim-target-catalog.js'));
 assert(html.includes("washEngineAutoColor"));
 assert(html.includes("auto-color-search"));
 console.log('PASS: 74 source talents, multi-color native search, 4-slot upgrade, 24 orders, exact replay, undo and no-result rollback');
})().catch(err=>{console.error(err);process.exitCode=1});
