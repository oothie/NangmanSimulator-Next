'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'index.html'),'utf8');
const native=fs.readFileSync(path.join(root,'engine/yysim-auto-search.js'),'utf8');
const match=/function washOpenedSlots\(value\)\{[\s\S]*?\n\}/.exec(ui);
assert(match,'shared wash opened-slot formatter must be present');
const formatter=vm.runInNewContext(match[0]+'\nwashOpenedSlots;');
for(let i=0;i<=4;i++){
 assert.equal(formatter(150+i),i+'칸','native 150–154 must render as 0–4 slots');
 assert.equal(formatter(String(150+i)),i+'칸');
}
assert.equal(formatter(null),'—');
assert.equal(formatter(155),'—');
assert(ui.includes('개방 칸 수</span>'),'wash card must use opened slots');
assert(ui.includes("['개방 칸 수',washOpenedSlots(r?.raw?.ZiZhi)]"),
 'wash summary must use slot count, not raw ZiZhi');
assert(ui.includes("' · 개방 칸 수 '+escape(washOpenedSlots"),
 'selected character header must show opened slot count');
assert(ui.includes("washOpenedSlots(dashboard?.zizhi"),
 'live WASM dashboard must show opened slot count');
assert(ui.includes("시험 개방 칸 수</label><select id=\"washZizhiInput\""),
 'test state input must display slot counts, not raw aptitude');
assert(ui.includes("[150,151,152,153,154].map(n=>'<option value=\"'+n"),
 'slot selector uses native 150–154 internally and labels 0–4');
assert(ui.includes("zizhi:Number(state.zizhi)||153"),
 'native WASM must continue receiving 150–154, not display-only 0–4');
assert(ui.includes("세수 개방 칸 수: '+washOpenedSlots(snapshot.zizhi)"),
 'upgrade success must describe 0–4 slot units');
assert(ui.includes("개방 칸 수 '+washOpenedSlots(next.zizhi)"),
 'manual test-state initialization must describe opened slots');
assert(native.includes("detail=hint?'개방 칸 수 '+(Number(hint[0])-150)+'칸'"),
 'automated search route steps must describe slot count');
assert(!ui.includes('시험 자질</label>'),'previous aptitude input label must be removed');
console.log('PASS: wash UI 150–154 -> 0–4 opened slots, native values unchanged');
