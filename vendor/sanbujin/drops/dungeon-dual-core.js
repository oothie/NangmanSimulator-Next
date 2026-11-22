/* Two independent dungeon forecasters. yy-sim consumes its original
 * DAILY_DATA skr operation order; Sanbujin replays its recovered native script.
 * Never conflate their RNG outputs or mutate imported save data. */
(function(root){
'use strict';
const valid=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
const num=x=>Number(x)||0;
const all=()=>root.DAILY_DATA?.dungeons||[];
const npcId=event=>Number(String(event?.id||'').match(/^drop_(\d+)_equip$/)?.[1]||event?.sourceNpc||0);
const sourceFor=event=>root.SBJDungeonYYAdapter?.findSource(event)||null;
const sourceDungeon=event=>{
 const match=sourceFor(event);
 return match?.d||all().find(d=>d.name===event?.sourceDungeon)||null;
};
function orderedEvents(catalog,dungeon){
 const byId=new Map((catalog||[]).filter(e=>e.outer).map(e=>[npcId(e),e]));
 const items=[];
 for(const npc of dungeon.npcs||[]){
  const event=byId.get(Number(npc.id));
  // Include bosses without a general-equipment table as explicitly unmodeled.
  items.push({npc,event:event||null});
 }
 return items;
}
function yyPredict(input,dungeon,entries){
 const seeds=new Map(),missingKeys=new Set();
 const draw=(key,weights)=>{
  const current=seeds.has(key)?seeds.get(key):num(input?.seeds?.[key]);
  if(!valid(current)){missingKeys.add(key);return null}
  const hit=root.SBJWildDrop.choose(current,weights);
  seeds.set(key,hit.seed);
  return hit.index;
 };
 const uniform=(key,max)=>{
  const current=seeds.has(key)?seeds.get(key):num(input?.seeds?.[key]);
  if(!valid(current)||!valid(max)){missingKeys.add(key);return null}
  const hit=root.SBJWildDrop.draw(current,max);
  seeds.set(key,hit.seed);
  return hit.value;
 };
 const rows=[];
 for(const {npc} of entries){
  const npcOps=(dungeon.ops||[]).filter(op=>op.t==='skr'&&
   (op.bs||[]).some(b=>Number(b.npc)===Number(npc.id)));
  let kind='none',item=0,color=0,unavailable=false,hasOrdinary=false,
      missingType='';
  for(const op of npcOps){
   const branches=(op.bs||[]).filter(b=>Number(b.npc)===Number(npc.id));
   for(const subset of [
     branches.filter(b=>['miss','equip','weapon'].includes(b.kind)),
     branches.filter(b=>b.kind==='color')
   ]){
    if(!subset.length)continue;
    const selected=draw(op.key,subset.map(b=>num(b.w)));
    if(selected===null){unavailable=true;missingType='해당 보스 난수 시드 누락';break}
    const branch=subset[selected];
    if(branch.kind==='color'){color=Number(branch.color)||0;continue}
    hasOrdinary=true;
    kind=branch.kind==='miss'?'none':branch.kind;
    const pool=npc[kind]||[];
    if(kind!=='none'&&pool.length){
     const ix=uniform(op.key,pool.length);
     if(ix===null){unavailable=true;missingType='장비 선택 시드 누락';break}
     item=Number(pool[ix-1])||0;
    }else if(kind!=='none'){unavailable=true;missingType='yy-sim 장비 후보 목록 미등록'}
   }
   if(unavailable)break;
  }
  rows.push({npcId:Number(npc.id),boss:npc.name,item,
   color:item?color:0,kind,model:'yy-sim',missing:unavailable,
   supported:hasOrdinary,reason:missingType,originalOperations:npcOps.length,
   specialCandidates:(dungeon.ops||[]).filter(op=>op.t==='uniq'&&
      Number(op.npc)===Number(npc.id)).map(op=>Number(op.item))});
 }
 return {source:'yy-sim',dungeon:dungeon.name,rows,
  missingSeeds:[...missingKeys],details:'원본 yy-sim 보상 가중치/실행 목록을 순서대로 계산. 전용 보상의 조건식은 별도 판정.'};
}
function sanPredict(input,entries,originalCatalog,dungeon){
 const lookup=new Map((originalCatalog||[]).filter(e=>e.outer).map(e=>[npcId(e),e]));
 const duplicateIds=new Set();
 for(const d of all()){
  for(const npc of d.npcs||[]){
   if(all().some(other=>other!==d&&(other.npcs||[]).some(n=>Number(n.id)===Number(npc.id))))
    duplicateIds.add(Number(npc.id));
  }
 }
 const withOriginal=entries.map(({npc,event})=>{
  const raw=lookup.get(Number(npc.id));
  // Do not silently substitute the normal difficulty's recovered native
  // source for the same NPC ID in a different yy-sim dungeon variant.
  const variantMismatch=!!raw&&duplicateIds.has(Number(npc.id))&&
    sourceDungeon(raw)?.id!==dungeon.id;
  return {npc,event:variantMismatch?null:(raw||event||null),
   original:!!raw&&!variantMismatch,variantMismatch};
 });
 const supported=withOriginal.filter(x=>x.event?.outer);
 const missing=supported.filter(x=>root.SBJDungeonDrop.missing(input,x.event).length);
 let prediction=null,error=null;
 if(supported.length&&!missing.length){
  try{prediction=root.SBJDungeonDrop.predictSequence(input,supported.map(x=>x.event))}
  catch(e){error=String(e?.message||e)}
 }
 const map=new Map();
 if(prediction)for(let i=0;i<supported.length;i++)map.set(Number(supported[i].npc.id),prediction[i]);
 const rows=withOriginal.map(({npc,event,original,variantMismatch})=>{
  const item=map.get(Number(npc.id));
  const unavailable=!!event&&root.SBJDungeonDrop.missing(input,event).length>0;
  return {npcId:Number(npc.id),boss:npc.name,
   item:item?.item||0,color:item?.color||0,kind:item?.kind||'none',
   specialDrops:item?.specialDrops||[],nativeReplay:!!item?.nativeReplay,
   missing:unavailable||!!error,supported:!!item,
   original:original,reason:item?.nativeReason||
    (unavailable?'해당 보스 난수 시드 누락':
      variantMismatch?'해당 난이도 산부진 원본 미복원':
      !event?'산부진 보스 복원 자료 없음':error||'')};
 });
 return {source:'sanbujin',rows,missingSeeds:[...new Set(missing.flatMap(x=>
    root.SBJDungeonDrop.missing(input,x.event)))],error,
    details:'산부진 복원 보상 함수 또는 독립 난수 테이블 사용. 지원 구간만 보스 전체 순서 반영.'};
}
function compare(input,dungeon,catalog,originalCatalog){
 if(!dungeon||!input)throw Error('관문 및 세이브 정보를 확인하세요');
 const entries=orderedEvents(catalog,dungeon);
 return {dungeon:dungeon.name,dungeonId:dungeon.id,
  bosses:entries.map(x=>({id:x.npc.id,name:x.npc.name})),
  yy:yyPredict(input,dungeon,entries),
  san:sanPredict(input,entries,originalCatalog)};
}
root.SBJDungeonDual={compare,sourceDungeon,orderedEvents,yyPredict,sanPredict};
})(window);
