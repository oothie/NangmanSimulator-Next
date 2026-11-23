// Actual save schema regression: Branch/Achieves and globalVariable.shudun pickup flags.
// Run: node tests/account-record-resources-smoke.cjs
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=source.indexOf('function yyAccountMappedLootView(');
const end=source.indexOf('\nfunction accountView(){',begin);
assert(begin>0&&end>begin,'account record/resource function exists');
const fn=source.slice(begin,end);
const section=(title,body)=>'<section><h3>'+title+'</h3>'+body+'</section>';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const characterEntries=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.values(v):[];
function render(save,verified={},page='map'){
 return new Function('save','window','yyRoleSection','characterEntries','escape','accountMapSearch','accountLootFilter','accountMapVisible','accountProgressBar','accountFold','yyAccountMapName','page',
  fn+';return yyAccountRecordAndResourceView(page)')(
  save,{NangmanQuest:{verified},NangmanMapLoot60014:[
   {mapId:'sfj',objectId:'2012',x:15,y:22,kind:'stump',depotKey:'shudun_sfj2012',treeFlag:'shudun_sfj2012'},
   {mapId:'nyz',objectId:'2004',x:30,y:8,kind:'stump',depotKey:'shudun_nyz2004',treeFlag:'shudun_nyz2004'},
   {mapId:'sfj',objectId:'2872',x:24,y:11,kind:'chest',depotKey:'sfj_Box_2872'},
   {mapId:'sfj',objectId:'2888',x:19,y:6,kind:'chest',depotKey:'sfj_Box_2888'},
   {mapId:'nyz',objectId:'3999',x:2,y:17,kind:'chest',depotKey:'nyz_Box_3999'}
  ]},section,characterEntries,escape,'','active',36,(a,b)=>'<meter>'+a+'/'+b+'</meter>',(title,body)=>'<details>'+title+body+'</details>',id=>({sfj:'십방집',nyz:'남양도'})[id]||id,page);
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
 EncryptMap:{sfj:{Plants:{'7':{Count:3}},Kuangs:{'301':{Count:6}}}},
 EncryptDepots:{sfj_Box_2872:{Depots:{}},sfj_Box_2888:{Depots:{'22':{Num:1}}}}
};
fixture.globalVariable={find_TotalShuDun:2,shudun_sfj2012:1,shudun_nyz2004:1};
const out=render(fixture,{event_known:['한국판 검증 이벤트','']});
assert(render(fixture,{event_known:['한국판 검증 이벤트','']},'jianghu').includes('미확인 임무'),'unmapped client event uses Korean fallback');
assert(render(fixture,{},'jianghu').includes('업적 저장 항목'),'achievements shown');
assert(render(fixture,{event_known:['한국판 검증 이벤트','']},'jianghu').includes('110,711'),'account activity count');
assert(out.includes('그루터기')&&out.includes('보물상자'),'only two map resource types');
assert(out.includes('2 / 2'),'both verified stump flags counted');
assert(out.includes('1 / 3'),'empty chest depot counted, partial chest excluded');
assert(out.includes('일부 수령'),'chest with remaining items not complete');
assert(out.includes('(15, 22)')&&out.includes('(24, 11)'),'stump and chest coordinates');
assert(out.includes('십방집')&&out.includes('남양도'),'Korean map names');
assert(out.includes('획득 기록 없음'),'not-recorded treasure chests shown');
assert(!out.includes('채집·채광'),'repeatable mining/plant data absent');
assert(!out.includes('종류 미확인 오브젝트'),'irrelevant object diagnostics removed');
const empty=render({});
assert(empty.includes('0 / 2')&&empty.includes('0 / 3'),'empty-save totals retain actual map object denominators');
const malformed=render({MapData:{swz:null,hua:{tmxObj:{'2':null}}}});
assert(malformed.includes('그루터기')&&malformed.includes('보물상자'),'malformed world-state safe');

console.log('PASS: Korean map object denominators, stump flags, chest depot status and coordinates');
