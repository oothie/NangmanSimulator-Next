/* yy-sim source driven dungeon normal-equipment RNG adapter.
 * Branch weights/order and item pools come from DAILY_DATA.dungeons.
 * Roll implementation, save parsing and shared Eds remain SBJDungeonDrop.
 * No mutation of imported saves or reference datasets. */
(function(root){
'use strict';
const all=()=>root.DAILY_DATA?.dungeons||[];
const npcId=event=>Number(String(event?.id||'').match(/^drop_(\d+)_equip$/)?.[1]||0);
function findSource(event){
 const id=npcId(event);
 if(!id)return null;
 const hits=all().flatMap(d=>(d.npcs||[]).filter(n=>Number(n.id)===id).map(n=>({d,n})));
 if(!hits.length)return null;
 if(hits.length===1)return hits[0];
 const variant=String(event.variant||'');
 if(variant==='挑战'||variant==='绝世'){
  return hits.find(h=>/追魂|绝世|登峰/.test(h.d.name))||hits[hits.length-1];
 }
 if(variant==='宿命')return hits.find(h=>/绝世/.test(h.d.name))||hits[hits.length-1];
 return hits.find(h=>/普通|宿命|追忆/.test(h.d.name))||hits[0];
}
function adapt(event){
 if(!event?.outer||!event?.color)return event;
 const match=findSource(event);
 if(!match)return event;
 const id=npcId(event);
 const operations=(match.d.ops||[]).filter(op=>op.t==='skr'&&op.bs?.some(b=>Number(b.npc)===id));
 const branches=operations.flatMap(op=>(op.bs||[]).filter(b=>Number(b.npc)===id));
 const outer=branches.filter(b=>['miss','equip','weapon'].includes(b.kind));
 const color=branches.filter(b=>b.kind==='color');
 if(!outer.length||!color.length)return event;
 // yy-sim stores branches in display order, not execution order.
 // Preserve the recovered native Sanbujin pick interval order while applying
 // yy-sim weights and available item categories. This is essential for
 // deterministic seed predictions (e.g. Yan Wang purple is first, not last).
 const aggregate=kind=>outer.filter(b=>b.kind===kind)
  .reduce((sum,b)=>sum+Number(b.w),0);
 let remaining={equip:aggregate('equip'),weapon:aggregate('weapon'),
  none:aggregate('miss')};
 const weights=(event.outer||[]).map(([kind,weight])=>{
  let category=kind,amount=Math.max(0,Number(weight)||0);
  if(remaining[category]>=amount){remaining[category]-=amount;return [category,amount]}
  if(category==='weapon'&&remaining.weapon===0&&remaining.none>=amount){
   remaining.none-=amount;return ['none',amount];
  }
  // Source weight change: retain native slot, but use only remaining
  // category capacity. Unallocated mass is reconciled below.
  amount=Math.min(amount,Math.max(0,remaining[category]||0));
  remaining[category]-=amount;
  return [category,amount];
 });
 for(const [kind,left] of Object.entries(remaining)){
  if(left>0)weights.push([kind,left]);
 }
 const colorById=new Map(color.map(b=>[Number(b.color),Number(b.w)]));
 const colorWeights=event.color.map(([id,weight])=>[id,colorById.get(Number(id))??Number(weight)]);
 const key=operations.find(op=>op.bs.some(b=>['miss','equip','weapon'].includes(b.kind)))?.key||event.outerSeed;
 const ckey=operations.find(op=>op.bs.some(b=>b.kind==='color'))?.key||event.colorSeed;
 const usePool=(old,list)=>{const ids=(list||[]).length?[...list]:[...(old?.ids||[])];
  return {...old,ids,random:true,max:ids.length,seed:key};};
 return {...event,outer:weights,outerSeed:key,color:colorWeights,colorSeed:ckey,
  equip:usePool(event.equip,match.n.equip),
  weapon:usePool(event.weapon,match.n.weapon),
  sourceVersion:root.DAILY_DATA?.ver,source:'yy-sim',
  sourceNpc:id,sourceDungeon:match.d.name};
}
root.SBJDungeonYYAdapter={adapt,findSource};
})(window);
