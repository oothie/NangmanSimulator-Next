'use strict';
// Regression: a live Korean save contains valid Diling RNG streams without
// globalVariable["3007"]. This optional story gate must not disable prediction.
// This test checks executability only; it does NOT assert server prediction accuracy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const ctx = {window:{}};
vm.createContext(ctx);
for (const name of ['wild-core.js', 'tomb-core.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/drops',name),'utf8'),ctx);
const save = {Rnds:{Sds:{rollenemy_tomb:1456365169,seed_35256:492075794}},
  globalVariable:{eat_2659:9,rollenemy_tomb2:200,get_history:6,treasure_hunting_cbt:2}};
const engine = ctx.window.SBJTombDrop;
const state = engine.open(save);
assert.equal(engine.ready(state),true,'missing 3007 does not prevent simulation');
assert.equal(state.missingFlags.length,0);
const before = JSON.stringify(save);
for(const order of ['descending','ascending']) {
  const rows = engine.predict(state,{count:40,order});
  assert.equal(rows.length,40);
  assert.equal(rows.every(r=>Number.isInteger(r.serial)),true);
}
assert.equal(JSON.stringify(save),before,'source save unchanged');
const blocked = engine.open({...save,globalVariable:{...save.globalVariable,'3007':5}});
assert.equal(engine.predict(blocked,{count:1})[0].reason,
  '제릉 조건 3007 미충족 · 일반 전투',
  'explicit saved story gate still honored');
console.log('PASS: Diling optional 3007 regression, two hypothetical orders, source untouched');
