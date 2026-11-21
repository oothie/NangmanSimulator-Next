// Original yy-sim wash result format preservation, pages, TSV export and UI parity.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/yysim-wash-history.js'),'utf8'),ctx);
const api=ctx.window.YYWashHistory;
const makeWash=i=>({washNo:i,pillsUsed:3,totalPills:i*3,talLucky:Math.min(850,i*2),
 talents:[{id:251,locked:i%2===0},{id:271,locked:false}],
 gotGold:i%37===0,wasPity:i===50});
const rows=api.flatten([
 {performed:50,results:Array.from({length:50},(_,i)=>makeWash(i+1))},
 {performed:52,results:Array.from({length:52},(_,i)=>makeWash(i+51))},
 {type:'goal-lock',targetIds:[251],applied:[0]}, // not a wash: don't forge an event
 {performed:3,outcomes:[makeWash(103),makeWash(104),makeWash(105)]}
]);
assert.equal(rows.length,105);
assert.equal(rows[0].washNo,1);
assert.equal(rows.at(-1).washNo,105);
assert.equal(rows[49].pity,true);
assert.equal(rows[36].gold,true);
assert.equal(rows[49].ids[0].locked,true);
const page1=api.paging(rows,1,50),page2=api.paging(rows,2,50),page3=api.paging(rows,3,50);
assert.equal(page1.page,1);assert.equal(page1.pages,3);
assert.equal(page1.rows[0].washNo,105);assert.equal(page1.rows.at(-1).washNo,56);
assert.equal(page2.rows[0].washNo,55);assert.equal(page2.rows.at(-1).washNo,6);
assert.equal(page3.rows.length,5);assert.equal(page3.rows.at(-1).washNo,1);
assert.equal(api.paging(rows,999,200).page,1);
const tsv=api.tsv(rows,id=>id===251?'일심겸용':'환생금선');
assert(tsv.startsWith('\uFEFF'));
assert(tsv.includes('일심겸용')&&tsv.includes('환생금선'));
assert(tsv.includes('천장')&&tsv.includes('자맥'));
assert(!tsv.includes('undefined'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of ['yysim-wash-history.js','washHistoryExport','washHistoryPrev',
 'washHistoryNext','washHistorySize','washHistoryClear',
 'historyHiddenBefore','YYWashHistory?.flatten','data-wash-main-exchange',
 'washEngineExchangeTalent', 'state.constraints=constraints'])
 assert(html.includes(key),'UI missing '+key);
console.log('PASS: 105 real-shape native washes, latest-first 50/100/200 paging, Korean TSV, conflict exchange controls');
