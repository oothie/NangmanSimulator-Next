'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-exchange-beam-search.js'),'utf8'),sandbox);
const {selectBeam}=sandbox.window.YYWashExchangeBeamSearch;
const ids=[201,202,203,204];
const base={total_pills:0};
function node(goals,seq,extra={}){
 return {state:{seed:seq,total_pills:seq,total_wash:seq,exchange_count:0,
  talents:[...goals.map(id=>({id,locked:true})),...Array.from({length:4-goals.length},(_,i)=>({id:100+i,locked:false}))],
  global_vars:{a:1,b:2},...extra}};
}
const one=node([201],1),oneDuplicate=JSON.parse(JSON.stringify(one));
oneDuplicate.state.global_vars={b:2,a:1};
const two=node([201,202],2),three=node([202,203],3),none=node([],4);
const nodes=[one,oneDuplicate,one,node([201],5),two,three,none];
const selected=selectBeam(nodes,ids,base,4);
assert.equal(selected.length,4,'every distinct goal mask should have one representative');
const masks=new Set(Array.from(selected,n=>n.state.talents.filter(t=>ids.includes(t.id)).map(t=>t.id).sort().join(',')));
assert.equal(masks.size,4,'goal-mask diversity survives duplicate top candidates');
assert(masks.has('201,202')&&masks.has('202,203')&&masks.has('201')&&masks.has(''));
const tiny=selectBeam(nodes,ids,base,2);
assert.equal(tiny.length,2,'beam hard capacity must not be exceeded');
assert(tiny.every(n=>n.state.talents.filter(t=>ids.includes(t.id)).length===2),
 'small beam must prioritize the two best partially-complete masks');
const differentNative=node([201],1,{global_vars:{a:1,b:3}});
const withNative=selectBeam([one,oneDuplicate,differentNative],ids,base,3);
assert.equal(withNative.length,2,'same canonical state deduplicates, different native RNG state remains distinct');
console.log('PASS: mixed-color WASM beam goal-mask diversity, exact state identity, quota and capacity');
