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
function render(save,verified={},page='map'){
 return new Function('save','window','yyRoleSection','characterEntries','escape','accountMapSearch','accountProgressBar','accountFold','page',
  fn+';return yyAccountRecordAndResourceView(page)')(
  save,{NangmanQuest:{verified}},section,characterEntries,escape,'',(a,b)=>'<meter>'+a+'/'+b+'</meter>',(title,body)=>'<details>'+title+body+'</details>',page);
}
const fixture={
 Branch:{event_known:{step:-1,recv:1795253568,trace:true},event_pending:{step:2}},
 Achieves:[{ID:1,Reward:2}],AchievePoint:182,
 BattleCount:110711,KillEnermy:110299,WudaoWin:943,
 MapData:{
  sfj:{tmxObj:{'2872':{pic:'pic_box_empty.png',nick:'yes'},'1234':{pic:'empty',nick:'yes'}}},
  nyz:{tmxObj:{'3001':{pic:'pic_stump_empty.png'},'3002':{nick:'yes',json:'yes'}}},
  hua:{tmxObj:{}}
 },
 EncryptMap:{sfj:{Plants:{'7':{Count:3}},Kuangs:{'301':{Count:6}}}}
};
fixture.globalVariable={find_TotalShuDun:2,shudun_sfj2012:1,shudun_nyz2004:1};
const out=render(fixture,{event_known:['한국판 검증 이벤트','']});
assert(render(fixture,{event_known:['한국판 검증 이벤트','']},'jianghu').includes('한국판 검증 이벤트'),'quest name matched');
assert(render(fixture,{},'jianghu').includes('업적 저장 항목'),'achievements shown');
assert(render(fixture,{event_known:['한국판 검증 이벤트','']},'jianghu').includes('110,711'),'account activity count');
assert(out.includes('그루터기 / 보물상자'),'correct collectible category');
assert(out.includes('상자·그루터기 외형 식별'),'both visually confirmed marker types summarized');
assert(out.includes('획득한 그루터기')&&out.includes('2개'),'confirmed stump pickup counters');
assert(out.includes('shudun_sfj2012'),'confirmed stump record row');
assert(out.includes('개별 획득 목록과 일치'),'cumulative count equals individual records');
assert(out.includes('십방집')&&out.includes('남양도'),'per-map labels');
assert(out.includes('종류 미확인'),'unknown classifications retained');
assert(!out.includes('채집·채광 기록'),'repeatable resource collection removed');
assert(!out.includes('Count 원본값'),'mine counts removed from UI');
const empty=render({});
assert(empty.includes('그루터기 / 보물상자'),'empty map is safe');
assert(empty.includes('종류 미확인'),'empty counts safe');
const malformed=render({MapData:{swz:null,hua:{tmxObj:{'2':null}}}});
assert(malformed.includes('종류 미확인'),'unknown object does not crash');

console.log('PASS: account Jianghu records and map-object chest/stump status categories');
