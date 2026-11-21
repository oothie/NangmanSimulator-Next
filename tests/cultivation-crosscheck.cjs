// Independent cultivation check against the unmodified Sanbujin source implementation.
// Run: node tests/cultivation-crosscheck.cjs
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'shared','sanbujin_cultivation_data.js'),'utf8');
const evaluator=fs.readFileSync(path.join(root,'shared','sanbujin_role_status_data.js'),'utf8');
const save={globalVariable:{}};
const context={console,save,roles:[],window:null,globalThis:null,
 escape:x=>String(x),yyRoleSection:(name,body)=>'<section>'+name+body+'</section>',
 characterEntries:value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[]};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context);
context.KONGFU_DATA=context.NANGMAN_SANBUJIN_KONGFU;
vm.runInContext(evaluator,context);
const start=html.indexOf('function yyRoleCultivationModel(');
const end=html.indexOf('function yyProgressStat(',start);
assert(start>0&&end>start,'cultivation helpers present');
vm.runInContext(html.slice(start,end),context);
const sample={ID:1,
 Taolus:[{ID:20010,Chong:10,Level:3},{ID:20020,Chong:10,Level:3},
  {ID:20030,Chong:10,Level:3},{ID:20040,Chong:10,Level:3},
  {ID:20010,CopyID:20030,Chong:13,Level:3}],
 Neis:[{ID:22010,Chong:10,Level:3}],Qings:[{ID:24010,Chong:10,Level:3}],
 WXXW1:100,WXXW2:120,WXXW3:50,WXXW4:0,WXXWng:50,WXXWqg:10};
const role={id:1,name:'테스트',type:'주인공',raw:sample};
const tracks=context.yyCultivationCrossCheck(role);
assert.equal(tracks.length,6,'six tracks');
for(const x of tracks){
 assert.equal(x.mismatch,false,'no discrepancy in '+x.id);
 assert.equal(x.unverified,false,'all source skills recognized in '+x.id);
 assert.equal(x.learned,x.originalLearned,'independent calculated contribution in '+x.id);
 assert.equal(x.current,x.originalCurrent,'independent current cultivation in '+x.id);
}
assert.equal(tracks.find(x=>x.id==='3').recognized,1,'copied sword appears in sword category');
const recordedCopy=context.yyRoleCultivationModel(role).records.find(x=>x.id==='2').skills.find(x=>x.id===20010);
assert.equal(recordedCopy.copyId,20030,'copy-origin ID must persist through source calculation');

const unknown={...sample,Taolus:[{ID:999999,Chong:10,Level:3}]};
const unknownRole={...role,raw:unknown};
assert(context.yyCultivationCrossCheck(unknownRole).some(x=>x.unverified),'missing IDs stay unknown');
const negative={...sample,Taolus:[{ID:20010,Chong:100,Level:3}]};
assert(context.yyCultivationCrossCheck({...role,raw:negative}).some(x=>x.unverified),'missing rate rows stay unknown');
console.log('PASS: source-matched, copied martial classification, unknown and missing rate cases');
