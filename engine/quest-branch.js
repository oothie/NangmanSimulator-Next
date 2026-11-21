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

/* Korean APK 60014 play_partner dictionary. 10047 omitted: Korean identity ambiguous
 * between extracted data sources; no guessed display name. */
const partnerNames={"10011":"진원봉","10012":"소유설","10013":"여진해","10014":"전봉","10015":"류여의","10024":"도연일","10025":"종무월","10026":"강일천","10027":"맹상","10028":"배이나","10029":"월영","10030":"이일진","10031":"상호건","10032":"진무쌍","10033":"탁발준","10034":"능연","10037":"야무유","10038":"양연헌","10039":"사고란","10040":"정소비","10041":"도화","10042":"우영이","10044":"화공노승","10045":"걸인무성","10046":"소패음","10048":"두월한","10050":"설용성","10052":"남지의","10053":"소매","10055":"백로","10056":"사도우","10057":"우소설","10058":"태길이","10059":"앙만","10060":"보경운"};
const prefixNames={cd:'성도',ly:'낙양',hz:'항주',nyz:'남양도',taz:'태안진',wyc:'망우촌',
 cbs:'장백산',qls:'기련산',qz:'천주',sfj:'십방집',sb:'새북',dxs:'대설산',
 td:'천도문',ty:'태을교',cl:'창랑',gs:'고소',yz:'유주',fmz:'봉명집',
 emei:'아미'};

let questIndexSource=null,questConditionIndex=new Map();
function questLinkedInfo(id){
 const catalog=root.NANGMAN_QUEST_60014?.quests||{};
 if(catalog!==questIndexSource){
  questIndexSource=catalog;questConditionIndex=new Map();
  for(const row of Object.values(catalog)){
   const req=row?.finish_req;
   const checks=Array.isArray(req)&&Array.isArray(req[0])?req:[req];
   for(const term of checks){
    if(!Array.isArray(term)||![2,3].includes(Number(term[0]))||typeof term[1]!=='string')continue;
    const key=term[1],list=questConditionIndex.get(key)||[];
    if(!list.some(x=>x.id===row.id))list.push(row);
    questConditionIndex.set(key,list);
   }
  }
 }
 const matched=questConditionIndex.get(id)||[];
 if(!matched.length)return null;
 const names=[...new Set(matched.map(x=>String(x.name||'').trim()).filter(Boolean))];
 if(names.length===1){
  const primary=matched.find(x=>Number(x.type)!==99)||matched[0];
  return {name:names[0]+' · 진행 기록',
   detail:'한국판 임무 「'+names[0]+'」의 판정 조건에 사용되는 분기 기록입니다. '+String(primary.description||'').replace(/#[0-9a-f]{6}#/gi,'').slice(0,220),
   source:'condition'};
 }
 return {name:'관련 임무 · '+names[0]+(names.length>1?' 외 '+(names.length-1)+'건':''),
  detail:'다음 한국판 임무들의 판정 조건에서 공통으로 참조합니다: '+names.slice(0,8).join(' / ')+'. 완료 임무를 단정할 수 없습니다.',
  source:'shared-condition'};
}
function labelForBranch(id){
 if(verified[id]&&verified[id][0]!=='상세 미확인 임무')return {name:verified[id][0],detail:verified[id][1],source:'verified'};
 const recruit=/^(10[0-9]{3})(?:_(add|open|join|recruit|task))$/i.exec(id);
 if(recruit&&partnerNames[recruit[1]]){
  const person=partnerNames[recruit[1]],suffix=recruit[2].toLowerCase();
  const kind=suffix==='add'?'추가':suffix==='open'?'개방':suffix==='join'||suffix==='recruit'?'영입':'관련';
  return {name:person+' · '+kind+' 기록',
    detail:'한국판 인물 데이터에서 '+person+'(#'+recruit[1]+')와 연결되는 저장 기록입니다. '+kind+' 이벤트의 내부 단계이며 구체적인 진행 내용은 세이브에 포함되지 않습니다.',source:'partner'};
 }
 const linked=questLinkedInfo(id);
 if(linked)return linked;
 const prefix=String(id).split('_')[0];
 const location=prefixNames[prefix];
 return {name:location?location+' · 이벤트 기록':'이벤트 기록 · '+id,
   detail:location?location+' 관련 세이브 분기입니다. 내부 ID '+id+'에 해당하는 한국판 상세 임무 설명은 확인되지 않았습니다.':
    '내부 ID '+id+'의 한국판 이름·상세 설명을 확인할 수 없습니다. 저장 단계와 추적 상태만 확인 가능합니다.',
   source:'unknown'};
}
function model(save){
 const branch=save?.Branch;
 const values=branch&&typeof branch==='object'&&!Array.isArray(branch)?Object.entries(branch):[];
 const rows=values.filter(([,x])=>x&&typeof x==='object').map(([id,entry])=>{
  const number=entry.step==null?NaN:Number(entry.step);
  const valid=Number.isInteger(number);
  const active=valid&&number>=0,done=valid&&number===-1;
  const {name,detail,source}=labelForBranch(id);
  const recv=entry.recv==null?null:Number(entry.recv);
  return {id,name,detail,source,step:valid?number:null,
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
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(cell))cell="'"+cell;
  return '"'+cell.replace(/"/g,'""')+'"';
 }).join(',')).join('\r\n')+'\r\n';
}
root.NangmanQuest={model,csv,verified,labelForBranch};
})(typeof window!=='undefined'?window:globalThis);
