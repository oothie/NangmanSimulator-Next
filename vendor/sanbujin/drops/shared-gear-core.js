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
function compareOrders(field,dungeon){
 const labels=['field-first','dungeon-first','alternate'];
 const models=labels.map(order=>merge(field,dungeon,order));
 const ids=[...new Set(models.flatMap(model=>model.byItem.map(item=>item.id)))].sort((a,b)=>a-b);
 return ids.map(id=>({
  itemId:id,
  count:models[0].byItem.find(x=>x.id===id)?.count||0,
  orders:models.map((model,index)=>{
   const sequence=model.equipment.filter(x=>x.itemId===id);
   return {order:labels[index],firstSource:sequence[0]?.source||null,
    firstStep:sequence[0]?.step??null,
    colorSequence:sequence.map(x=>x.color),
    sources:sequence.map(x=>x.source)};
  })
 }));
}
function traceEds(equipment,eds,equipCatalog={}){
 // Source-verified for five original equipment receipts (5009×2, 4609×2,
 // 5420×1). These are creation-seed hypotheses, not final refinement values.
 if(!Array.isArray(equipment))throw Error('드랍 장비 목록이 필요합니다');
 const saved=eds&&typeof eds==='object'?eds:{};
 const states=new Map(),seen=new Map(),output=[];
 const draw=root.SBJWildDrop?.draw,usable=root.SBJWildDrop?.usable;
 for(const event of equipment){
  const id=Number(event.itemId),key=String(id);
  const supplied=saved[key];
  const value=Number(supplied?.Value??supplied?.value??supplied?.V??supplied?.v??supplied);
  let seed=states.has(key)?states.get(key):(usable?.(value)?value:null);
  const drawNo=(seen.get(key)||0)+1;seen.set(key,drawNo);
  if(seed==null){
   output.push({...event,edsDraw:drawNo,edsKnown:false,
    creationSeedStatus:'장비 ID별 Eds 미확인 · 계산하지 않음'});
   continue;
  }
  const roll=draw(seed,99999999);
  states.set(key,roll.seed);
  // Observed in all 5 historical receipts:
  // MJSeed=floor(Whale draw value/10)+123, CZSeed=MJSeed+333.
  const mjSeed=Math.floor(roll.value/10)+123,czSeed=mjSeed+333;
  const config=equipCatalog?.[key];
  // The same original initial-affix generator used by wild equipment
  // applies to the externally supplied quality of ordinary 90-grade gear.
  const initialAffixes=config&&Number(event.color)>1&&Number(event.color)<=4?
   root.SBJWildDrop.generateAffixes(config,Number(event.color),roll.value):[];
  output.push({...event,edsDraw:drawNo,edsKnown:true,
   mjSeed,czSeed,edsAfter:roll.seed,initialAffixes,
   creationSeedStatus:'Eds 생성 순서·최초 추가 옵션 계산 (실측 5건 일치 · 최종 정련/망정 미연결)'});
 }
 return {equipment:output,finalEds:Object.fromEntries(states)};
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
 const plan=merge(field,dungeonRows,order);
 const alternatives=compareOrders(field,dungeonRows);
 const data=Array.isArray(save)?save[0]:save;
 const eds=data?.Rnds?.Eds??data?.rnds?.eds??{};
 const hasPerItemSeed=id=>{
  const value=eds[String(id)];
  const number=Number(value?.Value??value?.value??value?.V??value?.v??value);
  return Number.isSafeInteger(number)&&number>0;
 };
 const traced=traceEds(plan.equipment,eds,equipment||{});
 return {...plan,equipment:traced.equipment.map(x=>({...x,hasSharedSeed:hasPerItemSeed(x.itemId)})),
  edsTrace:traced.finalEds,
  byItem:plan.byItem.map(x=>({...x,hasSharedSeed:hasPerItemSeed(x.id)})),
  alternatives,scenarioOnly:true,
  fieldCount,dungeonCount,fieldNpc:target.npcId,
  dungeonBoss:event.boss,dungeonId:event.id};
}
root.SBJSharedGearCore={merge,compareOrders,traceEds,project,GEAR90};
})(window);
