#!/usr/bin/env node
/* Internal four-gate research only. Artificial RNG streams, never account saves. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const source=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const unwrap=s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
const draw=new Function(unwrap(source('engine/dungeon.js'))+';return draw;')();
const modules=[
 ['연왕부','engine/dungeon-replay-yan.js','replayYanwangfu'],
 ['창옥','engine/dungeon-replay-dcy.js','replayChangok'],
 ['벽유교','engine/dungeon-replay-byj.js','replayByeokyu'],
 ['유씨별원','engine/dungeon-replay-liu.js','replayLiuManor']
];
const producers=Object.fromEntries(modules.map(([gate,filename,fn])=>
 [gate,new Function('draw',unwrap(source(filename))+';return '+fn+';')(draw)]));
const forecast=new Function(unwrap(source('engine/dungeon-special.js'))+
 ';return forecastInterleavedSpecials;')();
const {createMixedRunner}=require('./mixed-four-gate.cjs');
const run=createMixedRunner(producers,forecast);
const keys=['seed_lsby','seed_byj','seed_33654','seed_33653','seed_33652',
 'seed_33650','seed_dcy_40372','seed_dcy_40373','seed_dcy_40374'];
function fakeSave(i){
 return {Rnds:{Sds:Object.fromEntries(keys.map((key,index)=>
   [key,101001+((i*23917+index*50051)%1600000000)]))},
  globalVariable:{
   win_lsby:12+i%35,win_ywf:12+i%35,win_dcy:12+i%35,win_byj:12+i%35,
   roll_35268:0,roll_2924_40372:0,roll_2925_40374:0,roll_2926_40373:0
  },Branch:{byj_bz:{step:-1}},Items:[]};
}
const schedules=[
 ['벽유교','창옥','연왕부','유씨별원','유씨별원','유씨별원'],
 ['유씨별원','연왕부','벽유교','창옥','유씨별원','벽유교'],
 ['연왕부','연왕부','창옥','벽유교','유씨별원','창옥']
];
let cases=0,specialUnknowns=0,hiddenGradeRolls=0;
for(let i=0;i<100;i++)for(const schedule of schedules)for(const mode of ['current','never_claimed']){
 const save=fakeSave(i),snapshot=JSON.stringify(save);
 const first=run(save,schedule,{claimMode:mode,includePrivateState:true});
 assert.equal(JSON.stringify(save),snapshot,'save must stay immutable');
 assert.equal(first.runs.length,schedule.length);
 const counts={};
 for(const event of first.runs){
  counts[event.gate]=(counts[event.gate]||0)+1;
  assert.equal(event.clear,counts[event.gate]);
  assert.equal(event.equipment.length,event.gate==='연왕부'?4:3);
  for(const gear of event.equipment){
   assert(gear.name,'Korean item name or no-drop label required');
   assert.equal(gear.itemId==null,gear.gradeCode===0);
   if(gear.itemId==null&&gear.rolledGradeCode!=null)hiddenGradeRolls++;
  }
  specialUnknowns+=event.unresolved;
 }
 // Independent per-clear oracle using the source consumer directly.
 let prior=save,globalNumeric=null,globalTemp=null;
 for(let j=0;j<schedule.length;j++){
  const gate=schedule[j];
  const raw=forecast(prior,gate,producers[gate],1,{
   mode:j===0?mode:'current',keyMode:'auto',tempState:globalTemp,
   numericState:globalNumeric,tempLifetime:'unknown',numericAfterGrant:'unknown',
   applyUnverifiedWhaleForwardReceipts:false
  });
  assert.equal(raw.rows.length,1);
  const actual=raw.rows[0].producer;
  const entry=first.runs[j];
  assert.equal(entry.drawCount,actual.drawCount);
  assert.deepEqual(entry.equipment.map(x=>[x.itemId,x.rolledGradeCode]),
   actual.results.map(x=>[x.itemId,x.gradeCode??null]));
  assert.deepEqual(entry.grants.map(x=>[x.npc,x.itemId,x.predicted,x.unresolved]),
   raw.rows[0].grants.map(x=>[x.npc,x.itemId,x.predicted===true,x.unresolved===true]));
  prior=raw.nextState;globalNumeric=raw.numericState;globalTemp=raw.tempState;
 }
 assert.deepEqual(first.privateNextState.Rnds.Sds,prior.Rnds.Sds);
 assert.deepEqual(first.privateNextState.globalVariable,prior.globalVariable);
 cases++;
}
const seed=fakeSave(3);
assert.throws(()=>run(seed,['문향교']),/Only 1–40/);
assert.throws(()=>run(seed,['유씨별원'],{liuKeyTimeline:[true,false]}),/Key timeline/);
assert.throws(()=>run(seed,['유씨별원'],{claimMode:'unknown'}),/ownership scenario/);
assert.equal(JSON.stringify(seed),JSON.stringify(fakeSave(3)));
console.log('PASS: '+cases+' mixed-clear synthetic scenarios; preserved hidden no-drop grade rolls '+hiddenGradeRolls+'; unresolved special checks '+specialUnknowns);
