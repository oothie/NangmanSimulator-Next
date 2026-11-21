// yy-sim real purple output schema: wash_no vs wash_times, conflict and export.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base,'engine','wash-preview-model.js'),'utf8'),ctx);
const api=ctx.window.NangmanWashPreview;
const example={purples:[
 {wash_no:8,wash_times:3,cumulative_pills:9,pills_from_previous_purple:9,
  talent_id:264,talent_name:'枪棍绝伦',can_exchange:false,was_pity:false,
  earlier_conflict_name:null},
 {wash_no:203,wash_times:68,cumulative_pills:204,pills_from_previous_purple:195,
  talent_id:276,talent_name:'不灭肉身',can_exchange:true,was_pity:true,
  earlier_conflict_name:'朝气蓬勃',earlier_conflict_wash_times:62,already_landed:false}]};
const original=JSON.stringify(example),rows=Array.from(api.normalize(example));
assert.equal(rows.length,2);
assert.equal(rows[0].event,8,'source wash_no is not the actual cycle');
assert.equal(rows[0].washes,3,'native wash_times = actual cycle');
assert.equal(rows[1].pills,204);
assert.equal(rows[1].gapPills,195);
assert.equal(rows[1].conflictWashes,62);
assert.equal(rows[1].exchangeable,true);
assert.equal(api.filter(rows,'exchange').length,1);
assert.equal(api.filter(rows,'blocked').length,1);
assert.equal(api.filter(rows,'pity').length,1);
assert.equal(api.filter(rows,'landed').length,0);
assert.throws(()=>api.filter(rows,'undefined'),/필터/);
assert.equal(api.display('不灭肉身',{'不灭肉身':276},id=>'한국'+id),'한국276 (#276)');
assert.equal(api.display('미확인 값',{}), '미확인 값');
const csv=api.csv(rows,{'枪棍绝伦':264,'不灭肉身':276,'朝气蓬勃':186},id=>'재능'+id);
assert(csv.startsWith('\uFEFF'));
assert(csv.includes('재능276 (#276)'));
assert(csv.includes('재능186 (#186)'));
assert(csv.includes('204'));
assert.equal(JSON.stringify(example),original,'preview presentation never mutates WASM output');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
for(const key of ['washPreviewFilter','washPreviewExport','data-wash-use-target','washPreviewCount'])assert(html.includes(key));
assert(html.includes('./engine/wash-preview-model.js'));
assert(html.includes('state.previewNameIds=result?.nameIds||{}'));
const host=fs.readFileSync(path.join(base,'vendor','yysim','engine-host.html'),'utf8');
assert(host.includes('Array.isArray(preview.purples)'));
console.log('PASS: original WASM purple event vs cycle, conflict, pity, Korean CSV and UI');
