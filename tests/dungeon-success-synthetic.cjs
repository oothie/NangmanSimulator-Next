/* Source-derived Korean four-gate success-only consumer regression.
 * Artificial RNG inputs only. No player save, account, identity, measured
 * item outcome, or personal RNG seed is stored in this repository.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const transform=source=>source
 .replace(/^import .*?;\s*$/gm,'')
 .replace(/^export /gm,'');
const draw=new Function(transform(read('engine/dungeon.js'))+';return draw;')();
const engine=transform(read('engine/dungeon-special.js'));
const special=new Function(engine+';return {forecastInterleavedSpecials,specialScenario,evaluateSpecialAwards};')();
const names=['replayLiuManor','replayYanwangfu','replayChangok','replayByeokyu'];
const paths=['engine/dungeon-replay-liu.js','engine/dungeon-replay-yan.js',
 'engine/dungeon-replay-dcy.js','engine/dungeon-replay-byj.js'];
const replay={};
for(let i=0;i<names.length;i++)
 replay[names[i]]=new Function('draw',transform(read(paths[i]))+
  ';return '+names[i]+';')(draw);
const ui=transform(read('engine/dungeon-test.js'));
const predict=new Function(...names,'forecastInterleavedSpecials',ui+
 ';return predictGate;')(...names.map(x=>replay[x]),special.forecastInterleavedSpecials);
const sample={Rnds:{Sds:{seed_lsby:1101,seed_byj:1102,
 seed_33654:1103,seed_33653:1104,seed_33652:1105,seed_33650:1106,
 seed_dcy_40372:1107,seed_dcy_40373:1108,seed_dcy_40374:1109}},
 globalVariable:{win_lsby:30,win_byj:30,win_dcy:30,win_ywf:30,
 roll_35268:0,roll_2924_40372:0,roll_2925_40374:0,
 roll_2926_40373:0},Branch:{byj_bz:{step:-1}},Items:[]};
const untouched=JSON.stringify(sample);
const counts={'연왕부':4,'창옥':3,'벽유교':3,'유씨별원':3};
for(const gate of Object.keys(counts))
 for(const mode of ['current','never_claimed']){
  const data=predict(sample,gate,3,'auto',mode);
  assert.equal(data.output.length,3);
  assert.deepEqual(data.output.map(x=>x.results.length),[counts[gate],counts[gate],counts[gate]]);
  for(const clear of data.output)for(const row of clear.results){
   assert(Array.isArray(row.special));
   assert(Array.isArray(row.unresolved));
   assert(row.special.every(x=>x.name&&x.kind==='지급 조건 충족'));
  }
  assert.equal(JSON.stringify(sample),untouched);
 }
const history={...sample,globalVariable:{...sample.globalVariable,
 get_8295_40374:1,drop_8295_40374:2}};
const current=special.specialScenario(history,'current');
const whatif=special.specialScenario(history,'never_claimed');
assert.equal(current.globalVariable.drop_8295_40374,2);
assert.equal(whatif.globalVariable.get_8295_40374,0);
assert.equal(whatif.globalVariable.drop_8295_40374,undefined);
assert.equal(whatif.Rnds.Sds.seed_dcy_40374,history.Rnds.Sds.seed_dcy_40374);
assert.equal(history.globalVariable.get_8295_40374,1);
assert(!read('engine/dungeon-special.js').includes('applyOriginalBattleLoss'),
 'the deployed success-only engine must not run battle loss/exit restoration');
console.log('PASS: four released gates, 2 ownership scenarios, no personal data or save mutation');
