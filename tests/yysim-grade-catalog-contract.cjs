'use strict';
// Read-only cross-check of user-selectable Korean target grades against the
// source yy-sim TALENT_DATA. Data integrity is a prerequisite for extending
// the ORIGINAL WASM search, not evidence that mixed-grade search now works.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
for(const filename of ['vendor/yysim/data.js','engine/yysim-target-catalog.js']){
 const script=fs.readFileSync(path.join(root,filename),'utf8');
 vm.runInContext(script,ctx,{filename});
}
const catalog=ctx.window.YYWashTargetCatalog;
const source=vm.runInContext('TALENT_DATA',ctx);
assert(Array.isArray(catalog)&&catalog.length===3,'Expected green/blue/purple categories');
const seen=new Set(),counts={2:0,3:0,4:0};
const excluded=new Set([236,244,245,255,277,408]);
for(const group of catalog){
 assert([2,3,4].includes(group.quality),'Only native talent grades 2/3/4');
 for(const talent of group.items){
  const id=talent.id,data=source[String(id)];
  assert(Number.isSafeInteger(id)&&id>0,'Invalid user-facing talent id');
  assert(data,'Target talent missing from original WASM init dataset: '+id);
  assert.equal(Number(data.pinzhi),group.quality,
   'Mismatch between Korean target grade and native talent grade: '+id);
  assert(!seen.has(id),'Duplicated selectable native talent id: '+id);
  assert(!excluded.has(id),'Unavailable or excluded dummy selectable: '+id);
  assert(typeof talent.ko==='string'&&talent.ko.trim(),'Missing Korean name: '+id);
  assert(typeof talent.name==='string'&&talent.name.trim(),'Missing source name: '+id);
  seen.add(id);counts[group.quality]++;
 }
}
assert(counts[2]>0&&counts[3]>0&&counts[4]>0,'Missing any expected grade');
// Representative mixed-grade native probes must use different source type
// families. Historically blue 191 and purple 271 were both type=177,
// making the old "all final slots" test ambiguous for reasons unrelated to
// native support for green or blue quality.
const compatibleFixture=[184,202,271];
assert.deepEqual(compatibleFixture.map(id=>Number(source[String(id)].pinzhi)),[2,3,4]);
assert.equal(new Set(compatibleFixture.map(id=>Number(source[String(id)].type))).size,3,
 'Mixed grade fixture has overlapping native type families');
assert.equal(Number(source['191'].type),Number(source['271'].type),
 'Former conflicting blue-purple regression fixture changed');
const nativeContract=fs.readFileSync(
 path.join(root,'tests/yysim-native-grade-contract.cjs'),'utf8');
const workerContract=fs.readFileSync(
 path.join(root,'tests/yysim-native-worker-parity.cjs'),'utf8');
assert(nativeContract.includes('[184,202,271]'));
assert(workerContract.includes('[184,202,271]'));

const host=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
assert(host.includes('![2,3,4].includes(TALENT_DATA[String(id)]?.pinzhi)'),
 'Original WASM search must accept only known green/blue/purple grade IDs');
assert(host.includes('completeRoutes=result.routes.filter(route=>'),
 'Native mixed result must verify every requested goal in the final slots');
assert(host.includes('nativeDiagnostics'),
 'The host must distinguish incomplete native mixed paths from valid results');
assert(host.includes('wasmSearchWashRoutes'),
 'Host search must still call original native WASM');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(page.includes('목표 전부 확보'),
 'Mixed route results must indicate that all final talents coexist');
assert(page.includes('따라 하기 · '),
 'Native route must present a clearly ordered gameplay guide');
assert(!page.includes('tests/yysim-native-live-probe.html'),
 'Auto-search must not advertise a redundant public inspection page');
console.log('PASS: source-matched grade catalog counts',JSON.stringify(counts),
 'no dummy IDs, experimental original-native mixed IDs, strict final routes');
