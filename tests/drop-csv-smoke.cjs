// Drop CSV export is read-only, filter preserving, and spreadsheet-safe.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..','vendor','sanbujin','drops'),ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'drop-export.js'),'utf8'),ctx);
const api=ctx.window.SBJDropExport;
const columns=[{title:'회차',key:'serial'},{title:'한국어',key:'label'},{title:'ID',key:'itemId'}];
const before=[{serial:1,label:'=SUM(1,2)',itemId:4009},{serial:2,label:' +cmd',itemId:4209},
 {serial:3,label:'"검",은',itemId:4409},{serial:4,label:'-1+2',itemId:4609}];
const snapshot=JSON.stringify(before);
const csv=api.csv(columns,before);
assert(csv.startsWith('\uFEFF'),'UTF-8 BOM for Korean spreadsheet');
assert(csv.includes('"\'=SUM(1,2)"'),'formula neutralized');
assert(csv.includes('"\' +cmd"'),'leading spaces and formula neutralized');
assert(csv.includes('"\'-1+2"'),'minus-formula neutralized');
assert(csv.includes('"""검"",은"'),'CSV quoted Korean commas');
assert.equal(JSON.stringify(before),snapshot,'export never mutates original projection');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wild=fs.readFileSync(path.join(root,'wild.js'),'utf8');
const dungeon=fs.readFileSync(path.join(root,'dungeon.js'),'utf8');
assert(html.includes('src="./drop-export.js"'));
assert(html.includes('id="wildExport"')&&html.includes('id="dungeonExport"'));
assert(wild.includes("SBJDropExport.save('Nangman_Wild_Drop_"));
assert(dungeon.includes("SBJDropExport.save('Nangman_Dungeon_Drop_"));
assert(wild.includes('최종 정련/망정 미연결'));
assert(dungeon.includes('최종 정련/망정 미연결'));
console.log('PASS: safe CSV for field/dungeon drop IDs and unverified final-equipment warnings');
