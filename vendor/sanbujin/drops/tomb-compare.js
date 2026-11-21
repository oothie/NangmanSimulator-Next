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
 if(data.cases?.length){
  const title=node('h3','제릉 보상 가중치 분기 가설 비교 (실게임 검증 전)');
  output.append(title);
  const hypotheses=document.createElement('table');
  hypotheses.style.width='100%';
  const header=document.createElement('tr');
  for(const col of ['가설','시드/변수','계산상 다음 상태','실제 사냥 후','대조'])header.append(node('th',col));
  hypotheses.append(header);
  for(const hypothesis of data.cases){
   for(const check of hypothesis.checks){
    const tr=document.createElement('tr');
    for(const cell of [hypothesis.order==='descending'?'가중치 내림차순':'가중치 오름차순',
     check.key,check.expected,check.actual??'누락',check.status]){
     const td=node('td',cell);
     td.style.padding='5px 8px';
     td.style.borderBottom='1px solid #c7bda9';
     tr.append(td);
    }
    hypotheses.append(tr);
   }
  }
  output.append(hypotheses);
  output.append(node('p',data.conclusion));
  for(const hypothesis of data.cases){
   const name=hypothesis.order==='descending'?'내림차순':'오름차순';
   output.append(node('p',name+' · 특수몹 등장 예상 '+hypothesis.forecastEvents+'회 · 90레벨 장비 예상 '+hypothesis.forecastGear.length+'회 (가설 단계)'));
  }
 }else if(data.message)output.append(node('p',data.message));
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
  const result=api.reconcile(before,after,Number($('tombCompareCount').value));
  render(result);
  status.textContent='전후 비교 완료 · '+result.count+'회 사냥 가정 · 제릉 RNG 시드 변화 '+result.streamChanges.length+'개. 장비 적중 여부 확정 검사는 아닙니다.';
 }catch(err){status.textContent=String(err.message||err);}
});
})();
