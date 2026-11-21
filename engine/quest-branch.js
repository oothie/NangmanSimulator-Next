/* Korean save Branch mission/event ledger.
 * Original yy-sim: Branch.step >= 0 active; step === -1 done.
 * Some entries are internal event watchers rather than player quests.
 */
(function(root){
'use strict';
const verified={
 cbs_treasure_js:['장백산 취룡천','원본 임무 기록'],
 general_jiwo_egg:['닭장에서 달걀 줍기','닭장에서 달걀을 꺼내기'],
 ly_GengFu:['야경꾼','야경꾼 관련 기록'],
 eastsea_nature:['동해 자연 이벤트','원본 단계 설명 미확인'],
 lxz_LinHeng:['임항의 혼수','임항 관련 기록'],
 qls_gf_talk:['야경꾼과 대화','기련산 야경꾼 관련 기록'],
 cbs_swarm_jianshi:['빙잠 생존 상태','장백산 빙잠 기록'],
 lv_100_one:['하늘이 막아도 길은 있다 · 경지 돌파법','현자 방장의 소식을 기다려 파경법을 얻기'],
 taiyi_daoxue:['도학 수련','도학 수련 진척'],
 qls_gf:['귀신과의 교류','기련산 관련 기록'],
 cd_baguafuxi2:['무학의 길, 강호에서의 재회','노인을 따라 화산 괘대산으로 이동'],
 ly_alyd:['거리의 싸움','낙하진 객잔 부근의 다툼 확인'],
 cd_bagua_task:['팔괘문 일일 임무','팔괘문 수행 기록'],
 cbsbz_js:['동굴 속 밀실','장백산 관련 임무'],
 td_blademaster:['천도문 기예 관측','천도문 기예 관련 기록'],
 cl_dragonspear:['풍우가 닥쳐오다','창랑 진파 무학의 용 계열 습득'],
 ly_GengFuTalk:['야경꾼 대화','야경꾼과 대화'],
 dmqj_js2:['상세 미확인 임무','원본 단계 자료가 더미 문구'],
 lxz_ylg:['야랑곡 · 첫 번째 이야기','야랑곡 관련 임무'],
 hz_setXuanWo:['항주 소용돌이 출현','항주 소용돌이 이벤트 상태'],
 dmqj_js:['상세 미확인 임무','원본 단계 자료가 더미 문구'],
 lingyue_jiayi_js:['휘월신공','휘월신공 관련 수련 기록'],
 byj_rd:['보상 수령 기록','원본 단계 설명 미확인']
};
function model(save){
 const branch=save?.Branch;
 const values=branch&&typeof branch==='object'&&!Array.isArray(branch)?Object.entries(branch):[];
 const rows=values.filter(([,x])=>x&&typeof x==='object').map(([id,entry])=>{
  const number=entry.step==null?NaN:Number(entry.step);
  const valid=Number.isInteger(number);
  const active=valid&&number>=0,done=valid&&number===-1;
  const [name,detail]=verified[id]||['임무·이벤트 #'+id,'한국판 이름 미연결'];
  const recv=entry.recv==null?null:Number(entry.recv);
  return {id,name,detail,step:valid?number:null,
   active,done,traced:(entry.trace===true||entry.hint===true),
   status:active?'진행 중':done?'완료 기록':'상태 미확인',
   received:Number.isFinite(recv)&&recv>1000000000&&recv<4102444800?recv:null,
   sign:Number.isFinite(Number(entry.sign))?Number(entry.sign):null};
 }).sort((a,b)=>Number(b.active)-Number(a.active)||
 Number(b.traced)-Number(a.traced)||a.id.localeCompare(b.id,'en'));
 return {rows,active:rows.filter(x=>x.active).length,
  done:rows.filter(x=>x.done).length,
  unknown:rows.filter(x=>!x.active&&!x.done).length,
  traced:rows.filter(x=>x.active&&x.traced).length};
}
function csv(data){
 const rows=[['내부 ID','한국어 명칭','단계','저장 상태','추적 여부','수락 시각','참고']];
 for(const x of data.rows)rows.push([
  x.id,x.name,x.step,x.status,x.traced?'추적 표시':'추적 없음',
  x.received==null?'':new Date(x.received*1000).toISOString(),x.detail
 ]);
 return '\uFEFF'+rows.map(row=>row.map(value=>{
  let cell=String(value??'');
  if(/^[\\s\\u0000-\\u001f]*[=+@\\-]/.test(cell))cell="'"+cell;
  return '"'+cell.replace(/"/g,'""')+'"';
 }).join(',')).join('\r\n')+'\r\n';
}
root.NangmanQuest={model,csv,verified};
})(typeof window!=='undefined'?window:globalThis);
