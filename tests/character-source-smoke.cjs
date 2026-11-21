// Regression tests for yy-sim character helpers. Run: node tests/character-source-smoke.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const begin = html.indexOf('function characterBattleSupport(role){');
const end = html.indexOf('\nfunction characterTrainingView(', begin);
assert(begin >= 0 && end > begin, 'character function boundaries must exist');
const context = {
 window: {
  CHAR_DATA: {'10058': {talent: 354}}, // must NOT be used as the active support talent
  BATTLE_TALENT_DATA: {'354': {effect1: [-1,'atk',30]}},
  NANGMAN_BATTLE_TALENTS_KO: {}
 },
 escape: value => String(value),
 wikiHasChinese: text => /[\u3400-\u9fff]/.test(text)
};
vm.createContext(context);
vm.runInContext(html.slice(begin, end), context);
const baseRole = {
 id: 10058,
 raw: {Level: 90, GrowDefence: 5, ExtDefence: 89, GrowHit: 2, ExtHit: 279, ExtParry: 98,
       BornTalent: {ID: 285}, CanZhu: false}
};
const missing = context.characterBattleSupport(baseRole);
assert.match(missing, /지원 재능 기록 없음/);
assert.doesNotMatch(missing, /#354/);
const base = context.characterSourceBasePanel(baseRole.raw);
for (const expected of ['551','549','236']) assert.match(base, new RegExp('>'+expected+'<'));
const supported = context.characterBattleSupport({
 id:10058, raw:{BornTalent:{ID:354},CanZhu:true}
});
assert.match(supported, /#354/);
assert.match(supported, /지원 가능 상태<\/span><b>가능/);
assert.match(supported, /원본 계수 30/);
assert.doesNotMatch(supported, /풍행객/);
console.log('PASS: saved BornTalent lookup and three independent yy-sim body formulas');
