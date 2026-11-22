// Verify oothie-style exact character pill/training counts and cross-character matrix.
// Run: node tests/account-growth-counts-smoke.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a, 'missing '+start);return source.slice(a,b);
};
const progress=new Function(extract('function yyProgressEntries(','function yyProgressView(')+';return yyProgressEntries')();
const fixture={globalVariable:{'2633_1':5,'2634_1':2,'2633_10058':4,'jwgjz_1':120,
 'zysy_1':110,'zysy1_1':2,'mh_mr_qgxw':239,'home_meihua_max':30}};
const main={id:1,name:'주인공',type:'주인공',raw:{ID:1,EatDrugs:{2605:66,2617:300,2618:270}}};
const companion={id:10058,name:'동료',type:'동료',raw:{ID:10058,EatDrugs:{2605:50,2617:30}}};
const mainP=progress(fixture,main,'consumable');
const find=(model,title)=>model.items.find(g=>g.title===title)?.values?.[0];
assert.equal(find(mainP,'용호단').current,5,'main 5/5 not group done count');
assert.equal(find(mainP,'용호단').max,5);
assert.equal(find(progress(fixture,companion,'consumable'),'용호단').current,4,'companion 4/5');
assert.equal(find(mainP,'대력환').current,300,'EatDrugs direct count');
assert.equal(find(mainP,'대력환').max,300);
assert.equal(find(mainP,'원양단').current,66,'unknown-cap pills still shown');
assert.equal(find(mainP,'원양단').max,null,'unknown upper cap not fabricated');
const train=progress(fixture,main,'training');
assert.equal(find(train,'검왕각 검술 지도').current,120,'oothie source training');
assert.equal(find(train,'자양서원 검술 지도').current,110,'oothie progress recorded');
const escaped=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const section=(name,body)=>'<section>'+name+body+'</section>';
const bar=(current,max)=>'<progress>'+current+'/'+(max??'?')+'</progress>';
const fold=(name,body)=>'<details>'+name+body+'</details>';
const accountSource=extract('function yyAccountGrowthDashboard(','function characterView(){');
const account=new Function('yyRoleSection','accountFold','accountProgressBar','yyProgressEntries','escape','save',accountSource+';return yyAccountGrowthDashboard')(
 section,fold,bar,progress,escaped,fixture);
const view=account([{r:main},{r:companion}]);
assert(view.includes('용호단'),'shows a row per pill');
assert(view.includes('5 / 5')&&view.includes('4 / 5'),'shows actual counts side by side');
assert(view.includes('66 / ?'),'unknown pill max correctly displayed');
assert(!view.includes('완료1 진행1'),'no abstract group counts substituted for pills');
const roleSource=extract('function yyRoleGrowthOverview(','function yyAccountRecordAndResourceView(');
const roleView=new Function('yyProgressEntries','yyRoleSection','accountProgressBar','escape','save',roleSource+';return yyRoleGrowthOverview')(
 progress,section,bar,escaped,fixture);
const pillPage=roleView(main,'consumable');
assert(pillPage.includes('용호단')&&pillPage.includes('5 / 5'),'person page shows direct 5/5');
assert(pillPage.includes('대력환')&&pillPage.includes('300 / 300'),'person page shows pills from EatDrugs');
console.log('PASS: per-person and account-wide numeric pill/training records with unknown cap safety');
