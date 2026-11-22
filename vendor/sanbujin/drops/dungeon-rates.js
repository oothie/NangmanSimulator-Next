/* yy-sim dungeon rate projection. Presentation only: never change RNG simulation. */
(function(root){
'use strict';
const source=()=>root.DAILY_DATA?.dungeons||[];
const number=v=>Number(v)||0;
const percent=p=>Number.isFinite(p)?(p*100).toLocaleString('ko-KR',{maximumFractionDigits:3})+'%':'—';
const localeName=id=>{
 const item=root.EQUIP_DATA?.equipment?.[id];
 return item?.koName||root.SBJ_KOREAN?.translate?.(item?.name||'')||'장비 #'+id;
};
function lookup(event){
 const npcId=Number(String(event?.id||'').match(/^drop_(\d+)_equip$/)?.[1]);
 if(!npcId)return null;
 const hits=source().flatMap(d=>(d.npcs||[]).filter(n=>Number(n.id)===npcId)
  .map(n=>({d,n})));
 if(!hits.length)return null;
 // The same NPC ID can occur in normal/hard variants. Prefer the
 // matching dungeon display name, otherwise identical NPC-rate records.
 const match=hits.find(x=>String(x.d.name).includes(String(event.variant||'').replace('普通','')))||
  hits.find(x=>String(event.dungeon).includes(String(x.d.name).split('·')[0]))||hits[0];
 const ops=(match.d.ops||[]).filter(op=>op.t==='skr'&&
  op.bs?.some(b=>Number(b.npc)===npcId));
 const byKind=(kind)=>ops.flatMap(op=>op.bs.filter(b=>b.kind===kind));
 const outer=[...byKind('miss'),...byKind('weapon'),...byKind('equip')];
 const color=byKind('color');
 if(!outer.length)return null;
 const sum=outer.reduce((s,x)=>s+number(x.w),0);
 const chance=k=>sum>0?outer.filter(x=>x.kind===k).reduce((s,x)=>s+number(x.w),0)/sum:0;
 const colorSum=color.reduce((s,x)=>s+number(x.w),0);
 const colors=[1,2,3,4].map(c=>({color:c,prob:colorSum?
  color.filter(x=>Number(x.color)===c).reduce((s,x)=>s+number(x.w),0)/colorSum:
  (event.color||[]).filter(x=>Number(x[0])===c).reduce((s,x)=>s+number(x[1]),0)/
   Math.max(1,(event.color||[]).reduce((s,x)=>s+number(x[1]),0))}));
 const missingEquipPool=chance('equip')>0&&!(match.n.equip||[]).length;
 const missingWeaponPool=chance('weapon')>0&&!(match.n.weapon||[]).length;
 return {npcId,dungeon:match.d.name,boss:match.n.name,
  equip:chance('equip'),weapon:chance('weapon'),none:chance('miss'),
  colors,items:[...new Set(missingEquipPool?event.equip?.ids||[]:match.n.equip||[])],
  weapons:[...new Set(missingWeaponPool?event.weapon?.ids||[]:match.n.weapon||[])],
  inferredPool:missingEquipPool||missingWeaponPool,
  uniques:match.n.uniques||[],
  uniqueOps:(match.d.ops||[]).filter(op=>op.t==='uniq'&&Number(op.npc)===npcId),
  source:'yy-sim',sum};
}
function fallback(event){
 if(!event.outer)return null;
 const total=event.outer.reduce((s,x)=>s+number(x[1]),0);
 const chance=k=>event.outer.filter(x=>x[0]===k).reduce((s,x)=>s+number(x[1]),0)/Math.max(1,total);
 const colorTotal=(event.color||[]).reduce((s,x)=>s+number(x[1]),0);
 return {npcId:null,dungeon:event.dungeon,boss:event.boss,
  equip:chance('equip'),weapon:chance('weapon'),none:chance('none'),
  colors:[1,2,3,4].map(c=>({color:c,prob:(event.color||[]).filter(x=>Number(x[0])===c)
   .reduce((s,x)=>s+number(x[1]),0)/Math.max(1,colorTotal)})),
  items:[...new Set(event.equip?.ids||[])],weapons:[...new Set(event.weapon?.ids||[])],
  uniques:[],uniqueOps:[],source:'산부진',sum:total};
}
function rate(event){return lookup(event)||fallback(event)}
function render(target,event){
 if(!target)return;
 target.replaceChildren();
 const d=rate(event);
 if(!d)return;
 const heading=document.createElement('h3');
 heading.textContent='보스별 일반 장비 드랍 확률';
 target.append(heading);
 const desc=document.createElement('p');
 desc.className='progress-note';
 desc.textContent='자료: '+d.source+' 보상 가중치 · 일반 장비 '+percent(d.equip+d.weapon)+
   ' / 장비 없음 '+percent(d.none)+
   ' · 일반 장비에 대한 확률입니다. 전용 주황 장비는 별도 판정됩니다.';
 target.append(desc);
 const kinds=document.createElement('div');kinds.className='dungeon-rate-stats';
 for(const [name,p] of [['일반 장비',d.equip],['일반 무기',d.weapon],
    ['장비 미드랍',d.none]]){
  const entry=document.createElement('span');
  entry.textContent=name+' '+percent(p);kinds.append(entry);
 }
 target.append(kinds);
 const t=document.createElement('table');t.className='dungeon-rate-table';
 const header=document.createElement('tr');
 for(const v of ['장비명','1회 드랍 확률','자색 드랍 확률']){const x=document.createElement('th');x.textContent=v;header.append(x)}
 t.append(header);
 const purple=d.colors.find(x=>x.color===4)?.prob||0;
 for(const [list,p] of [[d.items,d.equip],[d.weapons,d.weapon]]){
  for(const id of list){
   const tr=document.createElement('tr');
   const amount=list.length?p/list.length:0;
   for(const cell of [localeName(id)+' (#'+id+')',percent(amount),percent(amount*purple)]){
    const el=document.createElement('td');el.textContent=cell;tr.append(el);
   }
   t.append(tr);
  }
 }
 if(d.items.length+d.weapons.length)target.append(t);
 else{const p=document.createElement('p');p.className='progress-note';
  p.textContent='이 보스의 일반 장비 후보는 연결되지 않았습니다.';target.append(p)}
 const sub=document.createElement('p');sub.className='progress-note';
 sub.textContent='장비 등급(장비가 드랍된 경우): '+
  d.colors.map(x=>({1:'백색',2:'녹색',3:'청색',4:'자색'}[x.color]+' '+percent(x.prob))).join(' · ')+
  ' · 개별 장비 확률은 균등한 장비 선택을 전제로 계산했습니다.';
 target.append(sub);
 if(d.uniqueOps?.length){
  const title=document.createElement('h4');title.textContent='전용·특수 보상 기본 판정';target.append(title);
  const uniqueTable=document.createElement('table');uniqueTable.className='dungeon-rate-table';
  const head=document.createElement('tr');
  for(const label of ['보상 아이템','기본 판정 비율','조건']){
   const th=document.createElement('th');th.textContent=label;head.append(th)
  }
  uniqueTable.append(head);
  for(const op of d.uniqueOps){
   const low=Number(op.lo),high=Number(op.hi),threshold=Number(op.th);
   // Integer RNG is inclusive at both endpoints.
   const cases=op.cmp==='<='?Math.floor(threshold)-low+1:
     op.cmp==='<'?Math.ceil(threshold)-low:
     op.cmp==='>='?high-Math.ceil(threshold)+1:
     op.cmp==='>'?high-Math.floor(threshold):NaN;
   const prob=high>=low&&Number.isFinite(cases)?
     Math.max(0,Math.min(high-low+1,cases))/(high-low+1):NaN;
   const row=document.createElement('tr');
   const notes=[op.cap!=null?'획득 상한 '+op.cap+'회':'',
     Number(op.mul)!==1?'원본 보정 계수 '+op.mul:'',
     op.win?'누적/상태 변수 적용':''].filter(Boolean).join(' · ')||'원본 보상 조건 적용';
   for(const label of [localeName(op.item)+' (#'+op.item+')',
     Number.isFinite(prob)?percent(prob):'원본 판정 확인 필요',notes]){
    const td=document.createElement('td');td.textContent=label;row.append(td)
   }
   uniqueTable.append(row);
  }
  target.append(uniqueTable);
  const caveat=document.createElement('p');caveat.className='progress-note';
  caveat.textContent='기본 판정 비율은 yy-sim의 난수 구간과 비교 조건으로 계산했습니다. 누적 보정, 획득 기록, 조건부 판정이 적용되면 실제 회차별 확률은 달라질 수 있습니다.';
  target.append(caveat);
 }
 if(d.inferredPool){
  const note=document.createElement('p');note.className='progress-note';
  note.textContent='이 보스는 yy-sim 장비 후보 목록이 비어 있어 산부진 후보 장비 ID를 보완했습니다. 개별 장비 확률은 참고용입니다.';
  target.append(note);
 }
 if(d.source==='yy-sim'&&event?.outer){
  const oldTotal=event.outer.reduce((s,x)=>s+number(x[1]),0);
  const oldEquip=event.outer.filter(x=>x[0]==='equip').reduce((s,x)=>s+number(x[1]),0)/Math.max(1,oldTotal);
  if(Math.abs(oldEquip-d.equip)>0.0000001){
   const warn=document.createElement('p');warn.className='progress-note';
   warn.textContent='참고: yy-sim과 기존 산부진 장비 분기 가중치가 다릅니다. 확률표는 yy-sim 기준이며 예측 난수 엔진은 변경하지 않았습니다.';
   target.append(warn);
  }
 }
}
root.SBJDungeonRates={rate,render,percent};
})(window);
