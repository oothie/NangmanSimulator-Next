// Node.js regression test for Korean save-backed character information.
// Fixtures are synthetic and contain no user save data.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function section(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start);
 assert(start>=0&&end>start,'Missing script section: '+a);
 return html.slice(start,end);
}
const window={
 EQUIP_DATA:{equipment:{5015:{type:6,koName:'우스아대'},5209:{type:7}},fashion:{7163:{type:10,koName:'청조가랑'}}},
 NANGMAN_CRAFT_ID_KO:{'301':{name:'음률',desc:'기예'}},
 NANGMAN_ARTS_ID_KO:{'391':{name:'유서유경',desc:'비기'}},
 NANGMAN_SANBUJIN_JINGMAI:{'101':[['atk',50],['hit',40],['str',5],['con',5]]},
 NANGMAN_TALENT_NAMES_KO:{'285':'병기 애호','260':'양의상합'},
 NANGMAN_SANBUJIN_LIFE_META:{'301':{type:1},'391':{type:2,effects:[['def_ign',30,0.01],['atk',60,0.01]]}}
};
const escape=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const context={window,escape,characterNumber:(o,k)=>o?.[k]??'—',
 wikiHasChinese:x=>/[\u3400-\u9fff]/.test(String(x)),
 wikiKoMap:()=>new Map([['equips:5015',{name:'한국판 완갑'}]]),
 koreanWiki:[],console};
vm.createContext(context);
vm.runInContext(section('const characterCraftIds=','// 산부진 role_status_data.js 원본의 확정'),context);
vm.runInContext(section('function characterTalentName(','function characterView(){'),context);
const role={name:'시험 인물',raw:{
 Equips:[{ID:5015,Color:4,Level:12,Hit:700,EnExts:[{Key:'sword_add',Value:0.0475}],EnMans:[{Key:'atk',Value:69}]},{ID:7163,Level:0}],
 JingMais:[{ID:101,Index:11,Order:1,Tong:false},{ID:105,Index:5,Order:-1,Tong:true}],
 LifeSkills:[{ID:301,Level:300},{ID:391,Level:200}],
 LifeProps:[],
 BornTalent:{ID:285,Lock:false,RC:0},Talents:[{ID:260,Lock:true,RC:2},{ID:278,Lock:true,RC:3},{ID:401,Lock:true,RC:4}],
 RXiSui:79,ZiZhi:153
}};
let htmlEquip=vm.runInContext('characterEquipView',context)(role.raw);
assert.match(htmlEquip,/한국판 완갑/);assert.match(htmlEquip,/4\.8%/);assert.match(htmlEquip,/공격 \+69/);
let htmlMer=vm.runInContext('characterMeridianView',context)(role.raw);
assert.match(htmlMer,/수소음경/);assert.match(htmlMer,/10 \/ 10/);assert.match(htmlMer,/음맥/);
assert.match(htmlMer,/공격 [+]50/);assert.match(htmlMer,/선택 보너스: 완력 [+]5/);
let htmlLife=vm.runInContext('characterLifeView',context)(role.raw);
assert.match(htmlLife,/음률/);assert.match(htmlLife,/기예 · 1개/);assert.match(htmlLife,/비기 · 1개/);assert.match(htmlLife,/방어 관통 [+]6%/);
let htmlWash=vm.runInContext('characterWashView',context)(role,{XiSui:3273});
assert.match(htmlWash,/3273/);assert.match(htmlWash,/79/);assert.match(htmlWash,/병기 애호/);
assert.equal(vm.runInContext('characterWashTalents',context)(role).length,3);
context.wikiSource=null;context.wikiFallbackSource=null;
vm.runInContext(section('function wikiRows(){','function wikiKoMap(){'),context);
const rows=vm.runInContext('wikiRows',context)();
assert.equal(rows.filter(x=>x.cat==='craft').length,1);
assert.equal(rows.filter(x=>x.cat==='arts').length,1);
assert(!html.includes('nativeCharacterPanel('),'Cancelled character image preview was restored');
console.log('PASS: equipment, meridians, crafts/arts, wash and wiki fallback');
