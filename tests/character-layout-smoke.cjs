// yy-sim role-page structure smoke test. Run: node tests/character-layout-smoke.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
const start=source.indexOf('function yyRoleStatGrid('), end=source.indexOf('\nfunction others(){',start);
assert(start>=0&&end>start, 'yy-sim character layout functions must exist');
const root=source.slice(start,end);
const keys=['panel','equip','talent','detail','training','consumable','hengshan','other'];
for(const [id,label] of [['panel','능력치'],['equip','장비'],['talent','재능'],['detail','상세'],['training','수련'],['consumable','단약'],['hengshan','직무'],['other','기타']]){
 assert(root.includes("['"+id+"','"+label+"']"), 'missing source role tab '+id);
}
assert(root.includes('role-page-body'),'original two-column layout');
assert(root.includes('role-page-aside'),'original group selector');
assert(root.includes('role-page-main'),'original main content');
assert(root.includes('wr-hero'),'original character header');
assert(root.includes('wr-slot'),'original detail/equipment slots');
assert(root.includes('function yyRoleActiveLoadout('),'source active martial set');
assert(root.includes('function yyRoleSavedCultivationSummary('),'six-track cultivation visible on main panel');
assert(root.includes('function yyRoleBaseIntermediate('),'verified base values visible on main panel');
assert(source.includes("['WXXW2','도법']"),'WXXW2 must be blade cultivation');
assert(source.includes("['WXXW3','검법']"),'WXXW3 must be sword cultivation');
assert(root.includes('role-grid stat-grid'),'original stat cards');
assert(source.includes("if($('characterSearch'))"),'role selector search callback');
assert(source.includes('data-character-role'),'role switching callback');
assert(source.includes("characterFilter=''"),'character search remains independent');
assert(source.includes("if($('characterSearch'))"),'character search event bound');
assert(!source.includes('v0.7.14'),'old version label removed');
// yy-sim permanent-growth source key coverage and role scope.
const pStart=source.indexOf('function yyProgressEntries(');
const pEnd=source.indexOf('function characterView(){',pStart);
assert(pStart>0&&pEnd>pStart,'progress functions');
const pBody=source.slice(pStart,pEnd);
assert(pBody.includes('2660_atk_'),'companion blood-pool keys');
assert(pBody.includes('2630_'),'consumable role counters');
assert(pBody.includes('home_ssrx_max'),'shared stone lock key');
assert(pBody.includes('2658_'),'one-time Taiji pill');
const context={yyRoleSection:(title,inner)=>'<section>'+title+inner+'</section>',escape:value=>String(value)};
const {yyProgressEntries,yyProgressView}=new Function('yyRoleSection','escape',pBody+';return {yyProgressEntries,yyProgressView}')(
 context.yyRoleSection,context.escape);
const fixture={globalVariable:{'3255_atk':51,'muren_addXW1':50,'2660_atk':29,'2630_1':28,
 '2633_1':5,'2658_1':1,'eat_2662_int_1':2,'home_ssrx_max':5,'2660_atk_10058':12}};
const main={id:1,raw:{ID:1},type:'주인공'};
const companion={id:10058,raw:{ID:10058},type:'동료'};
assert.equal(yyProgressEntries(fixture,main,'training').items.length,8,'main source training groups');
assert.equal(yyProgressEntries(fixture,main,'consumable').items.length,29,'main original pills');
assert.equal(yyProgressEntries(fixture,companion,'consumable').items.length,24,'companion original pills');
assert.equal(yyProgressEntries(fixture,main,'other').items.length,1,'shared stone lock');
assert.equal(yyProgressEntries(fixture,main,'training').items[0].values[0].current,50,'upper bound enforced');
assert.equal(yyProgressEntries(fixture,companion,'training').items[0].values[0].current,12,'per-character blood pool');
assert.equal(yyProgressEntries(fixture,main,'consumable').items.find(x=>x.title==='무상단').values[0].current,28);
assert.equal(yyProgressEntries(fixture,main,'consumable').items.find(x=>x.title==='파장단').values[3].current,2);
assert(yyProgressView(fixture,main,'consumable').includes('파장단'),'consumable visible');
assert.equal(yyProgressEntries({},main,'training').available,false,'unknown if globalVariable missing');

assert(source.includes('function yyRoleExtraCombat('),'source kL combat-extra detail');
assert(source.includes('ExtMpFirst'),'extra true-essence stat included');
assert(source.includes('ExtParry'),'extra parry stat included');
// Extended tab: account-wide current cultivation, historical progress and shared counters.
assert(source.includes("['account','계정 전체']"),'account-wide training tab');
assert(source.includes("data-character-jump"),'account-to-role training drilldown');
const accountCode=source.slice(source.indexOf('function yyRoleCultivationModel('),source.indexOf('function characterView(){'));
assert(accountCode.includes('function yyAccountHistoryView('),'historical cultivation source ledger');
const accountFactory = new Function('window','save','roles','yyRoleSection','escape','yyProgressEntries','characterEntries',
 accountCode+';return {yyRoleCultivationModel,yyAccountCultivationView,yyCultivationAudit,yyAccountCultivationCsv};');
const mainSave={globalVariable:{
 '3255_atk':20,'muren_addXW1':10,'2630_1':3,'2630_10058':2,'home_ssrx_max':12
}};
const roster=[
 {name:'주인공',type:'주인공',id:1,level:90,raw:{ID:1,Level:90,WXXW1:120,WXXW2:100,WXXW3:80,WXXW4:50,WXXWng:70,WXXWqg:60}},
 {name:'동료',type:'동료',id:10058,level:90,raw:{ID:10058,Level:90,WXXW1:40,WXXW2:20,WXXW3:0,WXXW4:0,WXXWng:10,WXXWqg:0}}
];
const statusApi={cultivation:(save,role)=>({cultivation:{records:[1,2,3,4,'ng','qg'].map(k=>({
 kind:k,current:(role['WXXW'+k]||0)+100,extra:role['WXXW'+k]||0,learned:100,fixed:0,
 transferable:role['WXXW'+k]||0,raw:(role['WXXW'+k]||0)+100,overflow:0,
 history:k===1?[{name:'紫阳书院指点',current:20}]:[],
 skills:k===1?[{id:20010,chong:10,level:3,current:9,copiedName:null}]:[],unknownSkills:[]
}))}})};
const {yyRoleCultivationModel,yyAccountCultivationView,yyCultivationAudit,yyAccountCultivationCsv}=accountFactory(
 {RoleStatusData:statusApi},mainSave,roster,(title,inner)=>'<section><h3>'+title+'</h3>'+inner+'</section>',
 value=>String(value),yyProgressEntries,value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[]
);
assert.equal(yyRoleCultivationModel(roster[0]).records.length,6,'all six cultivation branches');
assert.equal(yyRoleCultivationModel(roster[0]).records[0].history[0].name,'자양서원 지도','Korean history names');
const accountHtml=yyAccountCultivationView();
assert(accountHtml.includes('계정 전체 수련 획득 이력'),'history ledger visible');
assert.equal((accountHtml.match(/data-character-jump/g)||[]).length,2,'account drilldown per role');
assert.equal((accountHtml.match(/계정 공유 영구 성장/g)||[]).length,1,'shared growth displayed only once');
assert(accountHtml.includes('인물 수'),'account summary');
assert(accountHtml.includes('계정 전체 영구 성장 진행 내역'),'account permanent growth ledger');
assert(accountHtml.includes('계정 전체 수련 계산 교차 검사'),'account independent six-track cross-check');
assert(accountHtml.includes('계정 전체 6계열 추가 수련 저장값'),'independent WXXW account totals');
assert(accountHtml.includes('저장 추가 수련 합계'),'saved cultivation raw sum');
assert(accountHtml.includes('권법'),'track label in account panel');
const fallbackApi={cultivation:()=>({cultivation:{records:[]}})};
const missingSource=accountFactory({RoleStatusData:fallbackApi},mainSave,roster,
 (title,inner)=>'<section><h3>'+title+'</h3>'+inner+'</section>',value=>String(value),yyProgressEntries,
 value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[]);
const fallbackHtml=missingSource.yyAccountCultivationView();
assert(fallbackHtml.includes('추가 120'),'saved WXXW remains visible when learned stats are unknown');
assert(fallbackHtml.includes('저장 추가 수련 합계'),'saved WXXW all-roster sum without engine');

assert(accountHtml.includes('수련 데이터 연결 진단'),'unmapped martial audit section');
assert(accountHtml.includes('검사한 무학 기록'),'audit enumerates source skills');
const csv=yyAccountCultivationCsv();
assert(csv.includes('현재 저장값'),'csv current values header');
assert(csv.includes('과거 획득 기록'),'csv historical section');
assert(csv.includes('계정 전체 수련 및 영구 단약 진행도'),'csv includes all permanent growth records');
assert(csv.includes('6계열 수련 독립 교차 검사'),'csv includes independent comparison');
assert(csv.includes('"주인공","1","주인공","단약","무상단"'),'csv includes role-scoped pills');
assert(csv.includes('"계정 공유"'),'shared progress is one CSV entry');
assert(csv.includes('무학별 수련 기여 기록'),'CSV includes every martial contribution');
assert(csv.includes('"20010","10","3","9"'),'CSV includes martial ID, Chong, Level, calculated cultivation');
assert(csv.includes('"주인공","1"'),'csv role ID');
assert(csv.includes('"자양서원 지도"'),'csv Korean historical source');
assert(csv.startsWith('\uFEFF'),'Excel UTF-8 BOM');
const audit=yyCultivationAudit([{r:{name:'검증 동료',raw:{
 Taolus:[{ID:20010,Level:10,Chong:10},{ID:999999,Level:10,Chong:10}],Neis:[],Qings:[]}},
 stats:{records:[]}}]);
assert(audit.some(x=>x.id==='999999'&&x.issues.includes('기본 무학 ID 미연결')),'detect martial IDs outside source table');


const activeChunk=source.slice(source.indexOf('function yyRoleActiveLoadout('),source.indexOf('function yyRolePanel('));
const activeMock=new Function('characterEntries','yyRoleSection','yyRoleSlot','wikiHasChinese','window',activeChunk+';return yyRoleActiveLoadout')(
 v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.values(v):[],
 (name,content)=>'<section>'+name+content+'</section>',
 (name,desc,tail)=>'<div>'+name+' · '+desc+' · '+tail+'</div>',
 x=>/[\u3400-\u9fff]/.test(x),
 {NANGMAN_54506_MARTIAL_KO:{'21470':['무예',null,null]}}
);
const activeHtml=activeMock({raw:{Taolus:[{ID:21470,Active:true,Chong:13,Level:3},{ID:20010,Active:false}],
 Neis:[],Qings:[]}});
assert(activeHtml.includes('무예 · 정진 13 · 수련 3'),'active martial name and levels');
assert(!activeHtml.includes('무학 #20010'),'non-equipped martial excluded');
assert(activeHtml.includes('현재 장착 기록 없음'),'not equipped categories represented');
const baseChunk=source.slice(source.indexOf('function yyRoleBaseAptitudes(raw){'),source.indexOf('function characterTrainingView('));
const baseApi=new Function('escape',baseChunk+';return {characterSourceBaseStats,characterSourceBasePanel}')(
 x=>String(x));
const sample={Level:90,GrowDefence:5,ExtDefence:89,GrowHit:2,ExtHit:279,ExtParry:98,
 GrowGangqi:15,ExtGangqi:0,GrowNeijin:20,ExtNeijin:0,
 Str:107,Con:90,Dex:0,Int:90,BornStr:42,BornCon:38,BornDex:21,BornInt:39,
 StrGift:5000,ConGift:1800,DexGift:5000,IntGift:5000,
 StrAtk:2,ConHp:10,DexDodge:1.5,DexSpeed:1.5,ConRen:3,IntMpFirst:0.2,
 GrowAttack:2,GrowHp:10,GrowDodge:1.4,GrowSpeed:2,
 ExtAttack:118,ExtHp:1193,ExtDodge:183,ExtSpeed:176,ExtRen:206,ExtMpFirst:0};
const byName=Object.fromEntries(baseApi.characterSourceBaseStats(sample).map(x=>[x.label,x.value]));
assert.equal(byName['방어 기본값'],551,'shared base defense');
assert.equal(byName['명중 기본값'],549,'shared base hit');
assert.equal(byName['초식방어 기본값'],236,'shared base parry');
assert.equal(byName['공격 초기값'],701,'initial unbuffed attack');
assert.equal(byName['기혈 초기값'],3559,'initial unbuffed hp');
assert.equal(byName['회피 초기값'],359,'initial unbuffed dodge');
assert.equal(byName['속도 초기값'],496.5,'initial unbuffed speed');
assert.equal(byName['인내 초기값'],629,'initial unbuffed resilience');
assert.equal(byName['진원 초기값'],33.4,'initial unbuffed true-essence');
assert(baseApi.characterSourceBasePanel(sample).includes('551'),'detail references shared calculation');

console.log('PASS: yy-sim role page structure, all 9 tabs, selector wiring and version labels');
