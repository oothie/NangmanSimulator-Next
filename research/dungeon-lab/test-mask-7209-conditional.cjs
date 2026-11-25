#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {draw,analyze,NPC}=require('./mask-7209-conditional.cjs');
const fixture={Rnds:{Sds:{aidrop70:12345}}}; // Synthetic only.
let sd=12345,expected=[];
for(let i=1;i<=20000&&expected.length<5;i++){
 const v=BigInt.asUintN(64,(BigInt(sd)+100n)*245109059551232n+48083817484545n);
 const r=(v>>17n)&2147483647n;
 sd=Number(r%2047483645n+1n);
 if(sd%100+1===1)expected.push(i);
}
const result=analyze(fixture);
assert.deepEqual(result.firstFiveMaskCandidateDraws,expected);
assert.equal(result.source.candidateKey,'aidrop70');
assert.deepEqual(result.source.sourceDrop,[7209,1]);
assert.throws(()=>analyze({Rnds:{Sds:{}}}),/aidrop70/);
const mixed=analyze(fixture,{limit:400,schedule:[NPC.bandit,NPC.wolf,...Array(398).fill(NPC.mask)]});
assert.equal(mixed.mode,'explicit-interleaving');
assert.equal(draw(12345,100).value,draw(12345,100).seed%100+1);
assert(!JSON.stringify(result).includes('12345'),'no raw seed in emitted model output');
console.log('PASS: 7209 conditional source model, missing-seed guard, 100-wide RNG and mixed 70-level candidates');
