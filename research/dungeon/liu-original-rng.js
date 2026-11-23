/* Independent Liu mansion RNG forensic engine, not loaded by the website.
 * Based on recovered 60014 story/fun/35271_1.lua and the client's JHRandData LCG.
 * Recovering seed consumption is not proof of the LuaJIT pairs() item order.
 * No actual user seed, save, or hard-coded measured equipment output. */
'use strict';
const MAX_SEED=2047483645n, MASK64=(1n<<64n)-1n;
function rng(seed,bound){
 const s=BigInt(seed),b=BigInt(bound);
 if(s<1n||s>MAX_SEED||b<1n||b>2147483647n)throw Error('RNG seed/bound invalid');
 const raw=((s+b)*245109059551232n+48083817484545n)&MASK64;
 const next=(((raw>>17n)&2147483647n)%MAX_SEED)+1n;
 return {seed:Number(next),value:Number(next%b)+1};
}
const n=x=>Number(x??0);
function replay(source){
 const vars=new Map(Object.entries(source.flags||{}).map(([k,v])=>[String(k),n(v)]));
 let seed=n(source.seed);
 const trace=[],events=[];
 const get=k=>n(vars.get(String(k)));
 const set=(k,v)=>vars.set(String(k),n(v));
 const add=(k,v)=>set(k,get(k)+v);
 const draw=(bound,label)=>{
  const out=rng(seed,bound);trace.push({index:trace.length+1,label,bound,before:seed,value:out.value,after:out.seed});
  seed=out.seed;return out.value;
 };
 const win=get('win_lsby');
 // A draw may be skipped by conditions. The plan records only operations
 // actually invoked by the recovered route, not synthetic missing draws.
 if(win>6){
  const v=draw(1000,'윤무 5020');
  events.push({kind:'unique',item:5020,hit:v-win<=50&&!get('drop_5020_35260')});
 }
 let v=draw(100,'윤무 장비 여부');
 if(v<=50)draw(3,'윤무 장비 번호');
 draw(100,'윤무 색상');
 if(win>12){
  v=draw(100,'고리 8913');
  if(v-get('roll_8913_35264')<40)add('roll_8913_35264',-60);
  else add('roll_8913_35264',40);
 }
 if(win>8)draw(1000,'고리 5628');
 if(!get('8915')&&win>10){
  v=draw(100,'고리의 열쇠 8915');
  const hit=v-get('roll_8915_35264')<20;
  add('roll_8915_35264',hit?-80:20);
  set('drop_8915_35264',hit?1:0);
  if(hit)set(8915,1);
  events.push({kind:'key',item:8915,hit});
 }
 const a=Array.from({length:11},(_,i)=>get('drop_lsby_'+(i+1)));
 // No invented default probability table. Weight data is mandatory.
 if(a.every(x=>x===0))throw Error('유씨별원 재료 A 원본 가중치가 없습니다');
 const weightsB=[301,302,303,304],weightsC=[201,200,200,200,200];
 const totals={materialA:a.reduce((x,y)=>x+y,0),materialB:1210,materialC:1001};
 draw(totals.materialA,'고리 재료 A');
 draw(totals.materialB,'고리 재료 B');
 draw(totals.materialC,'고리 재료 C');
 draw(3,'고리 재료 위치');
 v=draw(100,'고리 장비 여부');
 if(v<=50)draw(4,'고리 장비 번호');
 draw(100,'고리 색상');
 if(win>20){
  v=draw(100,'이뢰운 8914');
  add('roll_8914_35268',v-get('roll_8914_35268')<45?-55:45);
 }
 if(win>12){
  v=draw(100,'이뢰운 8917');
  add('roll_8917_35268',v-get('roll_8917_35268')<30?-70:30);
 }
 const roll35268=get('roll_35268');
 const materialWeights=[120-roll35268,roll35268];
 if(materialWeights.some(x=>x<0)||materialWeights.every(x=>x===0))
  throw Error('이뢰운 소재 원본 가중치가 잘못됐습니다');
 v=draw(120,'이뢰운 소재');
 // LuaJIT pairs() table order still unresolved: only seed consumption is certain.
 events.push({kind:'material',weights:materialWeights,roll:v,selected:'unknown-luajit-pairs-order'});
 v=draw(100,'이뢰운 장비 여부');
 if(v<=50)draw(4,'이뢰운 장비 번호');
 draw(100,'이뢰운 색상');
 return {endSeed:seed,trace,events,weights:{a,weightsB,weightsC,materialWeights,totals},
  flags:Object.fromEntries(vars),verifiedItemSequence:false,verifiedColorSequence:false};
}
module.exports={rng,replay};
