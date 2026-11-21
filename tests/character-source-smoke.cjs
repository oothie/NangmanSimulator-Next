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
assert.match(missing, /지원 재능 정보 없음/);
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
assertBase('집기 기본값', levelBase, 2);
assertBase('강기 기본값', {...levelBase, Level: 92}, 0);
assertBase('내경 기본값', {...levelBase, Level: 92}, 0);
assertBase('강기 기본값', {...levelBase, Level: 93}, 15);
assertBase('내경 기본값', {...levelBase, Level: 93}, 60);
assertBase('강기 기본값', {...levelBase, Level: 94}, 30);
assertBase('내경 기본값', {...levelBase, Level: 94}, 80);
assert.match(supported, /#354/);
assert.match(supported, /지원 가능<\/span><b>가능/);
assert.match(supported, /공격 · 계수 30/);
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
context.window.KONGFU_DATA={taolu:{'21470':{type:3},'21330':{type:2}}};
const sword=context.characterEquipCombatSplit({Taolus:[{ID:21470,Active:true}],
 Equips:[{ID:7283,Atk:935,LvProp:129,EnExts:[{Key:'sword_add',Value:0.0475}]},
 {ID:5015,EnExts:[{Key:'sword_add',Value:0.02275}]}]});
assert.equal(sword.weaponKey,'sword_add','active sword type from source table');
assert(Math.abs(sword.weaponBonus-.07025)<1e-9,'sword attack percentage across all equipment');
const noActive=context.characterEquipCombatSplit({Taolus:[{ID:21470,Active:false}],Equips:[{ID:7283}]});
assert.equal(noActive.weaponBonus,null,'no invented active weapon type');

context.window.EQUIP_DATA.equipment['7201']={type:2};
const mixed=context.characterEquipCombatSplit({Taolus:[{ID:21470,Active:true}],
 Equips:[{ID:7283,Atk:100,Hit:300},{ID:7201,Atk:75,Hit:220}]});
assert.equal(mixed.weapon.atk,175,'all weapons contribute attack independent of active type');
assert.equal(mixed.weapon.hit,300,'incompatible blade hit excluded when active martial is sword');
assert.equal(mixed.rawWeaponHit,520,'raw equipment hit preserved for audit');
assert.equal(mixed.excludedWeaponHit.length,1,'excluded weapon shown');
assert.equal(mixed.excludedWeaponHit[0].id,7201,'excluded ID preserved');
context.window.BORN_TALENT_DATA={'285':{effects:[['weapon',0.05],['def_ign',0.06]]},'282':{effects:[['hp',0.08]]}};
const born=context.characterEquipCombatSplit({BornTalent:{ID:285},
 Taolus:[{ID:21470,Active:true}],Equips:[{ID:7283,Atk:935,LvProp:129}]});
assert.equal(born.bornWeaponPct,0.05,'born trait original weapon multiplier');
assert.equal(born.bornWeaponAtk,52,'weapon attack born trait partial contribution');
const unrelated=context.characterEquipCombatSplit({BornTalent:{ID:282},Equips:[{ID:7283,Atk:935}]});
assert.equal(unrelated.bornWeaponAtk,0,'unrelated born talent effect is not weapon boost');
const noBorn=context.characterEquipCombatSplit({BornTalent:{ID:99999},Equips:[{ID:7283,Atk:935}]});
assert.equal(noBorn.bornWeaponAtk,null,'unknown born talent is not guessed');
assert.match(context.characterEquipCombatSplitView({BornTalent:{ID:285},Equips:[{ID:7283,Atk:935,LvProp:129}]}),/부분 증가분 52/);

const unknownType=context.characterEquipCombatSplit({Equips:[{ID:7283,Hit:300},{ID:7201,Hit:220}]});
assert.equal(unknownType.weapon.hit,520,'unknown active type does not claim excluded hit');
assert.equal(unknownType.weaponHitEligibilityKnown,false,'unknown subtype explicitly flagged');

assert.match(context.characterEquipCombatSplitView({Taolus:[{ID:21470,Active:true}],
 Equips:[{ID:5015,EnExts:[{Key:'sword_add',Value:0.02275}]}]}),/2.275%/);

assert.match(context.characterEquipCombatSplitView({Equips:[{ID:999999,Atk:12}]}),/장비 분류 미확인/);

// yy-sim original u0()/Od() training combat bonus, independently sourced from cultivation table.
const trainingBegin=html.indexOf('function yyOriginalCultivationEffects(raw){');
const trainingEnd=html.indexOf('function yyRoleSavedCultivationSummary(role){',trainingBegin);
assert(trainingBegin>0 && trainingEnd>trainingBegin,'original cultivation effects functions present');
context.yyRoleSection=(name,content)=>'<section>'+name+content+'</section>';
vm.runInContext(html.slice(trainingBegin,trainingEnd),context);
context.window.KONGFU_DATA={rate:{'39':{'kf_1':1,'kf_2':1,'kf_3':1}},taolu:{
 '20010':{type:1,wxxw:10,grade:1},'20020':{type:2,wxxw:20,grade:2}
},nei:{'22010':{wxxw:40,grade:3}},qing:{'24010':{wxxw:30,grade:2}}};
const cultivation=context.yyOriginalCultivationEffects({WXXW1:1485,WXXW2:10,WXXW3:0,WXXW4:0,
 WXXWng:970,WXXWqg:0,QuanGift:2,DaoGift:1.5,NGGift:1.2,QGGift:1,
 Taolus:[{ID:20010,Chong:10,Level:2},{ID:20020,Chong:10,Level:2}],
 Neis:[{ID:22010,Chong:10,Level:2}],Qings:[{ID:24010,Chong:10,Level:2}]});
const byKind=Object.fromEntries(cultivation.map(x=>[x.id,x]));
assert.equal(byKind['1'].current,1495,'cultivation skill + saved WXXW');
assert.equal(byKind['1'].bonusPct,74.75,'gift coefficient * 0.025');
assert.equal(byKind['2'].current,30,'blade cultivation independent of sword');
assert.equal(byKind['ng'].current,1010,'inner cultivation');
assert.equal(byKind['ng'].mpBack,1,'inner cultivation 1000-point recovery threshold');
assert.equal(byKind['qg'].current,30,'lightness cultivation');
const capped=context.yyOriginalCultivationEffects({WXXW1:1501,Taolus:[],Neis:[],Qings:[]});
assert.equal(capped[0].current,1500,'per-kind cap 1500');
assert.equal(capped[0].bonusPct,37.5,'gift falls back to source default 1');
assert(context.yyOriginalCultivationEffectsView({raw:{WXXW1:10,Taolus:[]}}).includes('수련 전투 보정'));

console.log('PASS: saved BornTalent lookup and yy-sim body formulas and equipment option subtotals and weapon-specific attack/hit and cultivation percentage');
