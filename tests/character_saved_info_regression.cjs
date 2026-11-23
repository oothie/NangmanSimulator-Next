'use strict';
// Public release uses synthetic role records; no private user save is embedded.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function part(a,b){const begin=html.indexOf(a),end=html.indexOf(b,begin);
 assert(begin>=0&&end>begin,'Missing current character module source '+a);
 return html.slice(begin,end);
}
const formatTime=new Function(part('function characterTalentTimeDisplay(','function characterWashTalents(')+';return characterTalentTimeDisplay')();
const talents=new Function('characterEntries',part('function characterWashTalents(','function characterWashView(')+';return characterWashTalents')(
 x=>Array.isArray(x)?x:x&&typeof x==='object'?Object.values(x):[]);
const fixture={id:10044,raw:{ID:10044,ZiZhi:153,Sex:1,
 Talents:[{ID:285,Lock:true,Time:'20251213130814_3225',RC:100},
 {ID:260,Lock:true,Time:'',RC:80},{ID:274,Lock:false,Time:'',RC:50}]}};
const list=talents(fixture);
assert.equal(list.length,3);
assert.deepEqual(list.map(x=>x.id),[285,260,274]);
assert.deepEqual(list.map(x=>x.locked),[true,true,false]);
assert.equal(list[0].rc,100);
assert.equal(formatTime('20251213130814_3225'),'2025.12.13 13:08:14 · 기록 #3225');
assert.equal(formatTime(''),'—');
for(const item of [
 'function characterSkillName(','function characterMeridianEffect(',
 'function characterWashView(','function characterView(){',
 "['equip','장비']","['talent','재능']","['training','수련']","['consumable','단약']",
 'NANGMAN_SANBUJIN_JINGMAI','NANGMAN_CRAFT_ID_KO','NANGMAN_ARTS_ID_KO',
 'NANGMAN_54506_SKILLS_KO']){
 assert(html.includes(item),'Character Korean localization/UI missing '+item)
}
assert(!html.includes('nativeCharacterPanel('),'Cancelled sprite preview must remain absent');
console.log('PASS: Korean character tabs, save-backed talent locking/values/times, craft, meridian and skill dictionaries');
