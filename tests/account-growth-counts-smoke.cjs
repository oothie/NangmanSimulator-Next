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
const account=new Function('yyProgressEntries','escape','save','yyPillEffect','yyRoleCultivationModel',
 'let accountGrowthPage=0;'+accountSource+';return {render:yyAccountGrowthDashboard,setPage:n=>accountGrowthPage=n}')(
 progress,escaped,fixture,()=> '',role=>({records:['권법','도법','검법','창·곤','내공','경공'].map(
  (name,i)=>({name,current:100+i}))}));
const roster=[{r:main},{r:companion}];
let allViews='';
for(let i=0;i<100;i++){
 account.setPage(i);const view=account.render(roster);
 const counters=view.match(/표 ([0-9]+) \/ ([0-9]+)/);
 allViews+=view;
 if(counters&&Number(counters[1])>=Number(counters[2]))break;
}
assert(allViews.includes('용호단'),'paged list includes individual pills');
assert(allViews.includes('5 / 5')&&allViews.includes('4 / 5'),'real pill counts side by side on a single role row');
assert(allViews.includes('66')&&!allViews.includes('66 / ?'),'uncapped pills display current only');
assert(!allViews.includes('완료1 진행1'),'no abstract group counts');
assert(allViews.includes('data-account-page'),'next-table controls exist');
const trainingView=account.render(roster,'training');
assert(trainingView.includes('수련 기록')&&trainingView.includes('인물'),'training table has names at left');
const sixView=account.render(roster,'cultivation');
assert(sixView.includes('6종 수련')&&sixView.includes('권법')&&sixView.includes('경공'),
 'all six martial cultivation values appear in the paged comparison');
assert(sixView.includes('100 / 1,500'),'six-group values use real cultivation model and 1500 cap');
const roleSource=extract('function yyRoleGrowthOverview(','function yyAccountRecordAndResourceView(');
const roleView=new Function('yyProgressEntries','yyRoleSection','accountProgressBar','escape','save','yyPillEffect',roleSource+';return yyRoleGrowthOverview')(
 progress,section,bar,escaped,fixture,()=> '');
const pillPage=roleView(main,'consumable');
assert(pillPage.includes('용호단')&&pillPage.includes('5 / 5'),'person page shows direct 5/5');
assert(pillPage.includes('대력환')&&pillPage.includes('300 / 300'),'person page shows pills from EatDrugs');
console.log('PASS: per-person and account-wide numeric pill/training records with unknown cap safety');
