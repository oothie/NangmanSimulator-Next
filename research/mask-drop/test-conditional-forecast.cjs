#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const {draw,conditionalRolls}=require('./conditional-forecast.cjs');
const environment={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/sanbujin/drops/wild-core.js'),'utf8'),
 environment,{filename:'wild-core.js'});
const original=environment.window.SBJWildDrop.draw;
assert.equal(typeof original,'function','original field RNG not loaded');
for(const seed of [1,23915,658279,1987662420])
 for(const bound of [1,3,100,1111,1000]){
  const value=draw(seed,bound);
  const expected=original(seed,bound);
  assert.equal(value.seed,expected.seed);
  assert.equal(value.roll,expected.value);
 }
for(const seed of [1,23915,658279]){
 const result=conditionalRolls(seed,{count:2000});
 assert.equal(result.source.includes('HYPOTHESIS_ONLY'),true);
 assert(result.first==null||result.first>=1&&result.first<=2000);
 assert(result.next.every(x=>x>=1&&x<=2000));
}
console.log('PASS: research-only mask sequence uses existing field RNG math; no native drop claims');
