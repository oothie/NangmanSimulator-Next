'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-exchange-beam-search.js'),'utf8'),ctx);
const search=ctx.window.YYWashExchangeBeamSearch;
const clone=x=>JSON.parse(JSON.stringify(x));
const original={seed:0,total_wash:0,total_pills:0,bag_pills:200,has_bag_pills:true,
 luck_seed:0,luck_seed_inited:false,exchange_count:0,
 talents:[{id:171,locked:false},{id:172,locked:false},{id:173,locked:false},{id:197,locked:false}]};
let state=clone(original);
const rawPurple=[263,262,264,184];
const exchangeMap={263:271,262:272,264:250};
const getState=()=>clone(state),setState=s=>(state=clone(s),true);
const doWash=()=>{
 const slot=state.talents.findLastIndex(t=>!t.locked);
 if(slot<0)return {error:'no free slot'};
 const id=rawPurple[state.total_wash%rawPurple.length];
 state.talents[slot]={id,locked:false};state.total_wash++;state.total_pills+=3;state.bag_pills-=3;state.seed++;
 return {talents:clone(state.talents)};
};
const getConflicts=()=>state.talents.map((t,i)=>exchangeMap[t.id]?{index:i,can_exchange:true}:null);
const doExchange=index=>{
 const id=exchangeMap[state.talents[index]?.id];
 if(!id)return {success:false};
 state.talents[index]={id,locked:false};state.exchange_count++;
 return {success:true,exchanged_to:id};
};
(async()=>{
 const answer=await search.run({ids:[271,272,250,184],horizon:8,topN:8,
  getState,setState,doWash,getConflicts,doExchange,
  qualityFor:id=>[263,262,264,271,272,250].includes(id)?4:2,
  beamWidth:16,
  freshBranch:async input=>{state=clone(input);return getState();}});
 assert(answer.routes.length>0,'native exchange actions recover goals missed by wash-only search');
 const best=answer.routes[0];
 assert.equal(best.pills,12);
 assert.equal(best.washes,4);
 assert.equal(best.exchanges,3);
 assert.deepEqual(Array.from(best.final_slots,x=>x.id).sort((a,b)=>a-b),[184,250,271,272]);
 const ops=Array.from(best.actions,x=>x.kind);
 assert.equal(ops.filter(x=>x==='exchange').length,3);
 assert.equal(ops.filter(x=>x==='lock').length,3);
 assert.equal(ops.at(-1),'wash_to');
 assert(!best.optimal,'bounded beam must never claim proof of global optimality');
 console.log('PASS: native WASM mixed green+3 purple exchange beam, final 4 slots, 12 real pills, chronological route');
})().catch(e=>{console.error(e);process.exitCode=1});
