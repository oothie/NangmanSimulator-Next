#!/usr/bin/env node
/* Public regression: entirely invented RNG seeds; no account data or save snapshots. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.createContext(sandbox);
for(const rel of ['vendor/sanbujin/drops/wild-core.js','vendor/sanbujin/drops/wild-data.js']){
  vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),sandbox,{filename:rel});
}
const {SBJWildDrop:engine,SBJWildCatalog:targets}=sandbox.window;
const sds={};
const vars={};
for(const target of targets){
  if(target.kind==='tomb'||target.seedKey==='seed_41786'||target.seedKey==='seed_51180')continue;
  sds[target.seedKey]=100000+target.npcId;
  if(target.encounter){
    sds[target.encounter.seedKey]=200000+target.npcId;
    vars[target.encounter.counterKey]=0;
  }
  if(target.kind==='tigerbone')sds[target.tigerTypeSeedKey]=300000+target.npcId;
}
const save={Rnds:{Sds:sds,Eds:{}},globalVariable:vars};
assert.equal(Object.hasOwn(vars,'eat_2659'),false);
let valid=0,blocked=0;
for(const target of targets){
  if(target.kind==='tomb')continue;
  const state=engine.open(save,target);
  const missing=!engine.usable(state.seed)||
    target.kind==='tigerbone'&&!engine.usable(state.tigerSeed)||
    target.encounter&&(!engine.usable(state.encounterSeed)||
      !Number.isFinite(state.encounterScore)||!Number.isFinite(state.encounterBoost));
  if(['seed_41786','seed_51180'].includes(target.seedKey)){
    assert.equal(Boolean(missing),true,target.name+' missing-seed guard');
    blocked++;
    continue;
  }
  assert.equal(Boolean(missing),false,target.name+' should be predictable');
  if(target.encounter)assert.equal(state.encounterBoost,0,target.name+' missing bonus defaults to zero');
  const rows=engine.predict(state,target,{pad:0,count:3,bait:'tiger',time:1800000000,interval:60},{});
  assert.equal(rows.length,3,target.name+' should calculate three steps');
  valid++;
}
const encounter=targets.find(t=>t.encounter);
const missingScore={Rnds:{Sds:sds},globalVariable:{}};
const invalid=engine.open(missingScore,encounter);
assert.equal(Number.isFinite(invalid.encounterScore),false,'unknown encounter score must not be invented');
const missingRng={Rnds:{Sds:{...sds}},globalVariable:vars};
delete missingRng.Rnds.Sds[encounter.encounter.seedKey];
assert.equal(engine.usable(engine.open(missingRng,encounter).encounterSeed),false,
  'unknown encounter RNG must not be invented');
const explicitBonus=engine.open({Rnds:{Sds:sds},globalVariable:{...vars,eat_2659:3}},encounter);
assert.equal(explicitBonus.encounterBoost,3,'present bonus value must be respected');
console.log('PASS: synthetic field seed coverage; predictable='+valid+', missing='+blocked);
