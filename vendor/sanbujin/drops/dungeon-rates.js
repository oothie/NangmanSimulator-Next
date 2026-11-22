/* yy-sim dungeon rate projection. Presentation only: never change RNG simulation. */
(function(root){
'use strict';
const source=()=>root.DAILY_DATA?.dungeons||[];
const number=v=>Number(v)||0;
const percent=p=>Number.isFinite(p)?(p*100).toLocaleString('ko-KR',{maximumFractionDigits:3})+'%':'—';
const localeName=id=>{
 const item=root.EQUIP_DATA?.equipment?.[id];
 return item?.koName||((item?.name&&root.SBJ_KOREAN?.translate?.(item.name))||item?.name)||'아이템 #'+id;
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
function baseChance(op){
 const lo=Number(op.lo),hi=Number(op.hi),th=Number(op.th);
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||!Number.isFinite(th)||hi<lo)return NaN;
 const count=op.cmp==='<='?Math.floor(th)-lo+1:
  op.cmp==='<'?Math.ceil(th)-lo:
  op.cmp==='>='?hi-Math.ceil(th)+1:
  op.cmp==='>'?hi-Math.floor(th):NaN;
 return Number.isFinite(count)?Math.max(0,Math.min(hi-lo+1,count))/(hi-lo+1):NaN;
}
function node(tag,content,cls){
 const el=document.createElement(tag);
 if(content!=null)el.textContent=String(content);
 if(cls)el.className=cls;
 return el;
}
function addRow(table,values){
 const row=node('tr');
 for(const val of values)row.append(node('td',val));
 table.append(row);
 return row;
}
function tableOf(headers){
 const table=node('table',null,'dungeon-rate-table');
 const header=node('tr');
 for(const label of headers)header.append(node('th',label));
 table.append(header);
 return table;
}
function render(target,event){
 if(!target)return;
 target.replaceChildren();
 const d=rate(event);
 if(!d){target.append(node('p','해당 보스의 드랍 확률 자료가 없습니다.','progress-note'));return;}
 target.append(node('h3','보스별 드랍 정보'));
 target.append(node('p',d.dungeon+' · '+d.boss+' · '+d.source+' 데이터','progress-note'));
 // yy-sim models special/unique rewards separately from the ordinary equipment draw.
 const special=(d.uniqueOps||[]).slice();
 if(special.length){
  const section=node('section',null,'dungeon-unique-section');
  section.append(node('h4','전용·특수 보상'));
  const table=tableOf(['드랍 아이템','기본 판정 기준','추가 조건']);
  for(const op of special){
   const chance=baseChance(op),isVariable=!!op.win||Number(op.mul)!==1;
   const score=Number.isFinite(chance)?percent(chance):'비율 확인 필요';
   const conditions=[];
   if(op.win)conditions.push('변동값 '+op.win);
   if(Number(op.mul)!==1)conditions.push('계수 ×'+op.mul);
   if(op.cap!=null)conditions.push('획득 상한 '+op.cap);
   if(op.flag)conditions.push('기록 반영');
   const label=isVariable?score+' (기초 기준) · 실제 변동':score;
   addRow(table,[localeName(op.item)+' (#'+op.item+')',label,conditions.join(' · ')||'기본 판정']);
  }
  section.append(table);
  section.append(node('p','이 수치는 yy-sim 원본 난수 범위의 기초 판정 비율입니다. 보스 처치 횟수·획득 이력·보정 계수가 개입하는 전용 보상은 현재 세이브에 따라 실제 확률이 변동할 수 있으므로 고정 확률로 간주하지 않습니다.','progress-note'));
  target.append(section);
 }else{
  target.append(node('p','연결된 yy-sim 전용 보상 확률 항목이 없습니다.','progress-note'));
 }
 const ordinary=node('details',null,'dungeon-ordinary-details');
 ordinary.append(node('summary','일반 장비 드랍 확률 · '+percent(d.equip+d.weapon)+' (펼쳐보기)'));
 ordinary.append(node('p','일반 장비 '+percent(d.equip)+' · 일반 무기 '+percent(d.weapon)+' · 미드랍 '+percent(d.none),'progress-note'));
 ordinary.append(node('p','등급별 확률(장비 획득 시): '+
   d.colors.map(c=>({1:'백색',2:'녹색',3:'청색',4:'자색'}[c.color]+' '+percent(c.prob))).join(' / '),'progress-note'));
 const ordinaryTable=tableOf(['일반 장비 후보','전체 회차 기준','자색 포함']);
 const purple=d.colors.find(x=>x.color===4)?.prob||0;
 for(const [list,prob] of [[d.items,d.equip],[d.weapons,d.weapon]]){
  for(const id of list){
   const each=list.length?prob/list.length:0;
   addRow(ordinaryTable,[localeName(id)+' (#'+id+')',percent(each),percent(each*purple)]);
  }
 }
 if(d.items.length+d.weapons.length)ordinary.append(ordinaryTable);
 else ordinary.append(node('p','연결된 일반 장비 후보가 없습니다.','progress-note'));
 ordinary.append(node('p','개별 일반 장비 확률은 보스 보상 가중치와 장비 후보 내 균등 추첨을 적용한 값입니다. 일반 장비와 전용 보상은 별개의 드랍 판정입니다.','progress-note'));
 target.append(ordinary);
 if(d.inferredPool)target.append(node('p','일부 장비 후보는 yy-sim의 빈 항목을 산부진 후보 데이터로 보완했습니다.','progress-note'));
}
root.SBJDungeonRates={rate,render,percent};
})(window);
