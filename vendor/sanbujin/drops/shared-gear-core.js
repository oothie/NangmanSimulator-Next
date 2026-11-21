/* Experimental chronological planner for shared per-item equipment receipt order.
 * Uses already-implemented wild and dungeon branch predictors. It does not
 * manufacture the missing Rnds.Eds final refinement/mangjeong sequence. */
(function(root){
'use strict';
const GEAR90=[4009,4209,4409,4609,4809,4811,5009,5015,5209,5213,5409,5420,5609,5616];
const gear90=new Set(GEAR90);
function merge(field,dungeon,order){
 if(!Array.isArray(field)||!Array.isArray(dungeon)||
    !['field-first','dungeon-first','alternate'].includes(order))
  throw Error('필드·관문 보상 호출 순서가 올바르지 않습니다');
 const fs=field.map((row,i)=>({source:'field',round:i+1,...row}));
 const ds=dungeon.map((row,i)=>({source:'dungeon',round:i+1,...row}));
 let events=[];
 if(order==='field-first')events=fs.concat(ds);
 if(order==='dungeon-first')events=ds.concat(fs);
 if(order==='alternate'){
  for(let n=0;n<Math.max(fs.length,ds.length);n++){
   if(fs[n])events.push(fs[n]);
   if(ds[n])events.push(ds[n]);
  }
 }
 const receipt=new Map(),equipment=[];
 for(const [index,event] of events.entries()){
  const item=Number(event.source==='field'?event.itemId:event.item);
  const color=Number(event.color);
  if(!gear90.has(item)||!Number.isInteger(color)||color<1||color>4)continue;
  const inPlan=(receipt.get(item)||0)+1;
  receipt.set(item,inPlan);
  equipment.push({step:index+1,source:event.source,round:event.round,
   itemId:item,color,inPlan,kind:event.kind||'',
   status:'계획 내 동일 장비 획득 회차 · 실제 이전 획득 이력 미포함'});
 }
 return {events:events.length,equipment,byItem:[...receipt].map(([id,count])=>({id,count})),
  total90:equipment.length,mode:order,qualityUnverified:true};
}
function project(save,target,event,fieldCount,dungeonCount,order,equipment){
 if(!save||typeof save!=='object'||!target||target.kind!=='story'||Number(target.lv)<90)
  throw Error('90레벨 이상 필드 특수몹 보상 함수를 선택하세요');
 if(!event?.outer||!event?.outerSeed)throw Error('일반 장비 드랍이 있는 관문 우두머리를 선택하세요');
 if(!Number.isInteger(fieldCount)||fieldCount<1||fieldCount>100||
    !Number.isInteger(dungeonCount)||dungeonCount<1||dungeonCount>100)
  throw Error('필드·관문 보상 계산은 각각 1~100회까지 실행합니다');
 const wild=root.SBJWildDrop,dungeon=root.SBJDungeonDrop;
 const fieldState=wild.open(save,target),dungeonState=dungeon.open(save);
 if(!wild.usable(fieldState.seed)||dungeon.missing(dungeonState,event).length)
  throw Error('선택한 필드 또는 관문 보상 함수의 저장 난수 시드가 없습니다');
 const field=wild.predict(fieldState,target,{pad:0,count:fieldCount,
  time:0,interval:30,bait:'normal'},equipment||{});
 const dungeonRows=dungeon.predict(dungeonState,event,dungeonCount);
 return {...merge(field,dungeonRows,order),fieldCount,dungeonCount,
  fieldNpc:target.npcId,dungeonBoss:event.boss,dungeonId:event.id};
}
root.SBJSharedGearCore={merge,project,GEAR90};
})(window);
