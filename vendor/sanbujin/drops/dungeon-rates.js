/* yy-sim dungeon rate projection. Presentation only: never change RNG simulation. */
(function(root){
'use strict';
const source=()=>root.DAILY_DATA?.dungeons||[];
const number=v=>Number(v)||0;
const percent=p=>Number.isFinite(p)?(p*100).toLocaleString('ko-KR',{maximumFractionDigits:3})+'%':'—';
const localeName=id=>{
 const ko=root.NangmanDungeonKoreanNames?.[id];
 if(ko)return String(ko).trim();
 const item=root.EQUIP_DATA?.equipment?.[id];
 return item?.koName||((item?.name&&root.SBJ_KOREAN?.translate?.(item.name))||item?.name)||
  root.SBJ_KOREAN?.translate?.(root.ITEM_NAMES?.[id]||'')||'이름 미확인';
};
function lookup(event){
 const npcId=Number(String(event?.id||'').match(/^drop_(\d+)_equip$/)?.[1]);
 if(!npcId)return null;
 const match=root.SBJDungeonYYAdapter?.findSource(event)||
  source().flatMap(d=>(d.npcs||[]).filter(n=>Number(n.id)===npcId)
   .map(n=>({d,n})))[0];
 if(!match)return null;
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
 return {npcId,dungeon:event.dungeon,boss:event.boss,
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
// Gates reconstructed from native Sanbujin boss code. The yy-sim
// op list records weighted tests but does not encode all prerequisite gates.
const GATES={
 'drop_2364_33653':['win_ywf',7],
 'drop_4422_33653':['win_ywf',4],
 'drop_2364_33652':['win_ywf',12],
 'drop_5618_33652':['win_ywf',10],
 'drop_2364_33650':['win_ywf',16],
 'drop_7081_33650':['win_ywf',20],
 'drop_5422_33650':['win_ywf',12],
 'drop_5427_50883':['win_byjzt',6],
 'drop_5223_50910':['win_byjzt',10],
 'drop_9430_44122':['win_byjzt',14],
 'drop_7264_35219':['win_byj',3],
 'drop_7262_35214':['win_byj',11],
 'drop_7263_35214':['win_byj',11],
 'drop_7267_35221':['win_byj',6],
 'drop_5020_35260':['win_lsby',7],
 'drop_8913_35264':['win_lsby',13],
 'drop_5628_35264':['win_lsby',9],
 'drop_8914_35268':['win_lsby',21],
 'drop_8917_35268':['win_lsby',13]
};
const QUEST_GATES={
 'drop_6559_40170':['jwg_zhenpai_jwj',1],
 'drop_6443_33862':['ty_xiaoqingshenshi',4]
};
function probability(op,input){
 const base=baseChance(op),flags=input?.flags;
 if(!flags||!(flags instanceof Map)||!Object.keys(input?.seeds||{}).length)
  return {base,real:null,gate:null};
 const gate=GATES[op.flag],quest=QUEST_GATES[op.flag];
 if(quest&&!flags.has(quest[0]))return {base,real:null,gate:null,unknownQuest:true};
 const required=(gate?Number(flags.get(gate[0])||0)>=gate[1]:true)&&
   (!quest||Number(flags.get(quest[0]))===quest[1]);
 const current=Number(flags.get(op.win)||0);
 const acquired=Number(flags.get(op.gotKey)||0);
 const capped=Number.isFinite(Number(op.cap))&&Number(op.cap)>0&&
   (acquired>=Number(op.cap)||
    Number(op.cap)===1&&((Number(flags.get(op.flag)||0)>=2)||
      input.owned?.has(Number(op.item))));
 const adjusted={...op,th:Number(op.th)+current*Number(op.mul||1)};
 return {base,real:required&&!capped?baseChance(adjusted):0,
  gate:gate?{name:gate[0],min:gate[1],met:required}:null,
  state:current};
}
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
function render(target,event,input){
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
   const chance=probability(op,input);
   const score=Number.isFinite(chance.base)?percent(chance.base):'미확인';
   const conditions=[];
   if(chance.gate)conditions.push('선행 조건 '+chance.gate.name+' ≥ '+chance.gate.min);
   if(chance.unknownQuest)conditions.push('임무 분기 미복원');
   if(op.win)conditions.push('누적값 '+op.win);
   if(Number(op.mul)!==1)conditions.push('보정 계수 ×'+op.mul);
   if(op.cap!=null)conditions.push('획득 상한 '+op.cap);
   const label=chance.real==null?'기본 '+score:
     '현재 세이브 '+percent(chance.real)+' (기본 '+score+')';
   addRow(table,[localeName(op.item),label,conditions.join(' · ')||'기본 판정']);
  }
  section.append(table);
  section.append(node('p','이 수치는 yy-sim 원본 난수 범위의 기초 판정 비율입니다. 현재 세이브의 누적값과 확인된 선행 조건을 반영합니다. 자료에 없는 전투 조건이나 획득 상한 충족 여부는 추가 검증이 필요하므로 확정 드랍률로 간주하지 않습니다.','progress-note'));
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
   addRow(ordinaryTable,[localeName(id),percent(each),percent(each*purple)]);
  }
 }
 if(d.items.length+d.weapons.length)ordinary.append(ordinaryTable);
 else ordinary.append(node('p','연결된 일반 장비 후보가 없습니다.','progress-note'));
 ordinary.append(node('p','개별 일반 장비 확률은 보스 보상 가중치와 장비 후보 내 균등 추첨을 적용한 값입니다. 일반 장비와 전용 보상은 별개의 드랍 판정입니다.','progress-note'));
 target.append(ordinary);
 if(d.inferredPool)target.append(node('p','일부 장비 후보는 yy-sim의 빈 항목을 산부진 후보 데이터로 보완했습니다.','progress-note'));
}
root.SBJDungeonRates={rate,render,percent,baseChance,probability};
})(window);
