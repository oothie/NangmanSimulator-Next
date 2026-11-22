// Actual save schema regression: Branch/Achieves and EncryptMap.Plants/Kuangs.
// Run: node tests/account-record-resources-smoke.cjs
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=source.indexOf('function yyAccountRecordAndResourceView(){');
const end=source.indexOf('\nfunction characterView(){',begin);
assert(begin>0&&end>begin,'account record/resource function exists');
const fn=source.slice(begin,end);
const section=(title,body)=>'<section><h3>'+title+'</h3>'+body+'</section>';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const characterEntries=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.values(v):[];
function render(save,verified={}){
 return new Function('save','window','yyRoleSection','characterEntries','escape',
  fn+';return yyAccountRecordAndResourceView()')(
  save,{NangmanQuest:{verified}},section,characterEntries,escape);
}
const fixture={
 Branch:{
  event_known:{step:-1,recv:1795253568,trace:true},
  event_pending:{step:2,recv:0}
 },
 Achieves:[{ID:1,Reward:2},{ID:9,Reward:4}],
 AchievePoint:182,
 BattleCount:110711,KillEnermy:110299,WudaoWin:943,
 CatchAnimal:2594,MakeCount:5325,Make90Count:120,Make100Count:0,
 EncryptMap:{
  swz:{
   Plants:{'7':{ID:7,Count:3,R:0,Time:1795253568}},
   Kuangs:{'301':{ID:301,Count:6,R:3733,RCD:1734270519,Time:1795253568}}
  },
  hua:{Plants:{},Kuangs:{},S:123},
  wyc:{Plants:{},Kuangs:{}}
 },
 MapData:{swz:{animal:{},walk:{}}},
 Fogs:{swz:{width:30,height:20,bits64:'AAAA'}},
 globalVariable:{swz_map_reward:1,num_map_reward:29}
};
const out=render(fixture,{event_known:['한국판 검증 이벤트','']});
assert(out.includes('한국판 검증 이벤트'),'Korean quest name joined for verified records');
assert(out.includes('완료 기록'),'completed branch in account ledger');
assert(out.includes('진행 · 2'),'active branch step preserved');
assert(out.includes('업적 저장 항목'),'achievement count present');
assert(out.includes('Reward 원본값'),'achievement reward is not interpreted as receipt state');
assert(out.includes('110,711'),'battle counts from save');
assert(out.includes('110,299'),'kill counts from save');
assert(out.includes('90레벨 장비 제작'),'legacy account counters');
assert(out.includes('십방집'),'known map code translated');
assert(out.includes('화산'),'empty maps still listed');
assert(out.includes('식물')&&out.includes('광맥'),'both resource collections supported');
assert(out.includes('301'),'mine resource node ID included');
assert(out.includes('3733'),'raw R field preserved');
assert(out.includes('Count 원본값'),'Count not asserted as remaining');
assert(out.includes('탐색 비트 지도'),'Fogs shown independently');
assert(out.includes('지도 보상 기록'),'map reward fields included');
assert(out.includes('지도별 저장 상태'),'all saved maps inspectable');
const empty=render({});
assert(empty.includes('저장된 개별 자원 슬롯 없음'),'empty map cache is unknown, not zero gathering');
assert(empty.includes('분기·이벤트 기록'),'empty account records render safely');
const malformed=render({EncryptMap:{swz:null,hua:{Kuangs:{'2':null}}},Branch:{invalid:null},Fogs:{swz:null}});
assert(malformed.includes('광맥'),'malformed legacy resource entry does not crash');
console.log('PASS: account Jianghu logs, cumulative achievements and actual map collection save structures');
