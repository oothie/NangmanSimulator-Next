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

console.log('PASS: yy-sim role page structure, all 8 tabs, selector wiring and version labels');
