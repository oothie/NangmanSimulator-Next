'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/sanbujin/drops/dungeon-v3-reverse-exact.js'),'utf8'),context);
const {draw,previous,reverseSteps}=context.window.SBJDungeonV3ReverseExact;
for(const seed of [1,4,197,40372,123456789,661129739,2047483645]){
 for(const bound of [1,3,4,66,100,1000,1001,1210,2355,35388,99999999]){
  const hit=draw(seed,bound);
  assert(previous(hit.seed,bound).includes(seed),`inverse did not contain original seed ${seed}/${bound}`);
 }
}
const seed=661129739,one=draw(seed,100),two=draw(one.seed,4),three=draw(two.seed,100);
const pathResult=reverseSteps(three.seed,[{label:'one',bound:100,value:one.value},
 {label:'two',bound:4,value:two.value},{label:'three',bound:100,value:three.value}]);
assert(pathResult.candidates.some(x=>x.seed===seed));
assert.equal(reverseSteps(three.seed,[{bound:4,value:9}]).candidates.length,0);
console.log('PASS: exact algebraic reverse matches 77 synthetic draws and 3-step path; impossible constraints rejected');
