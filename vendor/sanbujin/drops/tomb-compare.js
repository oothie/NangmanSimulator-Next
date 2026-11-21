/* Offline only: user manually selects two exported JSON saves. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=window.SBJTombSaveCompare;
const status=$('tombCompareStatus'),output=$('tombCompareResults');
const node=(tag,value)=>{
 const el=document.createElement(tag);
 el.textContent=String(value??'');
 return el;
};
async function load(file){
 if(!file)throw Error('사냥 전과 사냥 후 세이브 JSON 파일을 모두 선택하세요.');
 if(file.size>100*1024*1024)throw Error('세이브 파일이 100MB를 초과합니다.');
 try{return JSON.parse(await file.text());}catch(_){throw Error('JSON 형식이 올바르지 않습니다: '+file.name)}
}
function render(data){
 output.replaceChildren();
 const table=document.createElement('table');
 table.style.width='100%';
 table.style.borderCollapse='collapse';
 const head=document.createElement('tr');
 for(const text of ['종류','세이브 키','사냥 전','사냥 후','판정'])head.append(node('th',text));
 table.append(head);
 for(const [group,rows] of [['RNG 시드',data.seeds],['조건 변수',data.flags]]){
  for(const row of rows){
   const tr=document.createElement('tr');
   for(const text of [group,row.key,row.before??'누락',row.after??'누락',row.status]){
    const td=node('td',text);
    td.style.padding='5px 8px';
    td.style.borderBottom='1px solid #c7bda9';
    tr.append(td);
   }
   table.append(tr);
  }
 }
 output.append(table);
 for(const warning of data.warnings){
  const p=node('p',warning);
  p.className='progress-note';
  output.append(p);
 }
}
$('tombCompareRun').addEventListener('click',async()=>{
 status.textContent='세이브를 확인 중입니다.';
 output.replaceChildren();
 try{
  const before=await load($('tombBefore').files?.[0]);
  const after=await load($('tombAfter').files?.[0]);
  const result=api.diff(before,after);
  render(result);
  status.textContent='비교 완료 · 제릉 RNG 시드 변화 '+result.streamChanges.length+'개. 드랍 적중 여부 확정 검사는 아닙니다.';
 }catch(err){status.textContent=String(err.message||err);}
});
})();
