/* Native yy-sim wash event history projection.
 * Faithfully reads washNo, pillsUsed, totalPills, gotGold, wasPity,
 * talLucky and talents from the actual WASM WashResult, without
 * inventing any RNG events or results.
 */
(function(root){
'use strict';
const number=value=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
function flatten(log){
 const rows=[];
 for(const batch of Array.isArray(log)?log:[]){
  const source=Array.isArray(batch?.results)?batch.results:
   Array.isArray(batch?.outcomes)?batch.outcomes:
   batch?.results&&typeof batch.results==='object'?[batch.results]:[];
  for(const result of source){
   if(!result||typeof result!=='object')continue;
   rows.push({
    washNo:number(result.washNo??result.wash_no),
    exchanged:result.isExchange===true,
    exchangeNo:number(result.exchangeNo),
    pity:result.wasPity===true,gold:result.gotGold===true,
    pillsUsed:number(result.pillsUsed),totalPills:number(result.totalPills),
    lucky:number(result.talLucky),gap:number(result.purpleGapPills),
    ids:Array.isArray(result.talents)?
     result.talents.map(t=>({id:number(t?.id),locked:t?.locked===true}))
      .filter(x=>x.id!==null):[],
    raw:result
   });
  }
 }
 return rows;
}
function paging(rows,page=1,size=50){
 const total=rows.length;
 const limit=[50,100,200].includes(Number(size))?Number(size):50;
 const pages=Math.max(1,Math.ceil(total/limit));
 const current=Math.max(1,Math.min(pages,Math.trunc(Number(page)||1)));
 const start=total-(current-1)*limit;
 return {total,page:current,pages,size:limit,rows:rows.slice(Math.max(0,start-limit),start).reverse()};
}
function tsv(rows,nameFor=()=>null){
 const clean=v=>{
  let value=String(v??'').replace(/[\r\n\t]+/g,' ');
  if(/^[\s]*[=+@-]/.test(value))value="'"+value;
  return value;
 };
 const result=[['회차','표시','재능 슬롯','이번 세수단','누적 세수단','천장 진행','자맥 간격'].join('\t')];
 for(const row of rows){
  const label=row.exchanged?'치환':row.pity?'천장':row.gold?'자맥':'세수';
  result.push([
   row.washNo??'—',label,
   row.ids.map(t=>(t.locked?'[잠금] ':'')+String(nameFor(t.id)||'재능 #'+t.id)).join(' / '),
   row.pillsUsed??'',row.totalPills??'',row.lucky??'',row.gap??''
  ].map(clean).join('\t'));
 }
 return '\uFEFF'+result.join('\r\n')+'\r\n';
}
root.YYWashHistory={flatten,paging,tsv};
})(window);
