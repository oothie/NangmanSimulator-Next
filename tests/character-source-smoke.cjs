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
const levelBase = Object.assign({}, baseRole.raw, {GrowGangqi: 15, ExtGangqi: 0, GrowNeijin: 20, ExtNeijin: 0});
function assertBase(label, raw, expected) {
 const html = context.characterSourceBasePanel(raw);
 const fragment = html.match(new RegExp('<span>'+label+'</span><b>([^<]+)</b>'));
 assert(fragment, label+' must exist');
 assert.equal(Number(fragment[1]), expected, label);
}
assertBase('강기 기본값', levelBase, 0);
assertBase('내경 기본값', levelBase, 0);
assertBase('기 회복 기본값', levelBase, 2);
assertBase('강기 기본값', {...levelBase, Level: 92}, 0);
assertBase('내경 기본값', {...levelBase, Level: 92}, 0);
assertBase('강기 기본값', {...levelBase, Level: 93}, 15);
assertBase('내경 기본값', {...levelBase, Level: 93}, 60);
assertBase('강기 기본값', {...levelBase, Level: 94}, 30);
assertBase('내경 기본값', {...levelBase, Level: 94}, 80);
assert.match(supported, /#354/);
assert.match(supported, /지원 가능 상태<\/span><b>가능/);
assert.match(supported, /원본 계수 30/);
assert.doesNotMatch(supported, /풍행객/);
// Additional regression: source S1/Yt/Ia/Af/qf gear subtotals; avoid final combat claims.
const equipBegin = html.indexOf('function characterEquipSourceStats(raw){');
const equipEnd = html.indexOf('function characterEquipView(raw){', equipBegin);
assert(equipBegin >= 0 && equipEnd > equipBegin, 'equipment source helpers must exist');
context.characterEntries = v => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];
vm.runInContext(html.slice(equipBegin, equipEnd), context);
const equipment = {Equips:[{
 ID:1, Hp:100, Def:200, Dodge:10, Parry:20, Speed:30, RenXing:3,
 Gangqi:4, ExtraGangqi:6, Neijin:5, ExtraNeij:7, LvProp:100,
 EnExts:[{Key:'dodge_add',Value:15},{Key:'speed_add',Value:25},{Key:'hp_add',Value:8}],
 EnMans:[{Key:'gangqi',Value:11}], EnSpecials:[{Key:'neijin',Value:9}],
 EnStroys:[{Buff:'def_add',Type:5}], EnNoXLExts:[{Key:'hp_add',Value:1000}]
}]};
const subtotal = Object.fromEntries(
 context.characterEquipSourceStats(equipment).map(x=>[x.label,x.base+x.affix]));
for (const [label,expected] of Object.entries({
 '기혈':118,'방어':225,'회피':26,'초식방어':22,
 '속도':58,'인내':3,'강기':21,'내경':21
})) assert.equal(subtotal[label], expected, 'gear partial '+label);
assert.equal(subtotal['기혈'],118,'EnNoXLExts must be excluded');

// Original wb() weapon-specific ATK/HIT split: weapon types 1-4, other equipment separate.
const splitStart=html.indexOf('function characterEquipCombatSplit(raw){');
const splitEnd=html.indexOf('function characterEquipSourceView(raw){',splitStart);
assert(splitStart>0&&splitEnd>splitStart,'source split helpers should exist');
context.window.EQUIP_DATA={equipment:{
 '7283':{type:3},'5015':{type:6},'5409':{type:8}
}};
vm.runInContext(html.slice(splitStart,splitEnd),context);
const split=context.characterEquipCombatSplit({Equips:[
 {ID:7283,Atk:935,Hit:900,LvProp:129,EnExts:[{Key:'hit_add',Value:10}]},
 {ID:5015,Hit:731,EnExts:[{Key:'atk_add',Value:96}]},
 {ID:5409,Def:100},
 {ID:999999,Atk:12}
]});
assert.equal(split.weapon.atk,1055,'weapon attack with LvProp');
assert.equal(split.weapon.hit,1026,'weapon hit with LvProp and affix');
assert.equal(split.other.atk,96,'nonweapon attack affix');
assert.equal(split.other.hit,731,'nonweapon hit');
assert.equal(split.unknown.length,1,'unknown weapon category not guessed');
assert.equal(split.complete,false,'metadata incomplete');
assert.match(context.characterEquipCombatSplitView({Equips:[{ID:999999,Atk:12}]}),/장비 분류 미확인/);

console.log('PASS: saved BornTalent lookup and yy-sim body formulas and equipment option subtotals and weapon-specific attack/hit');
