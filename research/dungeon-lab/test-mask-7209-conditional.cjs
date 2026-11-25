#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {draw,analyze,NPC,LEVEL70_SOURCE,analyzeAlternativeBranches}=require('./mask-7209-conditional.cjs');
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
const mixed=analyze(fixture,{limit:400,schedule:[NPC.bandit,NPC.mask,...Array(398).fill(NPC.mask)]});
assert.equal(mixed.mode,'explicit-interleaving');
assert.equal(draw(12345,100).value,draw(12345,100).seed%100+1);
assert(!JSON.stringify(result).includes('12345'),'no raw seed in emitted model output');
assert.equal(LEVEL70_SOURCE.totalNpcRows,146);
assert.equal(LEVEL70_SOURCE.explicitDropRows,2);
assert.equal(LEVEL70_SOURCE.sameNameAlternateNpc.npc,35125);
assert.equal(LEVEL70_SOURCE.sameNameAlternateNpc.directDrop,false);
assert.deepEqual(LEVEL70_SOURCE.rows.map(row=>[row.npc,...row.drop]),
 [[30681,7209,1],[32950,3031,1]]);
assert(!Object.hasOwn(NPC,'wolf'),'unsupported non-source NPC must be excluded');
assert.throws(()=>analyze(fixture,{limit:1,schedule:[34461]}),
 /source|supported|candidate/i);
const seq=[NPC.mask,NPC.bandit,NPC.mask,NPC.mask];
const alt=analyzeAlternativeBranches(fixture,{sequence:seq});
assert.deepEqual(alt.states.map(x=>x.drawCount),[0,4,8]);
assert.deepEqual(alt.states[0].candidateBattles,[]);
assert(alt.states.every(x=>x.candidateBattles.every(i=>[1,3,4].includes(i))));
assert.equal(alt.nativeProven,false);
assert.throws(()=>analyzeAlternativeBranches(fixture,{sequence:[34461]}),/source-confirmed/);
assert.throws(()=>analyzeAlternativeBranches({Rnds:{Sds:{}}},{sequence:seq}),/aidrop70/);
console.log('PASS: 7209 conditional source model, missing-seed guard, 100-wide RNG and mixed 70-level candidates');
