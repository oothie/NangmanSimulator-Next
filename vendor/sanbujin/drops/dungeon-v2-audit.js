/* Experimental v2 dungeon RNG engines.
 * Source engine replays yy-sim operation definitions with explicit phases.
 * Native engine executes recovered Sanbujin functions with a traced state.
 * These engines do not share branch-selection logic or silently borrow each
 * other's predictions. Real-game accuracy requires independent verification. */
(function(root){
'use strict';
const num=x=>Number(x)||0;
const npcId=e=>Number(e?.sourceNpc||String(e?.id||'').match(/drop_(\d+)_equip/)?.[1]||0);
const npcOf=(d,n)=>d.npcs.find(x=>Number(x.id)===Number(n));
const equipmentFor=(catalog,d,n)=>catalog.find(e=>npcId(e)===Number(n)&&
 (root.SBJDungeonYYAdapter?.findSource(e)?.d.id===d.id))||
 catalog.find(e=>npcId(e)===Number(n))||null;
const longForm=(item,color,extra={})=>({item:num(item),color:item?num(color):0,...extra});
const winByDungeon={byj:'win_byj',dcy:'win_dcy',lsby:'win_lsby',
 ywf:'win_ywf',byjzt:'win_byjzt'};
function finishDungeon(runtime,plan,index){
 const current=plan[index],next=plan[index+1];
 if(!current||next?.dungeon===current.dungeon)return;
 const counter=winByDungeon[current.dungeon.id];
 if(counter)runtime.state.add(counter,1);
}
function createRuntime(input){
 const currents=new Map(),flags=new Map(input.flags||[]),temp=new Map(),trace=[];
 const stateOf=key=>currents.has(key)?currents.get(key):num(input.seeds?.[key]);
 const usable=root.SBJWildDrop.usable;
 function roll(key,bound,context){
  const before=stateOf(key);
  if(!usable(before))throw Error('시드 누락: '+key);
  if(!usable(bound))throw Error('잘못된 RNG 범위: '+String(bound));
  const x=root.SBJWildDrop.draw(before,bound);
  currents.set(key,x.seed);
  trace.push({key,before,after:x.seed,bound,value:x.value,context});
  return x.value;
 }
 function pick(key,weights,context){
  const total=weights.reduce((a,b)=>a+num(b),0);
  if(total<=0)throw Error('잘못된 가중치');
  const v=roll(key,total,context||'가중치 선택');
  let remain=v;
  for(let i=0;i<weights.length;i++)if((remain-=num(weights[i]))<=0)return i;
  throw Error('가중치 경계 계산 실패');
 }
 const scope=where=>where==='temp'?temp:flags;
 const state={level:num(input.level),
  get:(key,where)=>num(scope(where).get(String(key))),
  set:(key,v,where)=>{scope(where).set(String(key),num(v))},
  add:(key,v,where)=>{const map=scope(where);const name=String(key);
    map.set(name,num(map.get(name))+num(v))},
  branch:key=>{if(!flags.has(String(key)))throw Error('분기 정보 누락: '+key);
    return num(flags.get(String(key)))},
  draw:(key,bound)=>roll(key,bound,'산부진 원본 draw'),
  pick:(key,weights)=>pick(key,weights,'산부진 원본 pick')};
 return {roll,pick,state,flags,trace,currents,checkpoint:()=>({
  traceLength:trace.length,currents:new Map(currents),flags:new Map(flags),
  temp:new Map(temp)}),
  rollback:snapshot=>{
   currents.clear();for(const [k,v] of snapshot.currents)currents.set(k,v);
   flags.clear();for(const [k,v] of snapshot.flags)flags.set(k,v);
   temp.clear();for(const [k,v] of snapshot.temp)temp.set(k,v);
   trace.length=snapshot.traceLength;
  }
 };
}
function nativeRoutes(){
 const found=[],seen=new Set();
 for(const model of Object.values(root.SBJDungeonOrange||{})){
  const run=model?.run;
  if(typeof run!=='function'||seen.has(run))continue;
  seen.add(run);
  const code=Function.prototype.toString.call(run);
  const ids=[...new Set([...code.matchAll(/drop_(\d+)_equip/g)].map(x=>Number(x[1])))];
  if(ids.length)found.push({ids,run});
 }
 return found;
}
function native(input,plan,catalog,options={}){
 const runtime=createRuntime(input),routes=nativeRoutes(),out=[];
 const owner=root.SBJDungeonUniqueOwnership;
 owner?.preventExisting(input,runtime.flags,options);
 for(let i=0;i<plan.length;){
  const entry=plan[i],id=Number(entry.npc.id);
  const selected=routes.filter(r=>r.ids[0]===id&&r.ids.every((x,k)=>
    Number(plan[i+k]?.npc.id)===x)).sort((a,b)=>b.ids.length-a.ids.length)[0];
  if(!selected){
   out.push({npcId:id,...longForm(0,0),supported:false,
    reason:'산부진 원본 실행 함수 없음',trace:[]});i++;continue;
  }
  const checkpoint=runtime.checkpoint();
  owner?.preventExisting(input,runtime.flags,options);
  const before=new Map(runtime.flags),traceStart=runtime.trace.length;
  let fail='';
  try{selected.run(runtime.state)}catch(e){fail=String(e?.message||e)}
  if(fail){
   runtime.rollback(checkpoint);
   for(let j=0;j<selected.ids.length;j++)out.push({npcId:selected.ids[j],
    ...longForm(0,0),supported:false,reason:fail,trace:[]});
   i+=selected.ids.length;continue;
  }
  const operations=runtime.trace.slice(traceStart);
  for(let j=0;j<selected.ids.length;j++){
   const e=plan[i+j],npc=Number(e.npc.id),event=equipmentFor(catalog,e.dungeon,npc);
   const count=runtime.state.get('drop_'+npc+'_equip');
   const weaponCount=runtime.state.get('drop_'+npc+'_weapon');
   let item=0;
   if(count>0)item=event?.equip?.ids?.[count-1]||0;
   else if(weaponCount>0)item=event?.weapon?.ids?.[weaponCount-1]||0;
   const specials=(e.dungeon.ops||[]).filter(op=>op.t==='uniq'&&
     Number(op.npc)===npc&&runtime.state.get(op.flag)===1&&num(before.get(op.flag))!==1)
    .map(op=>num(op.item));
   const allowed=owner?owner.filterRewards(input,specials,options):specials;
   out.push({npcId:npc,...longForm(item,runtime.state.get('drop_'+npc+'_color')),
    supported:true,mode:'native-v2',specialDrops:allowed,
    trace:j===selected.ids.length-1?operations:[],
    routeLength:selected.ids.length,sourceFunction:selected.run.name});
  }
  finishDungeon(runtime,plan,i+selected.ids.length-1);
  i+=selected.ids.length;
 }
 return {rows:out,trace:runtime.trace,finalSeeds:Object.fromEntries(runtime.currents),
  finalFlags:new Map(runtime.flags)};
}
function source(input,plan,options={}){
 const runtime=createRuntime(input),rows=[],ownership=root.SBJDungeonUniqueOwnership;
 for(const entry of plan){
  const d=entry.dungeon,npc=entry.npc,ops=d.ops||[],id=Number(npc.id),
    begin=runtime.trace.length;
  let item=0,color=0,reason='',kind='miss';
  // The display data groups all skr operations before all uniq operations.
  // Recover the within-boss order, instead of interpreting the global list
  // order as execution order. Unlisted extra material/story draws remain unknown.
  const special=ops.filter(op=>op.t==='uniq'&&Number(op.npc)===id);
  try{
   for(const op of special){
    const allowed=ownership?.blocked(input,op.item,options);
    // Drawing a failed unique attempt can still consume RNG, even if owned.
    // This is only a source-data hypothesis; source lacks conditional gates.
    if(op.key&&num(op.hi)>=num(op.lo)&&num(op.hi)>0)
      runtime.roll(op.key,num(op.hi)-num(op.lo)+1,'yy-sim 전용 보상 후보 '+op.item);
    if(allowed)continue;
   }
   const skr=ops.filter(op=>op.t==='skr'&&
    (op.bs||[]).some(b=>Number(b.npc)===id));
   let ordinary=false;
   for(const op of skr){
    const current=(op.bs||[]).filter(b=>Number(b.npc)===id);
    const nonColor=current.filter(b=>['miss','weapon','equip'].includes(b.kind));
    const colors=current.filter(b=>b.kind==='color');
    if(nonColor.length){
     ordinary=true;
     const selected=nonColor[runtime.pick(op.key,nonColor.map(b=>b.w),'yy-sim 일반 드랍 여부')];
     kind=selected.kind;
     if(kind!=='miss'){
      const pool=npc[kind]||[];
      if(pool.length)item=num(pool[runtime.roll(op.key,pool.length,'yy-sim 장비 ID')-1]);
      else reason='장비 후보 풀 없음';
     }
    }
    // The native Dcy script nests its quality roll inside equipment hit,
    // whereas Byj/Lsby scripts roll quality unconditionally.
    if(colors.length&&(!nonColor.length||item)){
     const chosen=colors[runtime.pick(op.key,colors.map(b=>b.w),'yy-sim 색상')];
     color=num(chosen.color);
    }
   }
   if(!ordinary)reason='일반 장비 분기 데이터 없음';
  }catch(e){reason=String(e.message||e)}
  rows.push({npcId:id,...longForm(item,color),kind,supported:!reason,
   reason,mode:'source-v2',trace:runtime.trace.slice(begin),
   caveat:'yy-sim 보상 테이블에는 게임의 전체 특수 조건/재료 난수 호출이 없음'});
  finishDungeon(runtime,plan,plan.indexOf(entry));
 }
 return {rows,trace:runtime.trace,finalSeeds:Object.fromEntries(runtime.currents),
  finalFlags:new Map(runtime.flags)};
}
const fixture=Object.freeze({
 byj:[{npc:35219,item:4609,color:3},{npc:35214,item:5009,color:1},
  {npc:35221,item:4009,color:1}],
 dcy:[{npc:40372,item:0,color:0},{npc:40373,item:4009,color:2},
  {npc:40374,item:0,color:0}],
 lsby:[{npc:35260,item:0,color:0},{npc:35264,item:5209,color:2},
  {npc:35268,item:4209,color:2}]
});
function compareMeasured(rows,expected){
 const actual=new Map((expected||[]).map(x=>[num(x.npc),x]));
 return rows.filter(r=>actual.has(r.npcId)).map(r=>{
  const check=actual.get(r.npcId);
  return {npcId:r.npcId,expected:check,observed:{item:r.item,color:r.color},
    itemMatch:r.supported&&num(r.item)===check.item,
    colorMatch:r.supported&&num(r.color)===check.color,
    exact:r.supported&&num(r.item)===check.item&&num(r.color)===check.color,
    supported:r.supported,reason:r.reason||''};
 });
}
function planDungeons(ids){
 const dungeons=root.DAILY_DATA?.dungeons||[];
 return ids.flatMap(id=>{
  const dungeon=dungeons.find(d=>d.id===id);
  if(!dungeon)throw Error('관문 정보 없음: '+id);
  return (dungeon.npcs||[]).map(npc=>({dungeon,npc}));
 });
}
root.SBJDungeonV2={createRuntime,source,native,nativeRoutes,planDungeons,fixture,compareMeasured};
})(window);
