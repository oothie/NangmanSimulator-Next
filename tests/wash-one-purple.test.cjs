// node --test tests/wash-one-purple.test.cjs
// Mocked original WASM API: tests goal routing, slot opening, state rollback,
// and one-purple fallback. Not a proof of a globally minimal in-game route.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,
 '../engine/yysim-purple-anchor-mixed.js'),'utf8');
const window={};vm.runInNewContext(code,{window,setTimeout,Promise,console});
const api=window.YYWashPurpleAnchorMixed;
const talents={
 101:{name:'자맥',pinzhi:4,type:1},
 201:{name:'녹맥1',pinzhi:2,type:2},
 301:{name:'파맥1',pinzhi:3,type:3},
 401:{name:'녹맥2',pinzhi:2,type:4},
 501:{name:'파맥2',pinzhi:3,type:5},
 601:{name:'녹맥3',pinzhi:2,type:6},
 701:{name:'자맥2',pinzhi:4,type:7},
 801:{name:'자맥3',pinzhi:4,type:8}
};
const sequences=[
 [101,201],[101,201,301],[101,201,301,401],
 [101,201,401,601],[101,301,501,201],
 [101,701,201],[101,701,201,301],[101,701,801,201]
];
for(const ids of sequences){
 test('valid mixed goal '+ids.join('-'),()=>{const shape=api.requestShape(ids,talents);
  assert.ok(shape);assert.equal(shape.purple.length+shape.colors.length,ids.length);
 });
}
for(const ids of sequences.filter(ids=>ids.filter(id=>talents[id].pinzhi===4).length===1)){
 for(const purpleExists of [true,false]){
 test('replay one-purple '+ids.join('-')+' purpleExists='+purpleExists,async()=>{
  const originalTalents=purpleExists?[{id:101,locked:true}]:[];
  let state={zizhi:150+originalTalents.length,
    talents:originalTalents,total_wash:0,total_pills:0,
    str_gift:0,con_gift:0,bag_pills:100000,has_bag_pills:true};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const getState=()=>clone(state);
  const setState=x=>{state=clone(x);return true};
  const doWash=()=>{
   const next=ids.find(id=>!state.talents.some(t=>t.id===id));
   if(state.talents.length<state.zizhi-150&&next!=null)
    state.talents.push({id:next,locked:false});
   state.total_wash++;state.total_pills+=state.zizhi-150;
   return {ok:true};
  };
  const result=await api.run({desiredIds:ids,maxPad:0,horizon:30,topN:8,
   talents,getState,setState,doWash,exchangeTalent:()=>({error:true}),
   search:()=>({routes:[]}),guard:{
    run:()=>({routes:[],scanned:0}),
    statesEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)
   }});
  assert.ok(result.routes.length>0,result.error);
  assert.deepEqual([...result.routes[0].final_slots.map(t=>t.id)].sort((a,b)=>a-b),
   [...ids].sort((a,b)=>a-b));
  assert.deepEqual(state.talents,originalTalents);
 });
 }
}
test('reject conflicts and non-mixed requests',()=>{
 assert.equal(api.requestShape([201,301],talents),null);
 assert.equal(api.requestShape([101,201,201],talents),null);
 assert.equal(api.requestShape([101,701,801,201,301],talents),null);
});
