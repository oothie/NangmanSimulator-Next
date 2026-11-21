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
assert(!source.includes('v0.7.14'),'old version label removed');
console.log('PASS: yy-sim role page structure, all 8 tabs, selector wiring and version labels');
